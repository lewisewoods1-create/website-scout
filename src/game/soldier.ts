import * as THREE from 'three';
import type { Materials } from './materials';
import type { SoldierLook } from './progression';
import { buildWeapon, type WeaponCfg } from './weapons';
import { attachHands } from './hands';
import { bakeStatic, group, mesh, orientLimb, rbox, solveTwoBone } from './util';
import { addRim } from './materials';
import { camoTileTexture, PACK_CAMOS, type CamoId } from './camos';
import { operatorById, type Operator } from './operators';

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

/** Unit-height tapered cylinder (scaled along Y by orientLimb). */
const limb = (r0: number, r1: number) => cached(`limb${r0}|${r1}`, () => new THREE.CylinderGeometry(r1, r0, 1, 28, 1, true));
const sphere = (r: number) => cached(`sph${r}`, () => new THREE.SphereGeometry(r, 32, 22));
/** Smooth body part from a (radius, height) profile, bottom to top. */
const lathe = (key: string, pts: [number, number][]) =>
  cached(`lathe${key}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 40));

function molle(parent: THREE.Object3D, m: Materials, kit: THREE.Material, x: number, y: number, z: number, w: number, rows: number, face: 1 | -1) {
  for (let r = 0; r < rows; r++) {
    mesh(rbox(w, 0.006, 0.004, 0.0015), kit, parent, { pos: [x, y - r * 0.025, z + face * 0.002] });
    for (let c = 0; c < Math.floor(w / 0.038); c++) {
      mesh(rbox(0.003, 0.012, 0.005, 0.001), m.webbing, parent, { pos: [x - w / 2 + 0.019 + c * 0.038, y - r * 0.025, z + face * 0.003] });
    }
  }
}

function magPouch(parent: THREE.Object3D, m: Materials, kit: THREE.Material, x: number, y: number, z: number) {
  const p = group(parent, { pos: [x, y, z] });
  mesh(rbox(0.07, 0.11, 0.045, 0.012, 4), kit, p);
  mesh(rbox(0.074, 0.032, 0.05, 0.01, 4), kit, p, { pos: [0, 0.05, 0.002] }); // flap
  mesh(rbox(0.024, 0.02, 0.004, 0.002), m.webbing, p, { pos: [0, 0.045, 0.027] }); // pull tab
  mesh(rbox(0.06, 0.004, 0.003, 0.001), m.webbing, p, { pos: [0, 0.0, 0.0235] }); // elastic
  mesh(rbox(0.066, 0.0015, 0.0015, 0.0005), m.webbing, p, { pos: [0, -0.052, 0.0232] }); // stitch line
}

function arm(torso: THREE.Object3D, m: Materials, shoulder: THREE.Vector3, wrist: THREE.Vector3, pole: THREE.Vector3, sleeve: THREE.Material, kit: THREE.Material, patch: boolean) {
  const elbow = solveTwoBone(shoulder, wrist, 0.3, 0.28, pole, new THREE.Vector3());
  orientLimb(mesh(limb(0.054, 0.046), sleeve, torso), shoulder, elbow);
  orientLimb(mesh(limb(0.047, 0.037), sleeve, torso), elbow, wrist);
  // muscle bulges so limbs aren't plain tubes
  const bulge = (a: THREE.Vector3, b: THREE.Vector3, t: number, r: number, len: number) => {
    const s = mesh(sphere(1), sleeve, torso, { pos: new THREE.Vector3().lerpVectors(a, b, t).toArray() as [number, number, number] });
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    s.scale.set(r, len, r);
  };
  bulge(shoulder, elbow, 0.45, 0.058, 0.11);
  bulge(elbow, wrist, 0.3, 0.05, 0.09);
  mesh(sphere(0.06), sleeve, torso, { pos: shoulder.toArray() as [number, number, number], scale: [1, 0.9, 1.1] });
  mesh(sphere(0.047), sleeve, torso, { pos: elbow.toArray() as [number, number, number] });
  const out = new THREE.Vector3().addVectors(shoulder, wrist).multiplyScalar(0.5).sub(elbow).negate().normalize();
  const pad = mesh(rbox(0.07, 0.08, 0.035, 0.014, 4), m.polymer, torso, { pos: elbow.clone().addScaledVector(out, 0.035).toArray() as [number, number, number] });
  pad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
  const cuffPos = new THREE.Vector3().lerpVectors(elbow, wrist, 0.84);
  const cuff = mesh(cached('cuff', () => new THREE.TorusGeometry(0.038, 0.011, 12, 28)), sleeve, torso, { pos: cuffPos.toArray() as [number, number, number] });
  cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3().subVectors(wrist, elbow).normalize());
  if (patch) {
    // velcro unit patch on the upper arm
    const p = mesh(rbox(0.05, 0.035, 0.006, 0.003), kit, torso, { pos: new THREE.Vector3().lerpVectors(shoulder, elbow, 0.3).addScaledVector(out, -0.05).toArray() as [number, number, number] });
    p.lookAt(p.position.clone().add(out.clone().negate()));
  }
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function cachedMat(key: string, make: () => THREE.MeshStandardMaterial) {
  let mat = matCache.get(key);
  if (!mat) {
    mat = make();
    matCache.set(key, mat);
  }
  return mat;
}

/** Uniform fabric printed with a camo from the gun camo pack (same art as the weapon camos). */
function packFabric(m: Materials, id: CamoId) {
  return cachedMat(`fab:${id}:${m.camo.uuid}`, () => {
    const tex = camoTileTexture(id).clone();
    tex.repeat.set(3, 3);
    tex.needsUpdate = true;
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex,
      normalMap: m.camo.normalMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: id === 'gold' ? 0.45 : 0.9,
      metalness: id === 'gold' ? 0.6 : 0,
      sheen: 0.6,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color(0x9a9282),
    });
    addRim(mat);
    return mat;
  });
}

/** Material set for a look: uniform, gear, headgear. */
function lookMats(m: Materials, look: SoldierLook) {
  const base = { desert: m.camo, woodland: m.camoAlt, urban: m.camoUrban, night: m.camoNight }[look.uniform];
  const uniform = base ?? (PACK_CAMOS.includes(look.uniform as CamoId) ? packFabric(m, look.uniform as CamoId) : m.camo);
  const kit = { coyote: m.coyote, ranger: m.ranger, black: m.gearBlack }[look.gear] ?? m.coyote;
  return { uniform, kit };
}

/** Face, eyewear and headgear for an operator. Head pivot origin sits at the base of the skull. */
function buildHead(head: THREE.Object3D, m: Materials, op: Operator, uniform: THREE.Material, kit: THREE.Material) {
  const skin = cachedMat(`skin:${op.skin}:${m.skin.uuid}`, () => {
    const s = m.skin.clone();
    s.color.setHex(op.skin);
    return s;
  });
  const hair = cachedMat(`hair:${op.hair}`, () => new THREE.MeshStandardMaterial({ color: op.hair, roughness: 1 }));
  const covered = op.face === 'balaclava' || op.face === 'gasmask';
  // skull and jaw: knit balaclava / hood fabric, or skin
  const skull = covered ? m.webbing : skin;
  mesh(sphere(0.1), skull, head, { pos: [0, 0.06, 0.005], scale: [0.9, 1.1, 1.02] });
  mesh(sphere(0.06), skull, head, { pos: [0, -0.005, 0.04], scale: [1, 0.85, 1] });
  if (!covered) {
    for (const s of [-1, 1]) {
      mesh(sphere(0.018), skin, head, { pos: [s * 0.088, 0.055, 0.0], scale: [0.5, 1, 0.8] }); // ears
      mesh(sphere(0.011), m.hole, head, { pos: [s * 0.034, 0.078, 0.086] }); // eyes
      mesh(rbox(0.03, 0.007, 0.01, 0.003), hair, head, { pos: [s * 0.034, 0.1, 0.088], rot: [0, 0, s * -0.12] }); // brows
    }
    mesh(rbox(0.022, 0.04, 0.03, 0.01), skin, head, { pos: [0, 0.055, 0.1] }); // nose
    mesh(rbox(0.04, 0.006, 0.01, 0.003), m.sole, head, { pos: [0, 0.015, 0.093] }); // mouth line
    // short hair under any headgear
    mesh(cached('hair', () => new THREE.SphereGeometry(0.104, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42)), hair, head, { pos: [0, 0.07, -0.004], scale: [0.92, 1.05, 1.05] });
  }
  if (op.face === 'balaclava') mesh(sphere(0.03), skin, head, { pos: [0, 0.08, 0.075], scale: [1.9, 0.6, 0.6] }); // eye slot
  if (op.face === 'beard') {
    mesh(sphere(0.064), hair, head, { pos: [0, -0.008, 0.046], scale: [1.04, 0.9, 1.02] });
    mesh(rbox(0.06, 0.014, 0.02, 0.006), hair, head, { pos: [0, 0.03, 0.098] }); // moustache
  }
  if (op.face === 'shemagh') {
    // scarf wrapped over the head and lower face, eyes left open
    mesh(sphere(0.108), m.coyote, head, { pos: [0, 0.07, 0.0], scale: [0.95, 1.05, 1.05] });
    mesh(sphere(0.07), m.coyote, head, { pos: [0, 0.0, 0.05], scale: [1.08, 0.95, 1.05] });
    mesh(cached('wrap', () => new THREE.TorusGeometry(0.09, 0.022, 10, 32)), m.coyote, head, { pos: [0, 0.03, 0.02], rot: [1.3, 0, 0] });
    mesh(rbox(0.13, 0.03, 0.02, 0.01), skin, head, { pos: [0, 0.08, 0.098] }); // eye gap
  }
  if (op.face === 'gasmask') {
    const mask = group(head, { pos: [0, 0.05, 0.09] });
    mesh(sphere(0.07), m.rubber, mask, { scale: [1.05, 1.1, 0.6] });
    for (const s of [-1, 1]) {
      mesh(cached('lensr', () => new THREE.TorusGeometry(0.024, 0.006, 10, 24)), m.polymer, mask, { pos: [s * 0.034, 0.03, 0.035] });
      mesh(cached('lens', () => new THREE.CircleGeometry(0.024, 24)), m.visor, mask, { pos: [s * 0.034, 0.03, 0.037] });
    }
    mesh(cached('voice', () => new THREE.CylinderGeometry(0.022, 0.026, 0.03, 20)), m.polymer, mask, { pos: [0, -0.035, 0.035], rot: [Math.PI / 2, 0, 0] });
    const filter = group(mask, { pos: [-0.06, -0.035, 0.01], rot: [0, 0, 0.6] });
    mesh(cached('filter', () => new THREE.CylinderGeometry(0.03, 0.03, 0.05, 24)), m.parkerized, filter, { rot: [0, 0, Math.PI / 2] });
    mesh(cached('filterc', () => new THREE.CylinderGeometry(0.031, 0.031, 0.008, 24)), m.rubber, filter, { pos: [-0.026, 0, 0], rot: [0, 0, Math.PI / 2] });
    for (const s of [-1, 1]) mesh(rbox(0.008, 0.015, 0.12, 0.003), m.rubber, head, { pos: [s * 0.088, 0.07, 0.02] }); // straps
  }
  // eyewear
  if (op.eyes === 'goggles') {
    mesh(rbox(0.17, 0.042, 0.034, 0.016, 4), m.visor, head, { pos: [0, 0.085, 0.088] });
    mesh(rbox(0.178, 0.05, 0.02, 0.016, 4), m.rubber, head, { pos: [0, 0.085, 0.075] });
    for (const s of [-1, 1]) mesh(rbox(0.006, 0.012, 0.11, 0.002), m.rubber, head, { pos: [s * 0.09, 0.085, 0.025] });
  } else if (op.eyes === 'sunglasses') {
    mesh(rbox(0.15, 0.03, 0.012, 0.012, 4), m.visor, head, { pos: [0, 0.082, 0.102] });
    for (const s of [-1, 1]) mesh(rbox(0.004, 0.006, 0.09, 0.002), m.polymer, head, { pos: [s * 0.078, 0.085, 0.055] });
  } else if (op.eyes === 'aviators') {
    for (const s of [-1, 1]) mesh(sphere(0.022), m.visor, head, { pos: [s * 0.035, 0.074, 0.098], scale: [1.1, 0.9, 0.25] });
    mesh(rbox(0.03, 0.003, 0.003, 0.001), m.brass, head, { pos: [0, 0.085, 0.1] });
    for (const s of [-1, 1]) mesh(rbox(0.003, 0.004, 0.09, 0.001), m.brass, head, { pos: [s * 0.075, 0.08, 0.055] });
  }
  // headset (not under a hood)
  if (op.head !== 'hood') {
    for (const s of [-1, 1]) {
      mesh(cached('cup', () => new THREE.CylinderGeometry(0.036, 0.036, 0.032, 28)), m.polymer, head, { pos: [s * 0.098, 0.04, 0.0], rot: [0, 0, Math.PI / 2] });
      mesh(cached('cupr', () => new THREE.TorusGeometry(0.026, 0.006, 8, 24)), m.rubber, head, { pos: [s * 0.116, 0.04, 0.0], rot: [0, Math.PI / 2, 0] });
    }
    if (op.face !== 'gasmask') mesh(cached('mic', () => new THREE.CylinderGeometry(0.003, 0.003, 0.09, 8)), m.rubber, head, { pos: [0.07, 0.0, 0.07], rot: [0.2, 0.9, Math.PI / 2] });
  }
  // headgear
  if (op.head === 'boonie') {
    const hat = group(head, { pos: [0, 0.12, 0] });
    mesh(lathe('boonie', [[0.0, 0.07], [0.09, 0.065], [0.105, 0.04], [0.112, 0.0], [0.19, -0.02], [0.19, -0.028], [0.11, -0.01], [0.0, -0.01]]), uniform, hat);
    mesh(cached('hatband', () => new THREE.TorusGeometry(0.108, 0.008, 8, 40)), m.webbing, hat, { pos: [0, 0.015, 0], rot: [Math.PI / 2, 0, 0] });
  } else if (op.head === 'cap') {
    // ball cap worn backwards
    const cap = group(head, { pos: [0, 0.1, 0], rot: [0, Math.PI, 0] });
    mesh(cached('capc', () => new THREE.SphereGeometry(0.108, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.5)), kit, cap, { scale: [0.95, 0.8, 1.02] });
    mesh(rbox(0.13, 0.008, 0.08, 0.004), kit, cap, { pos: [0, 0.0, 0.13], rot: [-0.12, 0, 0] });
    mesh(sphere(0.012), kit, cap, { pos: [0, 0.087, 0] });
  } else if (op.head === 'hood') {
    mesh(sphere(0.118), m.gearBlack, head, { pos: [0, 0.07, -0.02], scale: [0.98, 1.08, 1.0] });
    mesh(cached('hoodrim', () => new THREE.TorusGeometry(0.09, 0.016, 10, 32)), m.gearBlack, head, { pos: [0, 0.06, 0.06], rot: [0.15, 0, 0], scale: [1, 1.2, 1] });
  } else {
    const helm = group(head, { pos: [0, 0.1, 0.0] });
    mesh(cached('shell', () => new THREE.SphereGeometry(0.135, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.5)), m.helmet, helm, { scale: [0.95, 0.95, 1.05] });
    for (const s of [-1, 1]) mesh(rbox(0.01, 0.04, 0.07, 0.01), m.webbing, helm, { pos: [s * 0.122, -0.02, 0.0] });
    mesh(cached('rim', () => new THREE.TorusGeometry(0.128, 0.007, 10, 48)), m.rubber, helm, { pos: [0, -0.002, 0], rot: [Math.PI / 2, 0, 0], scale: [0.95, 1.05, 1] });
    for (const s of [-1, 1]) {
      mesh(rbox(0.012, 0.03, 0.15, 0.005), m.polymer, helm, { pos: [s * 0.126, 0.018, 0.0], rot: [0, 0, s * 0.15] });
      for (let i = 0; i < 4; i++) mesh(rbox(0.004, 0.006, 0.006, 0.001), m.hole, helm, { pos: [s * 0.133, 0.018, -0.05 + i * 0.033], rot: [0, 0, s * 0.15] });
      mesh(rbox(0.01, 0.07, 0.012, 0.003), m.webbing, helm, { pos: [s * 0.11, -0.09, 0.03] });
    }
    mesh(rbox(0.09, 0.05, 0.004, 0.003), kit, helm, { pos: [0, 0.09, -0.04], rot: [-0.9, 0, 0] });
    mesh(rbox(0.11, 0.06, 0.05, 0.016, 4), kit, helm, { pos: [0, 0.02, -0.13] });
    mesh(rbox(0.008, 0.008, 0.004, 0.002), m.lens, helm, { pos: [0.05, 0.11, -0.08] });
    if (op.heavy) mesh(rbox(0.2, 0.06, 0.02, 0.01, 4), m.helmet, helm, { pos: [0, -0.02, 0.13], rot: [0.2, 0, 0] }); // brow armour
    if (op.head === 'nvg') {
      mesh(rbox(0.05, 0.045, 0.02, 0.01, 4), m.parkerized, helm, { pos: [0, 0.03, 0.135] });
      const nvg = group(helm, { pos: [0, 0.0, 0.17], rot: [-1.25, 0, 0] });
      mesh(rbox(0.04, 0.03, 0.05, 0.01, 4), m.parkerized, nvg, {});
      for (const s of [-1, 1]) {
        mesh(cached('tube', () => new THREE.CylinderGeometry(0.018, 0.02, 0.07, 28)), m.polymer, nvg, { pos: [s * 0.03, 0, 0.04], rot: [Math.PI / 2, 0, 0] });
        mesh(cached('tubel', () => new THREE.CylinderGeometry(0.016, 0.016, 0.003, 28)), m.nvgGlass, nvg, { pos: [s * 0.03, 0, 0.076], rot: [Math.PI / 2, 0, 0] });
      }
    }
  }
}

/**
 * Fully kitted operator, sculpted from smooth lathe and tapered parts with
 * ~300 details. Faces +Z, origin at the feet.
 * Named pivots for animation: hips, torso, head, thighL/R, kneeL/R, rifle.
 */
export function buildSoldier(m: Materials, look: SoldierLook, weapon: WeaponCfg | null): THREE.Group {
  const root = new THREE.Group();
  root.name = 'soldier';
  const op = operatorById(look.operator ?? 'ghost');
  const { uniform, kit } = lookMats(m, look);

  // ---------------------------------------------------------------- pelvis + belt
  const hips = group(root, { pos: [0, 0.99, 0], name: 'hips' });
  mesh(lathe('pelvis', [[0.0, -0.13], [0.11, -0.12], [0.155, -0.07], [0.17, 0.0], [0.168, 0.08], [0.16, 0.12]]), uniform, hips, { scale: [1, 1, 0.72] });
  mesh(rbox(0.36, 0.06, 0.26, 0.025, 4), kit, hips, { pos: [0, 0.085, 0] }); // battle belt
  mesh(rbox(0.37, 0.012, 0.265, 0.004), m.webbing, hips, { pos: [0, 0.105, 0] }); // inner belt edge
  mesh(rbox(0.052, 0.036, 0.012, 0.005), m.parkerized, hips, { pos: [0, 0.085, 0.132] }); // buckle
  for (const [x, z] of [[0.17, 0.06], [-0.17, 0.06], [0.18, -0.05], [-0.15, -0.1], [0.05, -0.13]] as const) {
    const p = mesh(rbox(0.07, 0.09, 0.05, 0.014, 4), kit, hips, { pos: [x, 0.05, z], rot: [0, Math.atan2(x, z), 0] });
    mesh(rbox(0.074, 0.026, 0.054, 0.01, 4), kit, p, { pos: [0, 0.04, 0] });
  }
  mesh(rbox(0.12, 0.1, 0.05, 0.025, 4), m.webbing, hips, { pos: [-0.08, -0.02, -0.13] }); // dump pouch
  // trouser seam folds at the crotch
  mesh(rbox(0.004, 0.08, 0.2, 0.002), m.webbing, hips, { pos: [0, -0.09, 0], scale: [1, 1, 0.7] });

  // ---------------------------------------------------------------- legs
  for (const s of [-1, 1] as const) {
    const side = s === 1 ? 'L' : 'R';
    const thigh = group(hips, { pos: [s * 0.095, -0.06, 0], name: `thigh${side}` });
    mesh(lathe('thigh', [[0.0, -0.44], [0.058, -0.43], [0.064, -0.38], [0.076, -0.28], [0.087, -0.14], [0.09, -0.05], [0.082, 0.03], [0.0, 0.05]]), uniform, thigh);
    // cargo pocket with flap
    const cp = group(thigh, { pos: [s * 0.075, -0.2, 0.01], rot: [0, s * 0.35, 0] });
    mesh(rbox(0.035, 0.13, 0.12, 0.012, 4), uniform, cp);
    mesh(rbox(0.04, 0.03, 0.125, 0.01, 4), uniform, cp, { pos: [0.002, 0.06, 0] });
    if (s === -1) {
      const hol = group(thigh, { pos: [-0.1, -0.16, 0.0] });
      mesh(rbox(0.04, 0.17, 0.09, 0.016, 4), m.polymer, hol, {});
      mesh(rbox(0.045, 0.04, 0.11, 0.01, 4), m.polymer, hol, { pos: [0, 0.07, 0] });
      mesh(rbox(0.03, 0.045, 0.06, 0.01, 4), m.polymer, hol, { pos: [0.002, 0.115, -0.02] });
      for (const y of [-0.03, -0.1]) mesh(cached(`strap${y}`, () => new THREE.TorusGeometry(0.092, 0.008, 6, 32)), m.webbing, thigh, { pos: [0, y - 0.08, 0], rot: [Math.PI / 2, 0, 0] });
    }
    const knee = group(thigh, { pos: [0, -0.43, 0], name: `knee${side}` });
    mesh(sphere(0.066), uniform, knee, {});
    const kp = group(knee, { pos: [0, 0.0, 0.062] });
    mesh(rbox(0.11, 0.13, 0.04, 0.02, 4), m.polymer, kp, {});
    mesh(rbox(0.09, 0.05, 0.012, 0.005), m.rubber, kp, { pos: [0, 0.0, 0.02] });
    for (const y of [0.045, -0.05]) mesh(cached(`kstrap${y}`, () => new THREE.TorusGeometry(0.072, 0.007, 6, 32)), m.webbing, knee, { pos: [0, y, -0.005], rot: [Math.PI / 2, 0, 0] });
    mesh(lathe('calf', [[0.0, -0.4], [0.05, -0.39], [0.054, -0.33], [0.068, -0.17], [0.066, -0.06], [0.06, 0.0], [0.0, 0.02]]), uniform, knee, { pos: [0, -0.01, -0.006] });
    // boot: shaft, rounded toe, heel, sole with lugs, laces
    const ankle = group(knee, { pos: [0, -0.42, 0] });
    mesh(lathe('bootshaft', [[0.0, -0.08], [0.064, -0.08], [0.066, 0.0], [0.07, 0.08], [0.0, 0.085]]), m.boot, ankle);
    mesh(rbox(0.11, 0.09, 0.2, 0.04, 5), m.boot, ankle, { pos: [0, -0.06, 0.03] });
    mesh(sphere(1), m.boot, ankle, { pos: [0, -0.07, 0.125], scale: [0.058, 0.048, 0.07] }); // toe box
    mesh(rbox(0.122, 0.03, 0.29, 0.012, 3), m.sole, ankle, { pos: [0, -0.112, 0.045] });
    for (let i = 0; i < 7; i++) mesh(rbox(0.124, 0.007, 0.014, 0.003), m.rubber, ankle, { pos: [0, -0.127, -0.08 + i * 0.042] });
    for (let i = 0; i < 6; i++) {
      mesh(rbox(0.05, 0.004, 0.006, 0.002), m.sole, ankle, { pos: [0, 0.06 - i * 0.026, 0.066 - i * 0.003], rot: [0.3, 0, 0] });
      for (const e of [-1, 1]) mesh(sphere(0.004), m.parkerized, ankle, { pos: [e * 0.026, 0.06 - i * 0.026, 0.064 - i * 0.003] }); // eyelets
    }
  }

  // ---------------------------------------------------------------- torso
  const torso = group(hips, { pos: [0, 0.1, 0], name: 'torso' });
  mesh(lathe('torso', [[0.0, -0.02], [0.15, 0.0], [0.16, 0.06], [0.166, 0.15], [0.178, 0.28], [0.188, 0.38], [0.182, 0.46], [0.145, 0.52], [0.075, 0.555], [0.0, 0.56]]), uniform, torso, { scale: [op.bulk, 1, 0.64 * op.bulk] });
  // plate carrier: rounded plates, cummerbund, shoulder pads, stitching
  const plateF = group(torso, { pos: [0, 0.3, 0.122 * op.bulk], scale: [op.bulk, 1, 1] });
  mesh(rbox(0.3, 0.34, 0.055, 0.022, 5), kit, plateF, {});
  mesh(rbox(0.29, 0.0015, 0.0015, 0.0005), m.webbing, plateF, { pos: [0, 0.165, 0.028] });
  molle(plateF, m, kit, 0, 0.09, 0.028, 0.26, 2, 1);
  for (let i = 0; i < 3; i++) magPouch(plateF, m, kit, -0.085 + i * 0.085, -0.09, 0.05);
  mesh(rbox(0.16, 0.08, 0.025, 0.01, 4), kit, plateF, { pos: [0, 0.03, 0.035] }); // admin
  mesh(rbox(0.07, 0.045, 0.004, 0.002), m.webbing, plateF, { pos: [0.045, 0.04, 0.049] }); // ID patch
  mesh(cached('tq', () => new THREE.CylinderGeometry(0.016, 0.016, 0.09, 20)), m.rubber, plateF, { pos: [-0.06, 0.035, 0.05], rot: [0, 0, Math.PI / 2] });
  const plateB = group(torso, { pos: [0, 0.3, -0.122 * op.bulk], scale: [op.bulk, 1, 1] });
  mesh(rbox(0.3, 0.36, 0.055, 0.022, 5), kit, plateB, {});
  molle(plateB, m, kit, 0, 0.12, -0.028, 0.26, 6, -1);
  const radio = group(plateB, { pos: [0.08, 0.02, -0.06] });
  mesh(rbox(0.07, 0.15, 0.045, 0.012, 4), kit, radio, {});
  mesh(rbox(0.05, 0.11, 0.035, 0.006, 4), m.polymer, radio, { pos: [0, 0.07, 0] });
  mesh(cached('ant', () => new THREE.CylinderGeometry(0.004, 0.0035, 0.32, 10)), m.rubber, radio, { pos: [0.015, 0.28, 0] });
  mesh(cached('antb', () => new THREE.CylinderGeometry(0.008, 0.008, 0.02, 16)), m.parkerized, radio, { pos: [0.015, 0.13, 0] });
  mesh(rbox(0.12, 0.22, 0.04, 0.025, 5), kit, plateB, { pos: [-0.05, -0.02, -0.05] }); // hydration
  for (const s of [-1, 1]) {
    mesh(rbox(0.05, 0.18, 0.23, 0.02, 4), kit, torso, { pos: [s * 0.172, 0.22, 0] });
    mesh(rbox(0.08, 0.035, 0.27, 0.014, 4), kit, torso, { pos: [s * 0.1, 0.49, 0] });
    mesh(rbox(0.06, 0.06, 0.012, 0.005), m.webbing, torso, { pos: [s * 0.1, 0.455, 0.14] });
  }
  mesh(cached('neck', () => new THREE.CylinderGeometry(0.05, 0.058, 0.1, 28)), m.webbing, torso, { pos: [0, 0.55, 0] });
  mesh(cached('shemagh', () => new THREE.TorusGeometry(0.07, 0.03, 14, 32)), m.ranger, torso, { pos: [0, 0.525, 0], rot: [Math.PI / 2, 0, 0] });

  // ---------------------------------------------------------------- head: face, eyewear, headgear (per operator)
  const head = group(torso, { pos: [0, 0.6, 0.0], name: 'head' });
  buildHead(head, m, op, uniform, kit);
  if (op.heavy) {
    // breacher armour: shoulder pauldrons and a neck guard
    for (const s of [-1, 1]) {
      const pd = group(torso, { pos: [s * 0.2, 0.47, 0], rot: [0, 0, s * -0.5] });
      mesh(rbox(0.1, 0.03, 0.17, 0.014, 4), kit, pd);
      mesh(rbox(0.09, 0.025, 0.15, 0.012, 4), kit, pd, { pos: [s * 0.03, -0.035, 0], rot: [0, 0, s * -0.3] });
    }
    mesh(cached('collar', () => new THREE.TorusGeometry(0.085, 0.03, 12, 32, Math.PI * 1.4)), kit, torso, { pos: [0, 0.53, 0.0], rot: [Math.PI / 2, 0, Math.PI * 0.8] });
    mesh(rbox(0.16, 0.12, 0.04, 0.02, 4), kit, hips, { pos: [0, -0.08, 0.13] }); // groin plate
  }

  // ---------------------------------------------------------------- weapon + IK arms
  const shoulderR = new THREE.Vector3(-0.2, 0.46, 0);
  const shoulderL = new THREE.Vector3(0.19, 0.46, 0.06);
  if (weapon) {
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
    arm(torso, m, shoulderR, wristR, new THREE.Vector3(-0.5, 0.0, -0.1), uniform, kit, true);
    arm(torso, m, shoulderL, wristL, new THREE.Vector3(0.45, 0.1, 0.1), uniform, kit, false);
  }

  root.scale.setScalar(op.height);
  bakeStatic(root, ['hips', 'torso', 'head', 'thighL', 'thighR', 'kneeL', 'kneeR']);
  root.traverse((o) => {
    o.frustumCulled = false;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return root;
}
