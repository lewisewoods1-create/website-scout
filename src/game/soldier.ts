import * as THREE from 'three';
import type { Materials } from './materials';
import { buildWeapon, type WeaponCfg } from './weapons';
import { attachHands } from './hands';
import { bakeStatic, group, mesh, orientLimb, rbox, solveTwoBone } from './util';

const unitLimb = new Map<string, THREE.BufferGeometry>();
/** Unit-height tapered cylinder (scaled along Y by orientLimb). */
function limb(r0: number, r1: number) {
  const k = `${r0}|${r1}`;
  let g = unitLimb.get(k);
  if (!g) {
    g = new THREE.CylinderGeometry(r1, r0, 1, 18, 1, true);
    unitLimb.set(k, g);
  }
  return g;
}
const sphere = (r: number) => new THREE.SphereGeometry(r, 18, 12);

function molle(parent: THREE.Object3D, m: Materials, x: number, y: number, z: number, w: number, rows: number, face: 1 | -1) {
  for (let r = 0; r < rows; r++) {
    mesh(rbox(w, 0.006, 0.004, 0.0015), m.coyote, parent, { pos: [x, y - r * 0.025, z + face * 0.002] });
    for (let c = 0; c < Math.floor(w / 0.038); c++) {
      mesh(rbox(0.003, 0.012, 0.005, 0.001), m.webbing, parent, { pos: [x - w / 2 + 0.019 + c * 0.038, y - r * 0.025, z + face * 0.003] });
    }
  }
}

function magPouch(parent: THREE.Object3D, m: Materials, x: number, y: number, z: number) {
  const p = group(parent, { pos: [x, y, z] });
  mesh(rbox(0.07, 0.11, 0.045, 0.008), m.coyote, p);
  mesh(rbox(0.074, 0.03, 0.05, 0.006), m.coyote, p, { pos: [0, 0.05, 0.002] }); // flap
  mesh(rbox(0.024, 0.02, 0.004, 0.002), m.webbing, p, { pos: [0, 0.045, 0.027] }); // pull tab
  mesh(rbox(0.06, 0.004, 0.003, 0.001), m.webbing, p, { pos: [0, 0.0, 0.0235] }); // elastic band
}

function arm(
  torso: THREE.Object3D,
  m: Materials,
  shoulder: THREE.Vector3,
  wrist: THREE.Vector3,
  pole: THREE.Vector3,
  sleeve: THREE.Material,
) {
  const elbow = solveTwoBone(shoulder, wrist, 0.3, 0.28, pole, new THREE.Vector3());
  orientLimb(mesh(limb(0.052, 0.045), sleeve, torso), shoulder, elbow);
  orientLimb(mesh(limb(0.046, 0.036), sleeve, torso), elbow, wrist);
  mesh(sphere(0.055), sleeve, torso, { pos: shoulder.toArray() as [number, number, number] });
  mesh(sphere(0.046), sleeve, torso, { pos: elbow.toArray() as [number, number, number] });
  // elbow pad + rolled cuff
  const out = new THREE.Vector3().addVectors(shoulder, wrist).multiplyScalar(0.5).sub(elbow).negate().normalize();
  const pad = mesh(rbox(0.07, 0.08, 0.035, 0.012), m.ranger, torso, { pos: elbow.clone().addScaledVector(out, 0.03).toArray() as [number, number, number] });
  pad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
  const cuffPos = new THREE.Vector3().lerpVectors(elbow, wrist, 0.82);
  const cuff = mesh(new THREE.TorusGeometry(0.038, 0.01, 8, 18), sleeve, torso, { pos: cuffPos.toArray() as [number, number, number] });
  cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3().subVectors(wrist, elbow).normalize());
}

/**
 * Fully kitted operator built from ~250 parts. Faces +Z, origin at the feet.
 * Named pivots for animation: hips, torso, head, thighL/R, kneeL/R, rifle.
 */
