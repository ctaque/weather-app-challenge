/**
 * Canvas-based precipitation heatmap
 * Shows precipitation rate with color gradients
 */

export interface PrecipitationDataPoint {
  lat: number;
  lon: number;
  rate: number; // mm/h
}

interface MapProjection {
  project: (lngLat: [number, number]) => [number, number];
  unproject: (xy: [number, number]) => [number, number];
}

export class PrecipitationHeatmapCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private precipData: PrecipitationDataPoint[] = [];
  private filteredPrecipData: PrecipitationDataPoint[] = [];
  private bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  private mapProjection?: MapProjection;
  private opacity: number = 0.7;
  private isMoving: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    precipData: PrecipitationDataPoint[],
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
    opacity: number = 0.7
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.precipData = precipData;
    this.bounds = bounds;
    this.opacity = opacity;
  }

  setProjection(projection: MapProjection) {
    this.mapProjection = projection;
  }

  /**
   * Get color for precipitation rate (mm/h)
   * Gradient: transparent (0) -> light blue -> blue -> dark blue -> purple -> red (heavy)
   */
  private getColorForRate(rate: number): string {
    // No precipitation - fully transparent
    if (rate < 0.1) return `rgba(0, 0, 0, 0)`;

    // Very light precipitation (0.1-0.5 mm/h) - Very light blue, semi-transparent
    if (rate < 0.5) return `rgba(173, 216, 230, ${this.opacity * 0.3})`; // Light blue

    // Light precipitation (0.5-1 mm/h) - Light blue
    if (rate < 1) return `rgba(135, 206, 250, ${this.opacity * 0.5})`; // Sky blue

    // Moderate precipitation (1-2.5 mm/h) - Blue
    if (rate < 2.5) return `rgba(70, 130, 180, ${this.opacity * 0.6})`; // Steel blue

    // Moderate-heavy precipitation (2.5-5 mm/h) - Dark blue
    if (rate < 5) return `rgba(30, 144, 255, ${this.opacity * 0.7})`; // Dodger blue

    // Heavy precipitation (5-10 mm/h) - Blue-purple
    if (rate < 10) return `rgba(75, 0, 130, ${this.opacity * 0.8})`; // Indigo

    // Very heavy precipitation (10-20 mm/h) - Purple
    if (rate < 20) return `rgba(138, 43, 226, ${this.opacity * 0.85})`; // Blue-violet

    // Intense precipitation (20-40 mm/h) - Red-purple
    if (rate < 40) return `rgba(199, 21, 133, ${this.opacity * 0.9})`; // Medium violet red

    // Extreme precipitation (40+ mm/h) - Red
    return `rgba(220, 20, 60, ${this.opacity * 0.95})`; // Crimson
  }

  /**
   * Filter precipitation data to only include points near the visible bounds
   */
  private filterDataByBounds() {
    // Add margin for interpolation (degrees)
    const margin = 5;

    this.filteredPrecipData = this.precipData.filter(point =>
      point.lat >= this.bounds.minLat - margin &&
      point.lat <= this.bounds.maxLat + margin &&
      point.lon >= this.bounds.minLon - margin &&
      point.lon <= this.bounds.maxLon + margin
    );

    console.log(`Filtered precipitation data: ${this.filteredPrecipData.length} points (from ${this.precipData.length})`);
  }

  /**
   * Interpolate precipitation rate at a position using inverse distance weighting
   */
  private interpolateRate(lng: number, lat: number): number {
    const maxDistance = 1.5; // Reduced for better performance
    let totalWeight = 0;
    let weightedRate = 0;

    // Use filtered data instead of all data
    for (const point of this.filteredPrecipData) {
      const distance = Math.sqrt(
        Math.pow(point.lat - lat, 2) + Math.pow(point.lon - lng, 2)
      );

      if (distance > maxDistance) continue;

      // Inverse distance weighting (avoid division by zero)
      const weight = distance < 0.001 ? 1000 : 1 / (distance * distance);
      totalWeight += weight;
      weightedRate += point.rate * weight;
    }

    if (totalWeight === 0) return 0;
    return weightedRate / totalWeight;
  }

  /**
   * Draw the precipitation heatmap
   */
  draw() {
    if (!this.mapProjection) return;

    // Filter data by visible bounds first
    this.filterDataByBounds();

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid resolution: larger during movement for better performance
    const gridSize = this.isMoving ? 40 : 25;

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

        // Get interpolated precipitation rate
        const rate = this.interpolateRate(lng, lat);

        // Skip if no precipitation
        if (rate < 0.1) continue;

        // Get color for this rate
        const color = this.getColorForRate(rate);

        // Draw rectangle on temp canvas
        tempCtx.fillStyle = color;
        tempCtx.fillRect(screenX, screenY, gridSize, gridSize);
      }
    }

    // Apply blur for smooth gradient effect (skip during movement)
    if (!this.isMoving) {
      this.ctx.filter = 'blur(15px)';
    }
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

  /**
   * Update bounds (e.g., when map viewport changes)
   */
  updateBounds(bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }) {
    this.bounds = bounds;
  }

  /**
   * Set moving state (for performance optimization during pan/zoom)
   */
  setMoving(moving: boolean) {
    this.isMoving = moving;
  }
}
