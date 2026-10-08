import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ps1ify, LAYER_WORLD } from './renderer';
import * as T from './textures';

export type Surface = 'concrete' | 'metal' | 'wood' | 'dirt';

export interface Box {
  min: THREE.Vector3;
  max: THREE.Vector3;
  surface: Surface;
}

export interface GameMap {
  boxes: Box[];
  spawns: THREE.Vector3[];
  half: number;
  lights: THREE.Light[];
  nav: NavGrid;
}

interface MatDef {
  tex: THREE.Texture;
  /** metres per texture repeat */
  scale: number;
  surface: Surface;
  emissive?: number;
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

class MapBuilder {
  boxes: Box[] = [];
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

  extra(mat: string, g: THREE.BufferGeometry) {
    const list = this.geos.get(mat) ?? [];
    list.push(g.index ? g.toNonIndexed() : g);
    this.geos.set(mat, list);
  }

  build(scene: THREE.Scene) {
    for (const [key, list] of this.geos) {
      const def = this.defs[key];
      const nonIndexed = list.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = mergeGeometries(nonIndexed, false);
      const mat = ps1ify(
        new THREE.MeshLambertMaterial({
          map: def.tex,
          emissive: def.emissive ?? 0,
          emissiveIntensity: def.emissive ? 1.5 : 0,
        }),
      );
      const m = new THREE.Mesh(merged, mat);
      m.layers.set(LAYER_WORLD);
      m.matrixAutoUpdate = false;
      scene.add(m);
    }
  }
}

/** Shipping container, length along X unless rotated. */
function container(b: MapBuilder, mat: string, x: number, z: number, alongZ: boolean, level = 0) {
  const L = 6.06;
  const W = 2.44;
  const H = 2.59;
  b.box(mat, x, level * H, z, alongZ ? W : L, H, alongZ ? L : W);
}

function crate(b: MapBuilder, x: number, z: number, level = 0, s = 1.2) {
  b.box('crate', x, level * s, z, s, s, s);
}

export function buildMap(scene: THREE.Scene): GameMap {
  const defs: Record<string, MatDef> = {
    ground: { tex: T.groundTex(), scale: 4, surface: 'dirt' },
    concrete: { tex: T.concreteTex(1), scale: 3, surface: 'concrete' },
    concreteDark: { tex: T.concreteTex(5, '#5a5752'), scale: 2.5, surface: 'concrete' },
    red: { tex: T.containerTex('#7a2a20', 31), scale: 2.6, surface: 'metal' },
    blue: { tex: T.containerTex('#24486b', 32), scale: 2.6, surface: 'metal' },
    green: { tex: T.containerTex('#3b5233', 33), scale: 2.6, surface: 'metal' },
    crate: { tex: T.crateTex(), scale: 1.2, surface: 'wood' },
    metal: { tex: T.metalTex(), scale: 2, surface: 'metal' },
    hazard: { tex: T.hazardTex(), scale: 1, surface: 'concrete' },
    lamp: { tex: T.metalTex(12, '#ffcf7a'), scale: 1, surface: 'metal', emissive: 0xffb050 },
  };
  const b = new MapBuilder(defs);
  const HALF = 32;

  // ground slab (thin box so it collides and textures like the rest)
  b.box('ground', 0, -0.5, 0, HALF * 2, 0.5, HALF * 2);

  // perimeter walls
  const WH = 5;
  b.box('concrete', 0, 0, -HALF - 0.5, HALF * 2 + 2, WH, 1);
  b.box('concrete', 0, 0, HALF + 0.5, HALF * 2 + 2, WH, 1);
  b.box('concrete', -HALF - 0.5, 0, 0, 1, WH, HALF * 2);
  b.box('concrete', HALF + 0.5, 0, 0, 1, WH, HALF * 2);
  // wall caps + hazard base strip
  for (const s of [-1, 1]) {
    b.box('hazard', 0, 0, s * (HALF - 0.05), HALF * 2, 0.6, 0.1, false);
    b.box('hazard', s * (HALF - 0.05), 0, 0, 0.1, 0.6, HALF * 2, false);
  }

  // --- warehouse office (x -6..6, z -18..-10)
  const bx0 = -6;
  const bx1 = 6;
  const bz0 = -18;
  const bz1 = -10;
  const BH = 3.4;
  const t = 0.35;
  b.box('concreteDark', 0, 0, bz0, bx1 - bx0, BH, t); // north wall
  // south wall with a central door (1.6 wide)
  b.box('concreteDark', -3.4, 0, bz1, 5.2, BH, t);
  b.box('concreteDark', 3.4, 0, bz1, 5.2, BH, t);
  b.box('concreteDark', 0, 2.3, bz1, 1.6, BH - 2.3, t);
  // west wall with window (z -15..-13, sill 1.0 lintel 2.1)
  b.box('concreteDark', bx0, 0, -16.5, t, BH, 3);
  b.box('concreteDark', bx0, 0, -11.5, t, BH, 3);
  b.box('concreteDark', bx0, 0, -14, t, 1.0, 2);
  b.box('concreteDark', bx0, 2.1, -14, t, BH - 2.1, 2);
  // east wall with door (z -15..-13.6)
  b.box('concreteDark', bx1, 0, -16.6, t, BH, 2.8);
  b.box('concreteDark', bx1, 0, -11.7, t, BH, 3.4);
  b.box('concreteDark', bx1, 2.3, -14.3, t, BH - 2.3, 1.4);
  // interior divider + roof
  b.box('concreteDark', -1.5, 0, -15.2, 0.25, BH, 5.6);
  b.box('metal', 0, BH, (bz0 + bz1) / 2, bx1 - bx0 + 0.6, 0.3, bz1 - bz0 + 0.6);
  crate(b, 3.5, -16.8);
  crate(b, 4.7, -16.8);
  crate(b, 3.5, -16.8, 1);
  b.box('metal', -4, 0, -16.9, 2.6, 0.9, 0.9); // workbench

  // --- containers
  container(b, 'red', -20, -18, false);
  container(b, 'blue', -20, -18, false, 1);
  container(b, 'green', -24, 4, true);
  container(b, 'blue', -14, 10, false);
  container(b, 'red', 18, -20, true);
  container(b, 'green', 22, 6, false);
  container(b, 'red', 10, 18, false);
  container(b, 'blue', 24, -6, true);
  container(b, 'green', 24, -6, true, 1);
  container(b, 'red', -18, 24, false);
  container(b, 'blue', -4, 26, true);

  // --- crate clusters
  crate(b, -6, 4);
  crate(b, -4.8, 4);
  crate(b, -6, 5.2);
  crate(b, -6, 4, 1);
  crate(b, 8, 2);
  crate(b, 12, -6);
  crate(b, 12, -4.8);
  crate(b, 12, -6, 1);
  crate(b, -16, -6);
  crate(b, -17.2, -6);
  crate(b, 4, 12);
  crate(b, -10, 20);
  crate(b, 16, 25);
  crate(b, 17.2, 25);
  crate(b, 27, 14);
  crate(b, -27, -10);
  crate(b, -27, -11.2);

  // --- jersey barriers
  b.box('concrete', 0, 0, 4, 3, 0.9, 0.6);
  b.box('concrete', -4, 0, 15, 0.6, 0.9, 3);
  b.box('concrete', 15, 0, 11, 3, 0.9, 0.6);
  b.box('concrete', -20, 0, -6, 3, 0.9, 0.6);
  b.box('concrete', 8, 0, -24, 0.6, 0.9, 3);
  b.box('concrete', -10, 0, -26, 3, 0.9, 0.6);
  b.box('concrete', 20, 0, 18, 0.6, 0.9, 3);

  // --- fuel tanks (cylinder visuals, box colliders)
  const tankMat = 'metal';
  for (const [x, z] of [[25, 23], [21, 26]] as const) {
    const g = new THREE.CylinderGeometry(1.5, 1.5, 3.2, 10, 2);
    g.translate(x, 1.6, z);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 1.6);
    b.extra(tankMat, g);
    b.boxes.push({ min: new THREE.Vector3(x - 1.4, 0, z - 1.4), max: new THREE.Vector3(x + 1.4, 3.2, z + 1.4), surface: 'metal' });
  }

  // --- sodium lamp posts
  const lights: THREE.Light[] = [];
  for (const [x, z] of [[-10, 0], [10, -10], [6, 14], [-22, 14], [20, -26]] as const) {
    b.box('metal', x, 0, z, 0.22, 5.2, 0.22);
    b.box('metal', x + 0.6, 5.0, z, 1.4, 0.15, 0.25, false);
    b.box('lamp', x + 1.15, 4.85, z, 0.45, 0.15, 0.3, false);
    const pl = new THREE.PointLight(0xffa040, 18, 14, 1.6);
    pl.position.set(x + 1.15, 4.6, z);
    pl.layers.enableAll();
    lights.push(pl);
    scene.add(pl);
  }

  b.build(scene);

  const spawns = [
    [-28, -28], [28, -28], [-28, 28], [28, 28], [0, 29], [0, -28], [-29, 0], [29, 0], [0, 0], [14, -14], [-12, -2], [8, 22],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));

  return { boxes: b.boxes, spawns, half: HALF, lights, nav: new NavGrid(b.boxes, HALF) };
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
