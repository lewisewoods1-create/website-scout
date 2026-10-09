import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Materials } from './materials';
import type { Loadout, MagId, MuzzleId, OpticId, UnderId, WeaponId } from './loadout';
import { group, mesh, rbox, type PlaceOpts } from './util';
import { acogReticleTex, dotReticleTex, markingTex, reticleTex } from './textures';
import { camoMaterial, type CamoId } from './camos';

/**
 * Procedural weapons, each 150-250 parts.
 * Local space: -Z forward (muzzle), +Y up, origin at the receiver.
 *
 * Named nodes used by animation code:
 *   mag, chargingHandle, muzzle, ejectionPort, sight, gripAnchor, guardAnchor, reticle
 */
export interface WeaponCfg {
  weapon: WeaponId;
  optic: OpticId;
  muzzle: MuzzleId;
  under: UnderId;
  mag: MagId;
  camo: CamoId;
}

export function cfgFromLoadout(l: Loadout, slot: 'primary' | 'secondary' = 'primary'): WeaponCfg {
  if (slot === 'secondary') {
    const pistol = l.secondary === 'p9';
    return {
      weapon: l.secondary,
      optic: 'iron',
      muzzle: pistol && l.secAttach === 'suppressor' ? 'suppressor' : 'none',
      under: 'none',
      mag: pistol && l.secAttach === 'extmag' ? 'ext' : 'std',
      camo: l.secCamo ?? 'none',
    };
  }
  return { weapon: l.weapon, optic: l.optic, muzzle: l.muzzle, under: l.under, mag: l.mag, camo: l.camo };
}

const cyl = (rt: number, rb: number, h: number, seg = 32) => new THREE.CylinderGeometry(rt, rb, h, seg);
const X90: [number, number, number] = [Math.PI / 2, 0, 0];
const Z90: [number, number, number] = [0, 0, Math.PI / 2];

let holoRet: THREE.Texture | null = null;
let dotRet: THREE.Texture | null = null;
let acogRet: THREE.Texture | null = null;

export function buildWeapon(mats: Materials, cfg: WeaponCfg, firstPerson = true): THREE.Group {
  const paint = camoMaterial(cfg.camo, mats.anodized);
  const m: Materials = cfg.camo === 'none' ? mats : { ...mats, anodized: paint, fde: paint, wood: paint };
  const builders: Record<WeaponId, (m: Materials, cfg: WeaponCfg) => THREE.Group> = {
    kr4: buildKR4,
    vk47: buildVK47,
    vx9: buildVX9,
    sp45: buildSP45,
    lm5: buildLM5,
    pk7: buildPK7,
    kestrel: buildKestrel,
    warden: buildWarden,
    talon: buildTalon,
    vulture: buildVulture,
    sk10: buildSK10,
    mk20: buildMK20,
    p9: buildP9,
    r357: buildR357,
  };
  const build = builders[cfg.weapon];
  const root = build(m, cfg);
  root.userData.cfg = cfg;
  root.userData.kind = cfg.weapon === 'p9' ? 'pistol' : cfg.weapon === 'r357' ? 'revolver' : 'rifle';
  if (!firstPerson) {
    const ret = root.getObjectByName('reticle');
    ret?.parent?.remove(ret);
  }
  return root;
}

// ---------------------------------------------------------------- shared attachments

/** Mounts an optic on a rail top at (y, z). Returns the eye-line point. */
function addOptic(root: THREE.Object3D, m: Materials, kind: OpticId, y: number, z: number) {
  if (kind === 'holo') {
    const sight = group(root, { pos: [0, y, z] });
    mesh(rbox(0.032, 0.012, 0.085, 0.002), m.anodized, sight, { pos: [0, 0.007, 0] });
    mesh(rbox(0.006, 0.008, 0.018, 0.002), m.anodizedEdge, sight, { pos: [0.019, 0.004, 0.02] });
    for (const s of [-1, 1]) mesh(rbox(0.006, 0.044, 0.07, 0.0025), m.anodized, sight, { pos: [s * 0.0205, 0.035, -0.004] });
    mesh(rbox(0.047, 0.006, 0.07, 0.0025), m.anodized, sight, { pos: [0, 0.059, -0.004] });
    for (const zz of [-0.038, 0.03]) mesh(rbox(0.04, 0.004, 0.004, 0.001), m.anodizedEdge, sight, { pos: [0, 0.014, zz] });
    const glassGeo = new THREE.PlaneGeometry(0.035, 0.042);
    mesh(glassGeo, m.glass, sight, { pos: [0, 0.035, -0.036] });
    mesh(glassGeo, m.glass, sight, { pos: [0, 0.035, 0.03] });
    holoRet ??= reticleTex();
    reticle(sight, holoRet, 0.03, [0, 0.035, -0.0365]);
    mesh(cyl(0.008, 0.008, 0.012, 20), m.anodizedEdge, sight, { pos: [0.02, 0.015, 0.04], rot: Z90 });
    for (let i = 0; i < 3; i++) mesh(rbox(0.006, 0.004, 0.006, 0.0015), m.rubber, sight, { pos: [0, 0.015, 0.045 - i * 0.008] });
    group(sight, { pos: [0, 0.035, -0.036], name: 'sight' });
  } else if (kind === 'acog') {
    const sight = group(root, { pos: [0, y, z] });
    mesh(rbox(0.028, 0.012, 0.07, 0.002), m.anodized, sight, { pos: [0, 0.006, 0] }); // mount
    for (const zz of [-0.025, 0.025]) mesh(rbox(0.034, 0.008, 0.012, 0.002), m.anodizedEdge, sight, { pos: [0, 0.004, zz] }); // clamps
    const cy = 0.036;
    // body: open double-sided shells so, when aiming, the eye looks down a dark tube
    const shell = (m.anodized as THREE.MeshStandardMaterial).clone();
    shell.side = THREE.DoubleSide;
    const tube = (r0: number, r1: number, len: number, zz: number, mat: THREE.Material) => {
      const g = new THREE.CylinderGeometry(r1, r0, len, 36, 1, true);
      g.rotateX(Math.PI / 2);
      mesh(g, mat, sight, { pos: [0, cy, zz] });
    };
    tube(0.0175, 0.0175, 0.075, 0.0, shell);
    tube(0.0175, 0.023, 0.025, -0.05, shell); // objective bell
    tube(0.023, 0.023, 0.016, -0.07, shell);
    tube(0.0175, 0.0165, 0.02, 0.047, shell); // eyepiece
    tube(0.0175, 0.0175, 0.012, 0.062, m.rubber);
    mesh(new THREE.TorusGeometry(0.0175, 0.0028, 10, 36), m.rubber, sight, { pos: [0, cy, 0.068] });
    mesh(new THREE.TorusGeometry(0.023, 0.002, 8, 36), m.anodizedEdge, sight, { pos: [0, cy, -0.078] });
    // turrets + fibre-optic tube on top
    mesh(cyl(0.008, 0.008, 0.012), m.anodizedEdge, sight, { pos: [0, cy + 0.022, 0.005] });
    mesh(cyl(0.008, 0.008, 0.012), m.anodizedEdge, sight, { pos: [0.022, cy, 0.005], rot: Z90 });
    mesh(cyl(0.0035, 0.0035, 0.05, 12), m.nvgGlass, sight, { pos: [0, cy + 0.02, -0.03], rot: X90 });
    mesh(new THREE.CircleGeometry(0.022, 36), m.glass, sight, { pos: [0, cy, -0.077], rot: [0, Math.PI, 0] });
    mesh(new THREE.CircleGeometry(0.0165, 36), m.glass, sight, { pos: [0, cy, 0.06] });
    acogRet ??= acogReticleTex();
    reticle(sight, acogRet, 0.03, [0, cy, 0.055]);
    group(sight, { pos: [0, cy, 0.055], name: 'sight' });
  } else if (kind === 'reflex') {
    const sight = group(root, { pos: [0, y, z] });
    mesh(rbox(0.026, 0.01, 0.05, 0.002), m.anodized, sight, { pos: [0, 0.005, 0] });
    mesh(rbox(0.014, 0.014, 0.02, 0.003), m.anodized, sight, { pos: [0, 0.015, 0.005] });
    // open tube: outer shell + front/back rings
    mesh(new THREE.CylinderGeometry(0.0175, 0.0175, 0.042, 28, 1, true).rotateX(Math.PI / 2), m.anodized, sight, { pos: [0, 0.036, 0] });
    for (const zz of [-0.021, 0.021]) mesh(new THREE.TorusGeometry(0.0172, 0.0022, 8, 28), m.anodizedEdge, sight, { pos: [0, 0.036, zz] });
    mesh(new THREE.CircleGeometry(0.016, 28), m.glass, sight, { pos: [0, 0.036, -0.019] });
    dotRet ??= dotReticleTex();
    reticle(sight, dotRet, 0.012, [0, 0.036, -0.0195]);
    mesh(cyl(0.0065, 0.0065, 0.01, 16), m.anodizedEdge, sight, { pos: [0.02, 0.036, 0.004], rot: Z90 }); // brightness knob
    mesh(rbox(0.008, 0.012, 0.012, 0.002), m.anodizedEdge, sight, { pos: [-0.016, 0.01, 0.0] }); // mount lever
    group(sight, { pos: [0, 0.036, -0.019], name: 'sight' });
  } else if (kind === 'sniper') {
    sniperScope(root, m, y, z);
  }
}

/**
 * Long variable-power scope (30 mm tube, 50 mm objective) on two rings.
 * Everything that crosses the line of sight is an open shell, so looking down
 * the eyepiece shows a dark tube; the game draws the full-screen reticle.
 */
function sniperScope(root: THREE.Object3D, m: Materials, y: number, z: number) {
  const sc = group(root, { pos: [0, y, z] });
  const cy = 0.042;
  const shell = shellMat(m.anodized);
  const tube = (rRear: number, rFront: number, len: number, zz: number, mat: THREE.Material = shell) =>
    mesh(cached(`scope${rRear}|${rFront}|${len}`, () => new THREE.CylinderGeometry(rRear, rFront, len, 32, 1, true).rotateX(Math.PI / 2)), mat, sc, { pos: [0, cy, zz] });
  // ridged grip ring made of small bars, so it never caps the tube
  const ridges = (r: number, len: number, zz: number, n: number, mat: THREE.Material) => {
    const list: BoxSpec[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      list.push([0.0024, 0.0022, len, Math.cos(a) * r, cy + Math.sin(a) * r, zz, 0, 0, a]);
    }
    boxes(sc, mat, list, 0.0006);
  };
  // eyepiece: rubber eyecup, ocular bell, diopter ring
  tube(0.0205, 0.0205, 0.012, 0.177, m.rubber);
  mesh(cached('scopeCup', () => new THREE.TorusGeometry(0.0205, 0.0026, 10, 36)), m.rubber, sc, { pos: [0, cy, 0.183] });
  tube(0.0212, 0.0198, 0.05, 0.146);
  ridges(0.0213, 0.008, 0.162, 30, m.anodizedEdge);
  // magnification ring with throw lever + index dots
  tube(0.0196, 0.0196, 0.02, 0.111);
  ridges(0.0198, 0.013, 0.111, 28, m.anodizedEdge);
  mesh(rbox(0.006, 0.01, 0.012, 0.002), m.anodizedEdge, sc, { pos: [0.022, cy + 0.006, 0.111], rot: [0, 0, -0.3] });
  boxes(sc, m.lens, [[0.0012, 0.0012, 0.0012, 0, cy + 0.0201, 0.1], [0.0012, 0.0012, 0.0012, 0.006, cy + 0.0192, 0.1]], 0.0004);
  tube(0.0196, 0.015, 0.016, 0.093);
  tube(0.015, 0.015, 0.066, 0.052);
  // turret saddle: wider shell + bases off the axis
  tube(0.0182, 0.0182, 0.05, -0.004);
  for (const r of [0.0175, -0.0175]) mesh(cached('scopeSadEdge', () => new THREE.TorusGeometry(0.0168, 0.0016, 8, 32)), m.anodizedEdge, sc, { pos: [0, cy, -0.004 + r * 1.4] });
  // elevation (top) and windage (right) turrets with knurled caps, parallax knob on the left
  const turret = (rot: V3, pos: V3, r: number) => {
    const t = group(sc, { pos, rot });
    mesh(ccyl(0.0105, 0.0105, 0.01, 24), m.anodized, t, { pos: [0, 0.004, 0] });
    mesh(knurlGeo(r, 0.013, 26), m.anodizedEdge, t, { pos: [0, 0.0155, 0] });
    mesh(ccyl(r * 0.9, r * 0.9, 0.002, 24), m.anodized, t, { pos: [0, 0.0228, 0] });
    mesh(ccyl(0.0035, 0.0035, 0.002, 12), m.steel, t, { pos: [0, 0.0238, 0] });
    mesh(rbox(0.0012, 0.006, 0.0012, 0.0004), m.lens, t, { pos: [0, 0.0105, -r - 0.0004] });
    boxes(t, m.lens, [0, 1, 2, 3, 4].map((i) => [0.0008, 0.003, 0.0008, Math.sin(i * 0.5 - 1) * (r + 0.0002), 0.0125, -Math.cos(i * 0.5 - 1) * (r + 0.0002)] as BoxSpec), 0.0002);
  };
  turret([0, 0, 0], [0, cy + 0.016, -0.004], 0.0128);
  turret([0, 0, -Math.PI / 2], [0.016, cy, -0.004], 0.0122);
  const px = group(sc, { pos: [-0.016, cy, -0.004], rot: [0, 0, Math.PI / 2] });
  mesh(ccyl(0.011, 0.011, 0.01, 24), m.anodized, px, { pos: [0, 0.004, 0] });
  mesh(knurlGeo(0.015, 0.012, 30), m.anodizedEdge, px, { pos: [0, 0.015, 0] });
  mesh(ccyl(0.0135, 0.0135, 0.002, 24), m.anodized, px, { pos: [0, 0.022, 0] });
  // front tube, objective bell and housing
  tube(0.015, 0.015, 0.076, -0.067);
  tube(0.015, 0.0272, 0.04, -0.125);
  tube(0.0272, 0.0272, 0.04, -0.165);
  mesh(cached('scopeObjRing', () => new THREE.TorusGeometry(0.0272, 0.0018, 8, 40)), m.anodizedEdge, sc, { pos: [0, cy, -0.185] });
  mesh(cached('scopeObjGlass', () => new THREE.CircleGeometry(0.026, 36)), m.glass, sc, { pos: [0, cy, -0.18], rot: [0, Math.PI, 0] });
  mesh(cached('scopeEyeGlass', () => new THREE.CircleGeometry(0.0195, 36)), m.glass, sc, { pos: [0, cy, 0.168] });
  // rings: open bands on bases clamped to the rail, two cap screws a side + cross-bolt
  for (const zz of [-0.068, 0.052]) {
    mesh(cached('scopeRing', () => new THREE.CylinderGeometry(0.0182, 0.0182, 0.016, 32, 1, true).rotateX(Math.PI / 2)), m.anodizedEdge, sc, { pos: [0, cy, zz] });
    boxes(sc, m.hole, [[0.003, 0.0012, 0.0165, -0.0183, cy, zz], [0.003, 0.0012, 0.0165, 0.0183, cy, zz]], 0.0003);
    mesh(rbox(0.02, cy - 0.016, 0.016, 0.003), m.anodized, sc, { pos: [0, (cy - 0.016) / 2, zz] });
    mesh(rbox(0.032, 0.008, 0.018, 0.002), m.anodized, sc, { pos: [0, 0.004, zz] });
    const sp: Part[] = [];
    for (const s of [-1, 1]) for (const dz of [-0.0045, 0.0045]) sp.push([ccyl(0.0022, 0.0022, 0.003, 10), [s * 0.019, cy, zz + dz], Z90]);
    merged(sc, m.steel, sp);
    mesh(cached('scopeNut', () => new THREE.CylinderGeometry(0.0042, 0.0042, 0.004, 6)), m.steel, sc, { pos: [-0.018, 0.005, zz], rot: Z90 });
  }
  // flip-up caps: front stands up, rear swings left
  tube(0.0288, 0.0288, 0.012, -0.18, m.polymer);
  const fc = group(sc, { pos: [0, cy + 0.03, -0.187], rot: [2.0, 0, 0] });
  mesh(ccyl(0.029, 0.029, 0.004, 32), m.polymer, fc, { pos: [0, -0.029, -0.002], rot: X90 });
  mesh(rbox(0.012, 0.006, 0.006, 0.002), m.polymer, sc, { pos: [0, cy + 0.03, -0.184] });
  tube(0.0222, 0.0222, 0.01, 0.174, m.polymer);
  mesh(rbox(0.006, 0.01, 0.008, 0.002), m.polymer, sc, { pos: [-0.024, cy, 0.176] });
  // dark liner so the bore of the scope reads black from the eyepiece
  const lm = linerMat();
  mesh(cached('scopeLiner', () => new THREE.CylinderGeometry(0.0144, 0.0144, 0.29, 32, 1, true).rotateX(Math.PI / 2)), lm, sc, { pos: [0, cy, -0.025] });
  mesh(cached('scopeLinerEye', () => new THREE.CylinderGeometry(0.0202, 0.0202, 0.064, 32, 1, true).rotateX(Math.PI / 2)), lm, sc, { pos: [0, cy, 0.152] });
  mesh(cached('scopeStop', () => new THREE.RingGeometry(0.0143, 0.0203, 32)), stopMat(), sc, { pos: [0, cy, 0.121] });
  group(sc, { pos: [0, cy, 0.17], name: 'sight' });
}

let liner: THREE.Material | null = null;
/** Unlit black inside faces: a lit material picks up grazing reflections down a tube. */
let stop: THREE.Material | null = null;
function stopMat() {
  stop ??= new THREE.MeshBasicMaterial({ color: 0x030303 });
  return stop;
}
function linerMat() {
  liner ??= new THREE.MeshBasicMaterial({ color: 0x030303, side: THREE.BackSide });
  return liner;
}

function reticle(parent: THREE.Object3D, tex: THREE.Texture, size: number, pos: [number, number, number]) {
  const r = mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    parent,
    { pos, name: 'reticle' },
  );
  r.renderOrder = 10;
}

/** Picatinny section along Z on top of a receiver. */
function rail(root: THREE.Object3D, m: Materials, y: number, z0: number, z1: number, mat = m.anodized) {
  mesh(rbox(0.021, 0.006, z0 - z1, 0.001), mat, root, { pos: [0, y, (z0 + z1) / 2] });
  for (let z = z0 - 0.006; z > z1; z -= 0.01) mesh(rbox(0.022, 0.0045, 0.0052, 0.0008), m.anodizedEdge, root, { pos: [0, y + 0.0055, z] });
}

type MuzzleStyle = 'birdcage' | 'slant' | 'cone' | 'slotted' | 'brake' | 'cap' | 'prong';

function addMuzzle(muzzle: THREE.Object3D, m: Materials, kind: MuzzleId, style: MuzzleStyle, scale = 1) {
  if (kind === 'suppressor') {
    mesh(cyl(0.02, 0.02, 0.17, 32), m.parkerized, muzzle, { pos: [0, 0, -0.07], rot: X90 });
    mesh(cyl(0.021, 0.021, 0.02, 32), m.steel, muzzle, { pos: [0, 0, 0.012], rot: X90 });
    for (let i = 0; i < 5; i++) mesh(new THREE.TorusGeometry(0.0202, 0.0012, 6, 32), m.anodizedEdge, muzzle, { pos: [0, 0, -0.02 - i * 0.025] });
    mesh(cyl(0.005, 0.005, 0.002, 12), m.hole, muzzle, { pos: [0, 0, -0.1555], rot: X90 });
    muzzle.userData.tip = -0.16;
    return;
  }
  if (kind === 'comp') {
    mesh(cyl(0.0145, 0.0145, 0.07, 32), m.parkerized, muzzle, { pos: [0, 0, -0.005], rot: X90 });
    mesh(cyl(0.0155, 0.0155, 0.01, 32), m.steel, muzzle, { pos: [0, 0, 0.03], rot: X90 });
    for (let i = 0; i < 3; i++) {
      mesh(rbox(0.008, 0.004, 0.009, 0.002), m.hole, muzzle, { pos: [0, 0.0135, -0.025 + i * 0.016] });
      for (const s of [-1, 1]) mesh(rbox(0.004, 0.006, 0.009, 0.002), m.hole, muzzle, { pos: [s * 0.0135, 0.004, -0.025 + i * 0.016] });
    }
    mesh(cyl(0.006, 0.006, 0.003, 16), m.hole, muzzle, { pos: [0, 0, -0.0405], rot: X90 });
    muzzle.userData.tip = -0.04;
    return;
  }
  if (style !== 'birdcage' && style !== 'slant') {
    muzzleDevice(group(muzzle, { scale: [scale, scale, scale] }), m, style);
    muzzle.userData.tip = 0;
    return;
  }
  if (style === 'birdcage') {
    mesh(cyl(0.0135, 0.0135, 0.058, 24), m.steel, muzzle, { pos: [0, 0, 0.03], rot: X90 });
    mesh(cyl(0.0145, 0.0145, 0.012, 24), m.steel, muzzle, { pos: [0, 0, 0.055], rot: X90 });
    mesh(new THREE.TorusGeometry(0.0115, 0.0025, 8, 24), m.steel, muzzle, { pos: [0, 0, 0.001] });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mesh(rbox(0.004, 0.003, 0.024, 0.0012), m.hole, muzzle, { pos: [Math.cos(a) * 0.0125, Math.sin(a) * 0.0125, 0.02], rot: [0, 0, a + Math.PI / 2] });
    }
  } else {
    // AK slant brake: cut face
    mesh(cyl(0.0135, 0.0135, 0.05, 24), m.parkerized, muzzle, { pos: [0, 0, 0.025], rot: X90 });
    mesh(rbox(0.03, 0.012, 0.02, 0.003), m.parkerized, muzzle, { pos: [0, 0.008, 0.004], rot: [0.5, 0, 0] });
    for (let i = 0; i < 2; i++) mesh(rbox(0.004, 0.012, 0.006, 0.001), m.hole, muzzle, { pos: [0, 0.006, 0.02 + i * 0.014] });
  }
  mesh(cyl(0.006, 0.006, 0.003, 16), m.hole, muzzle, { pos: [0, 0, -0.0005], rot: X90 });
  muzzle.userData.tip = 0;
}

