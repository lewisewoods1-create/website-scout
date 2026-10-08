import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Deterministic PRNG so procedural textures look the same every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const damp = (a: number, b: number, rate: number, dt: number) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const smooth = (t: number) => t * t * (3 - 2 * t);

const rboxCache = new Map<string, THREE.BufferGeometry>();
/** Cached rounded box — the workhorse for the high-detail models. */
export function rbox(w: number, h: number, d: number, r = 0.004, seg = 3): THREE.BufferGeometry {
  const key = `${w}|${h}|${d}|${r}|${seg}`;
  let g = rboxCache.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
    rboxCache.set(key, g);
  }
  return g;
}

export interface PlaceOpts {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
  name?: string;
}

export function place<T extends THREE.Object3D>(obj: T, parent: THREE.Object3D | null, o: PlaceOpts = {}): T {
  if (o.pos) obj.position.set(...o.pos);
  if (o.rot) obj.rotation.set(...o.rot);
  if (o.scale) obj.scale.set(...o.scale);
  if (o.name) obj.name = o.name;
  parent?.add(obj);
  return obj;
}

export function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  parent: THREE.Object3D | null,
  o: PlaceOpts = {},
): THREE.Mesh {
  return place(new THREE.Mesh(geo, mat), parent, o);
}

export function group(parent: THREE.Object3D | null, o: PlaceOpts = {}): THREE.Group {
  return place(new THREE.Group(), parent, o);
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpDir = new THREE.Vector3();
/**
 * Stretch a unit-length, Y-aligned limb mesh between two points
 * (both expressed in the mesh parent's space).
 */
export function orientLimb(obj: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  tmpDir.subVectors(to, from);
  const len = tmpDir.length();
  obj.position.addVectors(from, to).multiplyScalar(0.5);
  obj.quaternion.setFromUnitVectors(UP, tmpDir.divideScalar(len || 1));
  obj.scale.set(1, len, 1);
}

/** Two-bone IK: returns the elbow/knee position given root, target, bone lengths and a pole hint. */
export function solveTwoBone(
  root: THREE.Vector3,
  target: THREE.Vector3,
  a: number,
  b: number,
  pole: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  const toT = new THREE.Vector3().subVectors(target, root);
  const d = clamp(toT.length(), 1e-4, a + b - 1e-4);
  toT.normalize();
  // distance along root->target to the elbow's projection, and the elbow's offset from that line
  const x = (a * a - b * b + d * d) / (2 * d);
  const y = Math.sqrt(Math.max(0, a * a - x * x));
  const bend = new THREE.Vector3().copy(pole).sub(root);
  bend.sub(toT.clone().multiplyScalar(bend.dot(toT))).normalize();
  return out.copy(root).addScaledVector(toT, x).addScaledVector(bend, y);
}

export function setLayerDeep(obj: THREE.Object3D, layer: number) {
  obj.traverse((o) => o.layers.set(layer));
}

/**
 * Merge every static mesh under each animated node into one mesh per material.
 * Keeps the named pivots (and any other groups) so animation still works, but
 * cuts a ~300-part soldier down to a few dozen draw calls.
 */
export function bakeStatic(root: THREE.Object3D, pivots: string[]) {
  root.updateMatrixWorld(true);
  const anchors = new Set<THREE.Object3D>([root]);
  for (const n of pivots) {
    const o = root.getObjectByName(n);
    if (o) anchors.add(o);
  }
  const buckets = new Map<THREE.Object3D, Map<THREE.Material, THREE.BufferGeometry[]>>();
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const m = o as THREE.Mesh;
    if (Array.isArray(m.material)) return;
    let a: THREE.Object3D | null = m.parent;
    while (a && !anchors.has(a)) a = a.parent;
    if (!a) return;
    const rel = new THREE.Matrix4().copy(a.matrixWorld).invert().multiply(m.matrixWorld);
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(rel);
    for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
    if (!g.attributes.uv) {
      g = g.clone();
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    g.clearGroups();
    const byMat = buckets.get(a) ?? new Map<THREE.Material, THREE.BufferGeometry[]>();
    const list = byMat.get(m.material) ?? [];
    list.push(g);
    byMat.set(m.material, list);
    buckets.set(a, byMat);
    meshes.push(m);
  });
  for (const m of meshes) m.parent?.remove(m);
  for (const [anchor, byMat] of buckets) {
    for (const [mat, list] of byMat) {
      const merged = mergeGeometries(list, false);
      if (merged) anchor.add(new THREE.Mesh(merged, mat));
    }
  }
}
