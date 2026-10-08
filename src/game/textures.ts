import * as THREE from 'three';
import { mulberry32 } from './util';

type Ctx = CanvasRenderingContext2D;

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function noise(ctx: Ctx, w: number, h: number, rnd: () => number, amount: number, size = 1) {
  // lighten/darken blocks in place via one ImageData pass (per-pixel fillRect is very slow)
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let by = 0; by < h; by += size) {
    for (let bx = 0; bx < w; bx += size) {
      const v = (rnd() - 0.5) * amount;
      for (let y = by; y < Math.min(h, by + size); y++) {
        for (let x = bx; x < Math.min(w, bx + size); x++) {
          const i = (y * w + x) * 4;
          for (let k = 0; k < 3; k++) d[i + k] = v > 0 ? d[i + k] + (255 - d[i + k]) * v : d[i + k] * (1 + v);
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Low-res, point-sampled, tiling texture: the PS1 half of the look. */
function retro(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** High-res, filtered texture: the "insanely detailed" half. */
function hires(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- world (64px)

export function concreteTex(seed = 1, tint = '#77746c') {
  const rnd = mulberry32(seed);
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 64, 64);
  noise(ctx, 64, 64, rnd, 0.22, 2);
  noise(ctx, 64, 64, rnd, 0.12, 1);
  // water stains running down
  for (let i = 0; i < 5; i++) {
    const x = rnd() * 64;
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(30,25,20,0.35)');
    g.addColorStop(1, 'rgba(30,25,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 2 + rnd() * 4, 20 + rnd() * 44);
  }
  // panel seams
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 63, 64, 1);
  ctx.fillRect(63, 0, 1, 64);
  // cracks
  ctx.strokeStyle = 'rgba(20,18,15,0.6)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    let x = rnd() * 64;
    let y = rnd() * 64;
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (rnd() - 0.5) * 12;
      y += (rnd() - 0.5) * 12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return retro(c);
}

export function groundTex() {
  const rnd = mulberry32(7);
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = '#4a463e';
  ctx.fillRect(0, 0, 64, 64);
  noise(ctx, 64, 64, rnd, 0.3, 1);
  noise(ctx, 64, 64, rnd, 0.18, 4);
  // gravel speckle
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = rnd() > 0.5 ? '#6b665a' : '#2c2a25';
    ctx.fillRect(rnd() * 64, rnd() * 64, 1, 1);
  }
  // oil patches
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = 'rgba(15,15,18,0.35)';
    ctx.beginPath();
    ctx.ellipse(rnd() * 64, rnd() * 64, 6 + rnd() * 8, 4 + rnd() * 5, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return retro(c);
}

export function containerTex(paint: string, seed: number) {
  const rnd = mulberry32(seed);
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, 64, 64);
  // corrugation
  for (let x = 0; x < 64; x += 4) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, 0, 1, 64);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 2, 0, 2, 64);
  }
  noise(ctx, 64, 64, rnd, 0.15, 2);
  // rust bleed from top rail
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(${110 + rnd() * 40},${50 + rnd() * 20},20,${0.3 + rnd() * 0.4})`;
    const x = rnd() * 64;
    ctx.fillRect(x, 0, 1 + rnd() * 2, 4 + rnd() * 26);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, 64, 2);
  ctx.fillRect(0, 62, 64, 2);
  return retro(c);
}

export function crateTex() {
  const rnd = mulberry32(3);
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = '#8a6a3c';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    ctx.fillStyle = `rgba(0,0,0,${0.1 + rnd() * 0.15})`;
    ctx.fillRect(0, y, 64, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, y + 7, 64, 1);
  }
  noise(ctx, 64, 64, rnd, 0.18, 1);
  // frame + X brace
  ctx.strokeStyle = '#5b4325';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 58, 58);
  ctx.beginPath();
  ctx.moveTo(6, 6);
  ctx.lineTo(58, 58);
  ctx.stroke();
  ctx.fillStyle = '#2a1f12';
  for (const [x, y] of [[4, 4], [59, 4], [4, 59], [59, 59]]) ctx.fillRect(x, y, 2, 2);
  // stencil
  ctx.fillStyle = 'rgba(20,20,20,0.7)';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('7.62', 34, 20);
  return retro(c);
}

export function metalTex(seed = 11, base = '#3d4144') {
  const rnd = mulberry32(seed);
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 64, 64);
  noise(ctx, 64, 64, rnd, 0.2, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let i = 0; i < 64; i += 16) ctx.fillRect(0, i, 64, 1);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = 'rgba(120,60,25,0.35)';
    ctx.fillRect(rnd() * 64, rnd() * 64, 2 + rnd() * 5, 1 + rnd() * 3);
  }
  return retro(c);
}

export function hazardTex() {
  const [c, ctx] = canvas(32, 32);
  ctx.fillStyle = '#d6a021';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#1b1b1b';
  for (let i = -32; i < 64; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 8, 0);
    ctx.lineTo(i + 8 + 32, 32);
    ctx.lineTo(i + 32, 32);
    ctx.fill();
  }
  noise(ctx, 32, 32, mulberry32(4), 0.2, 1);
  return retro(c);
}

export function skyTex() {
  const rnd = mulberry32(99);
  const [c, ctx] = canvas(256, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#120d24');
  g.addColorStop(0.35, '#3a2147');
  g.addColorStop(0.47, '#a2483a');
  g.addColorStop(0.5, '#e08a3c');
  g.addColorStop(0.53, '#3b2d2a');
  g.addColorStop(1, '#16110f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  // sun
  ctx.fillStyle = '#ffd38a';
  ctx.beginPath();
  ctx.arc(64, 60, 5, 0, Math.PI * 2);
  ctx.fill();
  // streaky clouds
  for (let i = 0; i < 40; i++) {
    const y = 30 + rnd() * 30;
    ctx.fillStyle = `rgba(${200 + rnd() * 55},${90 + rnd() * 60},${70 + rnd() * 40},${0.08 + rnd() * 0.18})`;
    ctx.fillRect(rnd() * 256, y, 20 + rnd() * 60, 1 + rnd() * 2);
  }
  // distant skyline silhouette
  ctx.fillStyle = '#0d0a0c';
  let x = 0;
  while (x < 256) {
    const w = 4 + rnd() * 10;
    const h = 2 + rnd() * 9;
    ctx.fillRect(x, 64 - h, w, h + 2);
    x += w;
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function blobShadowTex() {
  const [c, ctx] = canvas(32, 32);
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function puffTex() {
  const [c, ctx] = canvas(16, 16);
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 16);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}

// ---------------------------------------------------------------- hi-res (detail models)

/** Grayscale height canvas filled from f(x, y) -> 0..1 via one ImageData write. */
function heightCanvas(w: number, h: number, f: (x: number, y: number) => number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, f(x, y) * 255));
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Height map -> tangent-space normal map. */
function heightToNormal(src: HTMLCanvasElement, strength: number): THREE.CanvasTexture {
  const w = src.width;
  const h = src.height;
  const sd = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const [c, ctx] = canvas(w, h);
  const out = ctx.createImageData(w, h);
  const H = (x: number, y: number) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return hires(c, false);
}

/** Multi-tone woodland-desert camo with a woven ripstop grid. */
export function camoFabric(palette: string[], seed: number) {
  const rnd = mulberry32(seed);
  const S = 512;
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, S, S);
  for (let layer = 1; layer < palette.length; layer++) {
    ctx.fillStyle = palette[layer];
    const count = 26 - layer * 4;
    for (let i = 0; i < count; i++) {
      const cx = rnd() * S;
      const cy = rnd() * S;
      const r = 18 + rnd() * (60 - layer * 8);
      // draw wrapped organic blobs
      for (const ox of [-S, 0, S]) {
        for (const oy of [-S, 0, S]) {
          ctx.beginPath();
          const pts = 9;
          for (let p = 0; p <= pts; p++) {
            const a = (p / pts) * Math.PI * 2;
            const rr = r * (0.6 + rnd() * 0.6);
            const px = cx + ox + Math.cos(a) * rr * 1.4;
            const py = cy + oy + Math.sin(a) * rr;
            if (p === 0) ctx.moveTo(px, py);
            else ctx.quadraticCurveTo(px + (rnd() - 0.5) * r, py + (rnd() - 0.5) * r, px, py);
          }
          ctx.fill();
        }
      }
    }
  }
  // ripstop grid + fibre noise
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < S; i += 16) {
    ctx.fillRect(i, 0, 1, S);
    ctx.fillRect(0, i, S, 1);
  }
  noise(ctx, S, S, rnd, 0.08, 1);
  const map = hires(c);

  // weave height map
  const hc = heightCanvas(256, 256, (x, y) => {
    const warp = Math.sin((x / 4) * Math.PI) * 0.5 + 0.5;
    const weft = Math.sin((y / 4) * Math.PI) * 0.5 + 0.5;
    const over = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? warp : weft;
    const rip = x % 32 < 2 || y % 32 < 2 ? 0.35 : 0;
    return Math.min(1, over * 0.8 + rip + rnd() * 0.1);
  });
  const normal = heightToNormal(hc, 2.5);
  normal.repeat.set(4, 4);
  return { map, normal };
}

/** Nylon webbing / cordura: solid colour with heavy weave. */
export function corduraTex(color: string, seed: number) {
  const rnd = mulberry32(seed);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  noise(ctx, 256, 256, rnd, 0.1, 1);
  // scuffs
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(255,240,210,${rnd() * 0.06})`;
    ctx.fillRect(rnd() * 256, rnd() * 256, 4 + rnd() * 20, 2 + rnd() * 8);
  }
  const map = hires(c);
  const hc = heightCanvas(128, 128, (x, y) => ((((x >> 1) + (y >> 1)) % 2) * 160 + rnd() * 60) / 255);
  const normal = heightToNormal(hc, 1.5);
  normal.repeat.set(6, 6);
  return { map, normal };
}

