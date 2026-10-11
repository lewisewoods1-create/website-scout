import * as THREE from 'three';

/**
 * Painted sky panoramas. The world is drawn at PS1 resolution, but the sky is a
 * full-resolution backdrop (clouds, sun glow, distant ridgelines or skylines) drawn
 * behind it by the renderer's sky pass.
 *
 * The texture is a cylindrical strip: 360° across, elevation EL_BOT..EL_TOP down the
 * height, so almost every pixel lands where players actually look.
 */
export const EL_TOP = 72;
export const EL_BOT = -18;
const W = 4096;
const H = 1024;

type Ridge =
  | { kind: 'mountains' | 'hills' | 'dunes'; color: string; base: number; amp: number; seed: number; rough?: number }
  | { kind: 'city' | 'industry'; color: string; base: number; amp: number; seed: number; lights?: string; density?: number }
  | { kind: 'trees'; color: string; base: number; amp: number; seed: number };

export interface SkyPaint {
  /** gradient: zenith, upper sky, horizon glow, below the horizon */
  zenith: string;
  upper: string;
  horizon: string;
  below: string;
  /** sun placement: world-space direction toward it on the ground plane (x, z) + elevation in degrees */
  sun?: { toward: [number, number]; el: number; size: number; color: string; glow: string; glowSize: number };
  stars?: number;
  clouds?: { kind: 'cumulus' | 'stratus' | 'overcast'; count: number; lit: string; shade: string; el0: number; el1: number; alpha: number };
  /** back to front */
  ridges: Ridge[];
  haze?: string;
  /** rising smoke columns on the skyline: [azimuth u 0..1, colour] */
  smoke?: [number, string][];
}

