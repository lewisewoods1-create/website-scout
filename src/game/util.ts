import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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
export function rbox(w: number, h: number, d: number, r = 0.004, seg = 2): THREE.BufferGeometry {
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
