/**
 * WebGL-based wind particles layer using deck.gl custom layer
 */
import { Layer, project32, picking } from '@deck.gl/core';
import { Model, Geometry } from '@luma.gl/engine';
import { Buffer } from '@luma.gl/core';
import type { WindDataPoint } from './windParticles';

const vs = `\
#version 300 es
#define SHADER_NAME wind-particle-layer-vertex-shader

in vec3 positions;
in vec3 instancePositions;
in vec4 instanceColors;
in float instanceAges;
in float instanceSpeeds;
in float instanceTrailProgress;

uniform float time;
uniform float opacity;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;

out vec4 vColor;
out float vTrailProgress;

void main(void) {
  // Progressive fade along trail: 0 = tail (old), 1 = head (new)
  float fadeFactor = pow(instanceTrailProgress, 1.2);

  // Width based on trail progress and speed
  float speedFactor = min(instanceSpeeds / 20.0, 1.0);
  float baseWidth = 1.5 + instanceTrailProgress * 4.0 + speedFactor * 3.0;

  // Apply width to vertex offset
  vec3 offset = positions * baseWidth * 0.001; // Scale factor for map coordinates

  // Final position
  vec3 worldPos = instancePositions + offset;

  // Apply camera projection
  vec4 position_commonspace;
  position_commonspace = vec4(worldPos, 1.0);
  gl_Position = projectionMatrix * viewMatrix * position_commonspace;

  // Color with fade
  vColor = instanceColors;
  vColor.a *= fadeFactor * opacity;
  vTrailProgress = instanceTrailProgress;

  // Smooth size with distance
  gl_PointSize = 2.0 + speedFactor * 3.0;
}
`;

const fs = `\
#version 300 es
#define SHADER_NAME wind-particle-layer-fragment-shader
precision highp float;

in vec4 vColor;
in float vTrailProgress;

out vec4 fragColor;

void main(void) {
  // Circular particle with soft edges
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  float r = dot(cxy, cxy);

  if (r > 1.0) {
    discard;
  }

  // Soft glow
  float alpha = vColor.a * (1.0 - sqrt(r));

  // Brighten towards head
  float brighten = 1.0 + vTrailProgress * 0.3;

  fragColor = vec4(vColor.rgb * brighten, alpha);
}
`;

interface WindParticlesWebGLLayerProps {
  id: string;
  data: WindDataPoint[];
  particleCount?: number;
  trailLength?: number;
  opacity?: number;
}

export class WindParticlesWebGLLayer extends Layer<WindParticlesWebGLLayerProps> {
  static layerName = 'WindParticlesWebGLLayer';

