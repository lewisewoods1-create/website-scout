import * as THREE from 'three';
import type { Materials } from './materials';
import { group, mesh, rbox } from './util';
import { reticleTex } from './textures';

/**
 * Procedural AR-pattern carbine ("KR-4"), ~200 parts.
 * Local space: -Z is forward (muzzle), +Y up, origin at the receiver.
 *
 * Named nodes used by animation code:
 *   mag, chargingHandle, muzzle, ejectionPort, sight, grip, foregrip, trigger
 */
export function buildRifle(m: Materials, reticle: THREE.Texture | null = reticleTex()): THREE.Group {
  const root = new THREE.Group();
  root.name = 'rifle';
  const cyl = (rt: number, rb: number, h: number, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const X90: [number, number, number] = [Math.PI / 2, 0, 0];
  const Z90: [number, number, number] = [0, 0, Math.PI / 2];

  // ---------------- upper receiver
  mesh(rbox(0.032, 0.044, 0.205, 0.004), m.anodized, root, { pos: [0, 0.022, 0] });
  // receiver flats & chamfers
  for (const s of [-1, 1]) {
    mesh(rbox(0.002, 0.026, 0.17, 0.0008), m.anodizedEdge, root, { pos: [s * 0.0165, 0.018, -0.005] });
  }
  // ejection port + dust cover (open)
  mesh(rbox(0.003, 0.016, 0.052, 0.001), m.hole, root, { pos: [0.0158, 0.026, -0.005], name: 'ejectionPort' });
  mesh(rbox(0.0015, 0.018, 0.054, 0.0006), m.anodizedEdge, root, { pos: [0.021, 0.012, -0.005], rot: [0, 0, -0.9] });
  // brass deflector
  mesh(rbox(0.008, 0.018, 0.016, 0.003), m.anodized, root, { pos: [0.019, 0.03, 0.03] });
  // forward assist
  mesh(cyl(0.008, 0.009, 0.034), m.anodized, root, { pos: [0.022, 0.032, 0.045], rot: [Math.PI / 2 - 0.15, 0, -0.3] });
  mesh(cyl(0.0095, 0.0095, 0.006), m.anodizedEdge, root, { pos: [0.026, 0.035, 0.064], rot: [Math.PI / 2 - 0.15, 0, -0.3] });
  // bolt carrier visible through port
  mesh(cyl(0.007, 0.007, 0.05, 12), m.steel, root, { pos: [0.009, 0.026, -0.005], rot: X90 });

  // top picatinny (receiver + handguard, continuous)
  const railStart = 0.1;
  const railEnd = -0.43;
  const railLen = railStart - railEnd;
  mesh(rbox(0.021, 0.006, railLen, 0.001), m.anodized, root, { pos: [0, 0.047, (railStart + railEnd) / 2] });
  for (let z = railStart - 0.006; z > railEnd; z -= 0.01) {
    mesh(rbox(0.022, 0.0045, 0.0052, 0.0008), m.anodizedEdge, root, { pos: [0, 0.0525, z] });
  }
  // rail slot numbers on the side (tiny white pips)
  for (let z = railStart - 0.02; z > railEnd; z -= 0.04) {
    mesh(rbox(0.0006, 0.002, 0.002, 0.0002), m.lens, root, { pos: [0.0107, 0.049, z] });
  }

  // charging handle
  const ch = group(root, { name: 'chargingHandle' });
  mesh(rbox(0.012, 0.008, 0.06, 0.002), m.anodized, ch, { pos: [0, 0.04, 0.115] });
  mesh(rbox(0.04, 0.009, 0.014, 0.003), m.anodized, ch, { pos: [0, 0.04, 0.142] });
  mesh(rbox(0.012, 0.006, 0.01, 0.002), m.anodizedEdge, ch, { pos: [-0.022, 0.04, 0.142] });

  // ---------------- lower receiver
  mesh(rbox(0.031, 0.036, 0.15, 0.004), m.anodized, root, { pos: [0, -0.016, 0.03] });
  // magwell (flared)
  mesh(rbox(0.034, 0.054, 0.072, 0.004), m.anodized, root, { pos: [0, -0.04, -0.036] });
  mesh(rbox(0.038, 0.008, 0.078, 0.003), m.anodizedEdge, root, { pos: [0, -0.066, -0.036] });
  // magwell front grip ridges
  for (let i = 0; i < 5; i++) {
    mesh(rbox(0.036, 0.003, 0.004, 0.001), m.anodizedEdge, root, { pos: [0, -0.025 - i * 0.008, -0.073] });
  }
  // trigger guard
  mesh(rbox(0.014, 0.005, 0.072, 0.002), m.anodized, root, { pos: [0, -0.06, 0.03] });
  mesh(rbox(0.014, 0.026, 0.006, 0.002), m.anodized, root, { pos: [0, -0.046, -0.004] });
  // trigger
  const trig = group(root, { pos: [0, -0.034, 0.018], name: 'trigger' });
  mesh(rbox(0.006, 0.024, 0.006, 0.002), m.steel, trig, { pos: [0, -0.01, 0.003], rot: [0.35, 0, 0] });
  // selector, mag release, bolt catch, pins
  mesh(cyl(0.006, 0.006, 0.004), m.anodizedEdge, root, { pos: [0.017, -0.006, 0.062], rot: Z90 });
  mesh(rbox(0.003, 0.004, 0.02, 0.001), m.steel, root, { pos: [0.0195, -0.006, 0.07], rot: [0.5, 0, 0] });
  mesh(cyl(0.0055, 0.0055, 0.005), m.anodizedEdge, root, { pos: [0.017, -0.018, -0.003], rot: Z90 });
  mesh(rbox(0.004, 0.022, 0.012, 0.0015), m.anodized, root, { pos: [-0.018, -0.008, -0.002] });
  for (const [y, z] of [[0.003, -0.06], [0.003, 0.085], [-0.01, 0.01], [-0.01, 0.04]]) {
    for (const s of [-1, 1]) mesh(cyl(0.0028, 0.0028, 0.002, 10), m.steel, root, { pos: [s * 0.0158, y, z], rot: Z90 });
  }
  // receiver markings (raised text plate)
  mesh(rbox(0.0008, 0.01, 0.04, 0.0003), m.anodizedEdge, root, { pos: [-0.0158, -0.018, -0.035] });

  // pistol grip (stippled, raked)
  const grip = group(root, { pos: [0, -0.04, 0.077], rot: [-0.32, 0, 0], name: 'grip' });
  mesh(rbox(0.03, 0.115, 0.044, 0.01, 3), m.polymer, grip, { pos: [0, -0.05, 0] });
  mesh(rbox(0.032, 0.012, 0.05, 0.004), m.polymer, grip, { pos: [0, -0.112, 0.002] });
  for (let i = 0; i < 3; i++) {
    mesh(rbox(0.031, 0.012, 0.01, 0.004), m.polymer, grip, { pos: [0, -0.025 - i * 0.025, -0.022] });
  }
  mesh(rbox(0.02, 0.03, 0.025, 0.006), m.polymer, grip, { pos: [0, -0.005, 0.025] }); // beavertail

  // ---------------- buffer tube + stock
  mesh(cyl(0.0155, 0.0155, 0.2, 24), m.anodized, root, { pos: [0, 0.018, 0.2], rot: X90 });
  mesh(new THREE.TorusGeometry(0.017, 0.003, 8, 24), m.anodizedEdge, root, { pos: [0, 0.018, 0.112] });
  mesh(cyl(0.019, 0.019, 0.008, 24), m.anodized, root, { pos: [0, 0.018, 0.107], rot: X90 }); // end plate
  for (let i = 0; i < 9; i++) {
    mesh(rbox(0.004, 0.003, 0.012, 0.001), m.anodizedEdge, root, { pos: [0, 0.001, 0.14 + i * 0.016] });
  }
  // collapsible stock body (extruded profile)
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
  // cheek riser + lightening cutouts
  mesh(rbox(0.036, 0.02, 0.09, 0.006), m.fde, root, { pos: [0, 0.052, 0.28] });
  for (let i = 0; i < 2; i++) {
    for (const s of [-1, 1]) mesh(rbox(0.002, 0.026, 0.026, 0.005), m.hole, root, { pos: [s * 0.0195, -0.02, 0.26 + i * 0.04] });
  }
  // butt pad
  mesh(rbox(0.04, 0.13, 0.018, 0.006, 3), m.rubber, root, { pos: [0, -0.008, 0.358] });
  for (let i = 0; i < 6; i++) mesh(rbox(0.041, 0.003, 0.004, 0.001), m.rubber, root, { pos: [0, -0.06 + i * 0.022, 0.369] });
  // adjustment lever + sling QD cup
  mesh(rbox(0.014, 0.008, 0.04, 0.003), m.polymer, root, { pos: [0, -0.024, 0.255] });
  mesh(cyl(0.007, 0.007, 0.012), m.steel, root, { pos: [-0.021, 0.0, 0.31], rot: Z90 });

  // ---------------- handguard (free float, M-LOK)
  const hgLen = 0.31;
  const hgZ = -0.115 - hgLen / 2;
  const hg = new THREE.CylinderGeometry(0.026, 0.026, hgLen, 8, 1);
  hg.rotateY(Math.PI / 8);
  mesh(hg, m.anodized, root, { pos: [0, 0.018, hgZ], rot: X90 });
  mesh(new THREE.TorusGeometry(0.0255, 0.0035, 6, 8), m.anodizedEdge, root, { pos: [0, 0.018, -0.115], rot: [0, 0, Math.PI / 8] });
  mesh(new THREE.TorusGeometry(0.0255, 0.0035, 6, 8), m.anodizedEdge, root, { pos: [0, 0.018, -0.115 - hgLen], rot: [0, 0, Math.PI / 8] });
  // M-LOK slots: sides + bottom 45° faces
  for (let i = 0; i < 6; i++) {
    const z = -0.14 - i * 0.045;
    // octagon faces: right, lower-right, bottom, lower-left, left
    for (const a of [0, -Math.PI / 4, -Math.PI / 2, (-3 * Math.PI) / 4, Math.PI]) {
      const r = 0.0242;
      mesh(rbox(0.003, 0.009, 0.032, 0.0035), m.hole, root, {
        pos: [Math.cos(a) * r, 0.018 + Math.sin(a) * r, z],
        rot: [0, 0, a],
      });
    }
  }
  // QD sling cups on handguard
  mesh(cyl(0.006, 0.006, 0.006), m.steel, root, { pos: [-0.027, 0.018, -0.13], rot: Z90 });

  // ---------------- barrel, gas, muzzle device
  mesh(cyl(0.0095, 0.0095, 0.13, 20), m.parkerized, root, { pos: [0, 0.018, -0.48], rot: X90 });
  mesh(cyl(0.012, 0.012, 0.012, 20), m.parkerized, root, { pos: [0, 0.018, -0.436], rot: X90 }); // shoulder
  const muzzle = group(root, { pos: [0, 0.018, -0.6], name: 'muzzle' });
  mesh(cyl(0.0135, 0.0135, 0.058, 24), m.steel, muzzle, { pos: [0, 0, 0.03], rot: X90 });
  mesh(cyl(0.0145, 0.0145, 0.012, 24), m.steel, muzzle, { pos: [0, 0, 0.055], rot: X90 });
  mesh(new THREE.TorusGeometry(0.0115, 0.0025, 8, 24), m.steel, muzzle, { pos: [0, 0, 0.001] });
  mesh(cyl(0.006, 0.006, 0.003, 16), m.hole, muzzle, { pos: [0, 0, -0.0005], rot: X90 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mesh(rbox(0.004, 0.003, 0.024, 0.0012), m.hole, muzzle, {
      pos: [Math.cos(a) * 0.0125, Math.sin(a) * 0.0125, 0.02],
      rot: [0, 0, a + Math.PI / 2],
    });
  }

  // ---------------- angled foregrip
  const fg = group(root, { pos: [0, -0.008, -0.25], name: 'foregrip' });
  mesh(rbox(0.024, 0.008, 0.07, 0.003), m.polymer, fg, {});
  mesh(rbox(0.022, 0.03, 0.05, 0.008, 3), m.fde, fg, { pos: [0, -0.015, 0.012], rot: [0.45, 0, 0] });

  // ---------------- weapon light (right side, 3 o'clock)
  const light = group(root, { pos: [0.037, 0.018, -0.36] });
  mesh(rbox(0.014, 0.02, 0.03, 0.003), m.anodized, light, { pos: [-0.007, 0, 0.012] }); // mount
  mesh(cyl(0.0115, 0.0115, 0.085, 24), m.anodized, light, { pos: [0.004, 0, 0.0], rot: X90 });
  mesh(cyl(0.0145, 0.0115, 0.025, 24), m.anodized, light, { pos: [0.004, 0, -0.052], rot: X90 });
  mesh(cyl(0.0125, 0.0125, 0.002, 24), m.lens, light, { pos: [0.004, 0, -0.065], rot: X90 });
  for (let i = 0; i < 8; i++) {
    mesh(new THREE.TorusGeometry(0.0118, 0.0012, 4, 20), m.anodizedEdge, light, { pos: [0.004, 0, 0.03 - i * 0.006] });
  }
  mesh(rbox(0.008, 0.006, 0.012, 0.002), m.rubber, light, { pos: [0.004, 0.0, 0.046] }); // tailcap button

  // ---------------- magazine (curved, ribbed polymer)
  const mag = group(root, { pos: [0, -0.06, -0.036], name: 'mag' });
  const ms = new THREE.Shape();
  const curve = (y: number) => -0.04 * (y / 0.2) * (y / 0.2) - 0.015 * (y / 0.2);
  const H = 0.19;
  ms.moveTo(-0.03, 0);
  ms.lineTo(0.03, 0);
  for (let i = 1; i <= 8; i++) {
    const y = (i / 8) * H;
    ms.lineTo(0.03 + curve(y), -y);
  }
  for (let i = 8; i >= 1; i--) {
    const y = (i / 8) * H;
    ms.lineTo(-0.03 + curve(y), -y);
  }
  ms.lineTo(-0.03, 0);
  const magGeo = new THREE.ExtrudeGeometry(ms, { depth: 0.022, bevelEnabled: true, bevelSize: 0.0025, bevelThickness: 0.0025, bevelSegments: 2 });
  magGeo.translate(0, 0, -0.011);
  mesh(magGeo, m.fde, mag, { rot: [0, -Math.PI / 2, 0] });
  // ribs + window + base plate
  for (let i = 0; i < 4; i++) {
    const y = 0.03 + i * 0.035;
    for (const s of [-1, 1]) {
      mesh(rbox(0.003, 0.004, 0.05, 0.0015), m.fde, mag, { pos: [s * 0.0135, -y, curve(y)] });
    }
  }
  mesh(rbox(0.0028, 0.06, 0.006, 0.0012), m.hole, mag, { pos: [0.0126, -0.07, 0.016 + curve(0.07)] });
  mesh(rbox(0.032, 0.012, 0.072, 0.004), m.polymer, mag, { pos: [0, -H - 0.004, curve(H)], rot: [-0.25, 0, 0] });
  // visible rounds on top
  for (let i = 0; i < 2; i++) {
    const rnd = group(mag, { pos: [(i ? -1 : 1) * 0.004, 0.003 + i * 0.003, -0.005 * i] });
    mesh(cyl(0.0048, 0.0048, 0.034, 12), m.brass, rnd, { rot: X90 });
    mesh(new THREE.ConeGeometry(0.0034, 0.02, 12), m.copper, rnd, { pos: [0, 0, -0.026], rot: [-Math.PI / 2, 0, 0] });
  }

  // ---------------- holographic sight
  const sight = group(root, { pos: [0, 0.053, -0.035] });
  mesh(rbox(0.032, 0.012, 0.085, 0.002), m.anodized, sight, { pos: [0, 0.007, 0] }); // base
  mesh(rbox(0.006, 0.008, 0.018, 0.002), m.anodizedEdge, sight, { pos: [0.019, 0.004, 0.02] }); // throw lever
  // hood: two posts + top bridge
  for (const s of [-1, 1]) {
    mesh(rbox(0.006, 0.044, 0.07, 0.0025), m.anodized, sight, { pos: [s * 0.0205, 0.035, -0.004] });
  }
  mesh(rbox(0.047, 0.006, 0.07, 0.0025), m.anodized, sight, { pos: [0, 0.059, -0.004] });
  // window frames
  for (const z of [-0.038, 0.03]) {
    mesh(rbox(0.04, 0.004, 0.004, 0.001), m.anodizedEdge, sight, { pos: [0, 0.014, z] });
  }
  // glass panes + reticle
  const glassGeo = new THREE.PlaneGeometry(0.035, 0.042);
  mesh(glassGeo, m.glass, sight, { pos: [0, 0.035, -0.036] });
  mesh(glassGeo, m.glass, sight, { pos: [0, 0.035, 0.03] });
  if (reticle) {
    const ret = mesh(
      new THREE.PlaneGeometry(0.03, 0.03),
      new THREE.MeshBasicMaterial({ map: reticle, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      sight,
      { pos: [0, 0.035, -0.0365], name: 'reticle' },
    );
    ret.renderOrder = 10;
  }
  // battery cap + buttons
  mesh(cyl(0.008, 0.008, 0.012, 20), m.anodizedEdge, sight, { pos: [0.02, 0.015, 0.04], rot: Z90 });
  for (let i = 0; i < 3; i++) mesh(rbox(0.006, 0.004, 0.006, 0.0015), m.rubber, sight, { pos: [0, 0.015, 0.045 - i * 0.008] });
  // sight centre (eye line) — used for ADS alignment
  group(sight, { pos: [0, 0.035, -0.036], name: 'sight' });

  // folding rear BUIS (folded flat)
  mesh(rbox(0.02, 0.008, 0.03, 0.002), m.anodized, root, { pos: [0, 0.058, 0.07] });
  // front BUIS (folded)
  mesh(rbox(0.02, 0.008, 0.026, 0.002), m.anodized, root, { pos: [0, 0.058, -0.41] });

  return root;
}