function anchors(root: THREE.Object3D, grip: [number, number, number], gripRake: number, guard: [number, number, number]) {
  group(root, { pos: grip, rot: [gripRake, 0, 0], name: 'gripAnchor' });
  group(root, { pos: guard, name: 'guardAnchor' });
}

// ---------------------------------------------------------------- KR-4 (AR pattern)

function buildKR4(m: Materials, cfg: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';

  // upper receiver
  mesh(rbox(0.032, 0.044, 0.205, 0.004), m.anodized, root, { pos: [0, 0.022, 0] });
  for (const s of [-1, 1]) mesh(rbox(0.002, 0.026, 0.17, 0.0008), m.anodizedEdge, root, { pos: [s * 0.0165, 0.018, -0.005] });
  mesh(rbox(0.003, 0.016, 0.052, 0.001), m.hole, root, { pos: [0.0158, 0.026, -0.005], name: 'ejectionPort' });
  mesh(rbox(0.0015, 0.018, 0.054, 0.0006), m.anodizedEdge, root, { pos: [0.021, 0.012, -0.005], rot: [0, 0, -0.9] });
  mesh(rbox(0.008, 0.018, 0.016, 0.003), m.anodized, root, { pos: [0.019, 0.03, 0.03] });
  mesh(cyl(0.008, 0.009, 0.034), m.anodized, root, { pos: [0.022, 0.032, 0.045], rot: [Math.PI / 2 - 0.15, 0, -0.3] });
  mesh(cyl(0.0095, 0.0095, 0.006), m.anodizedEdge, root, { pos: [0.026, 0.035, 0.064], rot: [Math.PI / 2 - 0.15, 0, -0.3] });
  mesh(cyl(0.007, 0.007, 0.05, 12), m.steel, root, { pos: [0.009, 0.026, -0.005], rot: X90 });

  rail(root, m, 0.047, 0.1, -0.43);
  for (let z = 0.08; z > -0.43; z -= 0.04) mesh(rbox(0.0006, 0.002, 0.002, 0.0002), m.lens, root, { pos: [0.0107, 0.049, z] });

  const ch = group(root, { name: 'chargingHandle' });
  mesh(rbox(0.012, 0.008, 0.06, 0.002), m.anodized, ch, { pos: [0, 0.04, 0.115] });
  mesh(rbox(0.04, 0.009, 0.014, 0.003), m.anodized, ch, { pos: [0, 0.04, 0.142] });
  mesh(rbox(0.012, 0.006, 0.01, 0.002), m.anodizedEdge, ch, { pos: [-0.022, 0.04, 0.142] });

  // lower receiver
  mesh(rbox(0.031, 0.036, 0.15, 0.004), m.anodized, root, { pos: [0, -0.016, 0.03] });
  mesh(rbox(0.034, 0.054, 0.072, 0.004), m.anodized, root, { pos: [0, -0.04, -0.036] });
  mesh(rbox(0.038, 0.008, 0.078, 0.003), m.anodizedEdge, root, { pos: [0, -0.066, -0.036] });
  for (let i = 0; i < 5; i++) mesh(rbox(0.036, 0.003, 0.004, 0.001), m.anodizedEdge, root, { pos: [0, -0.025 - i * 0.008, -0.073] });
  mesh(rbox(0.014, 0.005, 0.072, 0.002), m.anodized, root, { pos: [0, -0.06, 0.03] });
  mesh(rbox(0.014, 0.026, 0.006, 0.002), m.anodized, root, { pos: [0, -0.046, -0.004] });
  const trig = group(root, { pos: [0, -0.034, 0.018], name: 'trigger' });
  mesh(rbox(0.006, 0.024, 0.006, 0.002), m.steel, trig, { pos: [0, -0.01, 0.003], rot: [0.35, 0, 0] });
  mesh(cyl(0.006, 0.006, 0.004), m.anodizedEdge, root, { pos: [0.017, -0.006, 0.062], rot: Z90 });
  mesh(rbox(0.003, 0.004, 0.02, 0.001), m.steel, root, { pos: [0.0195, -0.006, 0.07], rot: [0.5, 0, 0] });
  mesh(cyl(0.0055, 0.0055, 0.005), m.anodizedEdge, root, { pos: [0.017, -0.018, -0.003], rot: Z90 });
  mesh(rbox(0.004, 0.022, 0.012, 0.0015), m.anodized, root, { pos: [-0.018, -0.008, -0.002] });
  for (const [y, z] of [[0.003, -0.06], [0.003, 0.085], [-0.01, 0.01], [-0.01, 0.04]]) {
    for (const s of [-1, 1]) mesh(cyl(0.0028, 0.0028, 0.002, 10), m.steel, root, { pos: [s * 0.0158, y, z], rot: Z90 });
  }
  mesh(rbox(0.0008, 0.01, 0.04, 0.0003), m.anodizedEdge, root, { pos: [-0.0158, -0.018, -0.035] });

  // pistol grip
  const grip = group(root, { pos: [0, -0.04, 0.077], rot: [-0.32, 0, 0] });
  mesh(rbox(0.03, 0.115, 0.044, 0.01, 3), m.polymer, grip, { pos: [0, -0.05, 0] });
  mesh(rbox(0.032, 0.012, 0.05, 0.004), m.polymer, grip, { pos: [0, -0.112, 0.002] });
  for (let i = 0; i < 3; i++) mesh(rbox(0.031, 0.012, 0.01, 0.004), m.polymer, grip, { pos: [0, -0.025 - i * 0.025, -0.022] });
  mesh(rbox(0.02, 0.03, 0.025, 0.006), m.polymer, grip, { pos: [0, -0.005, 0.025] });

  // buffer tube + stock
  mesh(cyl(0.0155, 0.0155, 0.2, 24), m.anodized, root, { pos: [0, 0.018, 0.2], rot: X90 });
  mesh(new THREE.TorusGeometry(0.017, 0.003, 8, 24), m.anodizedEdge, root, { pos: [0, 0.018, 0.112] });
  mesh(cyl(0.019, 0.019, 0.008, 24), m.anodized, root, { pos: [0, 0.018, 0.107], rot: X90 });
  for (let i = 0; i < 9; i++) mesh(rbox(0.004, 0.003, 0.012, 0.001), m.anodizedEdge, root, { pos: [0, 0.001, 0.14 + i * 0.016] });
  const sp = new THREE.Shape();
  sp.moveTo(0, 0.034);
  sp.lineTo(0.125, 0.04);
  sp.quadraticCurveTo(0.135, 0.04, 0.135, 0.03);
  sp.lineTo(0.135, -0.075);
  sp.quadraticCurveTo(0.13, -0.085, 0.12, -0.085);
  sp.lineTo(0.06, -0.07);
  sp.lineTo(0.0, -0.012);
  sp.lineTo(0, 0.034);
  const stockGeo = new THREE.ExtrudeGeometry(sp, { depth: 0.032, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 3, curveSegments: 8 });
  stockGeo.translate(0, 0, -0.016);
  mesh(stockGeo, m.fde, root, { pos: [0, 0.02, 0.215], rot: [0, -Math.PI / 2, 0] });
  mesh(rbox(0.036, 0.02, 0.09, 0.006), m.fde, root, { pos: [0, 0.052, 0.28] });
  for (let i = 0; i < 2; i++) for (const s of [-1, 1]) mesh(rbox(0.002, 0.026, 0.026, 0.005), m.hole, root, { pos: [s * 0.0195, -0.02, 0.26 + i * 0.04] });
  mesh(rbox(0.04, 0.13, 0.018, 0.006, 3), m.rubber, root, { pos: [0, -0.008, 0.358] });
  for (let i = 0; i < 6; i++) mesh(rbox(0.041, 0.003, 0.004, 0.001), m.rubber, root, { pos: [0, -0.06 + i * 0.022, 0.369] });
  mesh(rbox(0.014, 0.008, 0.04, 0.003), m.polymer, root, { pos: [0, -0.024, 0.255] });
  mesh(cyl(0.007, 0.007, 0.012), m.steel, root, { pos: [-0.021, 0.0, 0.31], rot: Z90 });

  // handguard (M-LOK)
  const hgLen = 0.31;
  const hgZ = -0.115 - hgLen / 2;
  const hg = new THREE.CylinderGeometry(0.026, 0.026, hgLen, 8, 1);
  hg.rotateY(Math.PI / 8);
  mesh(hg, m.anodized, root, { pos: [0, 0.018, hgZ], rot: X90 });
  for (const zz of [-0.115, -0.115 - hgLen]) mesh(new THREE.TorusGeometry(0.0255, 0.0035, 6, 8), m.anodizedEdge, root, { pos: [0, 0.018, zz], rot: [0, 0, Math.PI / 8] });
  for (let i = 0; i < 6; i++) {
    const z = -0.14 - i * 0.045;
    for (const a of [0, -Math.PI / 4, -Math.PI / 2, (-3 * Math.PI) / 4, Math.PI]) {
      const r = 0.0242;
      mesh(rbox(0.003, 0.009, 0.032, 0.0035), m.hole, root, { pos: [Math.cos(a) * r, 0.018 + Math.sin(a) * r, z], rot: [0, 0, a] });
    }
  }
  mesh(cyl(0.006, 0.006, 0.006), m.steel, root, { pos: [-0.027, 0.018, -0.13], rot: Z90 });

  // barrel + muzzle
  mesh(cyl(0.0095, 0.0095, 0.17, 20), m.parkerized, root, { pos: [0, 0.018, -0.5], rot: X90 });
  mesh(cyl(0.012, 0.012, 0.012, 20), m.parkerized, root, { pos: [0, 0.018, -0.436], rot: X90 });
  const muzzle = group(root, { pos: [0, 0.018, -0.6], name: 'muzzleBase' });
  addMuzzle(muzzle, m, cfg.muzzle, 'birdcage');

  addUnder(root, m, cfg.under, -0.008, -0.3, 0.026);

  // weapon light
  const light = group(root, { pos: [0.037, 0.018, -0.36] });
  mesh(rbox(0.014, 0.02, 0.03, 0.003), m.anodized, light, { pos: [-0.007, 0, 0.012] });
  mesh(cyl(0.0115, 0.0115, 0.085, 24), m.anodized, light, { pos: [0.004, 0, 0.0], rot: X90 });
  mesh(cyl(0.0145, 0.0115, 0.025, 24), m.anodized, light, { pos: [0.004, 0, -0.052], rot: X90 });
  mesh(cyl(0.0125, 0.0125, 0.002, 24), m.lens, light, { pos: [0.004, 0, -0.065], rot: X90 });
  for (let i = 0; i < 8; i++) mesh(new THREE.TorusGeometry(0.0118, 0.0012, 4, 20), m.anodizedEdge, light, { pos: [0.004, 0, 0.03 - i * 0.006] });

  // magazine (curved polymer)
  buildMag(root, m, m.fde, [0, -0.06, -0.036], 0.19, 0.04, 0.03, cfg.mag);

  // sights
  if (cfg.optic === 'iron') {
    // raised BUIS: rear aperture + front post on the rail
    const rear = group(root, { pos: [0, 0.058, 0.07] });
    mesh(rbox(0.02, 0.008, 0.03, 0.002), m.anodized, rear, {});
    for (const s of [-1, 1]) mesh(rbox(0.004, 0.026, 0.01, 0.0015), m.anodized, rear, { pos: [s * 0.009, 0.016, 0] });
    mesh(new THREE.TorusGeometry(0.0055, 0.0022, 8, 20), m.anodized, rear, { pos: [0, 0.024, 0] });
    group(rear, { pos: [0, 0.024, 0], name: 'sight' });
    const front = group(root, { pos: [0, 0.058, -0.41] });
    mesh(rbox(0.02, 0.008, 0.026, 0.002), m.anodized, front, {});
    for (const s of [-1, 1]) mesh(rbox(0.004, 0.028, 0.008, 0.0015), m.anodized, front, { pos: [s * 0.009, 0.016, 0] });
    mesh(rbox(0.0025, 0.02, 0.003, 0.0008), m.steel, front, { pos: [0, 0.016, 0] });
  } else {
    addOptic(root, m, cfg.optic, 0.053, -0.035);
    mesh(rbox(0.02, 0.008, 0.03, 0.002), m.anodized, root, { pos: [0, 0.058, 0.07] });
    mesh(rbox(0.02, 0.008, 0.026, 0.002), m.anodized, root, { pos: [0, 0.058, -0.41] });
  }

  markings(root, 'KR-4  CAL 5.56mm  SAFE-SEMI-AUTO', [-0.0162, -0.017, -0.035], 0.07);
  finishMuzzle(root);
  anchors(root, [0, -0.04, 0.077], -0.32, [-0.065, -0.026, -0.2]);
  return root;
}

// ---------------------------------------------------------------- VK-47 (AK pattern)

function buildVK47(m: Materials, cfg: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';
  const steel = m.parkerized;
  const blued = m.anodized;

  // stamped receiver with dimples, trunnion and dust cover
  mesh(rbox(0.034, 0.05, 0.25, 0.003), blued, root, { pos: [0, 0.0, 0.0] });
  for (const s of [-1, 1]) {
    mesh(rbox(0.002, 0.018, 0.02, 0.003), m.hole, root, { pos: [s * 0.0166, -0.01, -0.07] }); // mag dimple
    mesh(rbox(0.0015, 0.004, 0.2, 0.001), m.anodizedEdge, root, { pos: [s * 0.0172, 0.02, 0.0] }); // rail ridge
    for (const [y, z] of [[-0.012, -0.1], [-0.012, 0.08], [0.005, 0.04], [0.008, -0.11]]) {
      mesh(cyl(0.0025, 0.0025, 0.002, 10), m.steel, root, { pos: [s * 0.0172, y, z], rot: Z90 });
    }
  }
  const cover = group(root, { pos: [0, 0.03, 0.01] });
  mesh(rbox(0.032, 0.014, 0.2, 0.006, 3), blued, cover, {});
  for (let i = 0; i < 3; i++) mesh(rbox(0.026, 0.003, 0.008, 0.0015), m.anodizedEdge, cover, { pos: [0, 0.007, 0.085 - i * 0.012] });
  mesh(rbox(0.014, 0.008, 0.01, 0.002), steel, root, { pos: [0, 0.03, 0.115] }); // cover latch
  // ejection port + bolt carrier + charging handle on the right
  mesh(rbox(0.003, 0.018, 0.07, 0.001), m.hole, root, { pos: [0.0166, 0.012, -0.03], name: 'ejectionPort' });
  const ch = group(root, { name: 'chargingHandle' });
  mesh(rbox(0.008, 0.01, 0.07, 0.002), m.steel, ch, { pos: [0.0185, 0.012, -0.04] });
  mesh(cyl(0.007, 0.007, 0.022, 16), m.steel, ch, { pos: [0.03, 0.012, -0.068], rot: Z90 });
  // big safety/selector lever
  const sel = mesh(rbox(0.003, 0.016, 0.1, 0.0015), steel, root, { pos: [0.0185, 0.008, 0.06], rot: [0.08, 0, 0] });
  mesh(rbox(0.004, 0.018, 0.012, 0.002), steel, sel, { pos: [0.001, -0.008, -0.045] });
  // front trunnion + rear sight block with tangent leaf
  mesh(rbox(0.036, 0.052, 0.03, 0.004), steel, root, { pos: [0, 0.004, -0.14] });
  const rs = group(root, { pos: [0, 0.03, -0.14] });
  mesh(rbox(0.022, 0.018, 0.05, 0.003), steel, rs, { pos: [0, 0.006, -0.01] });
  mesh(rbox(0.018, 0.004, 0.06, 0.001), m.steel, rs, { pos: [0, 0.017, -0.01], rot: [0.04, 0, 0] });
  for (let i = 0; i < 8; i++) mesh(rbox(0.0004, 0.002, 0.0015, 0.0002), m.lens, rs, { pos: [0.0092, 0.017, -0.035 + i * 0.006] });
  // U-notch: base + two ears with a gap the front post sits in
  mesh(rbox(0.018, 0.004, 0.005, 0.001), m.steel, rs, { pos: [0, 0.02, 0.016] });
  for (const s of [-1, 1]) mesh(rbox(0.0055, 0.008, 0.005, 0.001), m.steel, rs, { pos: [s * 0.006, 0.025, 0.016] });
  mesh(rbox(0.008, 0.006, 0.008, 0.0015), m.steel, rs, { pos: [0.012, 0.012, 0.0] }); // slider

  // trigger group
  mesh(rbox(0.014, 0.005, 0.07, 0.002), steel, root, { pos: [0, -0.04, 0.03] });
  mesh(rbox(0.014, 0.022, 0.005, 0.002), steel, root, { pos: [0, -0.03, -0.004] });
  mesh(rbox(0.006, 0.022, 0.006, 0.002), m.steel, root, { pos: [0, -0.033, 0.024], rot: [0.3, 0, 0] });

  // wooden pistol grip
  const grip = group(root, { pos: [0, -0.025, 0.08], rot: [-0.38, 0, 0] });
  mesh(rbox(0.03, 0.105, 0.042, 0.012, 3), m.wood, grip, { pos: [0, -0.05, 0] });
  mesh(cyl(0.004, 0.004, 0.031, 10), m.steel, grip, { pos: [0, -0.02, 0.0], rot: Z90 });

  // fixed wooden stock
  const sp = new THREE.Shape();
  sp.moveTo(0, 0.02);
  sp.lineTo(0.24, 0.0);
  sp.lineTo(0.25, -0.01);
  sp.lineTo(0.25, -0.125);
  sp.lineTo(0.235, -0.13);
  sp.quadraticCurveTo(0.1, -0.06, 0, -0.03);
  sp.lineTo(0, 0.02);
  const stockGeo = new THREE.ExtrudeGeometry(sp, { depth: 0.032, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 3, curveSegments: 10 });
  stockGeo.translate(0, 0, -0.016);
  mesh(stockGeo, m.wood, root, { pos: [0, 0.012, 0.125], rot: [0, -Math.PI / 2, 0] });
  mesh(rbox(0.044, 0.13, 0.008, 0.004), m.steel, root, { pos: [0, -0.055, 0.378], rot: [0.08, 0, 0] }); // butt plate
  mesh(rbox(0.04, 0.034, 0.03, 0.004), steel, root, { pos: [0, 0.005, 0.13] }); // stock tang
  mesh(cyl(0.006, 0.006, 0.006, 12), m.steel, root, { pos: [-0.019, -0.05, 0.3], rot: Z90 }); // sling swivel

  // handguards: lower + upper over gas tube
  mesh(rbox(0.05, 0.042, 0.19, 0.016, 3), m.wood, root, { pos: [0, -0.004, -0.255] });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) mesh(rbox(0.002, 0.03, 0.006, 0.001), m.hole, root, { pos: [s * 0.0245, -0.004, -0.2 - i * 0.03] });
  mesh(rbox(0.04, 0.028, 0.17, 0.012, 3), m.wood, root, { pos: [0, 0.037, -0.245] });
  mesh(rbox(0.054, 0.012, 0.012, 0.003), steel, root, { pos: [0, -0.004, -0.158] }); // retainer
  mesh(rbox(0.052, 0.01, 0.01, 0.003), steel, root, { pos: [0, -0.004, -0.352] });
  mesh(cyl(0.011, 0.011, 0.04, 20), steel, root, { pos: [0, 0.037, -0.35], rot: X90 }); // gas tube front
  // barrel, gas block, front sight
  mesh(cyl(0.0105, 0.0105, 0.22, 20), steel, root, { pos: [0, 0.008, -0.45], rot: X90 });
  mesh(rbox(0.026, 0.05, 0.028, 0.006), steel, root, { pos: [0, 0.022, -0.375] });
  const fs = group(root, { pos: [0, 0.008, -0.52] });
  mesh(rbox(0.024, 0.02, 0.026, 0.004), steel, fs, {});
  for (const s of [-1, 1]) mesh(rbox(0.004, 0.044, 0.01, 0.0015), steel, fs, { pos: [s * 0.01, 0.025, 0] });
  mesh(cyl(0.0015, 0.0015, 0.03, 8), m.steel, fs, { pos: [0, 0.03, 0] });
  mesh(cyl(0.003, 0.003, 0.002, 10), m.lens, fs, { pos: [0, 0.046, 0] });
  // cleaning rod
  mesh(cyl(0.0028, 0.0028, 0.33, 8), m.steel, root, { pos: [0, -0.012, -0.44], rot: X90 });

  const muzzle = group(root, { pos: [0, 0.008, -0.56], name: 'muzzleBase' });
  addMuzzle(muzzle, m, cfg.muzzle, 'slant');

  addUnder(root, m, cfg.under, -0.028, -0.29, 0.027);

  // banana mag in bakelite
  buildMag(root, m, m.bakelite, [0, -0.025, -0.07], 0.2, 0.075, 0.034, cfg.mag);

  if (cfg.optic === 'iron') {
    group(root, { pos: [0, 0.0545, -0.124], name: 'sight' });
  } else {
    // dust-cover rail
    rail(cover, m, 0.01, 0.07, -0.08, steel);
    addOptic(root, m, cfg.optic, 0.051, 0.005);
  }

  markings(root, 'VK-47  7.62x39  No 0451', [-0.0173, -0.012, 0.02], 0.075);
  finishMuzzle(root);
  anchors(root, [0, -0.025, 0.08], -0.38, [-0.068, -0.03, -0.25]);
  return root;
}

