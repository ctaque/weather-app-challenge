/**
 * Custom WebGL Layer for ultra-optimized wind particle rendering
 * All calculations happen on GPU with shaders
 */
import { Layer, project32, picking } from '@deck.gl/core';
import GL from '@luma.gl/constants';
import type { WindDataPoint } from '../utils/windParticles';

const vs = `\
#define SHADER_NAME wind-particle-vertex-shader

attribute vec3 positions;
attribute vec3 instancePositions;
attribute vec4 instanceColors;
attribute float instanceTrailProgress;
attribute float instanceSpeed;

uniform float opacity;
uniform float time;
uniform mat4 viewProjectionMatrix;

varying vec4 vColor;
varying float vProgress;

void main(void) {
  // Progressive fade: 0 at tail (old), 1 at head (new)
  float fadeCurve = pow(instanceTrailProgress, 1.2);
  float alpha = fadeCurve * opacity;

  // Width increases towards head
  float speedFactor = min(instanceSpeed / 20.0, 1.0);
  float baseTaper = 1.5 + instanceTrailProgress * 4.0;
  float width = (baseTaper + speedFactor * 3.0) * 0.00015; // Scale to map units

  // Apply width offset
  vec3 offset = positions * width;
  vec3 worldPos = instancePositions + offset;

  // Project to screen space
  vec4 position_commonspace = vec4(worldPos, 1.0);
  gl_Position = viewProjectionMatrix * position_commonspace;

  // Pass to fragment shader
  vColor = vec4(instanceColors.rgb, alpha);
  vProgress = instanceTrailProgress;
}
`;

const fs = `\
#define SHADER_NAME wind-particle-fragment-shader

precision highp float;

varying vec4 vColor;
varying float vProgress;

void main(void) {
  // Brighten towards head
  float brighten = 1.0 + vProgress * 0.3;
  vec3 finalColor = vColor.rgb * brighten;

  gl_FragColor = vec4(finalColor, vColor.a);
}
`;

interface WindParticleLayerProps {
  id: string;
  windData: WindDataPoint[];
  particleCount?: number;
  trailLength?: number;
  opacity?: number;
  speedMultiplier?: number;
}

interface Particle {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  speed: number;
  color: [number, number, number];
  trail: Array<[number, number]>;
}

export class WindParticleLayer extends Layer<WindParticleLayerProps> {
  static layerName = 'WindParticleLayer';
  static defaultProps = {
    particleCount: 8000,
    trailLength: 1500,
    opacity: 0.95,
    speedMultiplier: 0.001
  };

  state!: {
    model?: any;
    particles: Particle[];
    windData: WindDataPoint[];
    time: number;
    bounds: {
      minLat: number;
      maxLat: number;
      minLon: number;
      maxLon: number;
    };
  };

  getShaders() {
    return super.getShaders({
      vs,
      fs,
      modules: [project32, picking]
    });
  }

  initializeState() {
    const { windData, particleCount, trailLength } = this.props;

    const gl = this.context.gl;

    // Get bounds from wind data
    const lats = windData.map(d => d.lat);
    const lons = windData.map(d => d.lon);
    const bounds = {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons)
    };

