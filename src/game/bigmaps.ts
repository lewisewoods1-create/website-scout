import * as THREE from 'three';
import { arena, house, type MapBuilder, type MapDef } from './map';
import * as T from './textures';
import { paintSky } from './sky';

/**
 * The two 96 m maps from the PLAN.md scope. Both stay flat for bots (the nav grid is
 * 2D), with player-only height from stair blocks: the Gridlock flyover and the
 * Scrapline office roof.
 */

// ---------------------------------------------------------------- props

/** Solid stair block rising `h` metres, stepping along +x (dir 1) or -x (dir -1), or along z. */
function stairs(b: MapBuilder, mat: string, x0: number, z0: number, width: number, h: number, dir: 1 | -1, alongZ = false) {
  const n = Math.ceil(h / 0.4);
  const run = 0.8;
  for (let i = 0; i < n; i++) {
    const top = ((i + 1) * h) / n;
    const c = (i + 0.5) * run * dir;
    if (alongZ) b.box(mat, x0, 0, z0 + c, width, top, run);
    else b.box(mat, x0 + c, 0, z0, run, top, width);
  }
  return n * run;
}

/** A lying cylinder (tanker barrel, pipe) with a box collider. */
function lyingTank(b: MapBuilder, mat: string, x: number, y: number, z: number, r: number, len: number, alongX: boolean) {
  const g = new THREE.CylinderGeometry(r, r, len, 14, Math.ceil(len / 2));
  g.rotateZ(Math.PI / 2);
  if (!alongX) g.rotateY(Math.PI / 2);
  g.translate(x, y + r, z);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, (uv.getY(i) * len) / 2);
  b.extra(mat, g);
  const c = r * 0.9;
  b.boxes.push({
    min: new THREE.Vector3(alongX ? x - len / 2 : x - c, y, alongX ? z - c : z - len / 2),
    max: new THREE.Vector3(alongX ? x + len / 2 : x + c, y + r * 2, alongX ? z + c : z + len / 2),
    surface: 'metal',
  });
}

type CarKind = 'hatch' | 'saloon' | 'van' | 'pickup';

/** Box-built car. alongX: length runs along x. Wheels are visual only. */
function car(b: MapBuilder, kind: CarKind, x: number, z: number, alongX: boolean, paint: string, opts: { burning?: boolean; flip?: boolean } = {}) {
  const L = kind === 'van' ? 5 : kind === 'hatch' ? 3.8 : 4.6;
  const Wd = kind === 'van' ? 2.0 : 1.8;
  const put = (mat: string, along: number, y: number, len: number, h: number, wid: number, collide = true) =>
    alongX ? b.box(mat, x + along, y, z, len, h, wid, collide) : b.box(mat, x, y, z + along, wid, h, len, collide);
  const s = opts.flip ? -1 : 1;
  if (kind === 'van') {
    put(paint, 0, 0.3, L, 1.95, Wd);
    put('glass', s * (L / 2 - 0.35), 1.15, 0.72, 0.8, Wd - 0.1, false);
  } else {
    put(paint, 0, 0.3, L, 0.75, Wd);
    if (kind === 'pickup') {
      put(paint, s * 0.9, 1.05, 1.9, 0.75, Wd - 0.1);
      put('glass', s * 0.9, 1.12, 1.95, 0.5, Wd - 0.06, false);
      put(paint, -s * 1.45, 1.05, 1.6, 0.35, 0.12, true);
    } else {
      const cab = kind === 'hatch' ? 2.1 : 2.4;
      const off = kind === 'hatch' ? -0.35 : 0;
      put(paint, s * off, 1.05, cab, 0.65, Wd - 0.15);
      put('glass', s * off, 1.12, cab + 0.06, 0.45, Wd - 0.1, false);
    }
  }
  // wheels
  for (const a of [-1, 1]) for (const w of [-1, 1]) {
    const al = a * (L / 2 - 0.8);
    const ac = w * (Wd / 2 - 0.05);
    if (alongX) b.box('tyre', x + al, 0, z + ac, 0.7, 0.62, 0.26, false);
    else b.box('tyre', x + ac, 0, z + al, 0.26, 0.62, 0.7, false);
  }
  if (opts.burning) b.fire(x, kind === 'van' ? 2.3 : 1.1, z, kind === 'van' ? 1.6 : 1.4);
}

