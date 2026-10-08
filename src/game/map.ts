import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ps1ify, LAYER_WORLD } from './renderer';

export type Surface = 'concrete' | 'metal' | 'wood' | 'dirt';

export interface Box {
  min: THREE.Vector3;
  max: THREE.Vector3;
  surface: Surface;
}

export interface MatDef {
  tex: THREE.Texture;
  /** metres per texture repeat */
  scale: number;
  surface: Surface;
  emissive?: number;
}

export interface MapTheme {
  sky: () => THREE.Texture;
  fog: [color: number, near: number, far: number];
  hemi: [sky: number, ground: number, intensity: number];
  sun: [color: number, intensity: number, x: number, y: number, z: number];
  ambient: [color: number, intensity: number];
}

export interface MapDef {
  id: string;
  name: string;
  desc: string;
  /** shown on the map card */
  swatch: string;
  half: number;
  theme: MapTheme;
  materials(): Record<string, MatDef>;
  layout(b: MapBuilder): void;
}

export interface GameMap {
  id: string;
  boxes: Box[];
  spawns: THREE.Vector3[];
  half: number;
  root: THREE.Group;
  nav: NavGrid;
  sky: THREE.Texture;
  dispose(): void;
}

/**
 * World-space box UVs (planar per face). Combined with subdivided faces this
 * keeps the affine warping visible but not nauseating.
 */
function worldBox(cx: number, cy: number, cz: number, w: number, h: number, d: number, scale: number) {
  const seg = (s: number) => Math.max(1, Math.ceil(s / 2));
  const g = new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d));
  g.translate(cx, cy, cz);
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    if (ay > 0.5) uv.setXY(i, x / scale, z / scale);
    else if (ax > 0.5) uv.setXY(i, z / scale, y / scale);
    else uv.setXY(i, x / scale, y / scale);
  }
  return g;
}

export class MapBuilder {
  boxes: Box[] = [];
  readonly root = new THREE.Group();
  private geos = new Map<string, THREE.BufferGeometry[]>();
  private defs: Record<string, MatDef>;

  constructor(defs: Record<string, MatDef>) {
    this.defs = defs;
  }

  /** Solid box: visual + collider. y is the bottom of the box. */
  box(mat: string, cx: number, y: number, cz: number, w: number, h: number, d: number, collide = true) {
    const def = this.defs[mat];
    const list = this.geos.get(mat) ?? [];
    list.push(worldBox(cx, y + h / 2, cz, w, h, d, def.scale));
    this.geos.set(mat, list);
    if (collide) {
      this.boxes.push({
        min: new THREE.Vector3(cx - w / 2, y, cz - d / 2),
        max: new THREE.Vector3(cx + w / 2, y + h, cz + d / 2),
        surface: def.surface,
      });
    }
  }

  /** Upright cylinder (tank, drum, tower leg) with a square collider. */
  cyl(mat: string, x: number, z: number, r: number, h: number, y = 0, collide = true, seg = 10) {
    const g = new THREE.CylinderGeometry(r, r, h, seg, Math.max(1, Math.ceil(h / 2)));
    g.translate(x, y + h / 2, z);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(r * 2.5)), (uv.getY(i) * h) / 2);
    this.extra(mat, g);
    if (collide) {
      const c = r * 0.92;
      this.boxes.push({ min: new THREE.Vector3(x - c, y, z - c), max: new THREE.Vector3(x + c, y + h, z + c), surface: this.defs[mat].surface });
    }
  }

  extra(mat: string, g: THREE.BufferGeometry) {
    const list = this.geos.get(mat) ?? [];
    list.push(g.index ? g.toNonIndexed() : g);
    this.geos.set(mat, list);
  }

  light(l: THREE.Light) {
    l.layers.enableAll();
    this.root.add(l);
  }

  build() {
    for (const [key, list] of this.geos) {
      const def = this.defs[key];
      const merged = mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)), false);
      const mat = ps1ify(
        new THREE.MeshLambertMaterial({ map: def.tex, emissive: def.emissive ?? 0, emissiveIntensity: def.emissive ? 1.5 : 0 }),
      );
      const m = new THREE.Mesh(merged, mat);
      m.layers.set(LAYER_WORLD);
      m.matrixAutoUpdate = false;
      m.castShadow = true;
      m.receiveShadow = true;
      this.root.add(m);
    }
  }
}

// ---------------------------------------------------------------- layout helpers

/** Shipping container, length along X unless rotated. */
export function container(b: MapBuilder, mat: string, x: number, z: number, alongZ: boolean, level = 0) {
  const L = 6.06;
  const W = 2.44;
  const H = 2.59;
  b.box(mat, x, level * H, z, alongZ ? W : L, H, alongZ ? L : W);
}