/** Anodised / cerakote wear: roughness map with scratches and edge polish. */
export function scratchRoughness(seed: number, base = 150) {
  const rnd = mulberry32(seed);
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, 512, 512);
  noise(ctx, 512, 512, rnd, 0.15, 2);
  ctx.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const v = 40 + rnd() * 60;
    ctx.strokeStyle = `rgba(${v},${v},${v},${0.3 + rnd() * 0.5})`;
    ctx.beginPath();
    const x = rnd() * 512;
    const y = rnd() * 512;
    const a = rnd() * Math.PI;
    const l = 4 + rnd() * 40;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  return hires(c, false);
}

/** Polymer grip stipple: bumpy normal map. */
export function stippleNormal(seed: number) {
  const rnd = mulberry32(seed);
  const H = new Float32Array(256 * 256);
  for (let i = 0; i < 2200; i++) {
    const cx = rnd() * 256;
    const cy = rnd() * 256;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dy) / 3;
        if (d >= 1) continue;
        const x = (Math.floor(cx) + dx + 256) & 255;
        const y = (Math.floor(cy) + dy + 256) & 255;
        H[y * 256 + x] = Math.min(1, H[y * 256 + x] + 0.9 * (1 - d));
      }
    }
  }
  const n = heightToNormal(heightCanvas(256, 256, (x, y) => H[y * 256 + x]), 3);
  n.repeat.set(3, 3);
  return n;
}