function jersey(b: MapBuilder, x: number, z: number, len: number, alongX: boolean) {
  if (alongX) b.box('barrier', x, 0, z, len, 1.0, 0.6);
  else b.box('barrier', x, 0, z, 0.6, 1.0, len);
}

function lampPost(b: MapBuilder, x: number, z: number, lit: boolean, facing: 1 | -1) {
  b.box('steel', x, 0, z, 0.22, 7, 0.22);
  b.box('steel', x, 6.9, z + facing * 0.9, 0.18, 0.15, 1.8, false);
  b.box('lamp', x, 6.75, z + facing * 1.7, 0.3, 0.15, 0.55, false);
  if (lit) {
    const pl = new THREE.PointLight(0xffb060, 16, 18, 1.6);
    pl.position.set(x, 6.4, z + facing * 1.7);
    b.light(pl);
  }
}

// ---------------------------------------------------------------- GRIDLOCK

export const GRIDLOCK: MapDef = {
  id: 'gridlock',
  name: 'GRIDLOCK',
  desc: 'Large · motorway pile-up at dusk. Long lanes, a flyover and a car park.',
  swatch: 'linear-gradient(180deg,#2a1838,#c4643a 60%,#3a3a3c 61%)',
  half: 48,
  theme: {
    sky: () =>
      paintSky({
        zenith: '#1c1430', upper: '#5a3058', horizon: '#ff9850', below: '#2c2022', haze: '#c0644c',
        sun: { toward: [-50, 20], el: 4, size: 1.8, color: '#fff2c8', glow: 'rgba(255,150,80,0.8)', glowSize: 40 },
        clouds: { kind: 'stratus', count: 80, lit: '#ffb07a', shade: '#4a2a48', el0: 4, el1: 34, alpha: 0.6 },
        ridges: [
          { kind: 'hills', color: '#3c2846', base: 0.5, amp: 5, seed: 12 },
          { kind: 'city', color: '#1a121a', base: -0.5, amp: 9, seed: 14, lights: '#ffd890', density: 1.3 },
        ],
        smoke: [[0.18, '#2a1c22'], [0.42, '#30222a'], [0.77, '#2a1c22']],
      }, 23),
    fog: [0x5c3e44, 34, 160],
    hemi: [0xb08ab8, 0x3a2c26, 1.35],
    sun: [0xffa060, 2.6, -50, 14, 20],
    ambient: [0x30262e, 0.6],
  },
  materials: () => ({
    road: { tex: T.asphaltTex(91, 'rgba(230,220,200,0.7)'), scale: 4.5, surface: 'concrete' },
    asphalt: { tex: T.asphaltTex(97), scale: 4, surface: 'concrete' },
    verge: { tex: T.groundTex(), scale: 4, surface: 'dirt' },
    concrete: { tex: T.concreteTex(21, '#8a867c'), scale: 3, surface: 'concrete' },
    deck: { tex: T.concreteTex(22, '#6e6a64'), scale: 3, surface: 'concrete' },
    barrier: { tex: T.concreteTex(23, '#a29e94'), scale: 1.5, surface: 'concrete' },
    wall: { tex: T.concreteTex(24, '#5e5a56'), scale: 3, surface: 'concrete' },
    brick: { tex: T.brickTex(92), scale: 2.5, surface: 'concrete' },
    brickDark: { tex: T.brickTex(98, '#4a2a22'), scale: 2.5, surface: 'concrete' },
    shutter: { tex: T.containerTex('#6a6a66', 41), scale: 2, surface: 'metal' },
    roof: { tex: T.metalTex(15, '#3a3a3a'), scale: 2, surface: 'metal' },
    steel: { tex: T.metalTex(16, '#6a6e72'), scale: 2, surface: 'metal' },
    glass: { tex: T.glassTex(94), scale: 1.6, surface: 'metal' },
    lamp: { tex: T.canvasTex('#ffe0a0', 99), scale: 1, surface: 'metal', emissive: 0xffc070 },
    hedge: { tex: T.foliageTex(93), scale: 1.5, surface: 'dirt' },
    tyre: { tex: T.tyreTex(), scale: 0.6, surface: 'wood' },
    hazard: { tex: T.hazardTex(), scale: 1, surface: 'metal' },
    carRed: { tex: T.carTex('#8a2420', 1), scale: 2, surface: 'metal' },
    carBlue: { tex: T.carTex('#28466e', 2), scale: 2, surface: 'metal' },
    carWhite: { tex: T.carTex('#c8c8c2', 3), scale: 2, surface: 'metal' },
    carSilver: { tex: T.carTex('#7c8288', 4), scale: 2, surface: 'metal' },
    carGreen: { tex: T.carTex('#2e4a34', 5), scale: 2, surface: 'metal' },
    burnt: { tex: T.carTex('#000', 6, true), scale: 2, surface: 'metal' },
    bus: { tex: T.hutTex(101, '#d0562a'), scale: 3, surface: 'metal' },
    tanker: { tex: T.metalTex(17, '#a8acb0'), scale: 2, surface: 'metal' },
    cab: { tex: T.carTex('#b0302a', 7), scale: 2, surface: 'metal' },
    billboard: { tex: T.canvasTex('#2a5a8a', 102), scale: 4, surface: 'wood' },
    crate: { tex: T.crateTex(), scale: 1.2, surface: 'wood' },
  }),
  layout(b) {
    arena(b, 48, 'verge', 'wall', 6);

    // ---- motorway: two carriageways along x, central barrier with breaks
    b.box('road', 0, -0.48, -21, 96, 0.5, 15, false);
    b.box('road', 0, -0.48, -1, 96, 0.5, 15, false);
    for (const x of [-38, -22, -6, 10, 26, 40]) jersey(b, x, -11, x === 10 ? 6 : 10, true);

    // ---- flyover: deck over the south carriageway, stairs up at both ends
    const deckY = 6;
    b.box('deck', 0, deckY, -1, 52, 0.6, 9);
    b.box('barrier', 0, deckY + 0.6, -5.3, 52, 1.1, 0.4);
    b.box('barrier', -14, deckY + 0.6, 3.3, 24, 1.1, 0.4);
    b.box('barrier', 14, deckY + 0.6, 3.3, 20, 1.1, 0.4);
    for (const x of [-20, -8, 4, 16]) b.box('deck', x, 0, -1, 1.4, deckY, 1.4);
    // stair ramps up to each end of the deck
    const top = deckY + 0.6;
    const run = stairs(b, 'concrete', -28.4 - Math.ceil(top / 0.4) * 0.8, 1.5, 3.5, top, 1);
    stairs(b, 'concrete', 28.4 + run, 1.5, 3.5, top, -1);
    b.box('deck', -27.2, deckY, 1.5, 2.4, 0.6, 3.5);
    b.box('deck', 27.2, deckY, 1.5, 2.4, 0.6, 3.5);
    // billboard on the deck
    b.box('steel', 6, deckY + 0.6, -4.4, 0.3, 4, 0.3);
    b.box('steel', 14, deckY + 0.6, -4.4, 0.3, 4, 0.3);
    b.box('billboard', 10, deckY + 3.2, -4.4, 10, 3.6, 0.3);

    // ---- pile-up: north carriageway
    car(b, 'saloon', -40, -24, true, 'carRed');
    car(b, 'hatch', -33, -18, false, 'burnt', { burning: true });
    car(b, 'van', -24, -25, true, 'carWhite');
    car(b, 'saloon', -16, -17, true, 'carSilver', { flip: true });
    car(b, 'pickup', -9, -24, false, 'carBlue');
    // jack-knifed tanker across two lanes
    b.box('cab', 3, 0.3, -26, 2.6, 2.6, 2.4);
    b.box('glass', 4.35, 1.6, -26, 0.1, 0.9, 2.1, false);
    lyingTank(b, 'tanker', 0, 0.9, -18, 1.3, 10, false);
    b.box('steel', 0, 0, -18, 1.6, 0.9, 9);
    b.box('hazard', 0, 0, -12.9, 2.4, 0.9, 0.3);
    car(b, 'saloon', 12, -22, true, 'burnt', { burning: true });
    car(b, 'hatch', 18, -26, false, 'carGreen');
    car(b, 'van', 26, -18, true, 'carSilver');
    car(b, 'saloon', 34, -25, true, 'carRed', { flip: true });
    car(b, 'pickup', 42, -17, false, 'burnt');

    // ---- south carriageway, under and either side of the flyover
    car(b, 'saloon', -44, -5, true, 'carBlue');
    car(b, 'hatch', -12, -4, true, 'carWhite');
    car(b, 'van', -2, 3, true, 'carGreen', { flip: true });
    car(b, 'saloon', 9, -3, false, 'burnt', { burning: true });
    car(b, 'hatch', 22, 2, true, 'carRed');
    car(b, 'saloon', 40, -4, true, 'carSilver');
    // overturned bus you can walk through (lying on its side)
    house(b, 'bus', -32, -3, 11, 3, 2.6, 'ew', 'bus');
    b.box('glass', -32, 1.5, -4.62, 9, 0.8, 0.12, false);
    // cones and debris
    for (const [x, z] of [[-20, -11.5], [-19, -12.2], [5, -10.5], [30, -9], [31, -8.4]]) b.box('hazard', x, 0, z, 0.35, 0.6, 0.35, false);
    for (const [x, z] of [[-27, -14], [17, -6], [36, -13]]) b.cyl('tyre', x, z, 0.4, 0.5);

    // ---- toll plaza along the north edge
    b.box('asphalt', 0, -0.47, -40.5, 96, 0.5, 15, false);
    for (const x of [-30, -18, -6, 6, 18, 30]) {
      house(b, 'glass', x, -36, 2.2, 3, 2.6, 'ew', 'roof');
      b.box('barrier', x, 0, -40, 0.6, 1, 4);
    }
    b.box('roof', 0, 5.4, -36, 70, 0.5, 6, false);
    for (const x of [-35, -12, 12, 35]) b.box('steel', x, 0, -36, 0.5, 5.4, 0.5);

    // ---- service station (north east)
    house(b, 'brick', 38, -42, 12, 7, 3.6, 'sw', 'roof');

    // ---- verge: hedges and a maintenance hut
    for (const [x, z, w] of [[-38, 11, 12], [-18, 13, 10], [2, 11, 8], [20, 13, 12], [38, 11, 10]]) b.box('hedge', x, 0, z, w, 1.4, 1.6);
    for (const [x, z, w] of [[-28, 16, 5], [10, 17, 6], [30, 16, 4]]) b.box('hedge', x, 0, z, w, 2.4, 1.8);
    house(b, 'brickDark', -6, 17, 5, 4, 2.8, 'nw', 'roof');

    // ---- car park and burnt-out shop row (south)
    b.box('asphalt', 0, -0.47, 31, 96, 0.5, 26, false);
    const parked: [CarKind, string][] = [['saloon', 'carSilver'], ['hatch', 'carRed'], ['van', 'carWhite'], ['saloon', 'burnt'], ['pickup', 'carGreen'], ['hatch', 'carBlue']];
    let k = 0;
    for (const z of [24, 31]) {
      for (let x = -38; x <= 38; x += 7.5) {
        if ((x + z * 3) % 4 === 0 || Math.abs(x) < 4) continue;
        const [kind, paint] = parked[k++ % parked.length];
        car(b, kind, x, z, false, paint, { burning: k === 9 });
      }
    }
    for (const x of [-36, -20, -4, 12, 28]) {
      house(b, x === 12 ? 'brickDark' : 'brick', x, 42, 12, 7, 3.6, 'n', 'roof');
      b.box('shutter', x + 3, 0, 38.4, 3.6, 2.6, 0.12, false);
    }
    b.box('brick', 42, 0, 42, 6, 3.6, 7);
    for (const [x, z] of [[-16, 36], [16, 36], [36, 22]]) b.box('crate', x, 0, z, 1.2, 1.2, 1.2);

    // ---- lights along the carriageway
    for (const [x, lit] of [[-30, true], [-6, false], [18, true], [40, false]] as [number, boolean][]) lampPost(b, x, -11.2, lit, 1);
    lampPost(b, -14, 20, false, -1);
    lampPost(b, 22, 20, true, -1);
  },
};

