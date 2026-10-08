import * as THREE from 'three';
import type { Materials } from './materials';
import type { Loadout, MuzzleId, OpticId, UnderId, WeaponId } from './loadout';
import { group, mesh, rbox } from './util';
import { dotReticleTex, reticleTex, weaponCamoTex, type CamoId } from './textures';

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
  camo: CamoId;
}

export function cfgFromLoadout(l: Loadout): WeaponCfg {
  return { weapon: l.weapon, optic: l.optic, muzzle: l.muzzle, under: l.under, camo: l.camo };
}

const cyl = (rt: number, rb: number, h: number, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg);
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
      metalness: id === 'gold' ? 1 : 0.35,
      roughness: id === 'gold' ? 0.3 : 0.55,
    });
    camoCache.set(id, mat);
  }
  return mat;
}

let holoRet: THREE.Texture | null = null;
let dotRet: THREE.Texture | null = null;

export function buildWeapon(mats: Materials, cfg: WeaponCfg, firstPerson = true): THREE.Group {
  const paint = camoMaterial(cfg.camo, mats.anodized);
  const m: Materials = cfg.camo === 'none' ? mats : { ...mats, anodized: paint, fde: paint, wood: paint };
  const root = cfg.weapon === 'vk47' ? buildVK47(m, cfg) : buildKR4(m, cfg);
  root.userData.cfg = cfg;
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
  }
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

function addMuzzle(muzzle: THREE.Object3D, m: Materials, kind: MuzzleId, style: 'birdcage' | 'slant') {
  if (kind === 'suppressor') {
    mesh(cyl(0.02, 0.02, 0.17, 32), m.parkerized, muzzle, { pos: [0, 0, -0.07], rot: X90 });
    mesh(cyl(0.021, 0.021, 0.02, 32), m.steel, muzzle, { pos: [0, 0, 0.012], rot: X90 });
    for (let i = 0; i < 5; i++) mesh(new THREE.TorusGeometry(0.0202, 0.0012, 6, 32), m.anodizedEdge, muzzle, { pos: [0, 0, -0.02 - i * 0.025] });
    mesh(cyl(0.005, 0.005, 0.002, 12), m.hole, muzzle, { pos: [0, 0, -0.1555], rot: X90 });
    muzzle.userData.tip = -0.16;
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
  mesh(cyl(0.0095, 0.0095, 0.13, 20), m.parkerized, root, { pos: [0, 0.018, -0.48], rot: X90 });
  mesh(cyl(0.012, 0.012, 0.012, 20), m.parkerized, root, { pos: [0, 0.018, -0.436], rot: X90 });
  const muzzle = group(root, { pos: [0, 0.018, -0.6], name: 'muzzleBase' });
  addMuzzle(muzzle, m, cfg.muzzle, 'birdcage');

  // foregrip
  if (cfg.under === 'grip') {
    const fg = group(root, { pos: [0, -0.008, -0.3] });
    mesh(rbox(0.024, 0.008, 0.06, 0.003), m.polymer, fg, {});
    mesh(cyl(0.014, 0.016, 0.08, 20), m.fde, fg, { pos: [0, -0.042, 0] });
    for (let i = 0; i < 4; i++) mesh(new THREE.TorusGeometry(0.0155, 0.0015, 6, 20), m.polymer, fg, { pos: [0, -0.03 - i * 0.014, 0], rot: X90 });
    mesh(cyl(0.017, 0.017, 0.008, 20), m.polymer, fg, { pos: [0, -0.084, 0] });
  }

  // weapon light
  const light = group(root, { pos: [0.037, 0.018, -0.36] });
  mesh(rbox(0.014, 0.02, 0.03, 0.003), m.anodized, light, { pos: [-0.007, 0, 0.012] });
  mesh(cyl(0.0115, 0.0115, 0.085, 24), m.anodized, light, { pos: [0.004, 0, 0.0], rot: X90 });
  mesh(cyl(0.0145, 0.0115, 0.025, 24), m.anodized, light, { pos: [0.004, 0, -0.052], rot: X90 });
  mesh(cyl(0.0125, 0.0125, 0.002, 24), m.lens, light, { pos: [0.004, 0, -0.065], rot: X90 });
  for (let i = 0; i < 8; i++) mesh(new THREE.TorusGeometry(0.0118, 0.0012, 4, 20), m.anodizedEdge, light, { pos: [0.004, 0, 0.03 - i * 0.006] });

  // magazine (curved polymer)
  buildMag(root, m, m.fde, [0, -0.06, -0.036], 0.19, 0.04, 0.03);

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

  if (cfg.under === 'grip') {
    const fg = group(root, { pos: [0, -0.028, -0.29] });
    mesh(rbox(0.026, 0.01, 0.06, 0.003), steel, fg, {});
    mesh(cyl(0.014, 0.016, 0.08, 20), m.polymer, fg, { pos: [0, -0.044, 0] });
    for (let i = 0; i < 4; i++) mesh(new THREE.TorusGeometry(0.0155, 0.0015, 6, 20), m.rubber, fg, { pos: [0, -0.032 - i * 0.014, 0], rot: X90 });
  }

  // banana mag in bakelite
  buildMag(root, m, m.bakelite, [0, -0.025, -0.07], 0.2, 0.075, 0.034);

  if (cfg.optic === 'iron') {
    group(root, { pos: [0, 0.0545, -0.124], name: 'sight' });
  } else {
    // dust-cover rail
    rail(cover, m, 0.01, 0.07, -0.08, steel);
    addOptic(root, m, cfg.optic, 0.051, 0.005);
  }

  finishMuzzle(root);
  anchors(root, [0, -0.025, 0.08], -0.38, [-0.068, -0.03, -0.25]);
  return root;
}

/** Curved, ribbed magazine with two visible rounds. */
function buildMag(root: THREE.Object3D, m: Materials, mat: THREE.Material, pos: [number, number, number], H: number, bend: number, width: number) {
  const mag = group(root, { pos, name: 'mag' });
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
  for (let i = 0; i < 4; i++) {
    const y = 0.03 + i * 0.035;
    for (const s of [-1, 1]) mesh(rbox(0.003, 0.004, width * 1.6, 0.0015), mat, mag, { pos: [s * 0.0135, -y, curve(y)] });
  }
  mesh(rbox(0.032, 0.012, width * 2.4, 0.004), m.polymer, mag, { pos: [0, -H - 0.004, curve(H)], rot: [-0.25 - bend * 3, 0, 0] });
  for (let i = 0; i < 2; i++) {
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
