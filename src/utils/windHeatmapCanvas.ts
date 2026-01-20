/**
 * Canvas-based wind speed heatmap
 * Shows wind intensity with color gradients
 */

export interface WindDataPoint {
  lat: number;
  lon: number;
  u: number;
  v: number;
  speed: number;
}

interface MapProjection {
  project: (lngLat: [number, number]) => [number, number];
  unproject: (xy: [number, number]) => [number, number];
}

export class WindHeatmapCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private windData: WindDataPoint[] = [];
  private bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  private mapProjection?: MapProjection;
  private opacity: number = 0.6;

  constructor(
    canvas: HTMLCanvasElement,
    windData: WindDataPoint[],
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
    opacity: number = 0.6
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.windData = windData;
    this.bounds = bounds;
    this.opacity = opacity;
  }

  setProjection(projection: MapProjection) {
    this.mapProjection = projection;
  }

  /**
   * Get color for wind speed (m/s)
   */
  private getColorForSpeed(speed: number): string {
    // Speed ranges and colors
    if (speed < 2) return `rgba(50, 136, 189, ${this.opacity})`; // Bleu foncé (très calme)
    if (speed < 5) return `rgba(102, 194, 165, ${this.opacity})`; // Turquoise (calme)
    if (speed < 8) return `rgba(171, 221, 164, ${this.opacity})`; // Vert clair (léger)
    if (speed < 11) return `rgba(230, 245, 152, ${this.opacity})`; // Jaune-vert (modéré)
    if (speed < 14) return `rgba(254, 224, 139, ${this.opacity})`; // Jaune (assez fort)
    if (speed < 17) return `rgba(253, 174, 97, ${this.opacity})`; // Orange clair (fort)
    if (speed < 20) return `rgba(244, 109, 67, ${this.opacity})`; // Orange (très fort)
    if (speed < 24) return `rgba(215, 48, 39, ${this.opacity})`; // Rouge (violent)
    return `rgba(165, 0, 38, ${this.opacity})`; // Rouge foncé (extrême)
  }

  /**
   * Interpolate wind speed at a position using inverse distance weighting
   */
  private interpolateSpeed(lng: number, lat: number): number {
    const maxDistance = 2.0; // Maximum distance to search (degrees)
    let totalWeight = 0;
    let weightedSpeed = 0;

    for (const point of this.windData) {
      const distance = Math.sqrt(
        Math.pow(point.lat - lat, 2) + Math.pow(point.lon - lng, 2)
      );

      if (distance > maxDistance) continue;

      // Inverse distance weighting (avoid division by zero)
      const weight = distance < 0.001 ? 1000 : 1 / (distance * distance);
      totalWeight += weight;
      weightedSpeed += point.speed * weight;
    }

    if (totalWeight === 0) return 0;
    return weightedSpeed / totalWeight;
  }

  /**
   * Draw the heatmap
   */
  draw() {
    if (!this.mapProjection) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid resolution for drawing (pixels between sample points)
    const gridSize = 25;

    // Create temporary canvas for better performance
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Draw grid of colored rectangles
    for (let screenX = 0; screenX < this.canvas.width; screenX += gridSize) {
      for (let screenY = 0; screenY < this.canvas.height; screenY += gridSize) {
        // Unproject screen coordinates to lng/lat
        const [lng, lat] = this.mapProjection.unproject([screenX, screenY]);

        // Check if point is within bounds
        if (
          lat < this.bounds.minLat ||
          lat > this.bounds.maxLat ||
          lng < this.bounds.minLon ||
          lng > this.bounds.maxLon
        ) {
          continue;
        }

        // Get interpolated wind speed
        const speed = this.interpolateSpeed(lng, lat);

        // Get color for this speed
        const color = this.getColorForSpeed(speed);

        // Draw rectangle on temp canvas
        tempCtx.fillStyle = color;
        tempCtx.fillRect(screenX, screenY, gridSize, gridSize);
      }
    }

    // Apply blur for smooth gradient effect
    this.ctx.filter = 'blur(15px)';
    this.ctx.drawImage(tempCanvas, 0, 0);
    this.ctx.filter = 'none';
  }

  /**
   * Redraw with new projection (when map moves)
   */
  redraw() {
    this.draw();
  }

  /**
   * Update canvas size
   */
  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Set opacity
   */
  setOpacity(opacity: number) {
    this.opacity = Math.max(0, Math.min(1, opacity));
  }
}