export function crate(b: MapBuilder, x: number, z: number, level = 0, s = 1.2, mat = 'crate') {
  b.box(mat, x, level * s, z, s, s, s);
}

/** Ground slab plus four boundary walls. */
export function arena(b: MapBuilder, half: number, ground: string, wall: string, wallH: number) {
  b.box(ground, 0, -0.5, 0, half * 2, 0.5, half * 2);
  b.box(wall, 0, 0, -half - 0.5, half * 2 + 2, wallH, 1);
  b.box(wall, 0, 0, half + 0.5, half * 2 + 2, wallH, 1);
  b.box(wall, -half - 0.5, 0, 0, 1, wallH, half * 2);
  b.box(wall, half + 0.5, 0, 0, 1, wallH, half * 2);
}

/**
 * Four-walled building with door gaps. doors: any of 'n' 's' 'e' 'w'
 * (n = -z side). Optional flat roof.
 */
export function house(b: MapBuilder, mat: string, cx: number, cz: number, w: number, d: number, h: number, doors: string, roof?: string) {
  const t = 0.35;
  const DW = 1.6;
  const DH = 2.3;
  const side = (alongX: boolean, fixed: number, from: number, to: number, door: boolean) => {
    const len = to - from;
    const mid = (from + to) / 2;
    const put = (c: number, l: number, y: number, hh: number) =>
      alongX ? b.box(mat, c, y, fixed, l, hh, t) : b.box(mat, fixed, y, c, t, hh, l);
    if (!door) return put(mid, len, 0, h);
    const seg = (len - DW) / 2;
    put(mid - DW / 2 - seg / 2, seg, 0, h);
    put(mid + DW / 2 + seg / 2, seg, 0, h);
    put(mid, DW, DH, h - DH);
  };
  side(true, cz - d / 2, cx - w / 2, cx + w / 2, doors.includes('n'));
  side(true, cz + d / 2, cx - w / 2, cx + w / 2, doors.includes('s'));
  side(false, cx - w / 2, cz - d / 2 + t / 2, cz + d / 2 - t / 2, doors.includes('w'));
  side(false, cx + w / 2, cz - d / 2 + t / 2, cz + d / 2 - t / 2, doors.includes('e'));
  if (roof) b.box(roof, cx, h, cz, w + 0.5, 0.3, d + 0.5);
}

/** Build a map from its definition into its own root group. */
export function buildMap(scene: THREE.Scene, def: MapDef): GameMap {
  const b = new MapBuilder(def.materials());
  def.layout(b);
  b.build();
  scene.add(b.root);
  const nav = new NavGrid(b.boxes, def.half);
  // spawn ring around the edge plus a few inner points, snapped to open ground
  const spawns: THREE.Vector3[] = [];
  for (const inset of [3.5, 13]) {
    const r = def.half - inset;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const k = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      const c = nav.nearestWalkable((Math.cos(a) / k) * r, (Math.sin(a) / k) * r);
      if (c) spawns.push(nav.center(c[0], c[1]));
    }
  }
  const sky = def.theme.sky();
  return {
    id: def.id,
    boxes: b.boxes,
    spawns,
    half: def.half,
    root: b.root,
    nav,
    sky,
    dispose() {
      scene.remove(b.root);
      b.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (m.material as THREE.MeshLambertMaterial).map?.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
      sky.dispose();
    },
  };
}

// ---------------------------------------------------------------- navigation

/** 1m grid + A*. Small arena, so this is plenty fast and fully automatic. */
export class NavGrid {
  readonly size: number;
  readonly blocked: Uint8Array;
  private readonly half: number;

  constructor(boxes: Box[], half: number) {
    this.half = half;
    this.size = half * 2;
    this.blocked = new Uint8Array(this.size * this.size);
    const r = 0.45;
    for (let gz = 0; gz < this.size; gz++) {
      for (let gx = 0; gx < this.size; gx++) {
        const cx = gx - half + 0.5;
        const cz = gz - half + 0.5;
        for (const bx of boxes) {
          if (bx.max.y < 0.3 || bx.min.y > 1.8) continue;
          if (cx + 0.5 > bx.min.x - r && cx - 0.5 < bx.max.x + r && cz + 0.5 > bx.min.z - r && cz - 0.5 < bx.max.z + r) {
            this.blocked[gz * this.size + gx] = 1;
            break;
          }
        }
      }
    }
  }

  cell(x: number, z: number): [number, number] {
    return [Math.floor(x + this.half), Math.floor(z + this.half)];
  }