/** Curved, ribbed magazine with two visible rounds. */
function buildMag(root: THREE.Object3D, m: Materials, mat: THREE.Material, pos: [number, number, number], H0: number, bend0: number, width: number, kind: MagId = 'std') {
  const mag = group(root, { pos, name: 'mag' });
  const H = kind === 'ext' ? H0 * 1.4 : H0;
  const bend = kind === 'ext' ? bend0 * 1.6 : bend0;
  if (kind === 'fast') {
    // second mag taped alongside, offset down and to the right
    const twin = group(mag, { pos: [0.027, -0.04, 0.0] });
    singleMag(twin, m, mat, H, bend, width, false);
    for (const y of [-0.03, -0.09]) mesh(rbox(0.06, 0.012, width * 2.2, 0.003), m.webbing, mag, { pos: [0.013, y, 0.004] });
  }
  singleMag(mag, m, mat, H, bend, width, true);
}

function singleMag(mag: THREE.Object3D, m: Materials, mat: THREE.Material, H: number, bend: number, width: number, rounds: boolean) {
  const curve = (y: number) => -bend * (y / H) * (y / H) - 0.015 * (y / H);
  const ms = new THREE.Shape();
  ms.moveTo(-width, 0);
  ms.lineTo(width, 0);
  for (let i = 1; i <= 10; i++) ms.lineTo(width + curve((i / 10) * H), -(i / 10) * H);
  for (let i = 10; i >= 1; i--) ms.lineTo(-width + curve((i / 10) * H), -(i / 10) * H);
  ms.lineTo(-width, 0);
  const g = new THREE.ExtrudeGeometry(ms, { depth: 0.022, bevelEnabled: true, bevelSize: 0.0025, bevelThickness: 0.0025, bevelSegments: 2 });
  g.translate(0, 0, -0.011);
  mesh(g, mat, mag, { rot: [0, -Math.PI / 2, 0] });
  for (let i = 0; i < Math.floor(H / 0.045); i++) {
    const y = 0.03 + i * 0.035;
    for (const s of [-1, 1]) mesh(rbox(0.003, 0.004, width * 1.6, 0.0015), mat, mag, { pos: [s * 0.0135, -y, curve(y)] });
  }
  mesh(rbox(0.032, 0.012, width * 2.4, 0.004), m.polymer, mag, { pos: [0, -H - 0.004, curve(H)], rot: [-0.25 - bend * 3, 0, 0] });
  for (let i = 0; i < (rounds ? 2 : 0); i++) {
    const rnd = group(mag, { pos: [(i ? -1 : 1) * 0.004, 0.003 + i * 0.003, -0.005 * i] });
    mesh(cyl(0.0048, 0.0048, 0.034, 12), m.brass, rnd, { rot: X90 });
    mesh(new THREE.ConeGeometry(0.0034, 0.02, 12), m.copper, rnd, { pos: [0, 0, -0.026], rot: [-Math.PI / 2, 0, 0] });
  }
}

/** Expose a single 'muzzle' node at the very tip (accounts for suppressor length). */
function finishMuzzle(root: THREE.Object3D) {
  const base = root.getObjectByName('muzzleBase')!;
  group(base, { pos: [0, 0, (base.userData.tip as number) ?? 0], name: 'muzzle' });
}

/** Engraved roll-mark on the left side of the receiver. */
function markings(root: THREE.Object3D, text: string, pos: [number, number, number], width: number) {
  const tex = markingTex(text);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, metalness: 0.6, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  mesh(new THREE.PlaneGeometry(width, width / 8), mat, root, { pos, rot: [0, -Math.PI / 2, 0] });
}

/** Vertical grip, angled grip or laser module under/along the handguard. */
function addUnder(root: THREE.Object3D, m: Materials, kind: UnderId, y: number, z: number, side: number) {
  if (kind === 'grip') {
    const fg = group(root, { pos: [0, y, z] });
    mesh(rbox(0.024, 0.008, 0.06, 0.003), m.polymer, fg, {});
    mesh(cyl(0.014, 0.016, 0.08), m.fde, fg, { pos: [0, -0.042, 0] });
    for (let i = 0; i < 4; i++) mesh(new THREE.TorusGeometry(0.0155, 0.0015, 8, 32), m.polymer, fg, { pos: [0, -0.03 - i * 0.014, 0], rot: X90 });
    mesh(cyl(0.017, 0.017, 0.008), m.polymer, fg, { pos: [0, -0.084, 0] });
  } else if (kind === 'angled') {
    const fg = group(root, { pos: [0, y, z + 0.03] });
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(0.075, 0);
    sh.quadraticCurveTo(0.08, -0.012, 0.07, -0.03);
    sh.lineTo(0.02, -0.04);
    sh.quadraticCurveTo(0.004, -0.03, 0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.024, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 3, curveSegments: 10 });
    g.translate(-0.04, 0, -0.012);
    mesh(g, m.fde, fg, { rot: [0, Math.PI / 2, 0] });
    for (let i = 0; i < 4; i++) mesh(rbox(0.026, 0.003, 0.004, 0.001), m.polymer, fg, { pos: [0, -0.012 - i * 0.006, 0.012 - i * 0.008] });
  } else if (kind === 'laser') {
    const lz = group(root, { pos: [-side - 0.012, y + 0.026, z - 0.03] });
    mesh(rbox(0.016, 0.026, 0.06, 0.004), m.anodized, lz, {});
    mesh(rbox(0.006, 0.016, 0.03, 0.002), m.anodizedEdge, lz, { pos: [0.009, 0, 0.005] }); // mount
    for (const yy of [0.006, -0.006]) mesh(cyl(0.0042, 0.0042, 0.004, 16), yy > 0 ? m.laserRed : m.lens, lz, { pos: [0, yy, -0.031], rot: X90 });
    mesh(rbox(0.008, 0.006, 0.012, 0.002), m.rubber, lz, { pos: [-0.004, 0.0145, 0.016] }); // switch
  }
}

// ---------------------------------------------------------------- P-9 pistol

function buildP9(m: Materials, cfg: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';
  const slideMat = m.anodized;
  // slide (named chargingHandle so the viewmodel can rack/recoil it)
  const slide = group(root, { name: 'chargingHandle' });
  mesh(rbox(0.025, 0.028, 0.188, 0.004, 3), slideMat, slide, { pos: [0, 0.031, -0.03] });
  mesh(rbox(0.021, 0.006, 0.17, 0.003), slideMat, slide, { pos: [0, 0.046, -0.03] }); // top bevel
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) mesh(rbox(0.0015, 0.018, 0.0022, 0.0006), m.hole, slide, { pos: [s * 0.0126, 0.032, 0.035 + i * 0.0055] });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) mesh(rbox(0.0015, 0.014, 0.0022, 0.0006), m.hole, slide, { pos: [s * 0.0126, 0.034, -0.105 + i * 0.0055] });
  mesh(rbox(0.003, 0.012, 0.04, 0.001), m.hole, slide, { pos: [0.0118, 0.038, -0.005], name: 'ejectionPort' });
  mesh(rbox(0.014, 0.012, 0.036, 0.002), m.steel, slide, { pos: [0.004, 0.038, -0.005] }); // barrel hood
  // sights: rear notch + front post with dots
  for (const s of [-1, 1]) mesh(rbox(0.006, 0.008, 0.008, 0.0015), m.anodized, slide, { pos: [s * 0.006, 0.0505, 0.05] });
  mesh(rbox(0.018, 0.003, 0.008, 0.001), m.anodized, slide, { pos: [0, 0.047, 0.05] });
  mesh(rbox(0.0035, 0.008, 0.005, 0.001), m.anodized, slide, { pos: [0, 0.0505, -0.112] });
  mesh(cyl(0.0012, 0.0012, 0.001, 10), m.lens, slide, { pos: [0, 0.052, -0.1095], rot: X90 });
  group(root, { pos: [0, 0.0515, 0.05], name: 'sight' });
  markings(slide, 'P-9  9x19mm', [-0.0127, 0.03, -0.06], 0.05);
  // frame, rail, trigger guard, trigger
  mesh(rbox(0.023, 0.018, 0.165, 0.004, 3), m.polymer, root, { pos: [0, 0.008, -0.025] });
  mesh(rbox(0.021, 0.008, 0.05, 0.002), m.polymer, root, { pos: [0, -0.004, -0.085] });
  for (let i = 0; i < 3; i++) mesh(rbox(0.022, 0.003, 0.004, 0.001), m.polymer, root, { pos: [0, -0.009, -0.07 - i * 0.012] });
  mesh(rbox(0.012, 0.005, 0.05, 0.002), m.polymer, root, { pos: [0, -0.026, -0.02] });
  mesh(rbox(0.012, 0.03, 0.005, 0.002), m.polymer, root, { pos: [0, -0.012, -0.045] });
  mesh(rbox(0.006, 0.02, 0.006, 0.002), m.polymer, root, { pos: [0, -0.012, -0.012], rot: [0.3, 0, 0] });
  // grip with stipple panels + mag base plate
  const grip = group(root, { pos: [0, -0.005, 0.03], rot: [-0.26, 0, 0] });
  mesh(rbox(0.028, 0.105, 0.052, 0.009, 3), m.polymer, grip, { pos: [0, -0.05, 0] });
  for (const s of [-1, 1]) mesh(rbox(0.002, 0.07, 0.04, 0.003), m.fde, grip, { pos: [s * 0.0142, -0.05, 0.001] });
  mesh(rbox(0.026, 0.012, 0.03, 0.004), m.polymer, grip, { pos: [0, 0.0, 0.028] }); // beavertail
  const mag = group(grip, { pos: [0, -0.104, 0], name: 'mag' });
  const ext = cfg.mag === 'ext';
  mesh(rbox(0.024, ext ? 0.04 : 0.012, 0.048, 0.004), m.polymer, mag, { pos: [0, ext ? -0.014 : 0.0, 0] });
  // barrel + muzzle
  const muzzle = group(root, { pos: [0, 0.037, -0.124], name: 'muzzleBase' });
  mesh(cyl(0.0055, 0.0055, 0.004, 16), m.hole, muzzle, { pos: [0, 0, -0.001], rot: X90 });
  if (cfg.muzzle === 'suppressor') {
    mesh(cyl(0.006, 0.006, 0.02, 20), m.steel, muzzle, { pos: [0, 0, -0.01], rot: X90 });
    mesh(cyl(0.0165, 0.0165, 0.14, 36), m.parkerized, muzzle, { pos: [0, 0, -0.09], rot: X90 });
    for (let i = 0; i < 4; i++) mesh(new THREE.TorusGeometry(0.0167, 0.001, 6, 36), m.anodizedEdge, muzzle, { pos: [0, 0, -0.04 - i * 0.03] });
    muzzle.userData.tip = -0.16;
  } else {
    muzzle.userData.tip = 0;
  }
  finishMuzzle(root);
  group(root, { pos: [0, -0.005, 0.03], rot: [-0.26, 0, 0], name: 'gripAnchor' });
  group(root, { pos: [-0.03, -0.05, 0.04], name: 'guardAnchor' });
  return root;
}

// ---------------------------------------------------------------- R-357 revolver

function buildR357(m: Materials): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';
  const st = m.steel;
  // frame, topstrap, barrel with full underlug
  mesh(rbox(0.03, 0.052, 0.07, 0.006, 3), st, root, { pos: [0, 0.012, 0.005] });
  mesh(rbox(0.022, 0.01, 0.06, 0.003), st, root, { pos: [0, 0.042, -0.01] });
  mesh(rbox(0.022, 0.034, 0.11, 0.005, 3), st, root, { pos: [0, 0.018, -0.1] });
  mesh(cyl(0.0095, 0.0095, 0.12, 32), st, root, { pos: [0, 0.032, -0.1], rot: X90 });
  mesh(rbox(0.006, 0.004, 0.1, 0.0015), st, root, { pos: [0, 0.042, -0.1] }); // vent rib
  mesh(rbox(0.004, 0.012, 0.016, 0.0015), st, root, { pos: [0, 0.047, -0.148] }); // front ramp
  mesh(rbox(0.0025, 0.004, 0.012, 0.001), m.laserRed, root, { pos: [0, 0.052, -0.148] }); // red insert
  for (const s of [-1, 1]) mesh(rbox(0.005, 0.006, 0.01, 0.0015), st, root, { pos: [s * 0.006, 0.05, 0.03] }); // rear notch
  group(root, { pos: [0, 0.05, 0.03], name: 'sight' });
  markings(root, 'R-357  .357 MAG', [-0.0112, 0.02, -0.1], 0.06);
  // cylinder on a crane that swings out to the left for reloads
  const crane = group(root, { pos: [-0.012, -0.004, -0.02], name: 'cylinderSwing' });
  const cylG = group(crane, { pos: [0.012, 0.028, 0], name: 'cylinder' });
  mesh(cyl(0.0195, 0.0195, 0.042, 36), st, cylG, { rot: X90 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    mesh(rbox(0.004, 0.006, 0.03, 0.002), m.hole, cylG, { pos: [Math.cos(a) * 0.019, Math.sin(a) * 0.019, 0], rot: [0, 0, a] });
    const b = a - Math.PI / 6;
    mesh(cyl(0.0048, 0.0048, 0.002, 16), m.brass, cylG, { pos: [Math.cos(b) * 0.0125, Math.sin(b) * 0.0125, 0.0215], rot: X90 });
  }
  mesh(cyl(0.004, 0.004, 0.05, 12), st, crane, { pos: [0.012, 0.028, -0.004], rot: X90 }); // ejector rod
  group(root, { name: 'mag' });
  // hammer, trigger, guard
  const hammer = group(root, { pos: [0, 0.035, 0.04], name: 'hammer' });
  mesh(rbox(0.008, 0.02, 0.012, 0.002), st, hammer, { pos: [0, 0.006, 0.004], rot: [-0.3, 0, 0] });
  mesh(rbox(0.01, 0.005, 0.014, 0.002), st, hammer, { pos: [0, 0.016, 0.012] });
  mesh(rbox(0.006, 0.022, 0.006, 0.002), st, root, { pos: [0, -0.02, -0.004], rot: [0.25, 0, 0] });
  mesh(new THREE.TorusGeometry(0.018, 0.0028, 10, 24, Math.PI), st, root, { pos: [0, -0.016, -0.004], rot: [0, Math.PI / 2, Math.PI] });
  // wooden grip panels
  const grip = group(root, { pos: [0, -0.004, 0.04], rot: [-0.32, 0, 0] });
  mesh(rbox(0.02, 0.1, 0.034, 0.006), st, grip, { pos: [0, -0.045, 0] });
  for (const s of [-1, 1]) {
    mesh(rbox(0.006, 0.096, 0.044, 0.008, 3), m.wood, grip, { pos: [s * 0.012, -0.048, 0.002] });
    mesh(cyl(0.003, 0.003, 0.002, 12), m.brass, grip, { pos: [s * 0.0152, -0.05, 0.002], rot: Z90 });
  }
  const muzzle = group(root, { pos: [0, 0.032, -0.16], name: 'muzzleBase' });
  mesh(cyl(0.005, 0.005, 0.004, 16), m.hole, muzzle, { pos: [0, 0, -0.001], rot: X90 });
  muzzle.userData.tip = 0;
  finishMuzzle(root);
  group(root, { pos: [0, 0.03, -0.01], name: 'ejectionPort' });
  group(root, { pos: [0, -0.004, 0.04], rot: [-0.32, 0, 0], name: 'gripAnchor' });
  group(root, { pos: [-0.03, -0.05, 0.05], name: 'guardAnchor' });
  return root;
}

// ================================================================ shared helpers for the newer guns