export function buildSoldier(m: Materials, variant: 0 | 1, weapon: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'soldier';
  const uniform = variant ? m.camoAlt : m.camo;
  const kit = variant ? m.ranger : m.coyote;

  const hips = group(root, { pos: [0, 0.99, 0], name: 'hips' });
  mesh(rbox(0.34, 0.2, 0.22, 0.06, 3), uniform, hips, { pos: [0, 0, 0] });
  // battle belt with pouches
  mesh(rbox(0.37, 0.065, 0.25, 0.02, 3), kit, hips, { pos: [0, 0.075, 0] });
  mesh(rbox(0.05, 0.035, 0.012, 0.004), m.parkerized, hips, { pos: [0, 0.075, 0.128] }); // buckle
  for (const [x, z] of [[0.17, 0.06], [-0.17, 0.06], [0.18, -0.05], [-0.15, -0.1], [0.05, -0.13]] as const) {
    const p = mesh(rbox(0.07, 0.09, 0.05, 0.01), kit, hips, { pos: [x, 0.04, z], rot: [0, Math.atan2(x, z), 0] });
    mesh(rbox(0.074, 0.025, 0.054, 0.006), kit, p, { pos: [0, 0.04, 0] });
  }
  // dump pouch
  mesh(rbox(0.12, 0.1, 0.05, 0.02, 3), m.webbing, hips, { pos: [-0.08, -0.03, -0.13] });

  // legs
  for (const s of [-1, 1] as const) {
    const side = s === 1 ? 'L' : 'R';
    const thigh = group(hips, { pos: [s * 0.095, -0.06, 0], name: `thigh${side}` });
    mesh(new THREE.CapsuleGeometry(0.078, 0.28, 6, 16), uniform, thigh, { pos: [0, -0.2, 0] });
    mesh(rbox(0.13, 0.05, 0.16, 0.02), uniform, thigh, { pos: [s * 0.03, -0.18, 0], rot: [0, 0, s * 0.1] }); // cargo pocket
    mesh(rbox(0.012, 0.03, 0.03, 0.004), m.webbing, thigh, { pos: [s * 0.085, -0.15, 0.03] });
    if (s === -1) {
      // drop-leg holster on the right
      const hol = group(thigh, { pos: [-0.09, -0.15, 0.0] });
      mesh(rbox(0.04, 0.17, 0.09, 0.012), m.polymer, hol, {});
      mesh(rbox(0.045, 0.04, 0.11, 0.008), m.polymer, hol, { pos: [0, 0.07, 0] });
      mesh(rbox(0.03, 0.04, 0.06, 0.008), m.polymer, hol, { pos: [0.002, 0.11, -0.02] }); // pistol grip
      for (const y of [-0.03, -0.1]) mesh(rbox(0.17, 0.018, 0.17, 0.006), m.webbing, thigh, { pos: [0, y - 0.08, 0] });
    }
    const knee = group(thigh, { pos: [0, -0.43, 0], name: `knee${side}` });
    mesh(sphere(0.07), uniform, knee, {});
    const kp = group(knee, { pos: [0, 0, 0.065] });
    mesh(rbox(0.11, 0.13, 0.035, 0.015, 3), m.polymer, kp, {});
    mesh(rbox(0.1, 0.06, 0.01, 0.004), m.rubber, kp, { pos: [0, 0.0, 0.017] });
    mesh(rbox(0.16, 0.022, 0.12, 0.006), m.webbing, knee, { pos: [0, 0.045, -0.0] });
    mesh(rbox(0.16, 0.022, 0.12, 0.006), m.webbing, knee, { pos: [0, -0.05, -0.0] });
    mesh(new THREE.CapsuleGeometry(0.064, 0.27, 6, 16), uniform, knee, { pos: [0, -0.21, -0.005] });
    // boot
    const ankle = group(knee, { pos: [0, -0.42, 0] });
    mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.16, 18), m.boot, ankle, { pos: [0, 0.0, -0.005] });
    mesh(rbox(0.115, 0.1, 0.26, 0.035, 3), m.boot, ankle, { pos: [0, -0.06, 0.045] });
    mesh(rbox(0.125, 0.032, 0.285, 0.01, 2), m.sole, ankle, { pos: [0, -0.112, 0.045] });
    for (let i = 0; i < 6; i++) mesh(rbox(0.126, 0.006, 0.012, 0.002), m.rubber, ankle, { pos: [0, -0.126, -0.07 + i * 0.045] });
    mesh(rbox(0.12, 0.07, 0.08, 0.03), m.rubber, ankle, { pos: [0, -0.07, 0.15] }); // toe cap
    for (let i = 0; i < 5; i++) {
      mesh(rbox(0.05, 0.004, 0.006, 0.002), m.sole, ankle, { pos: [0, 0.06 - i * 0.03, 0.07 - i * 0.004], rot: [0.3, 0, 0] }); // laces
    }
  }

  // torso
  const torso = group(hips, { pos: [0, 0.1, 0], name: 'torso' });
  mesh(rbox(0.36, 0.5, 0.22, 0.08, 4), uniform, torso, { pos: [0, 0.25, 0] });
  // plate carrier
  const plateF = group(torso, { pos: [0, 0.3, 0.125] });
  mesh(rbox(0.3, 0.34, 0.055, 0.015, 3), kit, plateF, {});
  molle(plateF, m, 0, 0.09, 0.028, 0.26, 2, 1);
  for (let i = 0; i < 3; i++) magPouch(plateF, m, -0.085 + i * 0.085, -0.09, 0.05);
  // admin panel + tourniquet + patch
  mesh(rbox(0.16, 0.08, 0.025, 0.008), kit, plateF, { pos: [0, 0.03, 0.035] });
  mesh(rbox(0.07, 0.045, 0.004, 0.002), m.webbing, plateF, { pos: [0.045, 0.04, 0.049] });
  mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.09, 12), m.rubber, plateF, { pos: [-0.06, 0.035, 0.05], rot: [0, 0, Math.PI / 2] });
  const plateB = group(torso, { pos: [0, 0.3, -0.125] });
  mesh(rbox(0.3, 0.36, 0.055, 0.015, 3), kit, plateB, {});
  molle(plateB, m, 0, 0.12, -0.028, 0.26, 6, -1);
  // radio + antenna + hydration
  const radio = group(plateB, { pos: [0.08, 0.02, -0.06] });
  mesh(rbox(0.07, 0.15, 0.045, 0.008), kit, radio, {});
  mesh(rbox(0.05, 0.11, 0.035, 0.004), m.polymer, radio, { pos: [0, 0.07, 0] });
  mesh(new THREE.CylinderGeometry(0.004, 0.0035, 0.32, 8), m.rubber, radio, { pos: [0.015, 0.28, 0] });
  mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 10), m.parkerized, radio, { pos: [0.015, 0.13, 0] });
  mesh(rbox(0.12, 0.22, 0.04, 0.02, 3), kit, plateB, { pos: [-0.05, -0.02, -0.05] });
  // cummerbund + shoulder straps
  for (const s of [-1, 1]) {
    mesh(rbox(0.05, 0.18, 0.22, 0.015, 3), kit, torso, { pos: [s * 0.175, 0.22, 0] });
    mesh(rbox(0.075, 0.03, 0.27, 0.01), kit, torso, { pos: [s * 0.1, 0.48, 0] });
    mesh(rbox(0.06, 0.06, 0.012, 0.004), m.webbing, torso, { pos: [s * 0.1, 0.45, 0.14] });
  }
  // neck + shemagh
  mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.1, 16), m.skin, torso, { pos: [0, 0.54, 0] });
  mesh(new THREE.TorusGeometry(0.07, 0.03, 10, 20), m.ranger, torso, { pos: [0, 0.52, 0], rot: [Math.PI / 2, 0, 0] });

  // head
  const head = group(torso, { pos: [0, 0.6, 0.0], name: 'head' });
  mesh(sphere(0.1), m.skin, head, { pos: [0, 0.07, 0.005], scale: [0.88, 1.08, 1] });
  mesh(rbox(0.11, 0.07, 0.1, 0.035, 3), m.skin, head, { pos: [0, 0.0, 0.025] }); // jaw
  mesh(rbox(0.13, 0.075, 0.11, 0.03, 3), m.webbing, head, { pos: [0, 0.0, 0.02] }); // balaclava lower
  mesh(rbox(0.03, 0.03, 0.03, 0.012), m.skin, head, { pos: [0, 0.06, 0.1] }); // nose
  // ballistic glasses
  mesh(rbox(0.17, 0.042, 0.03, 0.012, 3), m.visor, head, { pos: [0, 0.085, 0.085] });
  for (const s of [-1, 1]) mesh(rbox(0.006, 0.01, 0.1, 0.002), m.rubber, head, { pos: [s * 0.088, 0.085, 0.035] });
  // helmet shell
  const helm = group(head, { pos: [0, 0.1, 0.0] });
  mesh(new THREE.SphereGeometry(0.135, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), m.helmet, helm, { scale: [0.95, 0.95, 1.05] });
  mesh(new THREE.TorusGeometry(0.128, 0.007, 8, 32), m.rubber, helm, { pos: [0, -0.005, 0], rot: [Math.PI / 2, 0, 0], scale: [0.95, 1.05, 1] });
  // side rails, velcro, shroud, NVG
  for (const s of [-1, 1]) {
    mesh(rbox(0.012, 0.03, 0.15, 0.004), m.polymer, helm, { pos: [s * 0.127, 0.015, 0.0], rot: [0, 0, s * 0.15] });
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 20), m.polymer, helm, { pos: [s * 0.12, -0.065, 0.0], rot: [0, 0, Math.PI / 2] }); // ear cup
    mesh(new THREE.TorusGeometry(0.025, 0.005, 6, 16), m.rubber, helm, { pos: [s * 0.137, -0.065, 0.0], rot: [0, Math.PI / 2, 0] });
    mesh(rbox(0.01, 0.06, 0.012, 0.003), m.webbing, helm, { pos: [s * 0.11, -0.1, 0.03] }); // chin strap
  }
  mesh(rbox(0.09, 0.05, 0.004, 0.003), kit, helm, { pos: [0, 0.09, -0.04], rot: [-0.9, 0, 0] }); // velcro patch
  mesh(rbox(0.11, 0.06, 0.05, 0.012), kit, helm, { pos: [0, 0.02, -0.13] }); // counterweight
  mesh(rbox(0.05, 0.045, 0.02, 0.008), m.parkerized, helm, { pos: [0, 0.03, 0.135] }); // shroud
  const nvg = group(helm, { pos: [0, 0.0, 0.17], rot: [-1.25, 0, 0] }); // flipped up
  mesh(rbox(0.04, 0.03, 0.05, 0.008), m.parkerized, nvg, {});
  for (const s of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.07, 18), m.polymer, nvg, { pos: [s * 0.03, -0.0, 0.04], rot: [Math.PI / 2, 0, 0] });
    mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.003, 18), m.nvgGlass, nvg, { pos: [s * 0.03, 0, 0.076], rot: [Math.PI / 2, 0, 0] });
  }
  mesh(rbox(0.008, 0.008, 0.004, 0.002), m.lens, helm, { pos: [0.05, 0.11, -0.08] }); // IR strobe

  // rifle + hands + IK arms
  const rifle = buildWeapon(m, weapon, false);
  rifle.name = 'rifle';
  rifle.rotation.y = Math.PI;
  rifle.position.set(-0.12, 0.5, 0.36);
  torso.add(rifle);
  const hands = attachHands(rifle, m);
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(torso.matrixWorld).invert();
  const wristR = hands.right.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const wristL = hands.left.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  arm(torso, m, new THREE.Vector3(-0.2, 0.46, 0), wristR, new THREE.Vector3(-0.5, 0.0, -0.1), uniform);
  arm(torso, m, new THREE.Vector3(0.19, 0.46, 0.06), wristL, new THREE.Vector3(0.45, 0.1, 0.1), uniform);

  bakeStatic(root, ['hips', 'torso', 'head', 'thighL', 'thighR', 'kneeL', 'kneeR']);
  root.traverse((o) => {
    o.frustumCulled = false;
  });
  return root;
}
