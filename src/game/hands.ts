import * as THREE from 'three';
import type { Materials } from './materials';
import { group, mesh, rbox } from './util';

const segGeo = new Map<string, THREE.BufferGeometry>();
/** Finger segment: capsule running from z=0 to z=-len. */
function fingerSeg(r: number, len: number) {
  const key = `${r}|${len}`;
  let g = segGeo.get(key);
  if (!g) {
    g = new THREE.CapsuleGeometry(r, len, 4, 10);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -len / 2);
    segGeo.set(key, g);
  }
  return g;
}

export interface HandPose {
  /** curl (radians per joint) of each finger, index..pinky */
  curl: [number, number, number, number];
  thumbCurl: number;
}

/**
 * Gloved hand. Wrist at origin, fingers extend toward -Z, palm faces -X for
 * side=1 (right) and +X for side=-1 (left); fingers curl toward the palm.
 */
export function buildHand(m: Materials, side: 1 | -1, pose: HandPose): THREE.Group {
  const hand = new THREE.Group();
  hand.name = side === 1 ? 'handR' : 'handL';
  const s = side;
  // cuff + back of hand + palm
  mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.05, 16), m.glove, hand, { pos: [0, 0, 0.02], rot: [Math.PI / 2, 0, 0] });
  mesh(rbox(0.028, 0.078, 0.088, 0.012, 3), m.glove, hand, { pos: [0, 0, -0.045] });
  mesh(rbox(0.006, 0.07, 0.07, 0.003), m.gloveKnuckle, hand, { pos: [s * 0.014, 0, -0.045] }); // back plate
  mesh(rbox(0.012, 0.075, 0.016, 0.005), m.gloveKnuckle, hand, { pos: [s * 0.012, 0, -0.084] }); // knuckle guard
  // velcro wrist strap
  mesh(rbox(0.032, 0.03, 0.018, 0.004), m.webbing, hand, { pos: [s * 0.004, -0.01, 0.0] });

  const ys = [0.029, 0.01, -0.009, -0.027];
  const lens: [number, number, number][] = [
    [0.04, 0.026, 0.021],
    [0.044, 0.029, 0.022],
    [0.041, 0.027, 0.021],
    [0.033, 0.021, 0.018],
  ];
  for (let f = 0; f < 4; f++) {
    let parent: THREE.Object3D = group(hand, { pos: [-s * 0.002, ys[f], -0.088] });
    const r = f === 3 ? 0.0078 : 0.0088;
    for (let j = 0; j < 3; j++) {
      parent.rotation.y = s * pose.curl[f] * (j === 0 ? 0.85 : 1);
      mesh(fingerSeg(r - j * 0.0006, lens[f][j]), m.glove, parent);
      if (j === 0) mesh(rbox(0.006, 0.014, 0.018, 0.003), m.gloveKnuckle, parent, { pos: [s * 0.008, 0, -0.02] });
      parent = group(parent, { pos: [0, 0, -lens[f][j]] });
    }
  }
  // thumb: from the side of the palm near the index, angled across
  const t0 = group(hand, { pos: [-s * 0.01, 0.036, -0.03], rot: [0.5, s * 0.7, 0] });
  mesh(fingerSeg(0.0105, 0.035), m.glove, t0);
  const t1 = group(t0, { pos: [0, 0, -0.035], rot: [0, s * pose.thumbCurl, 0] });
  mesh(fingerSeg(0.0095, 0.03), m.glove, t1);
  return hand;
}

const basis = new THREE.Matrix4();

/**
 * Put both hands on a weapon using its gripAnchor / guardAnchor nodes.
 * Returns the hand groups so arms can be attached (viewmodel sleeves or third-person IK).
 */
export function attachHands(weapon: THREE.Object3D, m: Materials) {
  // right: wraps the pistol grip, trigger finger indexed straight
  const right = buildHand(m, 1, { curl: [0.35, 1.25, 1.3, 1.25], thumbCurl: 0.5 });
  right.position.set(0.024, -0.045, 0.07);
  right.rotation.set(0, 0.08, 0);
  weapon.getObjectByName('gripAnchor')!.add(right);

  if (weapon.userData.kind === 'pistol' || weapon.userData.kind === 'revolver') {
    // two-handed pistol grip: support hand wraps the grip from the left, under the strong hand
    const left = buildHand(m, -1, { curl: [1.15, 1.2, 1.25, 1.2], thumbCurl: 0.2 });
    left.position.set(-0.03, -0.075, 0.035);
    left.rotation.set(0.1, -0.55, -0.15);
    weapon.getObjectByName('gripAnchor')!.add(left);
    return { right, left };
  }

  // left: palm under the handguard, fingers wrapping up the right side
  const left = buildHand(m, -1, { curl: [1.0, 1.05, 1.1, 1.1], thumbCurl: 0.3 });
  basis.makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0));
  left.quaternion.setFromRotationMatrix(basis);
  left.position.copy(weapon.getObjectByName('guardAnchor')!.position);
  weapon.add(left);

  return { right, left };
}