export function skinTex() {
  const rnd = mulberry32(21);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#b07d5f';
  ctx.fillRect(0, 0, 256, 256);
  noise(ctx, 256, 256, rnd, 0.06, 1);
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = `rgba(90,50,35,${rnd() * 0.12})`;
    ctx.fillRect(rnd() * 256, rnd() * 256, 2, 2);
  }
  return hires(c);
}

/** Holographic sight reticle: 65 MOA ring + 1 MOA dot. */
export function reticleTex() {
  const [c, ctx] = canvas(256, 256);
  ctx.clearRect(0, 0, 256, 256);
  ctx.shadowColor = '#ff2a1a';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#ff4a30';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(128, 128, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ff6a50';
  ctx.beginPath();
  ctx.arc(128, 128, 5, 0, Math.PI * 2);
  ctx.fill();
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    ctx.fillRect(128 + Math.cos(a) * 70 - 3, 128 + Math.sin(a) * 70 - 3, 6, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function flashTex() {
  const [c, ctx] = canvas(128, 128);
  ctx.translate(64, 64);
  for (let i = 0; i < 7; i++) {
    ctx.rotate((Math.PI * 2) / 7);
    const g = ctx.createLinearGradient(0, 0, 60, 0);
    g.addColorStop(0, 'rgba(255,250,220,1)');
    g.addColorStop(0.4, 'rgba(255,180,60,0.8)');
    g.addColorStop(1, 'rgba(255,90,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(60, 0);
    ctx.lineTo(0, 7);
    ctx.fill();
  }
  const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
  rg.addColorStop(0, 'rgba(255,255,240,1)');
  rg.addColorStop(1, 'rgba(255,160,40,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(-30, -30, 60, 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- weapon finishes

/** Varnished walnut with long grain, for the VK-47 furniture. */
export function woodTex(seed = 71) {
  const rnd = mulberry32(seed);
  const [c, ctx] = canvas(256, 512);
  ctx.fillStyle = '#5a2e17';
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 140; i++) {
    const x = rnd() * 256;
    const w = 1 + rnd() * 3;
    ctx.fillStyle = rnd() > 0.5 ? `rgba(30,12,4,${0.15 + rnd() * 0.3})` : `rgba(150,80,40,${0.1 + rnd() * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 32) ctx.lineTo(x + Math.sin(y * 0.02 + i) * (2 + rnd() * 4), y);
    ctx.lineTo(x + w, 512);
    ctx.lineTo(x + w, 0);
    ctx.fill();
  }
  noise(ctx, 256, 512, rnd, 0.06, 1);
  // a few knots
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = 'rgba(25,10,3,0.5)';
    ctx.beginPath();
    ctx.ellipse(rnd() * 256, rnd() * 512, 3 + rnd() * 4, 8 + rnd() * 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return hires(c);
}

export type CamoId = 'none' | 'desert' | 'woodland' | 'urban' | 'arctic' | 'crimson' | 'gold' | 'obsidian' | 'prism';

/** Weapon camo maps (painted finishes, not fabric). */
export function weaponCamoTex(id: CamoId) {
  const rnd = mulberry32(id.length * 977 + id.charCodeAt(0));
  const [c, ctx] = canvas(512, 512);
  const pal: Record<string, string[]> = {
    desert: ['#b49a6b', '#8f7650', '#cdb58a', '#6e5a3c'],
    woodland: ['#5d6b3a', '#3a3f24', '#7a6a45', '#20221a'],
    urban: ['#8c9094', '#5c6064', '#b8bcc0', '#2f3236'],
    crimson: ['#7a1a14', '#1a0d0c', '#a8301f', '#3b0f0b'],
    gold: ['#c9a24a', '#e4c46a', '#a17d2c', '#f2dc8a'],
    arctic: ['#dfe7ec', '#9fb2c0', '#f6f8fa', '#5f7383'],
    obsidian: ['#0d0a12', '#1c1228', '#06050a', '#2b1840'],
    prism: ['#7fd6e8'],
  };
  const p = pal[id] ?? pal.desert;
  ctx.fillStyle = p[0];
  ctx.fillRect(0, 0, 512, 512);
  if (id === 'desert' || id === 'urban') {
    // digital pixel blocks
    for (let layer = 1; layer < p.length; layer++) {
      ctx.fillStyle = p[layer];
      for (let i = 0; i < 260 - layer * 50; i++) {
        const x = Math.floor(rnd() * 64) * 8;
        const y = Math.floor(rnd() * 64) * 8;
        const w = (1 + Math.floor(rnd() * 4)) * 8;
        const h = (1 + Math.floor(rnd() * 3)) * 8;
        ctx.fillRect(x, y, w, h);
      }
    }
  } else if (id === 'crimson') {
    // tiger stripes
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = p[1 + (i % 3)];
      const y = rnd() * 512;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 14 + (rnd() - 0.5) * 10);
      for (let x = 512; x >= 0; x -= 32) ctx.lineTo(x, y + 6 + rnd() * 8 + Math.sin(x * 0.03 + i) * 14);
      ctx.fill();
    }
  } else if (id === 'arctic') {
    // splinter: sharp shards in three tones
    for (let layer = 1; layer < p.length; layer++) {
      ctx.fillStyle = p[layer];
      for (let i = 0; i < 70 - layer * 15; i++) {
        const x = rnd() * 512;
        const y = rnd() * 512;
        const a = rnd() * Math.PI;
        const len = 40 + rnd() * 90;
        const w = 8 + rnd() * 18;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.lineTo(x + Math.cos(a) * len * 0.6 - Math.sin(a) * w, y + Math.sin(a) * len * 0.6 + Math.cos(a) * w);
        ctx.fill();
      }
    }
  } else if (id === 'obsidian') {
    // volcanic glass: black base, glowing violet/teal fracture veins
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(80,220,230,0.55)' : 'rgba(170,80,255,0.6)';
      ctx.lineWidth = 1 + rnd() * 2.5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8;
      let x = rnd() * 512;
      let y = rnd() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += (rnd() - 0.5) * 90;
        y += (rnd() - 0.5) * 90;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  } else if (id === 'prism') {
    // iridescent facets: triangles cycling through the hue wheel
    const n = 12;
    const s = 512 / n;
    for (let gy = 0; gy < n; gy++) {
      for (let gx = 0; gx < n; gx++) {
        for (let t = 0; t < 2; t++) {
          const hue = ((gx + gy) * 18 + t * 40 + rnd() * 30) % 360;
          ctx.fillStyle = `hsl(${hue} 70% ${55 + rnd() * 15}%)`;
          ctx.beginPath();
          ctx.moveTo(gx * s, gy * s);
          ctx.lineTo((gx + 1) * s, (gy + t) * s);
          ctx.lineTo((gx + 1 - t) * s, (gy + 1) * s);
          ctx.fill();
        }
      }
    }
  } else if (id === 'gold') {
    const g = ctx.createLinearGradient(0, 0, 512, 512);
    p.forEach((col, i) => g.addColorStop(i / (p.length - 1), col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  } else {
    for (let layer = 1; layer < p.length; layer++) {
      ctx.fillStyle = p[layer];
      for (let i = 0; i < 30; i++) {
        ctx.beginPath();
        ctx.ellipse(rnd() * 512, rnd() * 512, 20 + rnd() * 50, 10 + rnd() * 25, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  noise(ctx, 512, 512, rnd, 0.06, 1);
  return hires(c);
}

/** Small reflex sight: single bright dot. */
export function dotReticleTex() {
  const [c, ctx] = canvas(128, 128);
  ctx.shadowColor = '#ff2a1a';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ff6a50';
  ctx.beginPath();
  ctx.arc(64, 64, 11, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- map pool

export interface SkyStyle {
  stops: [number, string][];
  sun: { u: number; v: number; r: number; color: string } | null;
  clouds: { color: string; count: number; v0: number; v1: number };
  skyline: string | null;
}

/** Parameterised low-res equirect sky. Horizon sits at v = 0.5. */
export function skyThemed(style: SkyStyle, seed = 99) {
  const rnd = mulberry32(seed);
  const [c, ctx] = canvas(256, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  for (const [o, col] of style.stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  if (style.sun) {
    const s = style.sun;
    const rg = ctx.createRadialGradient(s.u * 256, s.v * 128, 0, s.u * 256, s.v * 128, s.r * 4);
    rg.addColorStop(0, s.color);
    rg.addColorStop(0.25, s.color);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, 256, 128);
  }
  for (let i = 0; i < style.clouds.count; i++) {
    ctx.globalAlpha = 0.06 + rnd() * 0.18;
    ctx.fillStyle = style.clouds.color;
    ctx.fillRect(rnd() * 256, (style.clouds.v0 + rnd() * (style.clouds.v1 - style.clouds.v0)) * 128, 20 + rnd() * 60, 1 + rnd() * 3);
  }
  ctx.globalAlpha = 1;
  if (style.skyline) {
    ctx.fillStyle = style.skyline;
    let x = 0;
    while (x < 256) {
      const w = 4 + rnd() * 12;
      const h = 1 + rnd() * 7;
      ctx.fillRect(x, 64 - h, w, h + 2);
      x += w;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function sandTex(seed = 81) {
  const rnd = mulberry32(seed);
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = '#c4a26e';
  ctx.fillRect(0, 0, 64, 64);
  noise(ctx, 64, 64, rnd, 0.16, 1);
  noise(ctx, 64, 64, rnd, 0.1, 4);
  // wind ripples
  ctx.strokeStyle = 'rgba(120,90,50,0.25)';
  for (let y = 4; y < 64; y += 7) {
    ctx.beginPath();
    for (let x = 0; x <= 64; x += 4) ctx.lineTo(x, y + Math.sin(x * 0.2 + y) * 1.5);
    ctx.stroke();
  }
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = rnd() > 0.5 ? '#8f7550' : '#dcc196';
    ctx.fillRect(rnd() * 64, rnd() * 64, 1, 1);
  }
  return retro(c);
}

/** Mud-brick / plaster wall with exposed bricks. */
export function adobeTex(seed = 82, base = '#b48a5e') {
  const rnd = mulberry32(seed);
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 64, 64);
  noise(ctx, 64, 64, rnd, 0.14, 2);
  for (let i = 0; i < 4; i++) {
    const x = rnd() * 48;
    const y = rnd() * 48;
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = 'rgba(110,70,40,0.6)';
        ctx.fillRect(x + k * 9 + (r % 2) * 4, y + r * 5, 8, 4);
      }
    }
  }
  const g = ctx.createLinearGradient(0, 40, 0, 64);
  g.addColorStop(0, 'rgba(70,45,25,0)');
  g.addColorStop(1, 'rgba(70,45,25,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return retro(c);
}

export function canvasTex(color: string, seed = 83) {
  const rnd = mulberry32(seed);
  const [c, ctx] = canvas(32, 32);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 32, 32);
  for (let x = 0; x < 32; x += 8) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, 0, 4, 32);
  }
  noise(ctx, 32, 32, rnd, 0.12, 1);
  return retro(c);
}

export function snowTex(seed = 84) {
  const rnd = mulberry32(seed);
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = '#dfe6ee';
  ctx.fillRect(0, 0, 64, 64);
  noise(ctx, 64, 64, rnd, 0.08, 1);
  noise(ctx, 64, 64, rnd, 0.06, 8);
  // boot prints + tire tracks
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = 'rgba(120,135,155,0.3)';
    ctx.fillRect(rnd() * 64, rnd() * 64, 2, 3);
  }
  ctx.fillStyle = 'rgba(130,145,165,0.18)';
  ctx.fillRect(18, 0, 4, 64);
  ctx.fillRect(28, 0, 4, 64);
  return retro(c);
}

/** Painted research-station cladding: white panels with a hazard-orange band. */
export function hutTex(seed = 85, band = '#d0562a') {
  const rnd = mulberry32(seed);
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = '#c9cdd0';
  ctx.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, 0, 1, 64);
  }
  ctx.fillStyle = band;
  ctx.fillRect(0, 30, 64, 10);
  noise(ctx, 64, 64, rnd, 0.12, 2);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = 'rgba(110,70,40,0.35)';
    ctx.fillRect(rnd() * 64, 40 + rnd() * 20, 1, 4 + rnd() * 10);
  }
  return retro(c);
}

export function drumTex(color: string, seed = 86) {
  const rnd = mulberry32(seed);
  const [c, ctx] = canvas(32, 32);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (const y of [6, 16, 26]) ctx.fillRect(0, y, 32, 2);
  noise(ctx, 32, 32, rnd, 0.18, 1);
  return retro(c);
}

/** 4x prism scope: illuminated chevron over a bullet-drop stadia. */
export function acogReticleTex() {
  const [c, ctx] = canvas(256, 256);
  ctx.strokeStyle = 'rgba(10,10,10,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(128, 140);
  ctx.lineTo(128, 236);
  ctx.moveTo(20, 128);
  ctx.lineTo(100, 128);
  ctx.moveTo(156, 128);
  ctx.lineTo(236, 128);
  for (let i = 1; i <= 5; i++) {
    const y = 140 + i * 16;
    const w = 14 - i * 2;
    ctx.moveTo(128 - w, y);
    ctx.lineTo(128 + w, y);
  }
  ctx.stroke();
  ctx.shadowColor = '#ff3a1a';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ff5a30';
  ctx.beginPath();
  ctx.moveTo(128, 120);
  ctx.lineTo(140, 140);
  ctx.lineTo(128, 133);
  ctx.lineTo(116, 140);
  ctx.closePath();
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const markCache = new Map<string, THREE.CanvasTexture>();
/** Engraved roll-mark text on transparent background. */
export function markingTex(text: string) {
  let t = markCache.get(text);
  if (t) return t;
  const [c, ctx] = canvas(512, 64);
  ctx.font = '600 34px "Barlow Condensed", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillText(text, 6, 34);
  ctx.fillStyle = 'rgba(200,200,195,0.85)';
  ctx.fillText(text, 4, 32);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  markCache.set(text, t);
  return t;
}

/** Soft, slightly lumpy smoke puff. */
export function smokeTex() {
  const rnd = mulberry32(77);
  const [c, ctx] = canvas(64, 64);
  for (let i = 0; i < 9; i++) {
    const x = 20 + rnd() * 24;
    const y = 20 + rnd() * 24;
    const r = 14 + rnd() * 14;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
