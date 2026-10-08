import * as THREE from 'three';
import { arena, container, crate, house, type MapBuilder, type MapDef } from './map';
import * as T from './textures';

/**
 * Map pool. Each map is a theme (sky, fog, light) plus a layout written with
 * the MapBuilder helpers. Layouts are 64x64m arenas sized for 6v6.
 */

function lamp(b: MapBuilder, x: number, z: number) {
  b.box('metal', x, 0, z, 0.22, 5.2, 0.22);
  b.box('metal', x + 0.6, 5.0, z, 1.4, 0.15, 0.25, false);
  b.box('lamp', x + 1.15, 4.85, z, 0.45, 0.15, 0.3, false);
  const pl = new THREE.PointLight(0xffa040, 18, 14, 1.6);
  pl.position.set(x + 1.15, 4.6, z);
  b.light(pl);
}

const DEPOT: MapDef = {
  id: 'depot',
  name: 'DEPOT',
  desc: 'Container yard at dusk. Mid-range lanes around a central office.',
  swatch: 'linear-gradient(160deg, #3a2147, #e08a3c 55%, #4a463e)',
  half: 32,
  theme: {
    sky: () => T.skyTex(),
    fog: [0x3b2a30, 24, 110],
    hemi: [0xa592c4, 0x3a2e22, 1.5],
    sun: [0xffa860, 2.4, -40, 22, -12],
    ambient: [0x2c2434, 0.6],
  },
  materials: () => ({
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
  }),
  layout(b) {
    const H = 32;
    arena(b, H, 'ground', 'concrete', 5);
    for (const s of [-1, 1]) {
      b.box('hazard', 0, 0, s * (H - 0.05), H * 2, 0.6, 0.1, false);
      b.box('hazard', s * (H - 0.05), 0, 0, 0.1, 0.6, H * 2, false);
    }
    // warehouse office (x -6..6, z -18..-10) with a window on the west wall
    const BH = 3.4;
    const t = 0.35;
    b.box('concreteDark', 0, 0, -18, 12, BH, t);
    b.box('concreteDark', -3.4, 0, -10, 5.2, BH, t);
    b.box('concreteDark', 3.4, 0, -10, 5.2, BH, t);
    b.box('concreteDark', 0, 2.3, -10, 1.6, BH - 2.3, t);
    b.box('concreteDark', -6, 0, -16.5, t, BH, 3);
    b.box('concreteDark', -6, 0, -11.5, t, BH, 3);
    b.box('concreteDark', -6, 0, -14, t, 1.0, 2);
    b.box('concreteDark', -6, 2.1, -14, t, BH - 2.1, 2);
    b.box('concreteDark', 6, 0, -16.6, t, BH, 2.8);
    b.box('concreteDark', 6, 0, -11.7, t, BH, 3.4);
    b.box('concreteDark', 6, 2.3, -14.3, t, BH - 2.3, 1.4);
    b.box('concreteDark', -1.5, 0, -15.2, 0.25, BH, 5.6);
    b.box('metal', 0, BH, -14, 12.6, 0.3, 8.6);
    crate(b, 3.5, -16.8);
    crate(b, 4.7, -16.8);
    crate(b, 3.5, -16.8, 1);
    b.box('metal', -4, 0, -16.9, 2.6, 0.9, 0.9);
    // containers
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
    for (const [x, z, l] of [[-6, 4, 0], [-4.8, 4, 0], [-6, 5.2, 0], [-6, 4, 1], [8, 2, 0], [12, -6, 0], [12, -4.8, 0], [12, -6, 1], [-16, -6, 0], [-17.2, -6, 0], [4, 12, 0], [-10, 20, 0], [16, 25, 0], [17.2, 25, 0], [27, 14, 0], [-27, -10, 0], [-27, -11.2, 0]]) {
      crate(b, x, z, l);
    }
    // jersey barriers
    for (const [x, z, w, d] of [[0, 4, 3, 0.6], [-4, 15, 0.6, 3], [15, 11, 3, 0.6], [-20, -6, 3, 0.6], [8, -24, 0.6, 3], [-10, -26, 3, 0.6], [20, 18, 0.6, 3]]) {
      b.box('concrete', x, 0, z, w, 0.9, d);
    }
    b.cyl('metal', 25, 23, 1.5, 3.2);
    b.cyl('metal', 21, 26, 1.5, 3.2);
    for (const [x, z] of [[-10, 0], [10, -10], [6, 14], [-22, 14], [20, -26]]) lamp(b, x, z);
  },
};

function stall(b: MapBuilder, x: number, z: number, cloth: string) {
  for (const [dx, dz] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) b.box('wood', x + dx, 0, z + dz, 0.14, 2.4, 0.14);
  b.box(cloth, x, 2.4, z, 2.9, 0.08, 2.5, false);
  b.box('wood', x, 0, z - 0.6, 2.3, 0.9, 0.7);
}