  walkable(gx: number, gz: number) {
    return gx >= 0 && gz >= 0 && gx < this.size && gz < this.size && !this.blocked[gz * this.size + gx];
  }

  walkableAt(x: number, z: number) {
    const [gx, gz] = this.cell(x, z);
    return this.walkable(gx, gz);
  }

  center(gx: number, gz: number) {
    return new THREE.Vector3(gx - this.half + 0.5, 0, gz - this.half + 0.5);
  }

  randomWalkable(rnd: () => number = Math.random): THREE.Vector3 {
    for (;;) {
      const gx = Math.floor(rnd() * this.size);
      const gz = Math.floor(rnd() * this.size);
      if (this.walkable(gx, gz)) return this.center(gx, gz);
    }
  }

  nearestWalkable(x: number, z: number): [number, number] | null {
    const [sx, sz] = this.cell(x, z);
    for (let r = 0; r < 6; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (this.walkable(sx + dx, sz + dz)) return [sx + dx, sz + dz];
        }
      }
    }
    return null;
  }

  /** Straight walkable line test, sampled every 0.3m. */
  clearLine(a: THREE.Vector3, b: THREE.Vector3) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(d / 0.3);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (!this.walkableAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  findPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const s = this.nearestWalkable(from.x, from.z);
    const g = this.nearestWalkable(to.x, to.z);
    if (!s || !g) return [];
    const N = this.size;
    const start = s[1] * N + s[0];
    const goal = g[1] * N + g[0];
    const gScore = new Float32Array(N * N).fill(Infinity);
    const came = new Int32Array(N * N).fill(-1);
    const closed = new Uint8Array(N * N);
    const open: number[] = [start];
    const f = new Float32Array(N * N).fill(Infinity);
    gScore[start] = 0;
    f[start] = 0;
    const h = (i: number) => {
      const dx = Math.abs((i % N) - g[0]);
      const dz = Math.abs(Math.floor(i / N) - g[1]);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % N;
      const cz = Math.floor(cur / N);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (!this.walkable(nx, nz)) continue;
          if (dx && dz && (!this.walkable(cx + dx, cz) || !this.walkable(cx, cz + dz))) continue;
          const ni = nz * N + nx;
          if (closed[ni]) continue;
          const ng = gScore[cur] + (dx && dz ? 1.414 : 1);
          if (ng < gScore[ni]) {
            gScore[ni] = ng;
            came[ni] = cur;
            f[ni] = ng + h(ni);
            open.push(ni);
          }
        }
      }
    }
    if (came[goal] === -1 && goal !== start) return [];
    const cells: THREE.Vector3[] = [];
    for (let c = goal; c !== -1; c = came[c]) cells.push(this.center(c % N, Math.floor(c / N)));
    cells.reverse();
    // string-pull: keep only corners we can't see past
    const out: THREE.Vector3[] = [];
    let anchor = from.clone();
    for (let i = 1; i < cells.length; i++) {
      if (!this.clearLine(anchor, cells[i])) {
        out.push(cells[i - 1]);
        anchor = cells[i - 1];
      }
    }
    out.push(cells[cells.length - 1] ?? to.clone());
    return out;
  }
}

// ---------------------------------------------------------------- ray queries

export interface RayHit {
  t: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  surface: Surface;
}

/** Slab test against every collider; returns nearest hit within maxT. */
export function raycastBoxes(boxes: Box[], o: THREE.Vector3, d: THREE.Vector3, maxT: number): RayHit | null {
  let best = maxT;
  let bestBox: Box | null = null;
  let bestAxis = 0;
  let bestSign = 1;
  for (const b of boxes) {
    let tmin = 0;
    let tmax = best;
    let axis = -1;
    let sign = 1;
    let ok = true;
    for (let a = 0; a < 3; a++) {
      const oa = o.getComponent(a);
      const da = d.getComponent(a);
      const mn = b.min.getComponent(a);
      const mx = b.max.getComponent(a);
      if (Math.abs(da) < 1e-8) {
        if (oa < mn || oa > mx) {
          ok = false;
          break;
        }
        continue;
      }
      let t1 = (mn - oa) / da;
      let t2 = (mx - oa) / da;
      let s = -1;
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        axis = a;
        sign = s;
      }
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) {
        ok = false;
        break;
      }
    }
    if (ok && axis >= 0 && tmin < best) {
      best = tmin;
      bestBox = b;
      bestAxis = axis;
      bestSign = sign;
    }
  }
  if (!bestBox) return null;
  const normal = new THREE.Vector3();
  normal.setComponent(bestAxis, bestSign);
  return { t: best, point: o.clone().addScaledVector(d, best), normal, surface: bestBox.surface };
}