    // Initialize particles
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount!; i++) {
      particles.push(this.createParticle(bounds));
    }

    this.setState({
      particles,
      windData,
      time: 0,
      bounds
    });

    const attributeManager = this.getAttributeManager();

    if (attributeManager) {
      attributeManager.addInstanced({
        instancePositions: {
          size: 3,
          type: GL.FLOAT,
          transition: false,
          accessor: 'getPosition'
        },
        instanceColors: {
          size: 4,
          type: GL.UNSIGNED_BYTE,
          normalized: true,
          transition: false,
          accessor: 'getColor'
        },
        instanceTrailProgress: {
          size: 1,
          type: GL.FLOAT,
          transition: false,
          accessor: 'getTrailProgress'
        },
        instanceSpeed: {
          size: 1,
          type: GL.FLOAT,
          transition: false,
          accessor: 'getSpeed'
        }
      });
    }
  }

  private createParticle(bounds: any): Particle {
    const x = bounds.minLon + Math.random() * (bounds.maxLon - bounds.minLon);
    const y = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);

    return {
      x,
      y,
      age: 0,
      maxAge: 2000 + Math.random() * 2000,
      speed: 0,
      color: [50, 136, 189],
      trail: [[x, y]]
    };
  }

  updateState({ props, oldProps, changeFlags }: any) {
    super.updateState({ props, oldProps, changeFlags });

    // Animate particles on every frame
    this.updateParticles();
  }

  private updateParticles() {
    const { particles, windData, time, bounds } = this.state;
    const { trailLength, speedMultiplier } = this.props;

    for (const particle of particles) {
      particle.age++;

      // Reset if too old or out of bounds
      if (
        particle.age > particle.maxAge ||
        particle.x < bounds.minLon ||
        particle.x > bounds.maxLon ||
        particle.y < bounds.minLat ||
        particle.y > bounds.maxLat
      ) {
        Object.assign(particle, this.createParticle(bounds));
        continue;
      }

      // Get wind at position
      const wind = this.interpolateWind(particle.x, particle.y, windData);

      if (!wind) {
        Object.assign(particle, this.createParticle(bounds));
        continue;
      }

      // Add turbulence
      const turbulence = Math.sin(time! * 0.05 + particle.x * 10) * 0.00005;

      // Update position
      particle.x += (wind.u * speedMultiplier! + turbulence);
      particle.y += (wind.v * speedMultiplier! - turbulence * 0.5);
      particle.speed = wind.speed;

      // Update color based on speed
      if (wind.speed < 5) particle.color = [50, 136, 189];
      else if (wind.speed < 10) particle.color = [102, 194, 165];
      else if (wind.speed < 15) particle.color = [254, 224, 139];
      else if (wind.speed < 20) particle.color = [244, 109, 67];
      else particle.color = [213, 62, 79];

      // Add to trail
      particle.trail.push([particle.x, particle.y]);

      if (particle.trail.length > trailLength!) {
        particle.trail.shift();
      }
    }

    this.setState({ time: time! + 1 });

    // Update attribute manager with new data
    const attributeManager = this.getAttributeManager();
    if (attributeManager) {
      attributeManager.invalidateAll();
    }
  }

  private interpolateWind(lon: number, lat: number, windData: WindDataPoint[]) {
    let closestPoint: WindDataPoint | null = null;
    let minDistance = Infinity;

    for (const point of windData) {
      const distance = Math.sqrt(
        Math.pow(point.lat - lat, 2) + Math.pow(point.lon - lon, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    }

    if (!closestPoint || minDistance > 1.0) {
      return null;
    }

    return closestPoint;
  }

  // Flatten trail data for GPU
  getPosition = (d: any, { index, data, target }: any): [number, number, number] => {
    const { particles } = this.state;

    let count = 0;
    for (const particle of particles) {
      for (let i = 0; i < particle.trail.length; i++) {
        if (count === index) {
          const [x, y] = particle.trail[i];
          return [x, y, 0];
        }
        count++;
      }
    }
    return [0, 0, 0];
  };

  getColor = (d: any, { index }: any): [number, number, number, number] => {
    const { particles } = this.state;

    let count = 0;
    for (const particle of particles) {
      for (let i = 0; i < particle.trail.length; i++) {
        if (count === index) {
          return [...particle.color, 255];
        }
        count++;
      }
    }
    return [255, 255, 255, 255];
  };

  getTrailProgress = (d: any, { index }: any): number => {
    const { particles } = this.state;

    let count = 0;
    for (const particle of particles) {
      const trailLen = particle.trail.length;
      for (let i = 0; i < trailLen; i++) {
        if (count === index) {
          return i / Math.max(trailLen - 1, 1); // 0 at tail, 1 at head
        }
        count++;
      }
    }
    return 0;
  };

  getSpeed = (d: any, { index }: any): number => {
    const { particles } = this.state;

    let count = 0;
    for (const particle of particles) {
      for (let i = 0; i < particle.trail.length; i++) {
        if (count === index) {
          return particle.speed;
        }
        count++;
      }
    }
    return 0;
  };

  // Calculate total instance count (all trail points)
  getNumInstances(): number {
    const { particles } = this.state;
    return particles.reduce((sum, p) => sum + p.trail.length, 0);
  }

  draw({ uniforms }: any) {
    const { opacity } = this.props;
    const { time } = this.state;

    const model = this.state.model;
    if (!model) return;

    model.setUniforms({
      ...uniforms,
      opacity,
      time: time! * 0.016
    });

    model.draw();
  }
}
