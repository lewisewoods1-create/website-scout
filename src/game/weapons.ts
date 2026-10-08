import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Materials } from './materials';
import type { Loadout, MagId, MuzzleId, OpticId, UnderId, WeaponId } from './loadout';
import { group, mesh, rbox, type PlaceOpts } from './util';
import { acogReticleTex, dotReticleTex, markingTex, reticleTex, weaponCamoTex, type CamoId } from './textures';

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

const camoCache = new Map<CamoId, THREE.MeshStandardMaterial>();
function camoMaterial(id: CamoId, base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  if (id === 'none') return base;
  let mat = camoCache.get(id);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      map: weaponCamoTex(id),
      roughnessMap: base.roughnessMap,
      metalness: { gold: 1, prism: 0.85, obsidian: 0.6 }[id as string] ?? 0.35,
      roughness: { gold: 0.3, prism: 0.22, obsidian: 0.16 }[id as string] ?? 0.55,
    });
    camoCache.set(id, mat);
  }
  return mat;
}

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
    boxes(sc, m.hole, [[0.0372, 0.0012, 0.0165, 0, cy, zz]], 0.0003);
    mesh(rbox(0.02, cy - 0.016, 0.016, 0.003), m.anodized, sc, { pos: [0, (cy - 0.016) / 2, zz] });
    mesh(rbox(0.032, 0.008, 0.018, 0.002), m.anodized, sc, { pos: [0, 0.004, zz] });
    const sp: Part[] = [];
    for (const s of [-1, 1]) for (const dz of [-0.0045, 0.0045]) sp.push([ccyl(0.0022, 0.0022, 0.003, 10), [s * 0.019, cy, zz + dz], Z90]);
    merged(sc, m.steel, sp);
    mesh(cached('scopeNut', () => new THREE.CylinderGeometry(0.0042, 0.0042, 0.004, 6)), m.steel, sc, { pos: [-0.018, 0.005, zz], rot: Z90 });
  }
  // flip-up caps: front stands up, rear swings left
  tube(0.0288, 0.0288, 0.012, -0.18, m.polymer);
  const fc = group(sc, { pos: [0, cy + 0.03, -0.187], rot: [2.5, 0, 0] });
  mesh(ccyl(0.029, 0.029, 0.004, 32), m.polymer, fc, { pos: [0, -0.029, -0.002], rot: X90 });
  mesh(rbox(0.012, 0.006, 0.006, 0.002), m.polymer, sc, { pos: [0, cy + 0.03, -0.184] });
  tube(0.0222, 0.0222, 0.01, 0.174, m.polymer);
  const rc = group(sc, { pos: [-0.024, cy, 0.18], rot: [0, -2.4, 0] });
  mesh(ccyl(0.023, 0.023, 0.004, 32), m.polymer, rc, { pos: [0.023, 0, 0.002], rot: X90 });
  mesh(rbox(0.006, 0.01, 0.008, 0.002), m.polymer, sc, { pos: [-0.024, cy, 0.178] });
  group(sc, { pos: [0, cy, 0.17], name: 'sight' });
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