  state!: {
    model?: Model;
    particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      age: number;
      maxAge: number;
      speed: number;
      color: [number, number, number, number];
      trail: Array<[number, number]>;
    }>;
    windData: WindDataPoint[];
    time: number;
  };

  getShaders() {
    return { vs, fs, modules: [project32, picking] };
  }

  initializeState() {
    const { particleCount = 8000, trailLength = 1500, data } = this.props;

    // Initialize particles
    const particles = [];
    const bounds = this.getDataBounds(data);

    for (let i = 0; i < particleCount; i++) {
      particles.push(this.createParticle(bounds));
    }

    this.setState({
      particles,
      windData: data,
      time: 0
    });

    // Create geometry for particle quads
    const geometry = new Geometry({
      topology: 'triangle-strip',
      attributes: {
        positions: new Float32Array([
          -1, -1, 0,
          1, -1, 0,
          -1, 1, 0,
          1, 1, 0
        ])
      }
    });

    this.setState({
      model: new Model(this.context.device, {
        ...this.getShaders(),
        geometry,
        isInstanced: true,
      })
    });
  }

  private getDataBounds(data: WindDataPoint[]) {
    const lats = data.map(d => d.lat);
    const lons = data.map(d => d.lon);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons)
    };
  }

  private createParticle(bounds: any) {
    const x = bounds.minLon + Math.random() * (bounds.maxLon - bounds.minLon);
    const y = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);

    return {
      x,
      y,
      vx: 0,
      vy: 0,
      age: 0,
      maxAge: 2000 + Math.random() * 2000,
      speed: 0,
      color: [50, 136, 189, 255] as [number, number, number, number],
      trail: [[x, y]] as Array<[number, number]>
    };
  }

  updateState({ props, oldProps, changeFlags }: any) {
    super.updateState({ props, oldProps, changeFlags });

    // Update particles
    if (changeFlags.dataChanged || !this.state.time) {
      this.updateParticles();
    }
  }

  private updateParticles() {
    const { particles, windData, time } = this.state;
    const { trailLength = 1500 } = this.props;
    const bounds = this.getDataBounds(windData);

    // Update each particle
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

      // Get wind at current position
      const wind = this.interpolateWind(particle.x, particle.y, windData);

      if (!wind) {
        Object.assign(particle, this.createParticle(bounds));
        continue;
      }

      // Update velocity and position
      const speedMultiplier = 0.001;
      const turbulence = Math.sin(time * 0.05 + particle.x * 10) * 0.00005;

      particle.vx = wind.u * speedMultiplier + turbulence;
      particle.vy = wind.v * speedMultiplier - turbulence * 0.5;

      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.speed = wind.speed;

      // Update color based on speed
      if (wind.speed < 5) particle.color = [50, 136, 189, 255];
      else if (wind.speed < 10) particle.color = [102, 194, 165, 255];
      else if (wind.speed < 15) particle.color = [254, 224, 139, 255];
      else if (wind.speed < 20) particle.color = [244, 109, 67, 255];
      else particle.color = [213, 62, 79, 255];

      // Add to trail
      particle.trail.push([particle.x, particle.y]);

      if (particle.trail.length > trailLength) {
        particle.trail.shift();
      }
    }

    this.setState({ time: time + 1 });

    // Prepare instance data for GPU
    this.updateInstanceData();

    // Request next frame
    this.setNeedsRedraw();
  }

  private updateInstanceData() {
    const { particles } = this.state;
    const { model } = this.state;

    if (!model) return;

    // Flatten all trail points with attributes
    const instanceData: {
      positions: number[];
      colors: number[];
      ages: number[];
      speeds: number[];
      trailProgress: number[];
    } = {
      positions: [],
      colors: [],
      ages: [],
      speeds: [],
      trailProgress: []
    };

    for (const particle of particles) {
      const trailLen = particle.trail.length;

      for (let i = 0; i < trailLen; i++) {
        const [x, y] = particle.trail[i];
        const progress = i / Math.max(trailLen - 1, 1); // 0 at tail, 1 at head

        instanceData.positions.push(x, y, 0);
        instanceData.colors.push(...particle.color.map(c => c / 255));
        instanceData.ages.push(particle.age / particle.maxAge);
        instanceData.speeds.push(particle.speed);
        instanceData.trailProgress.push(progress);
      }
    }

    // Update GPU buffers
    const instanceCount = instanceData.positions.length / 3;

    model.setInstanceCount(instanceCount);
    model.setAttributes({
      instancePositions: new Float32Array(instanceData.positions),
      instanceColors: new Float32Array(instanceData.colors),
      instanceAges: new Float32Array(instanceData.ages),
      instanceSpeeds: new Float32Array(instanceData.speeds),
      instanceTrailProgress: new Float32Array(instanceData.trailProgress)
    });
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

    return {
      u: closestPoint.u,
      v: closestPoint.v,
      speed: closestPoint.speed
    };
  }

  draw({ uniforms }: any) {
    const { model, time } = this.state;
    const { opacity = 1 } = this.props;

    if (!model) return;

    model.setUniforms({
      ...uniforms,
      time: time * 0.016,
      opacity
    });

    model.draw(this.context.renderPass);
  }
}