// ---------------------------------------------------------------- SCRAPLINE

function boxcar(b: MapBuilder, x: number, z: number, mat: string) {
  // doors open on both sides, so every boxcar is a shortcut across the tracks
  house(b, mat, x, z, 12, 3, 3.2, 'ns', 'roof');
  for (const d of [-4.5, 4.5]) b.box('steel', x + d, 0, z, 2, 0.5, 3.2, false);
}

function scrapStack(b: MapBuilder, x: number, z: number, n: number, alongX: boolean, seed: number) {
  const mats = ['scrapA', 'scrapB', 'scrapC'];
  for (let i = 0; i < n; i++) {
    const m = mats[(seed + i) % 3];
    const jitter = ((seed * 7 + i * 3) % 5) * 0.06 - 0.12;
    if (alongX) b.box(m, x + jitter, i * 0.85, z, 2.3, 0.85, 1.5);
    else b.box(m, x, i * 0.85, z + jitter, 1.5, 0.85, 2.3);
  }
}

function drum(b: MapBuilder, x: number, z: number, burning = false) {
  b.cyl(burning ? 'drumRust' : 'drum', x, z, 0.32, 0.95, 0, true, 10);
  if (burning) b.fire(x, 0.95, z, 0.55);
}

export const SCRAPLINE: MapDef = {
  id: 'scrapline',
  name: 'SCRAPLINE',
  desc: 'Large · fog-bound scrapyard on the rail sidings. Boxcars, a scrap maze and an office roof.',
  swatch: 'linear-gradient(180deg,#8a908c,#5a5248 58%,#6a3a22)',
  half: 48,
  theme: {
    sky: () =>
      paintSky({
        zenith: '#525a5c', upper: '#7e8684', horizon: '#b4b8b0', below: '#7a7a72', haze: '#a8aca4',
        sun: { toward: [30, -40], el: 18, size: 2.6, color: 'rgba(255,245,220,0.5)', glow: 'rgba(255,240,210,0.3)', glowSize: 30 },
        clouds: { kind: 'overcast', count: 110, lit: '#b8bcb6', shade: '#5c6260', el0: 5, el1: 60, alpha: 0.55 },
        ridges: [
          { kind: 'industry', color: '#6a6e6a', base: 0.8, amp: 7, seed: 31, density: 0.8 },
          { kind: 'industry', color: '#3e403c', base: -0.6, amp: 5, seed: 37, lights: '#ffb860', density: 1.1 },
        ],
        smoke: [[0.3, '#5a5852'], [0.55, '#4a4844'], [0.86, '#5a5852']],
      }, 41),
    fog: [0x9a9e98, 14, 95],
    hemi: [0xc8d0cc, 0x4a4238, 1.5],
    sun: [0xfff0d8, 1.6, 30, 30, -40],
    ambient: [0x484a48, 0.75],
  },
  materials: () => ({
    yard: { tex: T.groundTex(), scale: 4, surface: 'dirt' },
    ballast: { tex: T.gravelTex(95), scale: 2.5, surface: 'dirt' },
    concrete: { tex: T.concreteTex(31, '#7c7870'), scale: 3, surface: 'concrete' },
    wall: { tex: T.concreteTex(32, '#5a5650'), scale: 3, surface: 'concrete' },
    rail: { tex: T.metalTex(33, '#5a4a40'), scale: 1, surface: 'metal' },
    steel: { tex: T.metalTex(34, '#55595c'), scale: 2, surface: 'metal' },
    roof: { tex: T.metalTex(35, '#4a4c4c'), scale: 2, surface: 'metal' },
    boxRed: { tex: T.containerTex('#6a2a1e', 36), scale: 2.6, surface: 'metal' },
    boxBrown: { tex: T.containerTex('#5a4630', 37), scale: 2.6, surface: 'metal' },
    boxGrey: { tex: T.containerTex('#4e5658', 38), scale: 2.6, surface: 'metal' },
    scrapA: { tex: T.carTex('#6a2a24', 11, true), scale: 1.4, surface: 'metal' },
    scrapB: { tex: T.carTex('#2e4460', 12), scale: 1.4, surface: 'metal' },
    scrapC: { tex: T.carTex('#7a7a70', 13, true), scale: 1.4, surface: 'metal' },
    crane: { tex: T.hazardTex(), scale: 1.4, surface: 'metal' },
    craneBody: { tex: T.containerTex('#b88a22', 39), scale: 2, surface: 'metal' },
    shed: { tex: T.containerTex('#5e625e', 40), scale: 3, surface: 'metal' },
    office: { tex: T.brickTex(103, '#6e4a3a'), scale: 2.5, surface: 'concrete' },
    glass: { tex: T.glassTex(104, '#2c3a3a'), scale: 1.6, surface: 'metal' },
    shelf: { tex: T.woodTex(105), scale: 1.5, surface: 'wood' },
    crate: { tex: T.crateTex(), scale: 1.2, surface: 'wood' },
    tyre: { tex: T.tyreTex(106), scale: 0.6, surface: 'wood' },
    drum: { tex: T.drumTex('#2f5a7a'), scale: 1, surface: 'metal' },
    drumRust: { tex: T.drumTex('#6a3a22', 107), scale: 1, surface: 'metal' },
    weigh: { tex: T.metalTex(108, '#3a3c3e'), scale: 1, surface: 'metal' },
  }),
  layout(b) {
    arena(b, 48, 'yard', 'wall', 5);

    // ---- rail sidings (north): three tracks on ballast, boxcars with open doors
    b.box('ballast', 0, -0.46, -38, 96, 0.5, 18, false);
    for (const z of [-44, -38, -32]) {
      b.box('rail', 0, 0, z - 0.75, 96, 0.14, 0.12, false);
      b.box('rail', 0, 0, z + 0.75, 96, 0.14, 0.12, false);
    }
    boxcar(b, -34, -44, 'boxRed');
    boxcar(b, -6, -44, 'boxBrown');
    boxcar(b, 24, -44, 'boxGrey');
    boxcar(b, -20, -38, 'boxGrey');
    boxcar(b, 12, -38, 'boxRed');
    boxcar(b, 38, -38, 'boxBrown');
    boxcar(b, -38, -32, 'boxBrown');
    boxcar(b, 0, -32, 'boxGrey');
    // signal gantry
    b.box('steel', -46, 0, -38, 0.4, 6.5, 0.4);
    b.box('steel', -24, 6.3, -38, 44, 0.4, 0.5, false);

    // ---- crane and magnet (west)
    b.box('craneBody', -32, 0, -18, 2.4, 16, 2.4);
    b.box('craneBody', -32, 15.4, -18, 3.2, 2.4, 3.6, false);
    b.box('crane', -20, 17.4, -18, 26, 0.8, 1, false);
    b.box('steel', -12, 9.2, -18, 0.08, 8.2, 0.08, false);
    b.cyl('steel', -12, -18, 1.3, 0.6, 8.6, false, 12);
    b.box('concrete', -32, 0, -18, 5, 0.6, 5);

    // ---- crusher shed (west)
    house(b, 'shed', -34, 0, 14, 10, 6, 'nse', 'roof');
    b.box('steel', -36, 0, 0, 5, 2.4, 3.2);
    b.box('crane', -36, 2.4, 0, 5, 0.2, 3.2);
    for (const z of [-3, 3]) scrapStack(b, -30, z, 2, true, z + 7);

    // ---- scrap maze (centre): crushed-car stacks 1-3 high with gaps to weave through
    const rows: [number, number[]][] = [
      [-24, [-14, -6, 2, 10, 22, 30]],
      [-18, [-10, 6, 14, 26, 38]],
      [-12, [-16, -2, 10, 18, 34]],
      [-6, [-8, 2, 22, 30, 40]],
      [0, [-14, 6, 14, 26]],
      [6, [-6, 2, 18, 34, 40]],
      [12, [-12, 10, 22, 30]],
    ];
    rows.forEach(([z, xs], ri) => {
      xs.forEach((x, i) => {
        const h = 1 + ((ri * 3 + i * 5) % 3);
        scrapStack(b, x, z, h, true, ri * 5 + i);
        scrapStack(b, x + 2.4, z, Math.max(1, h - 1), true, ri * 5 + i + 1);
        if ((ri + i) % 3 === 0) scrapStack(b, x + 1.2, z + 2.1, h, false, ri + i);
      });
    });
    // tyre walls and drums through the maze
    for (const [x, z] of [[-18, -6], [-17.2, -6], [-16.4, -6], [30, 0], [30.8, 0], [31.6, 0], [4, 16], [4.8, 16]]) {
      b.cyl('tyre', x, z, 0.42, 0.3, 0);
      b.cyl('tyre', x, z, 0.42, 0.3, 0.3);
      b.cyl('tyre', x, z, 0.42, 0.3, 0.6);
    }
    drum(b, -4, -15, true);
    drum(b, -3.3, -14.6);
    drum(b, 17, -3, true);
    drum(b, 36, 9, true);
    drum(b, 36.7, 9.4);
    drum(b, -22, 18, true);
    drum(b, 26, -28, true);

    // ---- two-storey office with a walkable roof (south west)
    house(b, 'office', -30, 28, 14, 10, 3.6, 'nw', 'roof');
    b.box('glass', -30, 1.2, 22.9, 8, 1.4, 0.1, false);
    b.box('office', -30, 3.9, 23.1, 14.5, 0.9, 0.3);
    b.box('office', -30, 3.9, 32.9, 14.5, 0.9, 0.3);
    b.box('office', -37.1, 3.9, 25.5, 0.3, 0.9, 5);
    stairs(b, 'concrete', -21.6, 34, 2.2, 3.9, -1, true);
    b.box('concrete', -21.6, 3.6, 24.6, 2.3, 0.3, 3.2);
    b.box('crate', -33, 0, 30, 1.2, 1.2, 1.2);
    b.box('shelf', -26, 0, 31.5, 3, 1.0, 1.2);

    // ---- weighbridge and its hut
    b.box('weigh', 6, 0, 28, 10, 0.18, 4);
    house(b, 'office', 6, 34, 4, 3, 2.6, 'n', 'roof');

    // ---- parts warehouse with shelving aisles (south east)
    house(b, 'shed', 30, 34, 20, 13, 5, 'nw', 'roof');
    for (const x of [24, 29, 34, 38]) b.box('shelf', x, 0, 35, 1.0, 2.4, 8);

    // ---- yard gate (south) and loose cover
    b.box('steel', -6, 0, 46.5, 0.5, 3.5, 0.5);
    b.box('steel', 4, 0, 46.5, 0.5, 3.5, 0.5);
    for (const [x, z] of [[-12, 40], [-11, 41.2], [14, 20], [40, 22], [-44, 12], [-40, 40]]) b.box('crate', x, 0, z, 1.2, 1.2, 1.2);
  },
};