/** The same colour at zero alpha, so gradients fade out instead of through grey. */
function clearOf(color: string) {
  if (color.startsWith('#')) {
    const n = parseInt(color.length === 4 ? color.slice(1).replace(/./g, '$&$&') : color.slice(1, 7), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`;
  }
  const m = color.match(/rgba?\(([^,]+),([^,]+),([^,)]+)/);
  return m ? `rgba(${m[1]},${m[2]},${m[3]},0)` : 'rgba(0,0,0,0)';
}

const y = (el: number) => ((EL_TOP - el) / (EL_TOP - EL_BOT)) * H;
const px = (deg: number) => (deg / (EL_TOP - EL_BOT)) * H;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seamless 1D ridge noise: integer harmonics so u=0 and u=1 meet. */
function ridgeFn(seed: number, rough = 0.55) {
  const r = rng(seed);
  const waves = Array.from({ length: 9 }, (_, i) => {
    const k = Math.round(2 + Math.pow(2, i * 0.75) * (1 + r()));
    return { k, a: Math.pow(rough, i), p: r() * Math.PI * 2 };
  });
  const norm = waves.reduce((s, w) => s + w.a, 0);
  return (u: number) => {
    let v = 0;
    for (const w of waves) v += w.a * Math.sin(u * Math.PI * 2 * w.k + w.p);
    // sharpen peaks a little
    const n = v / norm;
    return Math.sign(n) * Math.pow(Math.abs(n), 0.85) * 0.5 + 0.5;
  };
}

/** Draw fn at x and, if it straddles the seam, again one panorama-width over. */
function wrap(x: number, half: number, fn: (x: number) => void) {
  fn(x);
  if (x - half < 0) fn(x + W);
  if (x + half > W) fn(x - W);
}

function softBlob(ctx: CanvasRenderingContext2D, x: number, yy: number, rx: number, ry: number, color: string, alpha: number, hard = 0.35) {
  ctx.save();
  ctx.translate(x, yy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, color);
  g.addColorStop(hard, color);
  g.addColorStop(1, clearOf(color));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintClouds(ctx: CanvasRenderingContext2D, c: NonNullable<SkyPaint['clouds']>, rnd: () => number) {
  for (let i = 0; i < c.count; i++) {
    const el = c.el0 + Math.pow(rnd(), 1.4) * (c.el1 - c.el0);
    // clouds shrink and flatten toward the horizon, and widen with elevation (cylinder stretch)
    const depth = Math.min(1, Math.max(0.18, (el - c.el0 + 3) / (c.el1 - c.el0 + 3)));
    const stretch = 1 / Math.cos((el * Math.PI) / 180);
    const x = rnd() * W;
    const yy = y(el);
    if (c.kind === 'stratus' || c.kind === 'overcast') {
      const len = (160 + rnd() * 420) * depth * stretch * (c.kind === 'overcast' ? 1.8 : 1);
      const th = (6 + rnd() * 16) * depth * (c.kind === 'overcast' ? 2.2 : 1);
      wrap(x, len, (xx) => {
        softBlob(ctx, xx, yy + th * 0.5, len, th, c.shade, c.alpha * 0.8);
        softBlob(ctx, xx - len * 0.1, yy - th * 0.2, len * 0.8, th * 0.6, c.lit, c.alpha * 0.7);
      });
      continue;
    }
    // cumulus: one solid silhouette of overlapping puffs with a flat base, shaded top to
    // bottom as a whole, highlighted per billow, then laid down with soft edges
    const size = (24 + rnd() * 44) * depth;
    const puffs = 7 + Math.floor(rnd() * 9);
    const spread = size * (1.6 + rnd() * 2.2) * stretch;
    const cw = Math.ceil((spread + size * 1.6 * stretch) * 2);
    const ch = Math.ceil(size * 2.6);
    const base = Math.round(ch * 0.86);
    const oc = document.createElement('canvas');
    oc.width = cw;
    oc.height = ch;
    const o = oc.getContext('2d')!;
    const pts = Array.from({ length: puffs }, () => {
      const t = rnd() * 2 - 1;
      const r = size * (0.5 + rnd() * 0.6) * (1 - Math.abs(t) * 0.5);
      return { x: cw / 2 + t * spread, y: base - r * (0.2 + rnd() * 0.6), r };
    });
    o.fillStyle = '#fff';
    for (const p of pts) {
      o.beginPath();
      o.ellipse(p.x, p.y, p.r * stretch, p.r, 0, 0, Math.PI * 2);
      o.fill();
    }
    o.clearRect(0, base, cw, ch - base);
    o.globalCompositeOperation = 'source-atop';
    const g = o.createLinearGradient(0, base - size * 1.5, 0, base);
    g.addColorStop(0, c.lit);
    g.addColorStop(0.5, c.lit);
    g.addColorStop(1, c.shade);
    o.fillStyle = g;
    o.fillRect(0, 0, cw, ch);
    for (const p of pts) {
      const hg = o.createRadialGradient(p.x - p.r * 0.25 * stretch, p.y - p.r * 0.35, 0, p.x, p.y, p.r * 1.05);
      hg.addColorStop(0, 'rgba(255,255,255,0.5)');
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      o.fillStyle = hg;
      o.fillRect(p.x - p.r * 2, p.y - p.r * 2, p.r * 4, p.r * 4);
    }
    ctx.save();
    ctx.globalAlpha = c.alpha;
    ctx.filter = `blur(${Math.max(0.8, size * 0.05).toFixed(1)}px)`;
    wrap(x, cw / 2, (xx) => ctx.drawImage(oc, xx - cw / 2, yy - base));
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function paintRidge(ctx: CanvasRenderingContext2D, r: Ridge, haze: string) {
  const rnd = rng(r.seed);
  const baseY = y(r.base);
  if (r.kind === 'mountains' || r.kind === 'hills' || r.kind === 'dunes') {
    const f = ridgeFn(r.seed, r.kind === 'dunes' ? 0.35 : r.kind === 'hills' ? 0.45 : r.rough ?? 0.58);
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) {
      const h = f(x / W);
      ctx.lineTo(x, baseY - px(r.amp) * (r.kind === 'dunes' ? h * h : h));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    const top = baseY - px(r.amp);
    const g = ctx.createLinearGradient(0, top, 0, baseY + px(2));
    g.addColorStop(0, r.color);
    g.addColorStop(1, haze);
    ctx.fillStyle = g;
    ctx.fill();
    return;
  }
  if (r.kind === 'trees') {
    ctx.fillStyle = r.color;
    ctx.fillRect(0, baseY - px(r.amp * 0.25), W, H);
    for (let x = 0; x < W; x += 3 + rnd() * 7) {
      const h = px(r.amp) * (0.4 + rnd() * 0.6);
      const w = h * (0.28 + rnd() * 0.12);
      ctx.beginPath();
      ctx.moveTo(x - w, baseY);
      ctx.lineTo(x, baseY - h);
      ctx.lineTo(x + w, baseY);
      ctx.fill();
    }
    return;
  }
  // city / industry: block silhouettes with lit windows, stacks and cranes
  const lights = 'lights' in r ? r.lights : undefined;
  const density = ('density' in r ? r.density : undefined) ?? 1;
  let x = 0;
  while (x < W) {
    const cluster = 0.5 + 0.5 * Math.sin((x / W) * Math.PI * 2 * 3 + r.seed) * Math.sin((x / W) * Math.PI * 2 * 7 + r.seed * 2);
    const bw = 14 + rnd() * 60;
    const gap = rnd() < 0.25 / density ? 6 + rnd() * 40 : 0;
    const bh = px(r.amp) * (0.18 + rnd() * 0.45 + cluster * cluster * 0.55 * rnd());
    const draw = (xx: number) => {
      ctx.fillStyle = r.color;
      if (r.kind === 'industry' && rnd() < 0.18) {
        // chimney stack
        const sw = 5 + rnd() * 6;
        const sh = bh * (1.4 + rnd());
        ctx.fillRect(xx + bw * 0.4, baseY - sh, sw, sh);
        ctx.fillRect(xx, baseY - bh * 0.5, bw, bh * 0.5);
      } else if (r.kind === 'industry' && rnd() < 0.12) {
        // storage tank
        ctx.beginPath();
        ctx.ellipse(xx + bw / 2, baseY - bh * 0.55, bw / 2, bh * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(xx, baseY - bh * 0.55, bw, bh * 0.55);
      } else {
        ctx.fillRect(xx, baseY - bh, bw, bh + 4);
        if (rnd() < 0.15) ctx.fillRect(xx + bw * 0.5, baseY - bh - px(1.5), 2, px(1.5)); // antenna
        if (lights) {
          ctx.fillStyle = lights;
          for (let wy = baseY - bh + 4; wy < baseY - 3; wy += 6) {
            for (let wx = xx + 3; wx < xx + bw - 3; wx += 5) {
              if (rnd() < 0.22) {
                ctx.globalAlpha = 0.35 + rnd() * 0.6;
                ctx.fillRect(wx, wy, 2, 3);
              }
            }
          }
          ctx.globalAlpha = 1;
        }
      }
    };
    wrap(x, bw, draw);
    x += bw + gap;
  }
  ctx.fillStyle = r.color;
  ctx.fillRect(0, baseY, W, H - baseY);
  if (r.kind === 'industry') {
    // a pair of tower cranes
    for (let k = 0; k < 2; k++) {
      const cx = rnd() * W;
      const ch = px(r.amp) * 1.6;
      ctx.fillRect(cx, baseY - ch, 4, ch);
      ctx.fillRect(cx - 50, baseY - ch, 120, 3);
      ctx.fillRect(cx + 60, baseY - ch, 2, ch * 0.3);
    }
  }
}

export function paintSky(s: SkyPaint, seed = 1): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const rnd = rng(seed);

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, s.zenith);
  g.addColorStop(y(28) / H, s.upper);
  g.addColorStop(y(2) / H, s.horizon);
  g.addColorStop(y(-4) / H, s.below);
  g.addColorStop(1, s.below);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (s.stars) {
    for (let i = 0; i < s.stars; i++) {
      const el = 8 + Math.pow(rnd(), 0.6) * (EL_TOP - 8);
      ctx.globalAlpha = (0.2 + rnd() * 0.8) * Math.min(1, (el - 8) / 20);
      ctx.fillStyle = rnd() < 0.15 ? '#ffd9b0' : '#e8f0ff';
      const r = rnd() < 0.05 ? 2 : 1;
      ctx.fillRect(rnd() * W, y(el), r, r);
    }
    ctx.globalAlpha = 1;
  }

  let sunX = 0;
  if (s.sun) {
    const [tx, tz] = s.sun.toward;
    sunX = (Math.atan2(tx, -tz) / (Math.PI * 2) + 0.5) * W;
    const sy = y(s.sun.el);
    const glowR = px(s.sun.glowSize);
    wrap(sunX, glowR, (xx) => {
      const gg = ctx.createRadialGradient(xx, sy, 0, xx, sy, glowR);
      gg.addColorStop(0, s.sun!.glow);
      gg.addColorStop(1, clearOf(s.sun!.glow));
      ctx.fillStyle = gg;
      ctx.fillRect(xx - glowR, sy - glowR, glowR * 2, glowR * 2);
    });
  }

  if (s.clouds) paintClouds(ctx, s.clouds, rnd);

  if (s.sun) {
    const sy = y(s.sun.el);
    const r = px(s.sun.size);
    wrap(sunX, r * 3, (xx) => {
      const gg = ctx.createRadialGradient(xx, sy, 0, xx, sy, r * 2.2);
      gg.addColorStop(0, s.sun!.color);
      gg.addColorStop(0.45, s.sun!.color);
      gg.addColorStop(1, clearOf(s.sun!.color));
      ctx.fillStyle = gg;
      ctx.fillRect(xx - r * 3, sy - r * 3, r * 6, r * 6);
    });
  }

  // haze band sitting on the horizon, then the ridgelines through it
  const haze = s.haze ?? s.horizon;
  for (const r of s.ridges) {
    paintRidge(ctx, r, haze);
    const hz = ctx.createLinearGradient(0, y(r.base + r.amp), 0, y(r.base - 1));
    hz.addColorStop(0, clearOf(haze));
    hz.addColorStop(1, haze);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = hz;
    ctx.fillRect(0, y(r.base + r.amp), W, y(r.base - 1) - y(r.base + r.amp));
    ctx.globalAlpha = 1;
  }

  for (const [u, col] of s.smoke ?? []) {
    const sx = u * W;
    for (let k = 0; k < 26; k++) {
      const t = k / 26;
      const el = s.ridges[s.ridges.length - 1].base + 1 + t * 22;
      softBlob(ctx, sx + Math.sin(t * 5) * 20 + t * t * 160, y(el), (14 + t * 70) * 1.2, 14 + t * 40, col, 0.32 * (1 - t));
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.anisotropy = 4;
  return t;
}

const SKY_VERT = /* glsl */ `
varying vec2 vNdc;
void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const SKY_FRAG = /* glsl */ `
uniform sampler2D tSky;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
varying vec2 vNdc;
void main() {
  vec4 v = uInvProj * vec4(vNdc, 1.0, 1.0);
  vec3 dir = normalize((uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);
  float u = atan(dir.x, -dir.z) / 6.28318530718 + 0.5;
  float el = degrees(asin(clamp(dir.y, -1.0, 1.0)));
  float t = clamp((el - ${EL_BOT.toFixed(1)}) / ${(EL_TOP - EL_BOT).toFixed(1)}, 0.001, 0.999);
  gl_FragColor = texture2D(tSky, vec2(u, t));
  #include <colorspace_fragment>
}
`;

/** Full-screen quad that draws a painted sky for any camera. */
export function skyPass() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: { tSky: { value: null }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() } },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  return {
    scene,
    set(sky: THREE.Texture, cam: THREE.Camera) {
      mat.uniforms.tSky.value = sky;
      mat.uniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
      mat.uniforms.uCamWorld.value.copy(cam.matrixWorld);
    },
  };
}
