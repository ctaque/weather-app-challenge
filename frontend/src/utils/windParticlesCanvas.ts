/**
 * Canvas-based wind particle system with alpha decay trails
 * Inspired by efficient 2D particle rendering techniques
 */

export interface WindDataPoint {
  lat: number;
  lon: number;
  u: number; // East-west wind component (m/s)
  v: number; // North-south wind component (m/s)
  speed: number;
}

interface Particle {
  lng: number;
  lat: number;
  x: number; // screen pixel x
  y: number; // screen pixel y
  age: number;
  maxAge: number;
  visible: boolean;
}

interface MapProjection {
  project: (lngLat: [number, number]) => [number, number];
  unproject: (xy: [number, number]) => [number, number];
}

const MAX_AGE = 1200; // milliseconds
const PARTICLES_DENSITY = 16; // Particles per degree² (visible area) - reduced to 1/5
const MAX_PARTICLES = 6000; // Maximum total particles to prevent performance issues - reduced to 1/5
const MIN_PARTICLES = 200; // Minimum particles even at world zoom - reduced to 1/5
const ALPHA_DECAY = 0.98; // How quickly trails fade (higher = longer trails) - 2x longer trails
const TRAVEL_SPEED = 0.00008; // Speed multiplier for particle movement
const FPS = 60;

