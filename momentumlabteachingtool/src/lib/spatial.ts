/**
 * Quadtree implementation for spatial subdivision and efficient querying.
 */

export interface Point {
  x: number;
  y: number;
  id: string;
  color: string;
  size: number;
  type: 'particle' | 'node';
  metadata?: any;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Quadtree {
  points: Point[] = [];
  divided = false;
  northwest?: Quadtree;
  northeast?: Quadtree;
  southwest?: Quadtree;
  southeast?: Quadtree;

  constructor(public boundary: Rect, public capacity: number = 4) {}

  subdivide() {
    const { x, y, w, h } = this.boundary;
    const nw = { x: x, y: y, w: w / 2, h: h / 2 };
    const ne = { x: x + w / 2, y: y, w: w / 2, h: h / 2 };
    const sw = { x: x, y: y + h / 2, w: w / 2, h: h / 2 };
    const se = { x: x + w / 2, y: y + h / 2, w: w / 2, h: h / 2 };

    this.northwest = new Quadtree(nw, this.capacity);
    this.northeast = new Quadtree(ne, this.capacity);
    this.southwest = new Quadtree(sw, this.capacity);
    this.southeast = new Quadtree(se, this.capacity);
    this.divided = true;
  }

  insert(point: Point): boolean {
    if (!this.contains(this.boundary, point)) {
      return false;
    }

    if (this.points.length < this.capacity) {
      this.points.push(point);
      return true;
    }

    if (!this.divided) {
      this.subdivide();
    }

    return (
      this.northwest!.insert(point) ||
      this.northeast!.insert(point) ||
      this.southwest!.insert(point) ||
      this.southeast!.insert(point)
    );
  }

  contains(rect: Rect, point: Point): boolean {
    return (
      point.x >= rect.x &&
      point.x < rect.x + rect.w &&
      point.y >= rect.y &&
      point.y < rect.y + rect.h
    );
  }

  query(range: Rect, found: Point[] = []): Point[] {
    if (!this.intersects(this.boundary, range)) {
      return found;
    }

    for (const p of this.points) {
      if (this.contains(range, p)) {
        found.push(p);
      }
    }

    if (this.divided) {
      this.northwest!.query(range, found);
      this.northeast!.query(range, found);
      this.southwest!.query(range, found);
      this.southeast!.query(range, found);
    }

    return found;
  }

  intersects(a: Rect, b: Rect): boolean {
    return !(
      b.x > a.x + a.w ||
      b.x + b.w < a.x ||
      b.y > a.y + a.h ||
      b.y + b.h < a.y
    );
  }

  // Helper to get all boundaries for visualization
  getBoundaries(boundaries: Rect[] = []): Rect[] {
    boundaries.push(this.boundary);
    if (this.divided) {
      this.northwest!.getBoundaries(boundaries);
      this.northeast!.getBoundaries(boundaries);
      this.southwest!.getBoundaries(boundaries);
      this.southeast!.getBoundaries(boundaries);
    }
    return boundaries;
  }

  // Helper to get all leaf nodes (containing points or at max depth)
  getLeaves(leaves: Quadtree[] = []): Quadtree[] {
    if (!this.divided) {
      leaves.push(this);
    } else {
      this.northwest!.getLeaves(leaves);
      this.northeast!.getLeaves(leaves);
      this.southwest!.getLeaves(leaves);
      this.southeast!.getLeaves(leaves);
    }
    return leaves;
  }
}