type V3 = [number, number, number];
/** Profile point (z, y) in the parent's space, with an optional corner radius. */
type P2 = [number, number] | [number, number, number];
/** w, h, d, x, y, z, rx?, ry?, rz? */
type BoxSpec = [number, number, number, number, number, number, number?, number?, number?];
type Part = [THREE.BufferGeometry, V3, V3?];

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}
const ccyl = (rt: number, rb: number, h: number, seg = 24) => cached(`cy${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const cone = (r: number, h: number) => cached(`co${r}|${h}`, () => new THREE.ConeGeometry(r, h, 12));
const torus = (r: number, t: number, arc = Math.PI * 2) => cached(`to${r}|${t}|${arc}`, () => new THREE.TorusGeometry(r, t, 8, 24, arc));

/** Cylinder along Z: radius `r` at the rear (+Z) end, `rf` at the front. */
function zc(p: THREE.Object3D, mat: THREE.Material, r: number, len: number, pos: V3, rf = r, seg = 24) {
  return mesh(ccyl(r, rf, len, seg), mat, p, { pos, rot: X90 });
}
/** Cylinder along X. */
function xc(p: THREE.Object3D, mat: THREE.Material, r: number, len: number, pos: V3, seg = 16) {
  return mesh(ccyl(r, r, len, seg), mat, p, { pos, rot: Z90 });
}
/** Cylinder along Y. */
function yc(p: THREE.Object3D, mat: THREE.Material, r: number, len: number, pos: V3, seg = 16) {
  return mesh(ccyl(r, r, len, seg), mat, p, { pos });
}

/** Straight-knurled knob (a toothed disc), axis along Y. */
function knurlGeo(r: number, h: number, teeth = 20) {
  return cached(`kn${r}|${h}|${teeth}`, () => {
    const s = new THREE.Shape();
    const n = teeth * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = i % 2 ? r * 0.88 : r;
      if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -h / 2);
    g.rotateX(-Math.PI / 2);
    return g;
  });
}
function knurl(p: THREE.Object3D, mat: THREE.Material, r: number, h: number, pos: V3, axis: 'x' | 'y' | 'z' = 'y', teeth = 20) {
  return mesh(knurlGeo(r, h, teeth), mat, p, { pos, rot: axis === 'x' ? Z90 : axis === 'z' ? X90 : undefined });
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpV = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);
/** Merge many small parts sharing a material into one mesh (rails, slots, rivets, belts). */
function merged(p: THREE.Object3D, mat: THREE.Material, parts: Part[], o: PlaceOpts = {}) {
  const gs = parts.map(([g, pos, rot]) => {
    const c = g.index ? g.toNonIndexed() : g.clone();
    tmpM.compose(tmpV.set(...pos), tmpQ.setFromEuler(tmpE.set(...(rot ?? [0, 0, 0]))), ONE);
    return c.applyMatrix4(tmpM);
  });
  return mesh(mergeGeometries(gs, false)!, mat, p, o);
}
function boxes(p: THREE.Object3D, mat: THREE.Material, list: BoxSpec[], r = 0.001) {
  return merged(p, mat, list.map(([w, h, d, x, y, z, rx = 0, ry = 0, rz = 0]): Part => [rbox(w, h, d, r, 2), [x, y, z], [rx, ry, rz]]));
}
/** Cross pins / rivet heads on both sides at half-width `half`. */
function pins(p: THREE.Object3D, m: Materials, half: number, pts: [number, number][], r = 0.0026) {
  const parts: Part[] = [];
  for (const [y, z] of pts) for (const s of [-1, 1]) parts.push([ccyl(r, r, 0.002, 12), [s * half, y, z], Z90]);
  return merged(p, m.steel, parts);
}

/** Closed outline with rounded corners (third value of a point overrides the radius). */
function outline<T extends THREE.Path>(s: T, pts: P2[], r: number): T {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i + n - 1) % n];
    const b = pts[(i + 1) % n];
    const rr = p[2] ?? r;
    if (rr <= 0) {
      if (i) s.lineTo(p[0], p[1]);
      else s.moveTo(p[0], p[1]);
      continue;
    }
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const db = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ka = Math.min(rr, da / 2) / da;
    const kb = Math.min(rr, db / 2) / db;
    const x0 = p[0] + (a[0] - p[0]) * ka;
    const y0 = p[1] + (a[1] - p[1]) * ka;
    if (i) s.lineTo(x0, y0);
    else s.moveTo(x0, y0);
    s.quadraticCurveTo(p[0], p[1], p[0] + (b[0] - p[0]) * kb, p[1] + (b[1] - p[1]) * kb);
  }
  s.closePath();
  return s;
}

interface ProfOpts {
  x?: number;
  r?: number;
  bevel?: number;
  holes?: P2[][];
  hr?: number;
  name?: string;
  /** wood: run the grain along the gun instead of across it */
  grain?: boolean;
}
/** Side profile drawn in gun (z, y) coordinates, extruded `depth` across X (centred on x). */
function prof(p: THREE.Object3D, mat: THREE.Material, pts: P2[], depth: number, o: ProfOpts = {}) {
  const sh = outline(new THREE.Shape(), pts, o.r ?? 0.003);
  for (const h of o.holes ?? []) sh.holes.push(outline(new THREE.Path(), h, o.hr ?? 0.006));
  const bev = Math.min(o.bevel ?? 0.0025, depth / 4);
  const g = new THREE.ExtrudeGeometry(sh, { depth: depth - bev * 2, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 2, curveSegments: 5 });
  g.translate(0, 0, -(depth - bev * 2) / 2);
  // extrude UVs come out in metres; bring them to the same density as the rounded boxes
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const k = o.grain ? 4 : 9;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (o.grain) uv.setXY(i, v * k, u * k);
    else uv.setXY(i, u * k, v * k);
  }
  return mesh(g, mat, p, { pos: [o.x ?? 0, 0, 0], rot: [0, -Math.PI / 2, 0], name: o.name });
}

const shellCache = new WeakMap<THREE.Material, THREE.Material>();
/** Double-sided copy, for open tubes and shields seen from inside. */
function shellMat(base: THREE.Material) {
  let s = shellCache.get(base);
  if (!s) {
    s = base.clone();
    s.side = THREE.DoubleSide;
    shellCache.set(base, s);
  }
  return s;
}

let oliveMat: THREE.MeshStandardMaterial | null = null;
/** Painted steel for ammo cans (never camo'd). */
function olive(m: Materials) {
  oliveMat ??= new THREE.MeshStandardMaterial({ color: 0x3f4a30, metalness: 0.45, roughness: 0.6, roughnessMap: m.steel.roughnessMap });
  return oliveMat;
}

/** Picatinny rail with the slats merged into one mesh. */
function rail2(p: THREE.Object3D, m: Materials, y: number, z0: number, z1: number, mat: THREE.Material = m.anodized) {
  mesh(rbox(0.021, 0.006, z0 - z1, 0.001), mat, p, { pos: [0, y, (z0 + z1) / 2] });
  const list: BoxSpec[] = [];
  for (let z = z0 - 0.006; z > z1; z -= 0.01) list.push([0.022, 0.0045, 0.0052, 0, y + 0.0055, z]);
  boxes(p, m.anodizedEdge, list, 0.0008);
}
/** Rail on a side or the bottom; (x, y) is where the rail base sits. */
function railDir(p: THREE.Object3D, m: Materials, dir: 'down' | 'left' | 'right', x: number, y: number, z0: number, z1: number, mat?: THREE.Material) {
  const g = group(p, { pos: [x, y, 0], rot: [0, 0, dir === 'down' ? Math.PI : dir === 'left' ? Math.PI / 2 : -Math.PI / 2] });
  rail2(g, m, 0, z0, z1, mat);
}

/** Flip-up rear aperture (owns the 'sight' node). */
function rearAperture(root: THREE.Object3D, m: Materials, y: number, z: number) {
  const rear = group(root, { pos: [0, y, z] });
  mesh(rbox(0.02, 0.008, 0.03, 0.002), m.anodized, rear, {});
  for (const s of [-1, 1]) mesh(rbox(0.004, 0.026, 0.01, 0.0015), m.anodized, rear, { pos: [s * 0.009, 0.016, 0] });
  mesh(torus(0.0055, 0.0022), m.anodized, rear, { pos: [0, 0.024, 0] });
  knurl(rear, m.anodizedEdge, 0.005, 0.005, [0.013, 0.008, 0.006], 'x', 12);
  group(rear, { pos: [0, 0.024, 0], name: 'sight' });
}
function frontPost(root: THREE.Object3D, m: Materials, y: number, z: number) {
  const front = group(root, { pos: [0, y, z] });
  mesh(rbox(0.02, 0.008, 0.026, 0.002), m.anodized, front, {});
  for (const s of [-1, 1]) mesh(rbox(0.004, 0.028, 0.008, 0.0015), m.anodized, front, { pos: [s * 0.009, 0.016, 0] });
  mesh(rbox(0.0025, 0.02, 0.003, 0.0008), m.steel, front, { pos: [0, 0.016, 0] });
}
/** Flip-up sights on a top rail (y = rail y + 0.011), raised for iron or folded under an optic. */
function railSights(root: THREE.Object3D, m: Materials, iron: boolean, y: number, zr: number, zf: number) {
  if (iron) {
    rearAperture(root, m, y, zr);
    frontPost(root, m, y, zf);
  } else {
    mesh(rbox(0.02, 0.008, 0.03, 0.002), m.anodized, root, { pos: [0, y, zr] });
    mesh(rbox(0.02, 0.008, 0.026, 0.002), m.anodized, root, { pos: [0, y, zf] });
  }
}

/** One cartridge lying along Z, centred on pos. */
function cartridge(p: THREE.Object3D, m: Materials, r: number, len: number, pos: V3) {
  const g = group(p, { pos });
  zc(g, m.brass, r, len * 0.68, [0, 0, len * 0.16], r, 14);
  zc(g, m.brass, r * 0.95, len * 0.08, [0, 0, -len * 0.22], r * 0.6, 14);
  mesh(cone(r * 0.58, len * 0.26), m.copper, g, { pos: [0, 0, -len * 0.37], rot: [-Math.PI / 2, 0, 0] });
}

/** Linked belt of rounds (parallel to the bore) along a quadratic curve in the XY plane. */
function belt(p: THREE.Object3D, m: Materials, a: [number, number], c: [number, number], b: [number, number], z: number, pitch: number, r: number, len: number) {
  const at = (t: number): [number, number] => {
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  };
  const brass: Part[] = [];
  const tips: Part[] = [];
  const links: Part[] = [];
  let prev = at(0);
  let acc = 0;
  let next = 0;
  const N = 160;
  for (let i = 0; i <= N; i++) {
    const q = at(i / N);
    acc += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
    prev = q;
    if (acc + 1e-6 < next) continue;
    next += pitch;
    const q1 = at(Math.max(0, i / N - 0.01));
    const q2 = at(Math.min(1, i / N + 0.01));
    const ang = Math.atan2(q2[1] - q1[1], q2[0] - q1[0]);
    brass.push([ccyl(r, r, len * 0.68, 14), [q[0], q[1], z + len * 0.16], X90]);
    brass.push([ccyl(r * 0.95, r * 0.6, len * 0.08, 14), [q[0], q[1], z - len * 0.22], X90]);
    tips.push([cone(r * 0.58, len * 0.26), [q[0], q[1], z - len * 0.37], [-Math.PI / 2, 0, 0]]);
    for (const dz of [0.28, -0.04]) links.push([rbox(r * 2.35, r * 2.35, len * 0.13, 0.0008, 2), [q[0], q[1], z + len * dz], [0, 0, ang]]);
    // the link tongue that clips to the next round
    links.push([rbox(pitch * 0.95, r * 0.45, len * 0.1, 0.0005, 2), [q[0] - Math.sin(ang) * r * 0.9 + Math.cos(ang) * pitch * 0.5, q[1] + Math.cos(ang) * r * 0.9 + Math.sin(ang) * pitch * 0.5, z + len * 0.12], [0, 0, ang]]);
  }
  merged(p, m.brass, brass);
  merged(p, m.copper, tips);
  merged(p, m.steel, links);
}

interface MagSpec {
  H: number;
  w: number;
  d: number;
  mat: THREE.Material;
  /** round radius + length shown at the feed lips */
  rnd?: [number, number];
  ribs?: boolean;
  window?: boolean;
  extK?: number;
  /** false: 'fast' (taped pair) isn't offered visually on this gun */
  fast?: boolean;
}
/** Straight box magazine, top centre at `pos`; named 'mag'. */
function boxMag(root: THREE.Object3D, m: Materials, pos: V3, rake: number, kind: MagId, s: MagSpec) {
  const mag = group(root, { pos, name: 'mag' });
  const inner = group(mag, { rot: [rake, 0, 0] });
  const k = kind === 'fast' && s.fast === false ? 'std' : kind;
  const H = k === 'ext' ? s.H * (s.extK ?? 1.4) : s.H;
  if (k === 'fast') {
    const off = s.w + 0.006;
    magBody(group(inner, { pos: [off, -0.035, 0] }), m, s, H, false);
    const tw = s.w * 2 + 0.016;
    const lo = -Math.min(H - 0.012, 0.12);
    boxes(inner, m.webbing, [[tw, 0.012, s.d + 0.006, off / 2, -0.05, 0], [tw, 0.012, s.d + 0.006, off / 2, (lo - 0.05) / 2 - 0.01, 0]], 0.003);
  }
  magBody(inner, m, s, H, true);
  return mag;
}
function magBody(g: THREE.Object3D, m: Materials, s: MagSpec, H: number, rounds: boolean) {
  mesh(rbox(s.w, H, s.d, 0.003), s.mat, g, { pos: [0, -H / 2, 0] });
  const list: BoxSpec[] = [];
  if (s.ribs !== false) {
    for (const x of [-1, 1]) for (const zz of [-0.2, 0.2]) list.push([0.002, H - 0.03, 0.004, (x * s.w) / 2, -H / 2 - 0.006, zz * s.d]);
    list.push([s.w + 0.002, 0.004, s.d + 0.002, 0, -0.018, 0]); // feed-lip reinforcement band
  }
  if (list.length) boxes(g, s.mat, list, 0.001);
  if (s.window) boxes(g, m.hole, [[0.002, H * 0.55, 0.005, -s.w / 2, -H * 0.5, s.d * 0.3], [0.002, H * 0.55, 0.005, s.w / 2, -H * 0.5, s.d * 0.3]], 0.0008);
  else boxes(g, m.hole, [0, 1, 2].map((i) => [0.002, 0.004, 0.004, -s.w / 2, -H * 0.4 - i * 0.012, s.d * 0.32] as BoxSpec), 0.0008);
  mesh(rbox(s.w + 0.005, 0.01, s.d + 0.008, 0.003), m.polymer, g, { pos: [0, -H - 0.003, 0.001] });
  mesh(rbox(s.w * 0.5, 0.004, s.d * 0.4, 0.0015), m.anodizedEdge, g, { pos: [0, -H - 0.009, 0.0] });
  if (rounds && s.rnd) {
    const [r, len] = s.rnd;
    boxes(g, m.steel, [[0.002, 0.006, s.d * 0.7, -r * 0.9, 0.0, 0], [0.002, 0.006, s.d * 0.7, r * 0.9, 0.0, 0]], 0.0006);
    cartridge(g, m, r, len, [r * 0.35, r * 0.5, -s.d / 2 + len / 2 + 0.002]);
  }
}

/** Folded bipod: yoke at pos, legs folded forward (-Z) along the barrel. */
function bipod(p: THREE.Object3D, m: Materials, pos: V3, len: number, r = 0.0055) {
  const b = group(p, { pos });
  mesh(rbox(0.036, 0.014, 0.032, 0.004), m.parkerized, b, { pos: [0, 0.004, 0] });
  mesh(rbox(0.014, 0.01, 0.02, 0.003), m.steel, b, { pos: [0, 0.006, 0.02] });
  knurl(b, m.anodizedEdge, 0.007, 0.01, [0.024, 0.004, 0.008], 'x', 14);
  xc(b, m.steel, 0.0035, 0.046, [0, -0.004, -0.006]);
  for (const s of [-1, 1]) {
    const leg = group(b, { pos: [s * 0.013, -0.008, -0.004], rot: [0.03, s * 0.035, 0] });
    mesh(rbox(0.013, 0.013, 0.024, 0.003), m.parkerized, leg, { pos: [0, 0, -0.008] });
    zc(leg, m.parkerized, r, len * 0.55, [0, 0, -0.02 - len * 0.275], r, 16);
    knurl(leg, m.polymer, r * 1.4, 0.012, [0, 0, -0.02 - len * 0.55], 'z', 14);
    zc(leg, m.steel, r * 0.72, len * 0.42, [0, 0, -0.02 - len * 0.55 - len * 0.21], r * 0.72, 16);
    boxes(leg, m.hole, [0, 1, 2, 3].map((i) => [0.0015, r * 0.5, 0.002, s * r * 0.7, 0, -0.03 - len * 0.6 - i * 0.012] as BoxSpec), 0.0004);
    zc(leg, m.rubber, r * 1.25, 0.018, [0, 0, -0.02 - len * 0.97], r * 1.05, 16);
  }
  zc(b, m.steel, 0.0018, 0.05, [0, -0.009, -0.035], 0.0018, 8);
}

/** Muzzle devices for 'none' beyond the KR-4/VK-47 ones. Built from tip (z=0) back to +Z. */
function muzzleDevice(g: THREE.Object3D, m: Materials, style: MuzzleStyle) {
  if (style === 'cap') {
    zc(g, m.steel, 0.0105, 0.016, [0, 0, 0.008]);
    knurl(g, m.steel, 0.011, 0.007, [0, 0, 0.011], 'z', 26);
    zc(g, m.steel, 0.0098, 0.002, [0, 0, 0.0], 0.0085);
    zc(g, m.hole, 0.0045, 0.002, [0, 0, -0.0012], 0.0045, 16);
  } else if (style === 'cone') {
    zc(g, m.parkerized, 0.0118, 0.052, [0, 0, 0.026], 0.0158, 24);
    zc(g, m.steel, 0.0128, 0.01, [0, 0, 0.054]);
    const sl: BoxSpec[] = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      sl.push([0.004, 0.0035, 0.024, Math.cos(a) * 0.0146, Math.sin(a) * 0.0146, 0.014, 0, 0, a]);
    }
    boxes(g, m.hole, sl, 0.001);
    zc(g, m.hole, 0.0075, 0.002, [0, 0, -0.0005], 0.0075, 16);
  } else if (style === 'slotted') {
    zc(g, m.parkerized, 0.0132, 0.078, [0, 0, 0.039]);
    zc(g, m.parkerized, 0.0145, 0.012, [0, 0, 0.074]);
    const sl: BoxSpec[] = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 5;
      sl.push([0.004, 0.0042, 0.05, Math.cos(a) * 0.0128, Math.sin(a) * 0.0128, 0.026, 0, 0, a]);
    }
    boxes(g, m.hole, sl, 0.0015);
    zc(g, m.hole, 0.0085, 0.002, [0, 0, -0.0005], 0.0085, 16);
  } else if (style === 'brake') {
    mesh(rbox(0.038, 0.034, 0.085, 0.006), m.parkerized, g, { pos: [0, 0, 0.0425] });
    zc(g, m.steel, 0.0175, 0.012, [0, 0, 0.088]);
    const sl: BoxSpec[] = [];
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) sl.push([0.004, 0.024, 0.013, s * 0.019, 0, 0.012 + i * 0.024]);
      sl.push([0.012, 0.004, 0.006, 0, 0.017, 0.02 + i * 0.024]);
    }
    boxes(g, m.hole, sl, 0.0015);
    mesh(rbox(0.032, 0.028, 0.004, 0.004), m.steel, g, { pos: [0, 0, -0.0005] });
    zc(g, m.hole, 0.0095, 0.002, [0, 0, -0.0025], 0.0095, 16);
    for (const s of [-1, 1]) xc(g, m.steel, 0.0024, 0.002, [s * 0.0195, -0.011, 0.075], 10);
  } else if (style === 'prong') {
    zc(g, m.parkerized, 0.0135, 0.022, [0, 0, 0.052]);
    knurl(g, m.parkerized, 0.0142, 0.008, [0, 0, 0.06], 'z', 18);
    const pr: BoxSpec[] = [];
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
      pr.push([0.0055, 0.0085, 0.045, Math.cos(a) * 0.0105, Math.sin(a) * 0.0105, 0.0215, 0, 0, a]);
    }
    boxes(g, m.parkerized, pr, 0.0015);
    zc(g, m.hole, 0.0075, 0.002, [0, 0, 0.0405], 0.0075, 16);
  }
}

/** Laser to the side, or grip under a rail: picks the right height for each. */
function underFor(root: THREE.Object3D, m: Materials, kind: UnderId, laser: [number, number, number], grip: [number, number] | null) {
  if (kind === 'laser') addUnder(root, m, 'laser', laser[0], laser[1], laser[2]);
  else if (grip && kind !== 'none') addUnder(root, m, kind, grip[0], grip[1], 0);
}

/** A-style polymer pistol grip with finger ridges and stipple panels. */
function pistolGrip(root: THREE.Object3D, m: Materials, pos: V3, rake: number, mat: THREE.Material = m.polymer) {
  const grip = group(root, { pos, rot: [rake, 0, 0] });
  mesh(rbox(0.03, 0.115, 0.044, 0.01, 3), mat, grip, { pos: [0, -0.05, 0] });
  mesh(rbox(0.032, 0.012, 0.05, 0.004), mat, grip, { pos: [0, -0.112, 0.002] });
  boxes(grip, mat, [0, 1, 2].map((i) => [0.031, 0.012, 0.01, 0, -0.025 - i * 0.025, -0.022] as BoxSpec), 0.004);
  for (const s of [-1, 1]) mesh(rbox(0.002, 0.07, 0.032, 0.004), m.rubber, grip, { pos: [s * 0.0152, -0.055, 0.002] });
  mesh(rbox(0.02, 0.03, 0.025, 0.006), mat, grip, { pos: [0, -0.005, 0.025] });
  return grip;
}

function trigger(root: THREE.Object3D, m: Materials, pos: V3) {
  const t = group(root, { pos, name: 'trigger' });
  mesh(rbox(0.006, 0.024, 0.006, 0.002), m.steel, t, { pos: [0, -0.01, 0.003], rot: [0.35, 0, 0] });
  mesh(rbox(0.007, 0.004, 0.006, 0.0015), m.steel, t, { pos: [0, -0.021, 0.007], rot: [0.6, 0, 0] });
}

/** Map optic for sniper-class guns: only the scope or the 4x. */
const sniperOptic = (o: OpticId): OpticId => (o === 'acog' ? 'acog' : 'sniper');

// ---------------------------------------------------------------- VX-9 STINGER (PDW)

function buildVX9(m: Materials, cfg: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';
  const by = 0.02;
  const hw = 0.019;
  // upper receiver: flat top, rounded nose dropping to the barrel
  prof(root, m.anodized, [[0.135, 0.05, 0.006], [-0.15, 0.05, 0.006], [-0.184, 0.032, 0.014], [-0.19, 0.0, 0.008], [-0.17, -0.012, 0.004], [0.135, -0.012, 0.004]], 0.038);
  const ser: BoxSpec[] = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) ser.push([0.002, 0.02, 0.0032, s * hw, 0.02, -0.062 - i * 0.007]);
    ser.push([0.002, 0.004, 0.11, s * hw, 0.04, 0.03]);
  }
  boxes(root, m.hole, ser, 0.0008);
  boxes(root, m.anodizedEdge, [[0.03, 0.002, 0.27, 0, 0.051, -0.005]], 0.0008);
  // ejection port with the bolt showing, brass deflector behind it
  mesh(rbox(0.003, 0.015, 0.042, 0.001), m.hole, root, { pos: [hw, 0.026, -0.022], name: 'ejectionPort' });
  mesh(rbox(0.0016, 0.009, 0.034, 0.0006), m.steel, root, { pos: [hw + 0.0012, 0.025, -0.022] });
  mesh(rbox(0.006, 0.014, 0.016, 0.003), m.anodized, root, { pos: [hw + 0.002, 0.029, 0.007] });
  // T charging handle under the back of the rail
  const ch = group(root, { pos: [0, 0.041, 0.142], name: 'chargingHandle' });
  mesh(rbox(0.012, 0.007, 0.03, 0.002), m.anodized, ch, { pos: [0, 0, -0.01] });
  mesh(rbox(0.048, 0.008, 0.012, 0.003), m.anodized, ch, { pos: [0, 0, 0.005] });
  for (const s of [-1, 1]) mesh(rbox(0.01, 0.0065, 0.01, 0.002), m.anodizedEdge, ch, { pos: [s * 0.022, 0, 0.006] });
  // rear end cap with the stock guides
  mesh(rbox(0.036, 0.05, 0.008, 0.003), m.anodizedEdge, root, { pos: [0, 0.018, 0.136] });
  rail2(root, m, 0.0555, 0.132, -0.15);
  for (const s of [-1, 1]) railDir(root, m, s < 0 ? 'left' : 'right', s * (hw + 0.002), 0.012, -0.103, -0.152);
  pins(root, m, hw, [[0.003, 0.11], [0.003, -0.13], [0.034, -0.03], [0.034, 0.09]]);

  // lower frame with closed trigger guard
  prof(root, m.polymer, [[0.118, -0.008], [0.118, -0.03, 0.006], [0.042, -0.032, 0.004], [0.036, -0.08, 0.008], [0.016, -0.088, 0.008], [-0.046, -0.072, 0.012], [-0.062, -0.034, 0.006], [-0.172, -0.03, 0.006], [-0.176, -0.008]], 0.032, {
    holes: [[[0.026, -0.038], [0.024, -0.075], [-0.036, -0.064], [-0.05, -0.04]]],
    hr: 0.008,
  });
  pins(root, m, 0.016, [[-0.02, 0.1], [-0.02, -0.15]], 0.0022);
  trigger(root, m, [0, -0.036, 0.01]);
  // ambi selector + mag release
  xc(root, m.anodizedEdge, 0.0055, 0.036, [0, -0.019, 0.095]);
  boxes(root, m.anodizedEdge, [[0.003, 0.004, 0.018, -0.0185, -0.023, 0.088, 0.7], [0.003, 0.004, 0.018, 0.0185, -0.023, 0.088, 0.7]], 0.0012);
  xc(root, m.polymer, 0.0045, 0.035, [0, -0.034, 0.05], 12);

  // grip; the 40-round mag goes up through it
  const grip = group(root, { pos: [0, -0.028, 0.068], rot: [-0.18, 0, 0] });
  mesh(rbox(0.034, 0.122, 0.05, 0.01, 3), m.polymer, grip, { pos: [0, -0.06, 0] });
  for (const s of [-1, 1]) mesh(rbox(0.002, 0.08, 0.036, 0.004), m.rubber, grip, { pos: [s * 0.017, -0.06, 0.003] });
  boxes(grip, m.polymer, [0, 1, 2].map((i) => [0.032, 0.01, 0.008, 0, -0.03 - i * 0.026, -0.025] as BoxSpec), 0.003);
  mesh(rbox(0.038, 0.01, 0.056, 0.004), m.polymer, grip, { pos: [0, -0.12, 0] });
  const mag = group(root, { pos: [0, -0.028, 0.068], name: 'mag' });
  const mi = group(mag, { rot: [-0.18, 0, 0] });
  const mH = cfg.mag === 'ext' ? 0.22 : 0.165;
  const vxMag = (g: THREE.Object3D) => {
    mesh(rbox(0.022, mH, 0.032, 0.003), m.polymer, g, { pos: [0, -mH / 2, 0] });
    boxes(g, m.hole, [0, 1, 2].map((i) => [0.023, 0.0035, 0.004, 0, -0.13 - i * 0.012, 0.01] as BoxSpec), 0.0008);
    mesh(rbox(0.027, 0.012, 0.038, 0.004), m.polymer, g, { pos: [0, -mH - 0.004, 0.002] });
    mesh(rbox(0.014, 0.004, 0.024, 0.0015), m.anodizedEdge, g, { pos: [0, -mH - 0.011, 0.002] });
  };
  vxMag(mi);
  if (cfg.mag === 'fast') {
    vxMag(group(mi, { pos: [0.03, -0.075, 0] }));
    boxes(mi, m.webbing, [[0.062, 0.012, 0.04, 0.015, -0.135, 0], [0.062, 0.012, 0.04, 0.015, -0.158, 0]], 0.003);
  }

  // folding foregrip under the nose
  mesh(rbox(0.026, 0.016, 0.03, 0.004), m.polymer, root, { pos: [0, -0.038, -0.15] });
  xc(root, m.steel, 0.004, 0.03, [0, -0.046, -0.142]);
  const fold = cfg.under === 'grip' ? 0 : cfg.under === 'angled' ? 0.75 : 1.5;
  const fg = group(root, { pos: [0, -0.046, -0.142], rot: [fold, 0, 0] });
  mesh(rbox(0.024, 0.066, 0.028, 0.009, 3), m.polymer, fg, { pos: [0, -0.037, -0.004] });
  boxes(fg, m.polymer, [0, 1, 2].map((i) => [0.026, 0.004, 0.03, 0, -0.022 - i * 0.014, -0.004] as BoxSpec), 0.0015);
  mesh(rbox(0.028, 0.008, 0.032, 0.003), m.polymer, fg, { pos: [0, -0.07, -0.004] });
  underFor(root, m, cfg.under === 'laser' ? 'laser' : 'none', [-0.014, -0.098, hw + 0.0085], null);

  // barrel + muzzle
  zc(root, m.parkerized, 0.0085, 0.06, [0, by, -0.21]);
  zc(root, m.steel, 0.0125, 0.01, [0, by, -0.19], 0.011);
  const muzzle = group(root, { pos: [0, by, -0.255], name: 'muzzleBase' });
  addMuzzle(muzzle, m, cfg.muzzle, 'cone', 0.85);

  // collapsing twin-rod stock, pulled out
  for (const s of [-1, 1]) {
    zc(root, m.steel, 0.0036, 0.2, [s * 0.012, 0.0, 0.236], 0.0036, 12);
    mesh(rbox(0.012, 0.012, 0.014, 0.003), m.polymer, root, { pos: [s * 0.012, 0.0, 0.144] });
  }
  mesh(rbox(0.016, 0.008, 0.01, 0.002), m.anodizedEdge, root, { pos: [0, -0.012, 0.142] });
  const butt = group(root, { pos: [0, -0.006, 0.338] });
  mesh(rbox(0.044, 0.108, 0.02, 0.008, 3), m.polymer, butt, {});
  mesh(rbox(0.046, 0.112, 0.01, 0.005), m.rubber, butt, { pos: [0, 0, 0.013] });
  boxes(butt, m.rubber, [0, 1, 2, 3, 4].map((i) => [0.047, 0.003, 0.004, 0, -0.04 + i * 0.02, 0.018] as BoxSpec), 0.001);
  for (const s of [-1, 1]) zc(butt, m.steel, 0.0052, 0.008, [s * 0.012, 0.006, -0.012], 0.0052, 12);
  mesh(torus(0.006, 0.0015), m.steel, root, { pos: [-0.022, 0.0, 0.125], rot: [0, Math.PI / 2, 0] });

  if (cfg.optic !== 'iron') addOptic(root, m, cfg.optic, 0.0615, -0.02);
  railSights(root, m, cfg.optic === 'iron', 0.0665, 0.108, -0.135);

  markings(root, 'VX-9  CAL 4.6x30  SAFE-SEMI-AUTO', [-hw - 0.0006, 0.024, 0.045], 0.07);
  finishMuzzle(root);
  anchors(root, [0, -0.028, 0.068], -0.18, [-0.06, -0.05, -0.115]);
  return root;
}

// ---------------------------------------------------------------- SP-45 RATTLER (.45 SMG)

function buildSP45(m: Materials, cfg: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';
  const by = 0.02;
  const hw = 0.023;
  // boxy polymer receiver running out into the handguard
  prof(root, m.anodized, [[0.115, 0.05, 0.006], [-0.125, 0.05, 0.004], [-0.135, 0.044, 0.004], [-0.252, 0.042, 0.008], [-0.262, 0.03, 0.006], [-0.262, -0.016, 0.006], [-0.25, -0.024, 0.004], [0.115, -0.024, 0.006]], 0.046);
  const det: BoxSpec[] = [];
  for (const s of [-1, 1]) {
    det.push([0.004, 0.007, 0.34, s * (hw + 0.0005), 0.0, -0.075]);
    det.push([0.003, 0.004, 0.09, s * (hw + 0.0005), 0.047, 0.05]);
  }
  boxes(root, m.anodized, det, 0.0015);
  const vents: BoxSpec[] = [];
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) vents.push([0.002, 0.012, 0.007, s * hw, 0.03, -0.165 - i * 0.017]);
  boxes(root, m.hole, vents, 0.001);
  pins(root, m, hw, [[0.035, 0.092], [0.035, -0.105], [-0.012, 0.1], [-0.012, -0.24]]);
  // ejection port, bolt, deflector
  mesh(rbox(0.003, 0.018, 0.05, 0.001), m.hole, root, { pos: [hw, 0.028, -0.025], name: 'ejectionPort' });
  mesh(rbox(0.0016, 0.011, 0.042, 0.0006), m.steel, root, { pos: [hw + 0.0012, 0.027, -0.025] });
  mesh(rbox(0.006, 0.014, 0.016, 0.003), m.anodized, root, { pos: [hw + 0.003, 0.032, 0.009] });
  // non-reciprocating side charging handle (left, front)
  mesh(rbox(0.003, 0.008, 0.11, 0.001), m.hole, root, { pos: [-hw, 0.03, -0.155] });
  const ch = group(root, { pos: [-hw, 0.03, -0.205], name: 'chargingHandle' });
  mesh(rbox(0.014, 0.007, 0.01, 0.002), m.steel, ch, { pos: [-0.006, 0, 0] });
  knurl(ch, m.polymer, 0.0065, 0.014, [-0.017, 0, 0], 'x', 14);
  rail2(root, m, 0.0555, 0.1, -0.12);
  railDir(root, m, 'down', 0, -0.0265, -0.14, -0.248);
  for (const s of [-1, 1]) railDir(root, m, s < 0 ? 'left' : 'right', s * (hw + 0.002), 0.006, -0.175, -0.248);

  // lower: magwell, big trigger guard and grip in one moulding
  prof(root, m.polymer, [[0.112, -0.02, 0.004], [0.114, -0.045, 0.012], [0.135, -0.142, 0.008], [0.128, -0.152, 0.006], [0.086, -0.152, 0.008], [0.074, -0.118, 0.01], [0.0, -0.075, 0.008], [-0.078, -0.07, 0.006], [-0.082, -0.02, 0.004]], 0.036, {
    holes: [[[0.062, -0.035, 0.008], [0.068, -0.1, 0.012], [0.006, -0.064, 0.008], [0.006, -0.035, 0.004]]],
    hr: 0.008,
  });
  for (const s of [-1, 1]) mesh(rbox(0.002, 0.07, 0.034, 0.005), m.rubber, root, { pos: [s * 0.018, -0.1, 0.104], rot: [-0.2, 0, 0] });
  boxes(root, m.polymer, [0, 1, 2].map((i) => [0.036, 0.003, 0.006, 0, -0.06 - i * 0.012, -0.0805] as BoxSpec), 0.001);
  mesh(rbox(0.04, 0.006, 0.084, 0.003), m.polymer, root, { pos: [0, -0.072, -0.04] });
  trigger(root, m, [0, -0.036, 0.032]);
  xc(root, m.anodizedEdge, 0.007, 0.05, [0, -0.004, 0.082]);
  boxes(root, m.anodizedEdge, [[0.003, 0.016, 0.006, -0.0255, -0.011, 0.082, 0.3], [0.003, 0.016, 0.006, 0.0255, -0.011, 0.082, 0.3]], 0.0012);
  mesh(rbox(0.016, 0.008, 0.012, 0.003), m.polymer, root, { pos: [0, -0.07, 0.006] });

  boxMag(root, m, [0, -0.03, -0.042], 0, cfg.mag, { H: 0.17, w: 0.024, d: 0.036, mat: m.polymer, rnd: [0.0058, 0.032], window: true });

  // barrel + thread cap
  zc(root, m.parkerized, 0.0095, 0.045, [0, by, -0.282]);
  zc(root, m.steel, 0.0135, 0.008, [0, by, -0.264]);
  const muzzle = group(root, { pos: [0, by, -0.315], name: 'muzzleBase' });
  addMuzzle(muzzle, m, cfg.muzzle, 'cap', 1);

  // side-folding skeleton stock (shown open) with hinge on the right
  mesh(rbox(0.04, 0.05, 0.022, 0.004), m.anodizedEdge, root, { pos: [0, 0.012, 0.125] });
  yc(root, m.steel, 0.0065, 0.054, [hw - 0.002, 0.012, 0.134]);
  xc(root, m.steel, 0.006, 0.006, [-0.021, 0.012, 0.125]);
  prof(root, m.polymer, [[0.13, 0.04, 0.006], [0.35, 0.04, 0.006], [0.362, 0.03, 0.004], [0.362, -0.09, 0.006], [0.35, -0.1, 0.006], [0.3, -0.088, 0.01], [0.13, -0.018, 0.006]], 0.024, {
    holes: [[[0.152, 0.026], [0.336, 0.026], [0.336, -0.07], [0.3, -0.068], [0.162, -0.008]]],
    hr: 0.008,
  });
  mesh(rbox(0.032, 0.136, 0.012, 0.005), m.rubber, root, { pos: [0, -0.026, 0.37] });
  boxes(root, m.rubber, [0, 1, 2, 3, 4, 5].map((i) => [0.033, 0.003, 0.004, 0, -0.08 + i * 0.022, 0.376] as BoxSpec), 0.001);
  mesh(torus(0.006, 0.0016), m.steel, root, { pos: [-0.014, 0.042, 0.345], rot: [0, Math.PI / 2, 0] });
  mesh(torus(0.006, 0.0016), m.steel, root, { pos: [-hw - 0.004, 0.03, 0.105], rot: [0, Math.PI / 2, 0] });

  if (cfg.optic === 'iron') {
    // rotary diopter drum at the back, hooded post at the front
    const rs = group(root, { pos: [0, 0.0615, 0.085] });
    mesh(rbox(0.024, 0.01, 0.032, 0.002), m.anodized, rs, { pos: [0, 0.005, 0] });
    for (const s of [-1, 1]) mesh(rbox(0.004, 0.018, 0.02, 0.0015), m.anodized, rs, { pos: [s * 0.013, 0.014, 0] });
    xc(rs, m.anodizedEdge, 0.009, 0.022, [0, 0.019, 0], 20);
    zc(rs, m.hole, 0.0022, 0.002, [0, 0.019, 0.0085], 0.0022, 12);
    group(rs, { pos: [0, 0.019, 0], name: 'sight' });
    const fs = group(root, { pos: [0, 0.052, -0.236] });
    mesh(rbox(0.022, 0.016, 0.03, 0.003), m.anodized, fs, {});
    mesh(torus(0.0105, 0.0025, Math.PI), m.anodized, fs, { pos: [0, 0.008, 0] });
    mesh(rbox(0.003, 0.022, 0.003, 0.0008), m.steel, fs, { pos: [0, 0.019, 0] });
  } else {
    addOptic(root, m, cfg.optic, 0.0615, -0.01);
  }
  underFor(root, m, cfg.under, [-0.018, -0.17, hw + 0.0085], [-0.035, -0.2]);

  markings(root, 'SP-45  CAL .45 ACP  SAFE-SEMI-AUTO', [-hw - 0.0006, 0.022, -0.03], 0.075);
  finishMuzzle(root);
  anchors(root, [0, -0.03, 0.092], -0.2, [-0.066, -0.05, -0.19]);
  return root;
}

// ---------------------------------------------------------------- LM-5 BRUTE (5.56 belt-fed)

function buildLM5(m: Materials, cfg: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';
  const by = 0.02;
  const hw = 0.026;
  // stamped receiver with stiffening ribs and rivets
  prof(root, m.anodized, [[0.13, 0.052, 0.004], [-0.19, 0.052, 0.004], [-0.202, 0.042, 0.004], [-0.202, -0.028, 0.004], [-0.16, -0.04, 0.004], [0.13, -0.04, 0.004]], 0.052);
  boxes(root, m.anodized, [[0.004, 0.007, 0.3, -hw, -0.024, -0.03], [0.004, 0.007, 0.3, hw, -0.024, -0.03]], 0.002);
  pins(root, m, hw, [[0.038, 0.11], [0.038, -0.18], [-0.012, 0.11], [-0.012, -0.185], [0.038, 0.03], [-0.034, 0.06], [-0.034, -0.14]]);
  zc(root, m.steel, 0.017, 0.018, [0, by, -0.205]);

  // feed tray cover with rail, latch and hinge
  const cover = group(root, { pos: [0, 0.062, -0.035] });
  mesh(rbox(0.054, 0.018, 0.21, 0.006, 3), m.anodized, cover, {});
  boxes(cover, m.anodizedEdge, [[0.056, 0.004, 0.004, 0, -0.004, 0.06], [0.056, 0.004, 0.004, 0, -0.004, -0.06]], 0.001);
  xc(cover, m.steel, 0.0055, 0.058, [0, -0.004, -0.106]);
  mesh(rbox(0.03, 0.012, 0.016, 0.003), m.steel, cover, { pos: [0, 0.002, 0.112] });
  for (const s of [-1, 1]) mesh(rbox(0.004, 0.016, 0.022, 0.0015), m.steel, cover, { pos: [s * 0.0285, -0.005, 0.105] });
  rail2(cover, m, 0.012, 0.095, -0.09);
  // feed tray opening on the left
  mesh(rbox(0.003, 0.026, 0.07, 0.001), m.hole, root, { pos: [-hw, 0.03, -0.065] });
  mesh(rbox(0.018, 0.004, 0.07, 0.0015), m.steel, root, { pos: [-hw - 0.007, 0.016, -0.065] });
  // charging handle (right), ejection port low on the right with open cover
  mesh(rbox(0.003, 0.008, 0.12, 0.001), m.hole, root, { pos: [hw, 0.006, -0.11] });
  const ch = group(root, { pos: [hw, 0.006, -0.165], name: 'chargingHandle' });
  mesh(rbox(0.016, 0.009, 0.012, 0.003), m.steel, ch, { pos: [0.008, 0, 0] });
  knurl(ch, m.polymer, 0.0075, 0.016, [0.02, 0, 0], 'x', 14);
  mesh(rbox(0.003, 0.012, 0.055, 0.001), m.hole, root, { pos: [hw, -0.028, -0.055], name: 'ejectionPort' });
  mesh(rbox(0.012, 0.0015, 0.05, 0.0005), m.steel, root, { pos: [hw + 0.006, -0.036, -0.055], rot: [0, 0, -0.4] });

  // trigger housing, guard, grip
  mesh(rbox(0.036, 0.026, 0.12, 0.004), m.parkerized, root, { pos: [0, -0.05, 0.065] });
  boxes(root, m.parkerized, [[0.012, 0.005, 0.094, 0, -0.092, 0.043], [0.012, 0.034, 0.005, 0, -0.077, -0.002]], 0.002);
  pins(root, m, 0.018, [[-0.05, 0.02], [-0.05, 0.1]], 0.0022);
  trigger(root, m, [0, -0.06, 0.045]);
  xc(root, m.anodizedEdge, 0.006, 0.04, [0, -0.052, 0.112]);
  pistolGrip(root, m, [0, -0.062, 0.105], -0.3);

  // skeleton stock on a buffer housing
  zc(root, m.anodized, 0.02, 0.05, [0, 0.01, 0.155]);
  prof(root, m.anodized, [[0.135, 0.045, 0.006], [0.36, 0.036, 0.008], [0.375, 0.024, 0.004], [0.375, -0.11, 0.006], [0.36, -0.122, 0.008], [0.3, -0.105, 0.012], [0.16, -0.045, 0.01], [0.135, -0.03, 0.004]], 0.036, {
    holes: [[[0.168, 0.027], [0.345, 0.021], [0.345, -0.088], [0.3, -0.082], [0.18, -0.031]]],
    hr: 0.012,
  });
  mesh(rbox(0.04, 0.152, 0.014, 0.005), m.rubber, root, { pos: [0, -0.043, 0.383] });
  boxes(root, m.rubber, [0, 1, 2, 3, 4, 5].map((i) => [0.041, 0.003, 0.004, 0, -0.1 + i * 0.024, 0.39] as BoxSpec), 0.001);
  mesh(rbox(0.03, 0.004, 0.07, 0.0015), m.steel, root, { pos: [0, 0.042, 0.33] });
  mesh(torus(0.006, 0.0016), m.steel, root, { pos: [0, -0.122, 0.34], rot: [0, Math.PI / 2, 0] });

  // handguard over the gas cylinder
  mesh(rbox(0.058, 0.044, 0.16, 0.012, 3), m.anodized, root, { pos: [0, -0.012, -0.28] });
  const hg: BoxSpec[] = [];
  for (const s of [-1, 1]) for (const k of [-1, 0, 1]) hg.push([0.002, 0.004, 0.13, s * 0.029, -0.012 + k * 0.01, -0.28]);
  boxes(root, m.hole, hg, 0.0008);
  // perforated heat shield over the barrel
  const shield = cached('lm5Shield', () => new THREE.CylinderGeometry(0.019, 0.019, 0.16, 20, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2));
  mesh(shield, shellMat(m.parkerized), root, { pos: [0, by, -0.28] });
  const sh: BoxSpec[] = [];
  for (let i = 0; i < 5; i++) for (const a of [-0.65, 0, 0.65]) sh.push([0.007, 0.0016, 0.016, Math.sin(a) * 0.0192, by + Math.cos(a) * 0.0192, -0.22 - i * 0.03, 0, 0, -a]);
  boxes(root, m.hole, sh, 0.0006);
  // gas cylinder, gas block + regulator
  zc(root, m.parkerized, 0.0095, 0.27, [0, -0.008, -0.33]);
  mesh(rbox(0.03, 0.05, 0.04, 0.005), m.parkerized, root, { pos: [0, 0.006, -0.47] });
  knurl(root, m.steel, 0.009, 0.01, [-0.02, -0.008, -0.47], 'x', 12);
  mesh(rbox(0.004, 0.024, 0.008, 0.0015), m.steel, root, { pos: [-0.026, -0.016, -0.47], rot: [0.4, 0, 0] });
  // barrel
  zc(root, m.parkerized, 0.011, 0.46, [0, by, -0.42]);
  const muzzle = group(root, { pos: [0, by, -0.67], name: 'muzzleBase' });
  addMuzzle(muzzle, m, cfg.muzzle, 'birdcage');
  // carry handle folded to the left
  const handle = group(root, { pos: [0, by, -0.385] });
  mesh(rbox(0.03, 0.03, 0.022, 0.006), m.parkerized, handle, {});
  const arm = group(handle, { rot: [0, 0, 0.9] });
  mesh(rbox(0.012, 0.06, 0.012, 0.004), m.parkerized, arm, { pos: [0, 0.035, 0] });
  zc(arm, m.polymer, 0.0095, 0.11, [0, 0.065, 0.045]);
  boxes(arm, m.polymer, [0, 1, 2, 3, 4].map((i) => [0.021, 0.021, 0.004, 0, 0.065, 0.005 + i * 0.02] as BoxSpec), 0.006);
  // tall front sight
  const fs = group(root, { pos: [0, 0, -0.585] });
  mesh(rbox(0.026, 0.026, 0.02, 0.005), m.parkerized, fs, { pos: [0, by, 0] });
  mesh(rbox(0.01, 0.06, 0.012, 0.003), m.parkerized, fs, { pos: [0, 0.06, 0] });
  boxes(fs, m.parkerized, [[0.003, 0.03, 0.012, -0.009, 0.082, 0], [0.003, 0.03, 0.012, 0.009, 0.082, 0]], 0.001);
  mesh(rbox(0.003, 0.016, 0.003, 0.0008), m.steel, fs, { pos: [0, 0.097, 0] });
  bipod(root, m, [0, -0.026, -0.47], 0.17);

  // 100-round soft pouch hanging under the left side, belt running up into the tray
  const ext = cfg.mag === 'ext';
  const W = ext ? 0.095 : 0.085;
  const H = ext ? 0.16 : 0.125;
  const D = ext ? 0.12 : 0.105;
  const mag = group(root, { pos: [-0.016, -0.046, -0.07], name: 'mag' });
  mesh(rbox(0.06, 0.012, 0.09, 0.003), m.polymer, mag, { pos: [0.012, -0.002, 0] });
  mesh(rbox(W, H, D, 0.016, 3), m.coyote, mag, { pos: [0, -0.008 - H / 2, 0] });
  mesh(rbox(W + 0.004, 0.044, 0.01, 0.005), m.coyote, mag, { pos: [0, -0.03, -D / 2 - 0.002] });
  boxes(mag, m.webbing, [[W + 0.004, 0.016, D + 0.004, 0, -0.008 - H * 0.62, 0], [0.018, H * 0.5, D + 0.006, 0, -0.008 - H * 0.6, 0]], 0.004);
  mesh(rbox(0.024, 0.02, 0.006, 0.003), m.polymer, mag, { pos: [0, -0.008 - H * 0.62, -D / 2 - 0.006] });
  mesh(rbox(0.012, 0.004, 0.07, 0.002), m.webbing, mag, { pos: [W / 2 + 0.003, -0.02, 0] });
  boxes(mag, m.hole, [[W + 0.0012, 0.001, 0.001, 0, -0.012, -D / 2 + 0.002], [W + 0.0012, 0.001, 0.001, 0, -0.012, D / 2 - 0.002]], 0.0003);
  belt(mag, m, [-W / 2 + 0.014, -0.004], [-W / 2 - 0.016, 0.052], [-0.009, 0.077], 0.005, 0.0105, 0.0048, 0.057);

  if (cfg.optic === 'iron') rearAperture(root, m, 0.0855, 0.05);
  else addOptic(root, m, cfg.optic, 0.0802, -0.025);
  railDir(root, m, 'down', 0, -0.034, -0.24, -0.33);
  underFor(root, m, cfg.under, [-0.02, -0.29, hw + 0.004], [-0.046, -0.285]);

  markings(root, 'LM-5  CAL 5.56mm  No 0905', [-hw - 0.0006, -0.006, 0.06], 0.08);
  finishMuzzle(root);
  anchors(root, [0, -0.062, 0.105], -0.3, [-0.074, -0.056, -0.27]);
  return root;
}

// ---------------------------------------------------------------- PK-7 ANVIL (7.62 GPMG)

function buildPK7(m: Materials, cfg: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';
  const by = 0.015;
  const hw = 0.0235;
  prof(root, m.anodized, [[0.11, 0.04, 0.004], [-0.2, 0.04, 0.004], [-0.218, 0.028, 0.006], [-0.218, -0.03, 0.004], [0.05, -0.034, 0.004], [0.11, -0.034, 0.004]], 0.047);
  boxes(root, m.anodized, [[0.003, 0.006, 0.26, -hw, -0.022, -0.06], [0.003, 0.006, 0.26, hw, -0.022, -0.06]], 0.0015);
  pins(root, m, hw, [[0.03, 0.09], [0.03, -0.195], [-0.02, 0.09], [-0.012, -0.195], [0.0, 0.035], [-0.022, 0.06]]);
  mesh(rbox(0.05, 0.072, 0.024, 0.004), m.parkerized, root, { pos: [0, 0.004, -0.212] });
  // feed cover with spine, latch and hinge
  const cover = group(root, { pos: [0, 0.05, -0.04] });
  mesh(rbox(0.047, 0.016, 0.19, 0.006, 3), m.anodized, cover, {});
  mesh(rbox(0.02, 0.006, 0.17, 0.002), m.anodized, cover, { pos: [0, 0.009, 0] });
  for (const s of [-1, 1]) boxes(cover, m.anodizedEdge, [0, 1, 2, 3].map((i) => [0.002, 0.008, 0.012, s * 0.0235, -0.002, -0.06 + i * 0.04] as BoxSpec), 0.0008);
  xc(cover, m.steel, 0.0055, 0.05, [0, -0.004, -0.096]);
  mesh(rbox(0.03, 0.012, 0.014, 0.003), m.steel, cover, { pos: [0, -0.002, 0.1] });
  mesh(rbox(0.012, 0.004, 0.016, 0.0015), m.steel, cover, { pos: [0, 0.006, 0.11], rot: [-0.3, 0, 0] });
  // feed port (right), ejection port, charging handle
  mesh(rbox(0.003, 0.024, 0.065, 0.001), m.hole, root, { pos: [hw, 0.024, -0.065] });
  mesh(rbox(0.016, 0.004, 0.065, 0.0015), m.steel, root, { pos: [hw + 0.007, 0.011, -0.065] });
  mesh(rbox(0.003, 0.012, 0.045, 0.001), m.hole, root, { pos: [hw, -0.004, 0.03], name: 'ejectionPort' });
  mesh(rbox(0.0015, 0.014, 0.045, 0.0005), m.steel, root, { pos: [hw + 0.006, -0.013, 0.03], rot: [0, 0, -0.5] });
  mesh(rbox(0.003, 0.008, 0.12, 0.001), m.hole, root, { pos: [hw, -0.018, -0.12] });
  const ch = group(root, { pos: [hw, -0.018, -0.17], name: 'chargingHandle' });
  mesh(rbox(0.012, 0.008, 0.012, 0.003), m.steel, ch, { pos: [0.006, 0, 0] });
  mesh(rbox(0.01, 0.024, 0.014, 0.004), m.steel, ch, { pos: [0.014, 0.008, 0] });
  boxes(ch, m.parkerized, [0, 1, 2, 3].map((i) => [0.011, 0.002, 0.015, 0.014, 0.0 + i * 0.005, 0] as BoxSpec), 0.0006);
  // rear tangent sight ahead of the cover
  const rs = group(root, { pos: [0, 0.046, -0.172] });
  mesh(rbox(0.03, 0.014, 0.05, 0.004), m.parkerized, rs, {});
  mesh(rbox(0.02, 0.004, 0.056, 0.0012), m.steel, rs, { pos: [0, 0.009, 0.002], rot: [0.05, 0, 0] });
  boxes(rs, m.lens, [0, 1, 2, 3, 4, 5].map((i) => [0.0004, 0.002, 0.0015, 0.0102, 0.0095, -0.018 + i * 0.006] as BoxSpec), 0.0002);
  mesh(rbox(0.024, 0.008, 0.009, 0.0015), m.steel, rs, { pos: [0, 0.01, -0.01] });
  mesh(rbox(0.018, 0.004, 0.005, 0.001), m.steel, rs, { pos: [0, 0.012, 0.024] });
  for (const s of [-1, 1]) mesh(rbox(0.0055, 0.008, 0.005, 0.001), m.steel, rs, { pos: [s * 0.006, 0.017, 0.024] });

  // trigger group, grip
  mesh(rbox(0.03, 0.024, 0.1, 0.004), m.parkerized, root, { pos: [0, -0.045, 0.05] });
  boxes(root, m.parkerized, [[0.012, 0.005, 0.088, 0, -0.085, 0.036], [0.012, 0.03, 0.005, 0, -0.07, -0.006]], 0.002);
  trigger(root, m, [0, -0.055, 0.032]);
  mesh(rbox(0.004, 0.012, 0.03, 0.0015), m.steel, root, { pos: [-0.016, -0.045, 0.06], rot: [0.3, 0, 0] });
  const grip = group(root, { pos: [0, -0.054, 0.085], rot: [-0.32, 0, 0] });
  mesh(rbox(0.03, 0.105, 0.042, 0.012, 3), m.wood, grip, { pos: [0, -0.05, 0] });
  for (const s of [-1, 1]) boxes(grip, m.hole, [0, 1, 2, 3, 4].map((i) => [0.002, 0.05, 0.0015, s * 0.0152, -0.05, -0.012 + i * 0.006] as BoxSpec), 0.0004);
  xc(grip, m.steel, 0.004, 0.031, [0, -0.02, 0], 10);

  // skeleton wooden stock
  prof(root, m.wood, [[0.11, 0.036, 0.004], [0.4, 0.02, 0.01], [0.41, 0.005, 0.004], [0.41, -0.12, 0.006], [0.395, -0.13, 0.008], [0.33, -0.11, 0.02], [0.16, -0.06, 0.02], [0.11, -0.034, 0.004]], 0.036, {
    holes: [[[0.17, 0.02], [0.37, 0.008], [0.37, -0.09], [0.32, -0.086], [0.2, -0.042]]],
    hr: 0.014,
    grain: true,
  });
  mesh(rbox(0.042, 0.04, 0.02, 0.004), m.parkerized, root, { pos: [0, 0.002, 0.115] });
  mesh(rbox(0.04, 0.138, 0.006, 0.002), m.parkerized, root, { pos: [0, -0.055, 0.415] });
  const rest = group(root, { pos: [0, -0.12, 0.414] });
  mesh(rbox(0.03, 0.004, 0.05, 0.0015), m.steel, rest, { pos: [0, 0, -0.025], rot: [-0.12, 0, 0] });
  xc(rest, m.steel, 0.003, 0.034, [0, 0, 0], 10);
  mesh(torus(0.0065, 0.0016), m.steel, root, { pos: [-0.019, -0.09, 0.36], rot: [0, Math.PI / 2, 0] });

  // gas tube cover/handguard, gas tube + block + regulator
  mesh(rbox(0.044, 0.03, 0.12, 0.01, 3), m.wood, root, { pos: [0, -0.022, -0.29] });
  boxes(root, m.hole, [0, 1, 2, 3, 4].map((i) => [0.046, 0.022, 0.003, 0, -0.022, -0.245 - i * 0.022] as BoxSpec), 0.0008);
  mesh(rbox(0.048, 0.01, 0.008, 0.002), m.parkerized, root, { pos: [0, -0.022, -0.352] });
  zc(root, m.parkerized, 0.0085, 0.31, [0, -0.018, -0.375]);
  mesh(rbox(0.026, 0.052, 0.032, 0.005), m.parkerized, root, { pos: [0, 0.0, -0.54] });
  knurl(root, m.steel, 0.0095, 0.008, [0.017, -0.018, -0.54], 'x', 10);
  mesh(rbox(0.004, 0.02, 0.006, 0.0015), m.steel, root, { pos: [0.022, -0.026, -0.54] });

  // fluted barrel, carry handle, front sight
  zc(root, m.parkerized, 0.0125, 0.565, [0, by, -0.5025]);
  const fl: BoxSpec[] = [];
  for (const [zz, len] of [[-0.42, 0.2], [-0.64, 0.12]]) {
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + Math.PI / 6;
      if (zz > -0.53 && Math.sin(a) < -0.3) continue;
      fl.push([0.002, 0.0026, len, Math.cos(a) * 0.0117, by + Math.sin(a) * 0.0117, zz, 0, 0, a]);
    }
  }
  boxes(root, m.hole, fl, 0.0008);
  zc(root, m.steel, 0.0175, 0.016, [0, by, -0.228]);
  const handle = group(root, { pos: [0, by, -0.262] });
  mesh(rbox(0.034, 0.034, 0.024, 0.006), m.parkerized, handle, {});
  const arm = group(handle, { rot: [0, 0, 1.0] });
  mesh(rbox(0.012, 0.06, 0.012, 0.004), m.parkerized, arm, { pos: [0, 0.036, 0] });
  zc(arm, m.wood, 0.0105, 0.11, [0, 0.066, 0.045]);
  const fs = group(root, { pos: [0, 0, -0.712] });
  mesh(rbox(0.028, 0.03, 0.024, 0.005), m.parkerized, fs, { pos: [0, by + 0.002, 0] });
  mesh(rbox(0.012, 0.03, 0.012, 0.003), m.parkerized, fs, { pos: [0, 0.042, 0] });
  boxes(fs, m.parkerized, [[0.003, 0.03, 0.014, -0.0095, 0.05, 0], [0.003, 0.03, 0.014, 0.0095, 0.05, 0]], 0.001);
  mesh(rbox(0.003, 0.012, 0.003, 0.0008), m.steel, fs, { pos: [0, 0.06, 0] });
  const muzzle = group(root, { pos: [0, by, -0.805], name: 'muzzleBase' });
  addMuzzle(muzzle, m, cfg.muzzle, 'slotted', 1.05);
  bipod(root, m, [0, -0.032, -0.555], 0.2);

  // 100-round can under the receiver, belt up into the right side
  const ext = cfg.mag === 'ext';
  const W = 0.072;
  const H = ext ? 0.15 : 0.12;
  const D = ext ? 0.135 : 0.115;
  const olv = olive(m);
  const mag = group(root, { pos: [0.012, -0.036, -0.07], name: 'mag' });
  mesh(rbox(0.03, 0.008, 0.09, 0.002), m.parkerized, mag, { pos: [-0.012, 0.0, 0] });
  mesh(rbox(W, H, D, 0.004), olv, mag, { pos: [0, -0.008 - H / 2, 0] });
  boxes(mag, olv, [[W + 0.003, 0.006, D + 0.003, 0, -0.03, 0], [W + 0.003, 0.006, D + 0.003, 0, -H + 0.02, 0]], 0.0015);
  mesh(rbox(W + 0.004, 0.01, D + 0.004, 0.003), olv, mag, { pos: [0, -0.008, 0] });
  zc(mag, m.steel, 0.003, D - 0.01, [-W / 2 - 0.002, -0.008, 0], 0.003, 10);
  mesh(rbox(0.006, 0.022, 0.016, 0.002), m.steel, mag, { pos: [W / 2 + 0.003, -0.018, -D / 2 + 0.02] });
  mesh(torus(0.018, 0.0018, Math.PI), m.steel, mag, { pos: [-W / 2 - 0.003, -0.03, 0], rot: [0, Math.PI / 2, Math.PI] });
  mesh(rbox(0.02, 0.003, 0.07, 0.001), m.hole, mag, { pos: [W / 2 - 0.014, -0.0025, 0] });
  markings(mag, '7.62x54R  100 RDS  LOT 77', [-W / 2 - 0.0006, -0.06, 0.0], 0.07);
  belt(mag, m, [W / 2 - 0.014, -0.004], [W / 2 + 0.022, 0.04], [0.0115, 0.06], 0.005, 0.0138, 0.0062, 0.077);

  if (cfg.optic === 'iron') {
    group(root, { pos: [0, 0.064, -0.148], name: 'sight' });
  } else {
    rail2(cover, m, 0.0145, 0.07, -0.07);
    addOptic(root, m, cfg.optic, 0.0705, -0.04);
  }
  underFor(root, m, cfg.under, [-0.042, -0.29, 0.022], [-0.037, -0.3]);

  markings(root, 'PK-7  7.62x54R  No 1217', [-hw - 0.0006, 0.002, -0.06], 0.085);
  finishMuzzle(root);
  anchors(root, [0, -0.054, 0.085], -0.32, [-0.066, -0.052, -0.29]);
  return root;
}

// ---------------------------------------------------------------- KESTREL (light .308 bolt)

function buildKestrel(m: Materials, cfg: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';
  const by = 0.02;
  // tactical polymer stock: near-vertical grip, raised comb, free-floated forend
  prof(root, m.fde, [[-0.34, 0.006, 0.01], [-0.35, -0.022, 0.015], [-0.3, -0.038, 0.03], [-0.07, -0.046, 0.03], [-0.03, -0.054, 0.006], [0.05, -0.054, 0.006], [0.072, -0.05, 0.016], [0.098, -0.13, 0.01], [0.138, -0.13, 0.012], [0.14, -0.092, 0.03], [0.39, -0.12, 0.008], [0.39, 0.035, 0.008], [0.21, 0.034, 0.03], [0.13, 0.014, 0.025], [0.076, 0.006, 0.006], [-0.1, 0.006, 0]], 0.042);
  for (const s of [-1, 1]) mesh(rbox(0.002, 0.06, 0.03, 0.004), m.fde, root, { pos: [s * 0.0212, -0.09, 0.112], rot: [-0.35, 0, 0] });
  // adjustable cheek riser
  mesh(rbox(0.034, 0.016, 0.15, 0.007), m.polymer, root, { pos: [0, 0.05, 0.29] });
  for (const zz of [0.24, 0.34]) yc(root, m.steel, 0.003, 0.016, [0, 0.04, zz], 10);
  knurl(root, m.anodizedEdge, 0.0065, 0.007, [-0.024, 0.02, 0.29], 'x', 12);
  // butt pad, sling studs, bipod stud
  mesh(rbox(0.044, 0.158, 0.004, 0.002), m.polymer, root, { pos: [0, -0.043, 0.3925] });
  mesh(rbox(0.044, 0.16, 0.016, 0.006), m.rubber, root, { pos: [0, -0.043, 0.402] });
  boxes(root, m.rubber, [0, 1, 2, 3, 4, 5].map((i) => [0.045, 0.003, 0.004, 0, -0.1 + i * 0.024, 0.409] as BoxSpec), 0.001);
  for (const [y, z] of [[-0.043, -0.28], [-0.117, 0.33]]) {
    yc(root, m.steel, 0.003, 0.008, [0, y, z], 10);
    mesh(torus(0.0065, 0.0016), m.steel, root, { pos: [0, y - 0.008, z], rot: [0, Math.PI / 2, 0] });
  }
  yc(root, m.steel, 0.0035, 0.006, [0, -0.036, -0.315], 10);

  // round receiver with rings, recoil lug, ejection port
  zc(root, m.anodized, 0.0165, 0.235, [0, by, -0.045]);
  zc(root, m.anodized, 0.0174, 0.04, [0, by, -0.142]);
  zc(root, m.anodized, 0.0174, 0.028, [0, by, 0.058]);
  mesh(rbox(0.03, 0.012, 0.008, 0.002), m.steel, root, { pos: [0, 0.004, -0.158] });
  mesh(rbox(0.004, 0.016, 0.058, 0.0012), m.hole, root, { pos: [0.0149, by + 0.007, -0.04], rot: [0, 0, 0.45], name: 'ejectionPort' });
  mesh(rbox(0.004, 0.012, 0.016, 0.0012), m.hole, root, { pos: [0.0162, by - 0.002, 0.066] });
  mesh(rbox(0.004, 0.006, 0.014, 0.0015), m.steel, root, { pos: [0.012, by + 0.012, 0.082] });
  mesh(rbox(0.003, 0.008, 0.012, 0.001), m.steel, root, { pos: [-0.0172, by + 0.004, 0.056] });
  mesh(rbox(0.016, 0.006, 0.2, 0.002), m.anodizedEdge, root, { pos: [0, 0.0375, -0.045] });
  rail2(root, m, 0.0425, 0.055, -0.145);

  // bolt: origin on the bore at the rear of the receiver; handle on the right
  const bolt = group(root, { pos: [0, by, 0.0725], name: 'bolt' });
  zc(bolt, m.steel, 0.012, 0.034, [0, 0, 0.017], 0.0125);
  mesh(rbox(0.009, 0.012, 0.016, 0.003), m.steel, bolt, { pos: [0, -0.004, 0.038] });
  mesh(rbox(0.003, 0.003, 0.003, 0.001), m.laserRed, bolt, { pos: [0, 0.003, 0.047] });
  zc(bolt, m.steel, 0.0095, 0.13, [0, 0, -0.065]);
  mesh(rbox(0.0016, 0.011, 0.048, 0.0006), m.steel, bolt, { pos: [0.0161, 0.0076, -0.112], rot: [0, 0, 0.45] });
  const handle = group(bolt, { pos: [0.009, 0, 0.004], name: 'chargingHandle' });
  const harm = group(handle, { rot: [0, -0.3, -0.5] });
  mesh(rbox(0.04, 0.007, 0.0075, 0.003), m.steel, harm, { pos: [0.02, 0, 0] });
  knurl(harm, m.polymer, 0.0085, 0.014, [0.042, 0, 0], 'x', 16);
  mesh(cached('kesKnob', () => new THREE.SphereGeometry(0.0086, 16, 10)), m.polymer, harm, { pos: [0.05, 0, 0] });

  // bottom metal: trigger guard, floor plate, mag release
  prof(root, m.parkerized, [[0.0, -0.05], [0.07, -0.05], [0.07, -0.058], [0.064, -0.092, 0.012], [0.02, -0.094, 0.012], [-0.002, -0.07, 0.006]], 0.014, {
    holes: [[[0.009, -0.058], [0.058, -0.058], [0.055, -0.084, 0.008], [0.022, -0.086, 0.008], [0.011, -0.07, 0.004]]],
    hr: 0.006,
  });
  mesh(rbox(0.028, 0.006, 0.1, 0.002), m.parkerized, root, { pos: [0, -0.055, -0.035] });
  mesh(rbox(0.012, 0.006, 0.012, 0.002), m.steel, root, { pos: [0, -0.058, -0.086], rot: [-0.3, 0, 0] });
  trigger(root, m, [0, -0.05, 0.034]);
  boxMag(root, m, [0, -0.045, -0.035], 0, cfg.mag, { H: 0.044, w: 0.024, d: 0.078, mat: m.polymer, fast: false, extK: 1.5, ribs: false });

  // slim tapered fluted barrel
  zc(root, m.parkerized, 0.0118, 0.555, [0, by, -0.44], 0.0085);
  zc(root, m.parkerized, 0.0128, 0.012, [0, by, -0.168]);
  const fl: BoxSpec[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    fl.push([0.002, 0.0026, 0.2, Math.cos(a) * 0.0098, by + Math.sin(a) * 0.0098, -0.37, 0, 0, a]);
  }
  boxes(root, m.hole, fl, 0.0008);
  const muzzle = group(root, { pos: [0, by, -0.735], name: 'muzzleBase' });
  addMuzzle(muzzle, m, cfg.muzzle, 'cap', 0.9);

  if (cfg.under === 'laser') addUnder(root, m, 'laser', -0.044, -0.2, 0.021);
  addOptic(root, m, sniperOptic(cfg.optic), 0.0485, -0.045);

  markings(root, 'KESTREL  .308 WIN  No 2210', [-0.0172, by, -0.08], 0.06);
  finishMuzzle(root);
  anchors(root, [0, -0.046, 0.098], -0.36, [-0.064, -0.06, -0.24]);
  return root;
}

// ---------------------------------------------------------------- WARDEN .338 (chassis bolt)

function buildWarden(m: Materials, cfg: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';
  const by = 0.02;
  // machined chassis: centre section, magwell, integral trigger guard
  mesh(rbox(0.052, 0.046, 0.28, 0.005), m.anodized, root, { pos: [0, -0.01, -0.04] });
  const pk: BoxSpec[] = [];
  for (const s of [-1, 1]) for (const zz of [0.06, -0.135]) pk.push([0.002, 0.018, 0.035, s * 0.026, -0.012, zz]);
  boxes(root, m.hole, pk, 0.003);
  boxes(root, m.anodizedEdge, [[0.005, 0.005, 0.28, -0.025, 0.012, -0.04, 0, 0, 0.785], [0.005, 0.005, 0.28, 0.025, 0.012, -0.04, 0, 0, 0.785]], 0.001);
  mesh(rbox(0.054, 0.04, 0.112, 0.005), m.anodized, root, { pos: [0, -0.046, -0.048] });
  mesh(rbox(0.058, 0.006, 0.118, 0.002), m.anodizedEdge, root, { pos: [0, -0.066, -0.048] });
  prof(root, m.anodized, [[0.008, -0.03], [0.078, -0.03], [0.08, -0.07, 0.012], [0.008, -0.068, 0.006]], 0.016, {
    holes: [[[0.018, -0.036], [0.07, -0.036], [0.07, -0.062, 0.01], [0.018, -0.06, 0.006]]],
    hr: 0.006,
  });
  trigger(root, m, [0, -0.034, 0.042]);
  mesh(rbox(0.022, 0.006, 0.012, 0.002), m.steel, root, { pos: [0, -0.066, 0.012] });
  // long free-float forend with M-LOK, full-length rail
  mesh(rbox(0.054, 0.058, 0.38, 0.01), m.anodized, root, { pos: [0, 0.007, -0.37] });
  boxes(root, m.anodizedEdge, [[0.005, 0.005, 0.38, -0.024, 0.033, -0.37, 0, 0, 0.785], [0.005, 0.005, 0.38, 0.024, 0.033, -0.37, 0, 0, 0.785]], 0.001);
  const ml: BoxSpec[] = [];
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) ml.push([0.002, 0.009, 0.03, s * 0.027, 0.004, -0.215 - i * 0.05]);
  for (let i = 0; i < 4; i++) ml.push([0.009, 0.002, 0.03, 0, -0.022, -0.22 - i * 0.055]);
  boxes(root, m.hole, ml, 0.0035);
  mesh(rbox(0.03, 0.008, 0.37, 0.002), m.anodized, root, { pos: [0, 0.039, -0.37] });
  mesh(rbox(0.018, 0.006, 0.27, 0.002), m.anodizedEdge, root, { pos: [0, 0.041, -0.04] });
  rail2(root, m, 0.045, 0.098, -0.555);
  railDir(root, m, 'down', 0, -0.025, -0.47, -0.552);
  for (const [x, z] of [[-0.028, -0.2], [-0.028, 0.06]]) {
    xc(root, m.steel, 0.006, 0.004, [x, 0.0, z], 16);
    zc(root, m.hole, 0.0032, 0.002, [x - 0.0021, 0.0, z], 0.0032, 12).rotation.set(0, 0, Math.PI / 2);
  }

  // action
  zc(root, m.parkerized, 0.019, 0.275, [0, by, -0.0375]);
  zc(root, m.parkerized, 0.0198, 0.03, [0, by, -0.16]);
  mesh(rbox(0.004, 0.018, 0.068, 0.0012), m.hole, root, { pos: [0.0171, by + 0.008, -0.035], rot: [0, 0, 0.45], name: 'ejectionPort' });
  mesh(rbox(0.004, 0.014, 0.018, 0.0012), m.hole, root, { pos: [0.0188, by - 0.002, 0.092] });
  mesh(rbox(0.003, 0.008, 0.014, 0.001), m.steel, root, { pos: [-0.0195, by + 0.004, 0.08] });
  // bolt: origin on the bore at the rear of the action
  const bolt = group(root, { pos: [0, by, 0.1], name: 'bolt' });
  zc(bolt, m.steel, 0.014, 0.04, [0, 0, 0.02], 0.015);
  mesh(rbox(0.01, 0.013, 0.018, 0.003), m.steel, bolt, { pos: [0, -0.006, 0.046] });
  mesh(rbox(0.003, 0.003, 0.004, 0.001), m.laserRed, bolt, { pos: [0, 0.002, 0.055] });
  zc(bolt, m.steel, 0.0115, 0.16, [0, 0, -0.08]);
  mesh(rbox(0.0016, 0.013, 0.056, 0.0006), m.steel, bolt, { pos: [0.0185, 0.0088, -0.135], rot: [0, 0, 0.45] });
  const handle = group(bolt, { pos: [0.011, 0, 0.006], name: 'chargingHandle' });
  const harm = group(handle, { rot: [0, -0.25, -0.55] });
  mesh(rbox(0.05, 0.008, 0.008, 0.003), m.steel, harm, { pos: [0.025, 0, 0] });
  knurl(harm, m.anodizedEdge, 0.011, 0.024, [0.058, 0, 0], 'x', 18);
  mesh(cached('warKnob', () => new THREE.SphereGeometry(0.0105, 16, 10)), m.anodizedEdge, harm, { pos: [0.07, 0, 0] });

  // grip
  const grip = group(root, { pos: [0, -0.032, 0.098], rot: [-0.22, 0, 0] });
  mesh(rbox(0.032, 0.11, 0.046, 0.011, 3), m.polymer, grip, { pos: [0, -0.055, 0] });
  for (const s of [-1, 1]) mesh(rbox(0.002, 0.07, 0.034, 0.004), m.rubber, grip, { pos: [s * 0.0162, -0.06, 0.002] });
  mesh(rbox(0.036, 0.01, 0.05, 0.004), m.polymer, grip, { pos: [0, -0.112, 0.002] });
  mesh(rbox(0.008, 0.008, 0.03, 0.003), m.polymer, grip, { pos: [-0.019, -0.006, 0.004] });

  // folding stock: hinge, skeleton frame, cheek piece, butt and monopod
  mesh(rbox(0.05, 0.052, 0.026, 0.005), m.anodized, root, { pos: [0, -0.004, 0.113] });
  yc(root, m.steel, 0.007, 0.054, [0.026, -0.004, 0.122]);
  xc(root, m.anodizedEdge, 0.007, 0.006, [-0.026, -0.004, 0.113]);
  prof(root, m.anodized, [[0.124, 0.03, 0.004], [0.38, 0.03, 0.006], [0.385, 0.02, 0.004], [0.385, -0.105, 0.004], [0.37, -0.115, 0.006], [0.31, -0.115, 0.004], [0.124, -0.03, 0.006]], 0.034, {
    holes: [[[0.148, 0.016], [0.27, 0.016], [0.27, -0.072], [0.162, -0.022]], [[0.29, 0.016], [0.362, 0.016], [0.362, -0.092], [0.29, -0.088]]],
    hr: 0.01,
  });
  mesh(rbox(0.036, 0.022, 0.15, 0.008), m.polymer, root, { pos: [0, 0.058, 0.28] });
  for (const zz of [0.23, 0.33]) yc(root, m.steel, 0.0035, 0.024, [0, 0.04, zz], 10);
  knurl(root, m.anodizedEdge, 0.008, 0.01, [-0.023, 0.023, 0.25], 'x', 14);
  mesh(rbox(0.04, 0.13, 0.006, 0.002), m.anodizedEdge, root, { pos: [0, -0.04, 0.389] });
  mesh(rbox(0.044, 0.15, 0.016, 0.006), m.rubber, root, { pos: [0, -0.04, 0.4] });
  boxes(root, m.rubber, [0, 1, 2, 3, 4, 5].map((i) => [0.045, 0.003, 0.004, 0, -0.1 + i * 0.024, 0.407] as BoxSpec), 0.001);
  mesh(rbox(0.022, 0.02, 0.026, 0.004), m.anodizedEdge, root, { pos: [0, -0.125, 0.335] });
  yc(root, m.steel, 0.005, 0.05, [0, -0.155, 0.335]);
  knurl(root, m.anodizedEdge, 0.013, 0.008, [0, -0.142, 0.335], 'y', 22);
  mesh(rbox(0.02, 0.008, 0.03, 0.003), m.rubber, root, { pos: [0, -0.182, 0.335] });

  // heavy barrel, brake, bipod
  zc(root, m.parkerized, 0.0145, 0.66, [0, by, -0.505]);
  zc(root, m.anodizedEdge, 0.02, 0.012, [0, by, -0.566]);
  const muzzle = group(root, { pos: [0, by, -0.855], name: 'muzzleBase' });
  addMuzzle(muzzle, m, cfg.muzzle, 'brake', 1.1);
  bipod(root, m, [0, -0.041, -0.51], 0.22, 0.0065);

  boxMag(root, m, [0, -0.03, -0.048], 0, cfg.mag, { H: 0.075, w: 0.03, d: 0.1, mat: m.parkerized, fast: false, extK: 1.35 });
  if (cfg.under === 'laser') addUnder(root, m, 'laser', -0.019, -0.37, 0.027);
  addOptic(root, m, sniperOptic(cfg.optic), 0.051, -0.05);

  markings(root, 'WARDEN  .338 LM  No 7731', [-0.0266, -0.012, -0.05], 0.07);
  finishMuzzle(root);
  anchors(root, [0, -0.032, 0.098], -0.22, [-0.072, -0.04, -0.32]);
  return root;
}

// ---------------------------------------------------------------- TALON SR (semi-auto 7.62)

function buildTalon(m: Materials, cfg: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';
  const by = 0.015;
  const hw = 0.017;
  prof(root, m.anodized, [[0.118, 0.032, 0.006], [-0.128, 0.032, 0.004], [-0.136, 0.022, 0.004], [-0.136, -0.028, 0.004], [0.118, -0.028, 0.006]], 0.034);
  pins(root, m, hw, [[-0.012, -0.11], [-0.012, 0.085], [0.006, 0.045], [-0.016, -0.03]], 0.0024);
  boxes(root, m.hole, [[0.002, 0.016, 0.02, -hw, -0.012, -0.07], [0.002, 0.016, 0.02, hw, -0.012, -0.07]], 0.003);
  const cover = group(root, { pos: [0, 0.038, 0.01] });
  mesh(rbox(0.032, 0.014, 0.2, 0.006, 3), m.anodized, cover, {});
  boxes(cover, m.anodizedEdge, [0, 1, 2].map((i) => [0.026, 0.003, 0.008, 0, 0.007, 0.08 - i * 0.012] as BoxSpec), 0.0015);
  mesh(rbox(0.014, 0.008, 0.01, 0.002), m.parkerized, root, { pos: [0, 0.038, 0.116] });
  mesh(rbox(0.036, 0.05, 0.03, 0.004), m.parkerized, root, { pos: [0, 0.004, -0.15] });
  // tangent rear sight (backup)
  const rs = group(root, { pos: [0, 0.03, -0.15] });
  mesh(rbox(0.022, 0.016, 0.045, 0.003), m.parkerized, rs, { pos: [0, 0.004, 0] });
  mesh(rbox(0.018, 0.004, 0.05, 0.001), m.steel, rs, { pos: [0, 0.013, -0.004], rot: [0.04, 0, 0] });
  for (const s of [-1, 1]) mesh(rbox(0.0055, 0.008, 0.005, 0.001), m.steel, rs, { pos: [s * 0.006, 0.019, 0.02] });
  // side scope mount on the left dovetail
  mesh(rbox(0.004, 0.014, 0.15, 0.001), m.parkerized, root, { pos: [-hw - 0.001, 0.012, -0.03] });
  const mt = group(root, { pos: [-hw - 0.007, 0.012, -0.03] });
  mesh(rbox(0.01, 0.026, 0.12, 0.003), m.anodized, mt, {});
  for (const zz of [-0.035, 0.035]) mesh(rbox(0.012, 0.05, 0.028, 0.004), m.anodized, mt, { pos: [-0.001, 0.03, zz] });
  mesh(rbox(0.004, 0.008, 0.045, 0.002), m.steel, mt, { pos: [-0.007, -0.004, 0.02], rot: [0.15, 0, 0] });
  knurl(mt, m.anodizedEdge, 0.007, 0.008, [-0.009, 0.0, -0.045], 'x', 14);
  mesh(rbox(0.05, 0.008, 0.13, 0.003), m.anodized, root, { pos: [-0.002, 0.062, -0.03] });
  boxes(root, m.hole, [0, 1, 2].map((i) => [0.051, 0.004, 0.018, -0.002, 0.062, -0.07 + i * 0.04] as BoxSpec), 0.0015);
  // charging handle, ejection port, safety lever (right)
  mesh(rbox(0.003, 0.016, 0.06, 0.001), m.hole, root, { pos: [hw, 0.018, -0.02], name: 'ejectionPort' });
  const ch = group(root, { pos: [hw, 0.004, -0.075], name: 'chargingHandle' });
  mesh(rbox(0.006, 0.009, 0.075, 0.002), m.steel, ch, { pos: [0.002, 0, 0.032] });
  xc(ch, m.steel, 0.0065, 0.02, [0.012, 0, 0], 16);
  const sel = mesh(rbox(0.003, 0.014, 0.09, 0.0015), m.parkerized, root, { pos: [hw + 0.0015, 0.0, 0.065], rot: [0.08, 0, 0] });
  mesh(rbox(0.004, 0.016, 0.012, 0.002), m.parkerized, sel, { pos: [0.001, -0.007, -0.04] });

  // trigger guard, mag catch
  boxes(root, m.parkerized, [[0.012, 0.005, 0.09, 0, -0.07, 0.03], [0.012, 0.042, 0.005, 0, -0.05, -0.014]], 0.002);
  trigger(root, m, [0, -0.034, 0.03]);
  mesh(rbox(0.014, 0.016, 0.008, 0.002), m.steel, root, { pos: [0, -0.038, -0.028] });

  // skeleton thumbhole stock
  prof(root, m.wood, [[0.112, 0.03, 0.004], [0.4, 0.02, 0.012], [0.412, 0.006, 0.004], [0.412, -0.125, 0.006], [0.398, -0.135, 0.008], [0.3, -0.114, 0.03], [0.155, -0.132, 0.016], [0.106, -0.136, 0.012], [0.073, -0.032, 0.006], [0.112, -0.028, 0.004]], 0.036, {
    holes: [
      [[0.134, 0.013], [0.205, 0.007], [0.212, -0.04], [0.172, -0.092], [0.138, -0.068]],
      [[0.236, 0.004], [0.382, -0.004], [0.382, -0.108], [0.3, -0.094], [0.236, -0.078]],
    ],
    hr: 0.014,
    grain: true,
  });
  boxes(root, m.wood, [0, 1, 2, 3].map((i) => [0.0372, 0.003, 0.006, 0, -0.05 - i * 0.016, 0.083 + i * 0.0045, -0.3] as BoxSpec), 0.0012);
  mesh(rbox(0.036, 0.036, 0.02, 0.004), m.parkerized, root, { pos: [0, 0.002, 0.12] });
  mesh(rbox(0.038, 0.016, 0.13, 0.007), m.polymer, root, { pos: [0, 0.035, 0.275], rot: [0.028, 0, 0] });
  for (const zz of [0.23, 0.32]) xc(root, m.steel, 0.003, 0.04, [0, 0.026, zz], 10);
  mesh(rbox(0.04, 0.15, 0.012, 0.005), m.rubber, root, { pos: [0, -0.058, 0.418] });
  boxes(root, m.rubber, [0, 1, 2, 3, 4, 5].map((i) => [0.041, 0.003, 0.004, 0, -0.12 + i * 0.024, 0.424] as BoxSpec), 0.001);
  mesh(torus(0.0065, 0.0016), m.steel, root, { pos: [0, -0.146, 0.33], rot: [0, Math.PI / 2, 0] });

  // slotted two-piece handguards, gas block, long barrel
  mesh(rbox(0.046, 0.036, 0.215, 0.014, 3), m.wood, root, { pos: [0, -0.006, -0.255] });
  mesh(rbox(0.036, 0.024, 0.2, 0.01, 3), m.wood, root, { pos: [0, 0.03, -0.255] });
  const sl: BoxSpec[] = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) sl.push([0.002, 0.02, 0.007, s * 0.0228, -0.006, -0.18 - i * 0.03, 0.5]);
    for (let i = 0; i < 3; i++) sl.push([0.002, 0.008, 0.024, s * 0.018, 0.03, -0.2 - i * 0.045]);
  }
  boxes(root, m.hole, sl, 0.0008);
  mesh(rbox(0.05, 0.012, 0.012, 0.003), m.parkerized, root, { pos: [0, -0.006, -0.145] });
  mesh(rbox(0.05, 0.07, 0.012, 0.004), m.parkerized, root, { pos: [0, 0.01, -0.367] });
  zc(root, m.parkerized, 0.0095, 0.06, [0, 0.03, -0.395]);
  mesh(rbox(0.026, 0.044, 0.03, 0.006), m.parkerized, root, { pos: [0, 0.02, -0.425] });
  knurl(root, m.steel, 0.008, 0.008, [0.016, 0.03, -0.425], 'x', 10);
  zc(root, m.parkerized, 0.0095, 0.68, [0, by, -0.475]);
  const fs = group(root, { pos: [0, 0, -0.738] });
  mesh(rbox(0.024, 0.024, 0.024, 0.005), m.parkerized, fs, { pos: [0, by + 0.004, 0] });
  mesh(torus(0.009, 0.0022, Math.PI), m.parkerized, fs, { pos: [0, 0.038, 0] });
  mesh(rbox(0.0025, 0.016, 0.0025, 0.0008), m.steel, fs, { pos: [0, 0.035, 0] });
  const muzzle = group(root, { pos: [0, by, -0.835], name: 'muzzleBase' });
  addMuzzle(muzzle, m, cfg.muzzle, 'slotted', 1.0);

  boxMag(root, m, [0, -0.028, -0.07], 0.1, cfg.mag, { H: 0.07, w: 0.028, d: 0.072, mat: m.parkerized, rnd: [0.006, 0.075] });
  if (cfg.under === 'laser') addUnder(root, m, 'laser', -0.03, -0.22, 0.023);
  addOptic(root, m, sniperOptic(cfg.optic), 0.066, -0.03);

  markings(root, 'TALON SR  7.62x54R  No 3349', [-hw - 0.0006, -0.013, 0.05], 0.065);
  finishMuzzle(root);
  anchors(root, [0, -0.034, 0.1], -0.3, [-0.064, -0.044, -0.26]);
  return root;
}

// ---------------------------------------------------------------- VULTURE (semi-auto bullpup)

function buildVulture(m: Materials, cfg: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';
  const by = 0.02;
  const hw = 0.025;
  // rear shell: action, mag housing behind the grip, butt
  prof(root, m.fde, [[-0.02, 0.05], [0.395, 0.05], [0.418, 0.032], [0.418, -0.108], [0.392, -0.118], [0.29, -0.078], [0.258, -0.046], [0.14, -0.046], [0.125, -0.03], [-0.02, -0.03]], 0.05, { r: 0.003 });
  prof(root, m.polymer, [[0.24, 0.05], [0.4, 0.05], [0.394, 0.09], [0.272, 0.096]], 0.036, { r: 0.004 });
  knurl(root, m.anodizedEdge, 0.008, 0.008, [-0.022, 0.07, 0.33], 'x', 14);
  // bolted side covers over the action and the butt
  for (const s of [-1, 1]) {
    prof(root, m.polymer, [[0.27, 0.04], [0.37, 0.04], [0.398, 0.014], [0.398, -0.075], [0.36, -0.092], [0.3, -0.068], [0.27, -0.03]], 0.003, { x: s * 0.0258, r: 0.004, bevel: 0.0008 });
    pins(root, m, 0.0275, [[0.032, 0.28], [0.032, 0.365], [-0.064, 0.36], [-0.026, 0.282]], 0.0022);
  }
  const facets: BoxSpec[] = [];
  for (const s of [-1, 1]) {
    facets.push([0.006, 0.006, 0.42, s * hw, 0.05, 0.19, 0, 0, 0.785]);
    facets.push([0.006, 0.006, 0.58, s * 0.027, 0.046, -0.31, 0.0103, 0, 0.785]);
  }
  boxes(root, m.anodizedEdge, facets, 0.001);
  const pl: BoxSpec[] = [];
  for (const s of [-1, 1]) {
    pl.push([0.002, 0.0015, 0.26, s * hw, 0.008, 0.25]);
    pl.push([0.002, 0.06, 0.0015, s * hw, 0.0, 0.13]);
    pl.push([0.002, 0.009, 0.03, s * 0.027, 0.006, -0.2]);
    for (let i = 1; i < 5; i++) pl.push([0.002, 0.009, 0.03, s * 0.027, 0.006, -0.2 - i * 0.06]);
  }
  for (let i = 0; i < 5; i++) {
    const zz = -0.27 - i * 0.06;
    pl.push([0.012, 0.002, 0.04, 0, 0.0475 - 0.006 * ((-0.02 - zz) / 0.58), zz]);
  }
  boxes(root, m.hole, pl, 0.0006);
  // long angular barrel shroud
  prof(root, m.fde, [[-0.6, 0.042], [-0.02, 0.048], [-0.02, -0.03], [-0.08, -0.034], [-0.6, -0.022], [-0.616, -0.004], [-0.612, 0.03]], 0.054, { r: 0.003 });
  boxes(root, m.anodizedEdge, [[0.056, 0.05, 0.004, 0, 0.009, -0.02], [0.056, 0.03, 0.006, 0, 0.012, -0.596]], 0.002);
  railDir(root, m, 'down', 0, -0.025, -0.46, -0.585);
  zc(root, m.anodizedEdge, 0.016, 0.01, [0, by, -0.614]);
  zc(root, m.parkerized, 0.0115, 0.19, [0, by, -0.7]);
  const muzzle = group(root, { pos: [0, by, -0.815], name: 'muzzleBase' });
  addMuzzle(muzzle, m, cfg.muzzle, 'cone', 1.05);

  // grip ahead of the mag, full-hand guard
  const grip = group(root, { pos: [0, -0.03, 0.077], rot: [-0.25, 0, 0] });
  mesh(rbox(0.03, 0.115, 0.046, 0.005), m.polymer, grip, { pos: [0, -0.057, 0] });
  for (const s of [-1, 1]) mesh(rbox(0.002, 0.07, 0.032, 0.003), m.rubber, grip, { pos: [s * 0.0152, -0.06, 0.003] });
  boxes(grip, m.polymer, [0, 1, 2].map((i) => [0.031, 0.008, 0.008, 0, -0.03 - i * 0.026, -0.023] as BoxSpec), 0.002);
  mesh(rbox(0.034, 0.01, 0.052, 0.003), m.polymer, grip, { pos: [0, -0.117, 0.002] });
  prof(root, m.anodized, [[0.086, -0.142], [0.06, -0.152], [-0.07, -0.038], [-0.07, -0.024], [-0.045, -0.024], [0.072, -0.124]], 0.02, { r: 0.006 });
  trigger(root, m, [0, -0.034, 0.022]);
  xc(root, m.anodizedEdge, 0.006, 0.054, [0, -0.012, 0.112]);

  // mag behind the grip
  mesh(rbox(0.054, 0.006, 0.094, 0.002), m.anodizedEdge, root, { pos: [0, -0.047, 0.2] });
  mesh(rbox(0.012, 0.012, 0.008, 0.002), m.anodizedEdge, root, { pos: [0, -0.052, 0.252] });
  boxMag(root, m, [0, -0.04, 0.2], 0, cfg.mag, { H: 0.062, w: 0.026, d: 0.078, mat: m.polymer, rnd: [0.006, 0.071], extK: 1.45 });

  // ejection port + deflector near the cheek (right), forward charging handle (left)
  mesh(rbox(0.003, 0.016, 0.06, 0.001), m.hole, root, { pos: [hw, 0.024, 0.2], name: 'ejectionPort' });
  mesh(rbox(0.0016, 0.01, 0.05, 0.0006), m.steel, root, { pos: [hw + 0.0012, 0.023, 0.2] });
  mesh(rbox(0.008, 0.018, 0.022, 0.002), m.anodized, root, { pos: [hw + 0.003, 0.027, 0.243], rot: [0, 0.25, 0] });
  mesh(rbox(0.003, 0.007, 0.16, 0.001), m.hole, root, { pos: [-0.027, 0.028, -0.13] });
  const ch = group(root, { pos: [-0.027, 0.028, -0.2], name: 'chargingHandle' });
  mesh(rbox(0.012, 0.008, 0.01, 0.002), m.steel, ch, { pos: [-0.006, 0, 0] });
  mesh(rbox(0.008, 0.018, 0.014, 0.003), m.polymer, ch, { pos: [-0.014, 0.0, 0] });

  // raised carry rail on two angular posts
  prof(root, m.anodized, [[0.12, 0.05], [0.2, 0.05], [0.19, 0.088], [0.14, 0.088]], 0.03);
  prof(root, m.anodized, [[-0.22, 0.047], [-0.15, 0.048], [-0.17, 0.088], [-0.21, 0.088]], 0.03);
  mesh(rbox(0.03, 0.01, 0.4, 0.003), m.anodized, root, { pos: [0, 0.088, -0.01] });
  boxes(root, m.hole, [-0.12, -0.06, 0.0, 0.06].map((zz) => [0.031, 0.004, 0.03, 0, 0.088, zz] as BoxSpec), 0.0015);
  rail2(root, m, 0.096, 0.19, -0.21);

  // butt pad, QD cups
  mesh(rbox(0.052, 0.15, 0.014, 0.005), m.rubber, root, { pos: [0, -0.035, 0.425] });
  boxes(root, m.rubber, [0, 1, 2, 3, 4, 5].map((i) => [0.053, 0.003, 0.004, 0, -0.095 + i * 0.024, 0.432] as BoxSpec), 0.001);
  xc(root, m.steel, 0.006, 0.052, [0, -0.06, 0.37]);
  xc(root, m.steel, 0.006, 0.056, [0, 0.0, -0.5]);

  if (cfg.under === 'laser') addUnder(root, m, 'laser', -0.014, -0.34, 0.027);
  addOptic(root, m, sniperOptic(cfg.optic), 0.102, 0.05);

  markings(root, 'VULTURE  7.62x51  SEMI', [-hw - 0.0006, 0.02, 0.31], 0.08);
  finishMuzzle(root);
  anchors(root, [0, -0.03, 0.077], -0.25, [-0.07, -0.044, -0.26]);
  return root;
}

// ---------------------------------------------------------------- SK-10 RANGER (wooden semi-auto)

function buildSK10(m: Materials, cfg: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';
  const by = 0.015;
  const hw = 0.015;
  const iron = cfg.optic === 'iron';
  // milled receiver, open top with the bolt carrier showing
  prof(root, m.anodized, [[0.105, 0.028, 0.008], [-0.112, 0.028, 0.004], [-0.12, 0.02, 0.004], [-0.12, -0.018, 0.004], [0.105, -0.018, 0.004]], 0.03);
  pins(root, m, hw, [[0.006, 0.09], [0.006, -0.105], [-0.01, 0.05]], 0.0022);
  mesh(rbox(0.022, 0.012, 0.1, 0.003), m.steel, root, { pos: [0, 0.031, -0.055] });
  mesh(rbox(0.003, 0.012, 0.07, 0.001), m.hole, root, { pos: [hw, 0.02, -0.055], name: 'ejectionPort' });
  if (iron) {
    mesh(rbox(0.03, 0.014, 0.115, 0.006, 3), m.anodized, root, { pos: [0, 0.034, 0.05] });
    zc(root, m.anodized, 0.009, 0.01, [0, 0.036, 0.11], 0.009, 16);
  } else {
    mesh(rbox(0.03, 0.01, 0.17, 0.003), m.anodized, root, { pos: [0, 0.041, 0.0] });
    rail2(root, m, 0.049, 0.08, -0.08);
  }
  mesh(rbox(0.004, 0.012, 0.03, 0.0015), m.steel, root, { pos: [hw + 0.002, 0.018, 0.09] });
  xc(root, m.steel, 0.004, 0.006, [hw + 0.004, 0.022, 0.078], 10);
  const ch = group(root, { pos: [hw + 0.002, 0.03, -0.09], name: 'chargingHandle' });
  xc(ch, m.steel, 0.0035, 0.016, [0.006, 0, 0], 10);
  xc(ch, m.steel, 0.0065, 0.01, [0.016, 0, 0], 16);
  // trunnion + tangent rear sight
  mesh(rbox(0.03, 0.04, 0.03, 0.004), m.parkerized, root, { pos: [0, 0.012, -0.135] });
  const rs = group(root, { pos: [0, 0.034, -0.14] });
  mesh(rbox(0.022, 0.014, 0.04, 0.003), m.parkerized, rs, { pos: [0, 0.002, 0] });
  mesh(rbox(0.018, 0.004, 0.05, 0.001), m.steel, rs, { pos: [0, 0.011, -0.004], rot: [0.05, 0, 0] });
  boxes(rs, m.lens, [0, 1, 2, 3, 4, 5].map((i) => [0.0004, 0.002, 0.0015, 0.0092, 0.0115, -0.022 + i * 0.006] as BoxSpec), 0.0002);
  mesh(rbox(0.022, 0.008, 0.008, 0.0015), m.steel, rs, { pos: [0, 0.011, -0.016] });
  mesh(rbox(0.018, 0.004, 0.005, 0.001), m.steel, rs, { pos: [0, 0.014, 0.018] });
  for (const s of [-1, 1]) mesh(rbox(0.0055, 0.009, 0.005, 0.001), m.steel, rs, { pos: [s * 0.006, 0.0195, 0.018] });

  // gas tube + wooden handguard, gas block
  zc(root, m.parkerized, 0.008, 0.32, [0, 0.036, -0.3]);
  mesh(rbox(0.03, 0.02, 0.23, 0.009, 3), m.wood, root, { pos: [0, 0.038, -0.265] });
  mesh(rbox(0.032, 0.008, 0.012, 0.003), m.steel, root, { pos: [0, 0.028, -0.15] });
  mesh(rbox(0.022, 0.044, 0.03, 0.005), m.parkerized, root, { pos: [0, 0.026, -0.465] });
  zc(root, m.steel, 0.0075, 0.012, [0, 0.036, -0.484]);
  // barrel, hooded front post, folding bayonet
  zc(root, m.parkerized, 0.0095, 0.5, [0, by, -0.37]);
  mesh(rbox(0.022, 0.04, 0.03, 0.005), m.parkerized, root, { pos: [0, by + 0.004, -0.588] });
  mesh(torus(0.01, 0.0022, Math.PI), m.parkerized, root, { pos: [0, 0.046, -0.588] });
  mesh(rbox(0.0025, 0.018, 0.0025, 0.0008), m.steel, root, { pos: [0, 0.047, -0.588] });
  const bay = group(root, { pos: [0, -0.008, -0.575] });
  xc(bay, m.steel, 0.004, 0.026, [0, 0, 0], 12);
  mesh(rbox(0.012, 0.016, 0.05, 0.004), m.parkerized, bay, { pos: [0, -0.004, 0.022] });
  mesh(rbox(0.004, 0.013, 0.15, 0.0015), m.steel, bay, { pos: [0, -0.005, 0.12] });
  mesh(rbox(0.004, 0.009, 0.03, 0.0015), m.steel, bay, { pos: [0, -0.007, 0.205], rot: [-0.2, 0, 0] });
  boxes(bay, m.hole, [[0.0045, 0.002, 0.12, 0, -0.003, 0.12]], 0.0005);
  const muzzle = group(root, { pos: [0, by, -0.64], name: 'muzzleBase' });
  addMuzzle(muzzle, m, cfg.muzzle, 'cap', 0.95);

  // full wooden stock with semi-pistol wrist
  prof(root, m.wood, [[-0.335, 0.006, 0.01], [-0.34, -0.018, 0.012], [-0.2, -0.026, 0.03], [-0.06, -0.034, 0.01], [0.08, -0.036, 0.02], [0.12, -0.06, 0.03], [0.165, -0.088, 0.04], [0.385, -0.12, 0.008], [0.392, 0.025, 0.006], [0.24, 0.02, 0.05], [0.15, 0.008, 0.03], [0.112, 0.0, 0.01], [-0.12, -0.002, 0], [-0.15, 0.006, 0]], 0.04, { grain: true });
  mesh(rbox(0.042, 0.148, 0.006, 0.002), m.parkerized, root, { pos: [0, -0.048, 0.396] });
  boxes(root, m.hole, [[0.022, 0.03, 0.0012, 0, -0.03, 0.3995], [0.002, 0.008, 0.03, -0.0205, -0.05, 0.27]], 0.0005);
  mesh(torus(0.0065, 0.0016), m.steel, root, { pos: [-0.022, -0.01, -0.27], rot: [0, Math.PI / 2, 0] });
  for (const zz of [-0.02, 0.11]) xc(root, m.steel, 0.004, 0.042, [0, -0.012, zz], 12);
  // trigger guard, mag release, mag
  prof(root, m.parkerized, [[-0.005, -0.033], [0.075, -0.033], [0.07, -0.072, 0.012], [0.01, -0.074, 0.01]], 0.012, {
    holes: [[[0.004, -0.039], [0.066, -0.039], [0.062, -0.065, 0.01], [0.012, -0.067, 0.008]]],
    hr: 0.006,
  });
  trigger(root, m, [0, -0.034, 0.036]);
  mesh(rbox(0.01, 0.01, 0.008, 0.002), m.steel, root, { pos: [0, -0.04, -0.004] });
  boxMag(root, m, [0, -0.026, -0.045], 0.05, cfg.mag, { H: 0.07, w: 0.028, d: 0.068, mat: m.parkerized, rnd: [0.0056, 0.056], extK: 1.6 });

  if (iron) group(root, { pos: [0, 0.056, -0.122], name: 'sight' });
  else addOptic(root, m, cfg.optic, 0.055, 0.0);
  if (cfg.under === 'angled' || cfg.under === 'grip') railDir(root, m, 'down', 0, -0.026, -0.19, -0.3);
  underFor(root, m, cfg.under, [-0.034, -0.24, 0.021], [-0.036, -0.27]);

  markings(root, 'SK-10  7.62x39  No 1954', [-hw - 0.0006, 0.012, 0.02], 0.07);
  finishMuzzle(root);
  anchors(root, [0, -0.03, 0.108], -0.55, [-0.062, -0.042, -0.24]);
  return root;
}

// ---------------------------------------------------------------- MK-20 SENTINEL (chassis battle rifle)

function buildMK20(m: Materials, cfg: WeaponCfg): THREE.Group {
  const root = new THREE.Group();
  root.name = 'weapon';
  const by = 0.015;
  // chassis: lower block, side plates (right one windowed), cap
  mesh(rbox(0.052, 0.04, 0.25, 0.006), m.fde, root, { pos: [0, -0.012, -0.01] });
  const plate: P2[] = [[0.115, 0.056], [-0.135, 0.056], [-0.135, 0.0], [0.115, 0.0]];
  prof(root, m.fde, plate, 0.006, { x: -0.023, r: 0.004, bevel: 0.001 });
  prof(root, m.fde, plate, 0.006, { x: 0.023, r: 0.004, bevel: 0.001, holes: [[[0.06, 0.046], [-0.105, 0.046], [-0.105, 0.012], [0.06, 0.012]]], hr: 0.004 });
  mesh(rbox(0.052, 0.006, 0.25, 0.002), m.fde, root, { pos: [0, 0.057, -0.01] });
  pins(root, m, 0.026, [[0.03, 0.095], [0.03, -0.12], [-0.018, 0.1], [-0.018, -0.12]], 0.0028);
  boxes(root, m.hole, [[0.002, 0.03, 0.04, -0.026, 0.028, -0.06], [0.002, 0.03, 0.04, -0.026, 0.028, 0.06]], 0.006);
  // M14-pattern receiver inside, op-rod handle through the window, ejection port
  mesh(rbox(0.036, 0.042, 0.24, 0.004), m.parkerized, root, { pos: [0, 0.025, -0.01] });
  mesh(rbox(0.003, 0.016, 0.05, 0.001), m.hole, root, { pos: [0.018, 0.034, -0.015], name: 'ejectionPort' });
  mesh(rbox(0.006, 0.006, 0.05, 0.002), m.steel, root, { pos: [0.017, 0.016, -0.03] });
  const ch = group(root, { pos: [0.026, 0.03, -0.085], name: 'chargingHandle' });
  mesh(rbox(0.005, 0.008, 0.12, 0.002), m.steel, ch, { pos: [-0.005, -0.006, -0.05] });
  mesh(rbox(0.014, 0.012, 0.016, 0.004), m.steel, ch, { pos: [0.004, 0, 0] });
  mesh(rbox(0.006, 0.016, 0.006, 0.002), m.steel, ch, { pos: [0.01, 0.006, 0.006] });
  // magwell, trigger guard, grip
  mesh(rbox(0.056, 0.03, 0.096, 0.005), m.fde, root, { pos: [0, -0.042, -0.065] });
  mesh(rbox(0.06, 0.005, 0.1, 0.002), m.anodizedEdge, root, { pos: [0, -0.056, -0.065] });
  boxes(root, m.fde, [[0.014, 0.006, 0.075, 0, -0.072, 0.045], [0.014, 0.04, 0.006, 0, -0.052, 0.007]], 0.002);
  trigger(root, m, [0, -0.036, 0.04]);
  mesh(rbox(0.016, 0.006, 0.014, 0.002), m.steel, root, { pos: [0, -0.06, -0.016] });
  mesh(rbox(0.004, 0.01, 0.02, 0.0015), m.steel, root, { pos: [-0.028, -0.02, -0.02] });
  pistolGrip(root, m, [0, -0.032, 0.09], -0.3);
  // quad-rail forend with end cap and a ladder cover
  mesh(rbox(0.052, 0.068, 0.285, 0.008), m.fde, root, { pos: [0, 0.024, -0.2775] });
  mesh(rbox(0.054, 0.07, 0.008, 0.004), m.anodizedEdge, root, { pos: [0, 0.024, -0.424] });
  rail2(root, m, 0.062, 0.115, -0.42);
  for (const s of [-1, 1]) railDir(root, m, s < 0 ? 'left' : 'right', s * 0.029, 0.024, -0.15, -0.41);
  railDir(root, m, 'down', 0, -0.013, -0.15, -0.41);
  mesh(rbox(0.004, 0.018, 0.12, 0.002), m.rubber, root, { pos: [0.0365, 0.024, -0.34] });
  boxes(root, m.rubber, [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [0.005, 0.019, 0.003, 0.0375, 0.024, -0.29 - i * 0.014] as BoxSpec), 0.0008);
  // gas cylinder + front band, barrel, flash hider
  zc(root, m.parkerized, 0.011, 0.07, [0, -0.006, -0.46]);
  mesh(rbox(0.026, 0.05, 0.03, 0.006), m.parkerized, root, { pos: [0, 0.004, -0.48] });
  zc(root, m.steel, 0.008, 0.01, [0, -0.006, -0.5]);
  zc(root, m.parkerized, 0.0105, 0.565, [0, by, -0.4175]);
  const muzzle = group(root, { pos: [0, by, -0.72], name: 'muzzleBase' });
  addMuzzle(muzzle, m, cfg.muzzle, 'prong', 1.0);
  // 20-round steel box
  boxMag(root, m, [0, -0.03, -0.065], 0.03, cfg.mag, { H: 0.15, w: 0.028, d: 0.08, mat: m.parkerized, rnd: [0.006, 0.071], extK: 1.33 });
  // telescoping stock with cheek riser
  zc(root, m.anodized, 0.016, 0.24, [0, 0.016, 0.235]);
  zc(root, m.anodizedEdge, 0.019, 0.01, [0, 0.016, 0.12]);
  boxes(root, m.hole, [0, 1, 2, 3, 4].map((i) => [0.004, 0.002, 0.006, 0, -0.0, 0.13 + i * 0.014] as BoxSpec), 0.0006);
  prof(root, m.polymer, [[0.2, 0.04, 0.006], [0.372, 0.044, 0.006], [0.38, 0.034, 0.004], [0.38, -0.1, 0.006], [0.368, -0.11, 0.006], [0.32, -0.1, 0.012], [0.2, -0.008, 0.008]], 0.04, {
    holes: [[[0.25, -0.016], [0.33, -0.016], [0.33, -0.07], [0.3, -0.07]]],
    hr: 0.008,
  });
  mesh(rbox(0.012, 0.008, 0.03, 0.002), m.polymer, root, { pos: [0, -0.012, 0.21] });
  mesh(rbox(0.034, 0.016, 0.13, 0.007), m.polymer, root, { pos: [0, 0.062, 0.29] });
  for (const zz of [0.25, 0.33]) yc(root, m.steel, 0.003, 0.016, [0, 0.05, zz], 10);
  knurl(root, m.anodizedEdge, 0.0065, 0.007, [-0.023, 0.03, 0.29], 'x', 12);
  mesh(rbox(0.042, 0.152, 0.014, 0.005), m.rubber, root, { pos: [0, -0.03, 0.387] });
  boxes(root, m.rubber, [0, 1, 2, 3, 4, 5].map((i) => [0.043, 0.003, 0.004, 0, -0.09 + i * 0.024, 0.394] as BoxSpec), 0.001);

  if (cfg.optic !== 'iron') addOptic(root, m, cfg.optic, 0.068, -0.03);
  railSights(root, m, cfg.optic === 'iron', 0.073, 0.085, -0.4);
  underFor(root, m, cfg.under, [-0.002, -0.28, 0.0375], [-0.023, -0.3]);

  markings(root, 'MK-20  7.62x51  SAFE-FIRE', [-0.0266, 0.03, 0.0], 0.07);
  finishMuzzle(root);
  anchors(root, [0, -0.032, 0.09], -0.3, [-0.066, -0.032, -0.3]);
  return root;
}