export class WindParticlesCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private windData: WindDataPoint[] = [];
  private bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  private rafId?: number;
  private lastTime = 0;
  private mapProjection?: MapProjection;
  private gridResolution = 0.5;
  private currentParticleCount = MAX_PARTICLES;
  private visibleBounds?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };

  constructor(
    canvas: HTMLCanvasElement,
    windData: WindDataPoint[],
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.windData = windData;
    this.bounds = bounds;
  }

  /**
   * Set the map projection for converting between lng/lat and screen pixels
   */
  setProjection(projection: MapProjection) {
    this.mapProjection = projection;
  }

  /**
   * Update visible bounds and recalculate optimal particle count
   */
  updateVisibleBounds(bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  }) {
    this.visibleBounds = bounds;
    this.updateParticleCount();
  }

  /**
   * Calculate optimal particle count based on visible area
   */
  private calculateOptimalParticleCount(): number {
    if (!this.visibleBounds) {
      return MAX_PARTICLES;
    }

    // Calculate visible area in degrees²
    const latRange = this.visibleBounds.maxLat - this.visibleBounds.minLat;
    const lonRange = this.visibleBounds.maxLon - this.visibleBounds.minLon;
    const visibleArea = latRange * lonRange;

    // Calculate particles needed for constant density
    const optimalCount = Math.round(visibleArea * PARTICLES_DENSITY);

    // Clamp between min and max
    return Math.max(MIN_PARTICLES, Math.min(MAX_PARTICLES, optimalCount));
  }

  /**
   * Update particle count based on visible area
   */
  private updateParticleCount() {
    const newCount = this.calculateOptimalParticleCount();

    if (newCount === this.currentParticleCount) {
      return; // No change needed
    }

    this.currentParticleCount = newCount;

    // Add or remove particles as needed
    if (this.particles.length < newCount) {
      // Add particles
      const toAdd = newCount - this.particles.length;
      for (let i = 0; i < toAdd; i++) {
        const particle = this.createParticle();
        if (particle) {
          this.particles.push(particle);
        }
      }
    } else if (this.particles.length > newCount) {
      // Remove excess particles (keep the most recent ones)
      this.particles = this.particles.slice(0, newCount);
    }

    console.log(`Adjusted particle count to ${this.currentParticleCount} (visible area: ${this.visibleBounds ? (this.visibleBounds.maxLat - this.visibleBounds.minLat) * (this.visibleBounds.maxLon - this.visibleBounds.minLon) : 'unknown'}°²)`);
  }

  /**
   * Initialize particles at random visible positions
   */
  private initializeParticles() {
    this.particles = [];

    // Use dynamic particle count
    const particleCount = this.calculateOptimalParticleCount();
    this.currentParticleCount = particleCount;

    for (let i = 0; i < particleCount; i++) {
      const particle = this.createParticle();
      if (particle) {
        this.particles.push(particle);
      }
    }
  }

  /**
   * Create a new particle at a random position within bounds
   */
  private createParticle(): Particle | null {
    const lng = this.bounds.minLon + Math.random() * (this.bounds.maxLon - this.bounds.minLon);
    const lat = this.bounds.minLat + Math.random() * (this.bounds.maxLat - this.bounds.minLat);

    if (!this.mapProjection) return null;

    const [x, y] = this.mapProjection.project([lng, lat]);

    return {
      lng,
      lat,
      x,
      y,
      age: MAX_AGE * Math.random(),
      maxAge: MAX_AGE,
      visible: this.isInBounds(x, y)
    };
  }

  /**
   * Check if screen position is within canvas bounds
   */
  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.canvas.width && y >= 0 && y < this.canvas.height;
  }

  /**
   * Interpolate wind at a given position
   */
  private interpolateWind(lng: number, lat: number): { u: number; v: number } | null {
    let closestPoint: WindDataPoint | null = null;
    let minDistance = Infinity;

    for (const point of this.windData) {
      const distance = Math.sqrt(
        Math.pow(point.lat - lat, 2) + Math.pow(point.lon - lng, 2)
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
      v: closestPoint.v
    };
  }

  /**
   * Move a particle based on wind data
   */
  private moveParticle(particle: Particle, delta: number) {
    particle.age += delta;

    // Respawn if too old
    if (particle.age > particle.maxAge) {
      const newParticle = this.createParticle();
      if (newParticle) {
        Object.assign(particle, newParticle);
        particle.age = (MAX_AGE * Math.random()) / 4;
      } else {
        particle.visible = false;
      }
      return;
    }

    if (!particle.visible || !this.mapProjection) return;

    // Get wind at current position
    const wind = this.interpolateWind(particle.lng, particle.lat);
    if (!wind) {
      particle.visible = false;
      return;
    }

    const { u, v } = wind;

    // Convert wind speed (m/s) to degrees per millisecond
    // At equator: 1 degree ≈ 111km
    // This is a simplification; more accurate would account for latitude
    const lngDelta = (u * delta * TRAVEL_SPEED);
    const latDelta = (v * delta * TRAVEL_SPEED);

    // Update geographic position
    particle.lng += lngDelta;
    particle.lat += latDelta;

    // Wrap longitude
    if (particle.lng > 180) particle.lng -= 360;
    if (particle.lng < -180) particle.lng += 360;

    // Check latitude bounds
    if (particle.lat < this.bounds.minLat || particle.lat > this.bounds.maxLat ||
        particle.lng < this.bounds.minLon || particle.lng > this.bounds.maxLon) {
      particle.visible = false;
      return;
    }

    // Project to screen
    const [newX, newY] = this.mapProjection.project([particle.lng, particle.lat]);

    if (!this.isInBounds(newX, newY)) {
      particle.visible = false;
      return;
    }

    // Draw line from old to new position
    const speed = Math.sqrt(u * u + v * v);

    // Color based on speed
    let color: string;
    if (speed < 5) color = 'rgba(50, 136, 189, 0.8)'; // Blue
    else if (speed < 10) color = 'rgba(102, 194, 165, 0.8)'; // Teal
    else if (speed < 15) color = 'rgba(254, 224, 139, 0.8)'; // Yellow
    else if (speed < 20) color = 'rgba(244, 109, 67, 0.8)'; // Orange
    else color = 'rgba(213, 62, 79, 0.8)'; // Red

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1.5 + (speed / 10); // Line width based on speed

    this.ctx.beginPath();
    this.ctx.moveTo(particle.x, particle.y);
    this.ctx.lineTo(newX, newY);
    this.ctx.stroke();

    // Update screen position
    particle.x = newX;
    particle.y = newY;
  }

  /**
   * Animation loop
   */
  private animate = (timestamp: number) => {
    if (!this.mapProjection) {
      this.rafId = requestAnimationFrame(this.animate);
      return;
    }

    const delta = this.lastTime ? timestamp - this.lastTime : 1000 / FPS;

    if (delta >= 1000 / FPS) {
      // Move all visible particles
      this.particles.forEach(p => this.moveParticle(p, delta));

      // Apply fade effect to create trails
      this.ctx.globalAlpha = ALPHA_DECAY;
      this.ctx.globalCompositeOperation = 'copy';
      this.ctx.drawImage(this.canvas, 0, 0);
      this.ctx.globalAlpha = 1.0;
      this.ctx.globalCompositeOperation = 'source-over';

      this.lastTime = timestamp;
    }

    this.rafId = requestAnimationFrame(this.animate);
  };

  /**
   * Start the animation
   */
  start() {
    if (this.rafId) return; // Already running

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Initialize particles
    this.initializeParticles();

    // Start animation loop
    this.lastTime = 0;
    this.rafId = requestAnimationFrame(this.animate);
  }

  /**
   * Stop the animation
   */
  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.stop();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = [];
  }

  /**
   * Update canvas size
   */
  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Update projection (called when map moves/zooms)
   */
  updateProjection(projection: MapProjection, visibleBounds?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  }) {
    this.mapProjection = projection;

    // Update visible bounds if provided
    if (visibleBounds) {
      this.updateVisibleBounds(visibleBounds);
    }

    // Reproject all particles to new screen positions
    this.particles.forEach(p => {
      if (!this.mapProjection) return;
      const [x, y] = this.mapProjection.project([p.lng, p.lat]);
      p.x = x;
      p.y = y;
      p.visible = this.isInBounds(x, y);
    });
  }
}
