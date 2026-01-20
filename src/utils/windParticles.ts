/**
 * Wind particles simulation for animated wind visualization
 */

export interface WindDataPoint {
  lat: number;
  lon: number;
  u: number; // East-west wind component (m/s)
  v: number; // North-south wind component (m/s)
  speed: number;
}

export interface Particle {
  x: number; // longitude
  y: number; // latitude
  age: number;
  maxAge: number;
  path: [number, number][]; // Trail positions [lon, lat]
  pathAges: number[]; // Age of each trail segment for better fading
  pathPhases: number[]; // Independent phase for each trail point
  speed: number;
  color: [number, number, number]; // RGB base color
  phase: number; // For animation variations
}

export class WindParticleSystem {
  private particles: Particle[] = [];
  private windData: WindDataPoint[] = [];
  private bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  private gridResolution = 0.5; // degrees
  private trailLength = 5000; // Trainées très longues mais gérables par le GPU
  private frameCount = 0; // For global animations

  constructor(
    windData: WindDataPoint[],
    particleCount: number = 2000,
    bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
  ) {
    this.windData = windData;

    // Calculate bounds from data if not provided
    if (bounds) {
      this.bounds = bounds;
    } else {
      const lats = windData.map((d) => d.lat);
      const lons = windData.map((d) => d.lon);
      this.bounds = {
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLon: Math.min(...lons),
        maxLon: Math.max(...lons),
      };
    }

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      this.particles.push(this.createParticle());
    }
  }

  private createParticle(): Particle {
    const x = this.randomBetween(this.bounds.minLon, this.bounds.maxLon);
    const y = this.randomBetween(this.bounds.minLat, this.bounds.maxLat);
    const maxAge = this.randomBetween(2000, 4000); // Durée de vie MASSIVE pour les trainées géantes !

    // Random base color for variation
    const colorVariant = Math.random();
    let color: [number, number, number];
    if (colorVariant < 0.2) color = [50, 136, 189]; // Blue
    else if (colorVariant < 0.4) color = [102, 194, 165]; // Teal
    else if (colorVariant < 0.6) color = [254, 224, 139]; // Yellow
    else if (colorVariant < 0.8) color = [244, 109, 67]; // Orange
    else color = [213, 62, 79]; // Red

    return {
      x,
      y,
      age: 0,
      maxAge,
      path: [[x, y]],
      pathAges: [0],
      pathPhases: [Math.random() * Math.PI * 2], // Random phase for each point
      speed: 0,
      color,
      phase: Math.random() * Math.PI * 2, // Random starting phase
    };
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /**
   * Interpolate wind vector at given position using bilinear interpolation
   */
  private interpolateWind(lon: number, lat: number): { u: number; v: number; speed: number } | null {
    // Find nearest grid points
    const latIndex = Math.round((this.bounds.maxLat - lat) / this.gridResolution);
    const lonIndex = Math.round((lon - this.bounds.minLon) / this.gridResolution);

    // Find the closest wind data point
    let closestPoint: WindDataPoint | null = null;
    let minDistance = Infinity;

    for (const point of this.windData) {
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
      speed: closestPoint.speed,
    };
  }

  /**
   * Update particle positions based on wind data
   */
  public update(deltaTime: number = 0.016): void {
    // deltaTime in seconds (default 60fps = 0.016s)
    const speedMultiplier = 0.1; // 100× PLUS RAPIDE - ULTRA VITESSE !
    this.frameCount++;

    for (const particle of this.particles) {
      particle.age++;

      // Reset particle if too old or out of bounds
      if (
        particle.age > particle.maxAge ||
        particle.x < this.bounds.minLon ||
        particle.x > this.bounds.maxLon ||
        particle.y < this.bounds.minLat ||
        particle.y > this.bounds.maxLat
      ) {
        Object.assign(particle, this.createParticle());
        continue;
      }

      // Get wind at current position
      const wind = this.interpolateWind(particle.x, particle.y);

      if (!wind) {
        // No wind data here, reset particle
        Object.assign(particle, this.createParticle());
        continue;
      }

      // Update color based on current wind speed
      if (wind.speed < 5) particle.color = [50, 136, 189];
      else if (wind.speed < 10) particle.color = [102, 194, 165];
      else if (wind.speed < 15) particle.color = [254, 224, 139];
      else if (wind.speed < 20) particle.color = [244, 109, 67];
      else particle.color = [213, 62, 79];

      // Add subtle turbulence for organic movement
      const turbulence = Math.sin(this.frameCount * 0.05 + particle.phase) * 0.00005;

      // Update position based on wind
      const dx = (wind.u * speedMultiplier + turbulence) * deltaTime;
      const dy = (wind.v * speedMultiplier - turbulence * 0.5) * deltaTime;

      particle.x += dx;
      particle.y += dy;
      particle.speed = wind.speed;

      // Add to trail with independent phase
      particle.path.push([particle.x, particle.y]);
      particle.pathAges.push(particle.age);
      particle.pathPhases.push(Math.random() * Math.PI * 2); // Each point gets its own phase

      // Keep trail at fixed length
      if (particle.path.length > this.trailLength) {
        particle.path.shift();
        particle.pathAges.shift();
        particle.pathPhases.shift();
      }
    }
  }

  /**
   * Get current particle data for rendering
   */
  public getParticles(): Particle[] {
    return this.particles;
  }

  /**
   * Get trail data with segmented fade effect and independent timing per point
   * Optimized for GPU rendering
   */
  public getTrails(): Array<{
    path: [number, number][];
    speed: number;
    age: number;
    baseColor: [number, number, number];
    pathAges: number[];
    pathPhases: number[];
    segmentPosition: number; // 0 = tail (old), 1 = head (new)
  }> {
    const segmentedTrails: Array<any> = [];
    const segmentSize = 100; // Larger segments for better performance

    for (const p of this.particles) {
      if (p.path.length < 20) continue; // Skip very short trails

      // Divide the trail into segments for GPU batching
      const numSegments = Math.ceil(p.path.length / segmentSize);

      for (let i = 0; i < numSegments; i++) {
        const startIdx = i * segmentSize;
        const endIdx = Math.min(startIdx + segmentSize + 1, p.path.length); // +1 for overlap
        const segmentPath = p.path.slice(startIdx, endIdx);

        if (segmentPath.length < 2) continue;

        // Position in full trail: 0 at start (old), 1 at end (new)
        const segmentPosition = (startIdx + (endIdx - startIdx) / 2) / p.path.length;

        segmentedTrails.push({
          path: segmentPath,
          speed: p.speed,
          age: p.age / p.maxAge,
          baseColor: p.color,
          pathAges: p.pathAges.slice(startIdx, endIdx),
          pathPhases: p.pathPhases.slice(startIdx, endIdx),
          segmentPosition: segmentPosition,
        });
      }
    }

    return segmentedTrails;
  }

  /**
   * Get particle head positions for ScatterplotLayer (glow effect)
   */
  public getHeads(): Array<{
    position: [number, number];
    speed: number;
    color: number[];
  }> {
    return this.particles
      .filter(p => p.path.length > 0)
      .map((p) => {
        const speed = p.speed;
        let color: number[];

        if (speed < 5) color = [50, 136, 189, 255];
        else if (speed < 10) color = [102, 194, 165, 255];
        else if (speed < 15) color = [254, 224, 139, 255];
        else if (speed < 20) color = [244, 109, 67, 255];
        else color = [213, 62, 79, 255];

        return {
          position: [p.x, p.y],
          speed,
          color
        };
      });
  }

  /**
   * Get wind arrows - sampled particles with direction info
   */
  public getArrows(): Array<{
    position: [number, number];
    angle: number; // Direction in degrees
    speed: number;
    color: number[];
  }> {
    // Sample every Nth particle to avoid overcrowding
    const sampleRate = 3;

    return this.particles
      .filter((p, index) => index % sampleRate === 0 && p.path.length > 1)
      .map((p) => {
        const speed = p.speed;

        // Calculate wind direction from last two points in path
        const len = p.path.length;
        const [x1, y1] = p.path[len - 2];
        const [x2, y2] = p.path[len - 1];

        // Calculate angle in degrees (0° = East, 90° = North)
        const dx = x2 - x1;
        const dy = y2 - y1;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        // Color based on speed
        let color: number[];
        if (speed < 5) color = [50, 136, 189, 255];
        else if (speed < 10) color = [102, 194, 165, 255];
        else if (speed < 15) color = [254, 224, 139, 255];
        else if (speed < 20) color = [244, 109, 67, 255];
        else color = [213, 62, 79, 255];

        return {
          position: [p.x, p.y],
          angle,
          speed,
          color
        };
      });
  }
}