const OUTPOST: MapDef = {
  id: 'outpost',
  name: 'OUTPOST',
  desc: 'Walled desert village at noon. Tight alleys, a market and rooftops of cover.',
  swatch: 'linear-gradient(160deg, #5d8ec4, #e8d7b5 55%, #c4a26e)',
  half: 32,
  theme: {
    sky: () =>
      T.skyThemed({
        stops: [[0, '#4f86c4'], [0.42, '#a9c6dc'], [0.5, '#efe0bf'], [0.53, '#a68c66'], [1, '#5a4a36']],
        sun: { u: 0.7, v: 0.16, r: 5, color: '#fffbe8' },
        clouds: { color: '#ffffff', count: 25, v0: 0.18, v1: 0.42 },
        skyline: '#9a8160',
      }, 7),
    fog: [0xd2bc94, 30, 130],
    hemi: [0xbcd4ff, 0x8a6a44, 1.35],
    sun: [0xfff1d6, 3.2, 30, 50, 20],
    ambient: [0x40362a, 0.6],
  },
  materials: () => ({
    sand: { tex: T.sandTex(), scale: 4, surface: 'dirt' },
    adobe: { tex: T.adobeTex(), scale: 3, surface: 'concrete' },
    adobeLight: { tex: T.adobeTex(88, '#c9a77a'), scale: 3, surface: 'concrete' },
    roof: { tex: T.crateTex(), scale: 2, surface: 'wood' },
    wood: { tex: T.crateTex(), scale: 1.5, surface: 'wood' },
    crate: { tex: T.crateTex(), scale: 1.2, surface: 'wood' },
    clothRed: { tex: T.canvasTex('#8a2a1e'), scale: 1, surface: 'wood' },
    clothBlue: { tex: T.canvasTex('#2a4a7a', 87), scale: 1, surface: 'wood' },
    sandbag: { tex: T.canvasTex('#8a7a55', 89), scale: 0.8, surface: 'dirt' },
    rust: { tex: T.metalTex(13, '#6a4a32'), scale: 2, surface: 'metal' },
    drum: { tex: T.drumTex('#2f5a7a'), scale: 1, surface: 'metal' },
    metal: { tex: T.metalTex(14, '#7a7a74'), scale: 2, surface: 'metal' },
  }),
  layout(b) {
    arena(b, 32, 'sand', 'adobe', 4);
    // central compound with an inner courtyard wall
    house(b, 'adobeLight', 0, 0, 12, 9, 3.6, 'nsew', 'roof');
    b.box('adobeLight', -2, 0, 1.5, 0.3, 3.6, 3);
    // village houses
    house(b, 'adobe', -20, -20, 8, 7, 3.2, 'se', 'roof');
    house(b, 'adobe', 20, -20, 8, 7, 3.2, 'sw', 'roof');
    house(b, 'adobeLight', -21, 19, 8, 8, 3.2, 'ne', 'roof');
    house(b, 'adobe', 20, 20, 9, 7, 3.2, 'nw', 'roof');
    house(b, 'adobeLight', 0, -24, 12, 6, 3.2, 'sew', 'roof');
    house(b, 'adobe', 0, 24, 10, 6, 3.2, 'new', 'roof');
    // market
    stall(b, -13, -4, 'clothRed');
    stall(b, -13, 3, 'clothBlue');
    stall(b, 13, -4, 'clothBlue');
    stall(b, 13, 3, 'clothRed');
    // alley walls + sandbags
    for (const [x, z, w, d] of [[-8, -14, 6, 0.4], [9, 13, 6, 0.4], [-26, 0, 0.4, 8], [26, 0, 0.4, 8]]) b.box('adobe', x, 0, z, w, 2.2, d);
    for (const [x, z, w, d] of [[-6, 14, 4, 0.9], [7, -13, 4, 0.9], [-16, 9, 0.9, 3], [16, -9, 0.9, 3], [0, 9, 3, 0.9], [0, -9.5, 3, 0.9]]) b.box('sandbag', x, 0, z, w, 1.0, d);
    // wrecked pickup
    b.box('rust', -7, 0, -21, 4.2, 1.1, 1.9);
    b.box('rust', -7.6, 1.1, -21, 1.8, 0.8, 1.8);
    // water tower
    for (const [dx, dz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) b.box('metal', 25 + dx, 0, 12 + dz, 0.25, 6, 0.25);
    b.cyl('metal', 25, 12, 1.7, 2.6, 6, false);
    // crates + drums
    for (const [x, z, l] of [[-9, 6, 0], [-9, 7.2, 0], [-9, 6, 1], [8, -6, 0], [9.2, -6, 0], [-25, -26, 0], [26, -27, 0], [4, 17, 0], [-4, -17, 0], [-27, 12, 0]]) crate(b, x, z, l);
    for (const [x, z] of [[6, 7], [6.7, 7.3], [-24, -12], [-23.4, -12.5], [22, 26], [-14, 27]]) b.cyl('drum', x, z, 0.3, 0.9, 0, true, 8);
  },
};

const WHITEOUT: MapDef = {
  id: 'whiteout',
  name: 'WHITEOUT',
  desc: 'Arctic research station under heavy overcast. Long sightlines between huts.',
  swatch: 'linear-gradient(160deg, #6f7f92, #dfe5ea 55%, #c9cdd0)',
  half: 32,
  theme: {
    sky: () =>
      T.skyThemed({
        stops: [[0, '#5f7083'], [0.45, '#b9c4cf'], [0.5, '#e6ebef'], [0.55, '#a3adb6'], [1, '#5e666e']],
        sun: { u: 0.35, v: 0.3, r: 6, color: 'rgba(255,255,255,0.6)' },
        clouds: { color: '#ffffff', count: 60, v0: 0.15, v1: 0.48 },
        skyline: '#7d8893',
      }, 11),
    fog: [0xc9d2db, 18, 90],
    hemi: [0xdde8ff, 0x8090a0, 1.7],
    sun: [0xe8eeff, 1.5, -20, 40, 30],
    ambient: [0x506070, 0.7],
  },
  materials: () => ({
    snow: { tex: T.snowTex(), scale: 4, surface: 'concrete' },
    concrete: { tex: T.concreteTex(2, '#8a8f94'), scale: 3, surface: 'concrete' },
    hut: { tex: T.hutTex(), scale: 3.2, surface: 'metal' },
    hutGreen: { tex: T.hutTex(91, '#3d6a4a'), scale: 3.2, surface: 'metal' },
    hutRoof: { tex: T.metalTex(15, '#8a9096'), scale: 2, surface: 'metal' },
    contWhite: { tex: T.containerTex('#b8bcc0', 34), scale: 2.6, surface: 'metal' },
    contRed: { tex: T.containerTex('#8a2a22', 35), scale: 2.6, surface: 'metal' },
    crate: { tex: T.crateTex(), scale: 1.2, surface: 'wood' },
    drum: { tex: T.drumTex('#9a2a20', 92), scale: 1, surface: 'metal' },
    metal: { tex: T.metalTex(16, '#5a6066'), scale: 2, surface: 'metal' },
    dome: { tex: T.hutTex(93, '#c9cdd0'), scale: 4, surface: 'metal' },
  }),
  layout(b) {
    arena(b, 32, 'snow', 'concrete', 4.5);
    for (const s of [-1, 1]) {
      b.box('snow', 0, 4.5, s * 32.5, 66, 0.25, 1.1, false);
      b.box('snow', s * 32.5, 4.5, 0, 1.1, 0.25, 64, false);
    }
    // command building with radar dome on the roof
    house(b, 'hut', 0, 0, 10, 8, 3.4, 'nsew', 'hutRoof');
    const dome = new THREE.SphereGeometry(2.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(0, 3.7, 0);
    b.extra('dome', dome);
    // huts
    house(b, 'hut', -16, -14, 12, 6, 3.2, 'ew', 'hutRoof');
    house(b, 'hutGreen', 16, -14, 12, 6, 3.2, 'ew', 'hutRoof');
    house(b, 'hutGreen', -15, 16, 6, 12, 3.2, 'ns', 'hutRoof');
    house(b, 'hut', 18, 14, 10, 7, 3.2, 'nw', 'hutRoof');
    house(b, 'hut', 0, -26, 14, 5, 3.2, 's', 'hutRoof');
    // comms mast
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) b.box('metal', -25 + dx, 0, 1 + dz, 0.2, 11, 0.2);
    for (let y = 1.5; y < 11; y += 2) b.box('metal', -25, y, 1, 1.8, 0.1, 1.8, false);
    // fuel tanks, drums, snow drifts, containers
    b.cyl('metal', 25, -1, 1.5, 3);
    b.cyl('metal', 26, 4, 1.5, 3);
    for (const [x, z] of [[8, 6], [8.7, 6.4], [8.3, 7.1], [-7, -7], [-7.6, -6.6], [-24, -24], [23, 27]]) b.cyl('drum', x, z, 0.3, 0.9, 0, true, 8);
    for (const [x, z, w, d] of [[6, 12, 5, 2], [-8, -4, 4, 2], [12, -26, 5, 2.5], [-26, 22, 4, 3], [-4, 20, 2.5, 4]]) b.box('snow', x, 0, z, w, 0.5, d);
    container(b, 'contWhite', 8, 22, false);
    container(b, 'contRed', -26, -16, true);
    container(b, 'contWhite', 26, -20, true);
    container(b, 'contRed', 26, -20, true, 1);
    for (const [x, z, l] of [[-4, 8, 0], [-2.8, 8, 0], [-4, 8, 1], [10, -6, 0], [-20, 6, 0], [-21.2, 6, 0], [14, 27, 0]]) crate(b, x, z, l);
  },
};

export const MAPS: MapDef[] = [DEPOT, OUTPOST, WHITEOUT];

export function mapById(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? DEPOT;
}
