/* Dead Pixels — rank & prestige badge generator.
 * Procedural low-poly SVG. Pure functions: levelBadge(1..75), prestigeBadge(1..10, phase).
 * Animated prestige badges take a loop phase 0..1 (LOOP seconds per loop). */
(function (root) {
'use strict';
const D2R = Math.PI / 180, TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const n3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const LIGHT = n3([-0.5, -0.72, 0.8]);
const OUT = '#07080b';
const LOOP = 3;      // seconds per animation loop
const FRAMES = 36;   // frames per loop for sprite export (12 fps)
const STATIC_PHASE = 0.62; // frame used for static exports of animated badges

function rng(seed) { let s = (seed >>> 0) || 0x9e3779b9; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hashPts(p) { let h = 2166136261; for (const q of p) { h ^= Math.round(q[0] * 7.3 + q[1] * 13.1) & 0xffff; h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- colour ---------- */
const h2r = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const r2h = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mixHex = (a, b, t) => r2h(mixc(h2r(a), h2r(b), clamp(t, 0, 1)));
function M(d, m, l, s) { return { s: [[0, h2r(d)], [0.5, h2r(m)], [0.8, h2r(l)], [1, h2r(s || l)]] }; }
function mixMat(a, b, t) { return { s: a.s.map((st, i) => [st[0], mixc(st[1], b.s[i][1], clamp(t, 0, 1))]) }; }
function shade(m, v) {
  v = clamp(v, 0, 1); const s = m.s;
  for (let i = 1; i < s.length; i++) if (v <= s[i][0]) { const t = (v - s[i - 1][0]) / (s[i][0] - s[i - 1][0]); return r2h(mixc(s[i - 1][1], s[i][1], t)); }
  return r2h(s[s.length - 1][1]);
}
const lit = n => clamp(0.1 + 0.9 * (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]), 0, 1);

const MAT = {
  khaki:    M('#3a301a', '#a88d4f', '#e2cd8e', '#fff3c8'),
  bronze:   M('#341f0d', '#a0622a', '#e3a458', '#ffe2ad'),
  silver:   M('#262c33', '#8692a0', '#d3dbe5', '#ffffff'),
  steel:    M('#1a1f25', '#5b6674', '#aab5c3', '#eef3f8'),
  gold:     M('#432a04', '#c18a19', '#f3cf58', '#fff6c9'),
  white:    M('#3a4452', '#aab6c4', '#eef3f8', '#ffffff'),
  olive:    M('#10140b', '#26301c', '#3e4a31', '#55634a'),
  gun:      M('#0e1115', '#222830', '#38414c', '#4e5966'),
  steelb:   M('#0b121c', '#1b2c40', '#30486a', '#47668c'),
  navy:     M('#0a0e1c', '#18203e', '#2b3763', '#415183'),
  crimson:  M('#24040a', '#6e0f19', '#a82029', '#d24046'),
  obsid:    M('#040406', '#141419', '#26262f', '#3d3d49'),
  ruby:     M('#2c0306', '#8d0f1c', '#e0303b', '#ff9a9a'),
  red:      M('#2a0404', '#b0121c', '#f0403a', '#ffb7a6'),
  emerald:  M('#022014', '#0b7a49', '#2fd98a', '#d4fff0'),
  sapphire: M('#03112e', '#1450b8', '#4fa3ff', '#d8eeff'),
  ice:      M('#0b2238', '#3d8ccc', '#a8e4ff', '#ffffff'),
  amethyst: M('#170529', '#5e1fa3', '#a865ff', '#f2e4ff'),
  violet:   M('#2a0a4d', '#8a3cff', '#d7a8ff', '#ffffff'),
  bone:     M('#3b3326', '#b9ad92', '#ece4cf', '#ffffff'),
  char:     M('#0b0604', '#2e140b', '#a8380e', '#ffb347'),
  lava:     M('#2a0300', '#c22a05', '#ff8a12', '#fff2a0'),
  fireY:    M('#8a2e00', '#ff9a10', '#ffe14d', '#fffbe0'),
  fireR:    M('#2a0000', '#a01405', '#ff4b12', '#ffb347'),
  magma:    M('#050303', '#17100d', '#3d1a0e', '#ff8a2a'),
};

/* ---------- geometry ---------- */
const area = p => { let a = 0; for (let i = 0, n = p.length; i < n; i++) { const q = p[i], r = p[(i + 1) % n]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; };
function centroid(p) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, n = p.length; i < n; i++) { const q = p[i], r = p[(i + 1) % n], f = q[0] * r[1] - r[0] * q[1]; a += f; cx += (q[0] + r[0]) * f; cy += (q[1] + r[1]) * f; }
  if (Math.abs(a) < 1e-9) { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; }
  return [cx / (3 * a), cy / (3 * a)];
}
const mv = (p, dx, dy) => p.map(q => [q[0] + dx, q[1] + dy]);
const rot = (p, a, cx = 0, cy = 0) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return p.map(q => { const x = q[0] - cx, y = q[1] - cy; return [cx + x * c - y * s, cy + x * s + y * c]; }); };
const mirX = (p, cx = 0) => p.map(q => [2 * cx - q[0], q[1]]).reverse();
function regPoly(cx, cy, r, n, a0 = -90, ry = r) { const p = []; for (let i = 0; i < n; i++) { const a = (a0 + 360 * i / n) * D2R; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * ry]); } return p; }
function starPoly(cx, cy, R, r, n = 5, a0 = -90) { const p = []; for (let i = 0; i < 2 * n; i++) { const a = (a0 + 180 * i / n) * D2R, rr = i % 2 ? r : R; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return p; }
function chamferRect(cx, cy, w, h, c) { const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2; return [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]]; }
function arcPoly(cx, cy, R, r, a0, a1, seg) { const o = [], i = []; for (let k = 0; k <= seg; k++) { const a = lerp(a0, a1, k / seg) * D2R; o.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); i.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o.concat(i.reverse()); }
function diamond(cx, cy, w, h) { return [[cx, cy - h], [cx + w, cy], [cx, cy + h], [cx - w, cy]]; }

function inset(p, d) {
  const n = p.length, sg = area(p) > 0 ? 1 : -1, E = [], out = [];
  for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; const nx = -dy * sg, ny = dx * sg; E.push({ a: [a[0] + nx * d, a[1] + ny * d], d: [dx, dy], n: [nx, ny] }); }
  for (let i = 0; i < n; i++) {
    const e1 = E[(i - 1 + n) % n], e2 = E[i], den = e1.d[0] * e2.d[1] - e1.d[1] * e2.d[0];
    let Q;
    if (Math.abs(den) < 1e-6) Q = [p[i][0] + e2.n[0] * d, p[i][1] + e2.n[1] * d];
    else { const wx = e2.a[0] - e1.a[0], wy = e2.a[1] - e1.a[1], t = (wx * e2.d[1] - wy * e2.d[0]) / den; Q = [e1.a[0] + e1.d[0] * t, e1.a[1] + e1.d[1] * t]; }
    const mx = Q[0] - p[i][0], my = Q[1] - p[i][1], ml = Math.hypot(mx, my), lim = Math.abs(d) * 4;
    if (ml > lim) Q = [p[i][0] + mx / ml * lim, p[i][1] + my / ml * lim];
    out.push(Q);
  }
  return out;
}
function starShaped(p, c) {
  const s = Math.sign(area(p));
  for (let i = 0, n = p.length; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; const cr = (a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0]); if (cr * s <= 1e-6) return false; }
  return true;
}
function earclip(p) {
  const s = area(p) > 0 ? 1 : -1, idx = p.map((_, i) => i), tris = [];
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = 0;
  while (idx.length > 3 && guard++ < 2000) {
    let found = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i - 1 + idx.length) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length], a = p[i0], b = p[i1], c = p[i2];
      if (cr(a, b, c) * s <= 1e-9) continue;
      let inside = false;
      for (const j of idx) { if (j === i0 || j === i1 || j === i2) continue; const q = p[j], d1 = cr(a, b, q) * s, d2 = cr(b, c, q) * s, d3 = cr(c, a, q) * s; if (d1 > 1e-9 && d2 > 1e-9 && d3 > 1e-9) { inside = true; break; } }
      if (inside) continue;
      tris.push([a, b, c]); idx.splice(i, 1); found = true; break;
    }
    if (!found) break;
  }
  if (idx.length === 3) tris.push(idx.map(i => p[i]));
  return tris;
}
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function subdiv(t, k) { if (k <= 0) return [t]; const [a, b, c] = t, ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); return [...subdiv([a, ab, ca], k - 1), ...subdiv([ab, b, bc], k - 1), ...subdiv([ca, bc, c], k - 1), ...subdiv([ab, bc, ca], k - 1)]; }

/* ---------- svg emit ---------- */
const f2 = v => Math.round(v * 100) / 100;
const P = p => p.map(q => f2(q[0]) + ',' + f2(q[1])).join(' ');
const face = (p, c) => `<polygon points="${P(p)}" fill="${c}" stroke="${c}" stroke-width=".45" stroke-linejoin="round"/>`;
const flat = (p, c, op) => `<polygon points="${P(p)}" fill="${c}"${op != null ? ` opacity="${f2(clamp(op, 0, 1))}"` : ''}/>`;

/* Faceted low-poly solid: outline + bevel ring + pyramid/ear-clipped top, flat-shaded from LIGHT. */
function gem(p, m, o = {}) {
  const n = p.length; let s = '';
  const oc = o.outline === false ? null : (o.outline || OUT);
  if (oc) s += `<polygon points="${P(p)}" fill="${oc}" stroke="${oc}" stroke-width="${o.ow ?? 3}" stroke-linejoin="round"/>`;
  if (o.outlineOnly) return s;
  const bev = o.bevel ?? 2.6, k = o.slope ?? 1.25, tl = o.tilt || [0, 0], jit = o.jitter ?? 0.14, br = o.bright || 0;
  const R = rng(o.seed ?? hashPts(p));
  const sh = nr => shade(m, lit(n3(nr)) + br);
  if (o.mode === 'flat') { return s + face(p, o.fill || shade(m, 0.6 + br)); }
  let top = p;
  if (bev > 0) {
    const ins = inset(p, bev), sg = area(p) > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const ox = dy * sg, oy = -dx * sg;
      s += face([a, b, ins[(i + 1) % n], ins[i]], sh([ox * k + tl[0] + (R() - .5) * jit, oy * k + tl[1] + (R() - .5) * jit, 1]));
    }
    top = ins;
  }
  const c = o.center || centroid(top);
  let Rm = 0; for (const q of top) Rm = Math.max(Rm, Math.hypot(q[0] - c[0], q[1] - c[1]));
  Rm = Rm || 1;
  if (o.mode !== 'ear' && starShaped(top, c)) {
    const h = (o.height ?? 0.3) * Rm;
    for (let i = 0; i < top.length; i++) {
      const a = top[i], b = top[(i + 1) % top.length];
      const u = [b[0] - a[0], b[1] - a[1], 0], v = [c[0] - a[0], c[1] - a[1], h];
      let nr = n3([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
      if (nr[2] < 0) nr = nr.map(x => -x);
      for (const t of subdiv([a, b, c], o.subdiv || 0)) s += face(t, sh([nr[0] + tl[0] + (R() - .5) * jit, nr[1] + tl[1] + (R() - .5) * jit, nr[2]]));
    }
  } else {
    const dome = o.dome ?? 0.45;
    for (const t0 of earclip(top)) for (const t of subdiv(t0, o.subdiv || 0)) {
      const gx = (t[0][0] + t[1][0] + t[2][0]) / 3, gy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      s += face(t, sh([(gx - c[0]) / Rm * dome + tl[0] + (R() - .5) * jit * 1.6, (gy - c[1]) / Rm * dome + tl[1] + (R() - .5) * jit * 1.6, 1]));
    }
  }
  return s;
}

function shadowOf(parts, dx = 1.8, dy = 2.4, op = 0.45) {
  let s = `<g opacity="${op}">`;
  for (const p of parts) if (!p.noShadow) { const w = ((p.o && p.o.ow != null) ? p.o.ow : 3) + 1; s += `<polygon points="${P(mv(p.pts, dx, dy))}" fill="#000" stroke="#000" stroke-width="${w}" stroke-linejoin="round"/>`; }
  return s + '</g>';
}
function render(parts, o = {}) { return (o.shadow === false ? '' : shadowOf(parts, o.dx, o.dy, o.op)) + parts.map(p => gem(p.pts, p.m, p.o || {})).join(''); }
function bbox(parts) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of parts) for (const q of p.pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); } return [x0, y0, x1, y1]; }
function fit(parts, box, maxS = 1.4) {
  const b = bbox(parts), s = Math.min(box.w / (b[2] - b[0]), box.h / (b[3] - b[1]), maxS), ox = (b[0] + b[2]) / 2, oy = (b[1] + b[3]) / 2;
  return parts.map(p => ({ ...p, pts: p.pts.map(q => [box.cx + (q[0] - ox) * s, box.cy + (q[1] - oy) * s]) }));
}
const place = (parts, dx, dy, s = 1) => parts.map(p => ({ ...p, pts: p.pts.map(q => [dx + q[0] * s, dy + q[1] * s]) }));
const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">${body}</svg>`;

/* Stepped (posterised) glow — reads as pixel-art bloom rather than a smooth gradient. */
function sglow(cx, cy, r, col, op, steps = 4, sides = 12, a0 = -90) { let s = ''; for (let i = 0; i < steps; i++) s += flat(regPoly(cx, cy, r * (1 - i / steps), sides, a0), col, op); return s; }
function twinkle(cx, cy, r, op) { return op <= 0.01 ? '' : flat(starPoly(cx, cy, r, r * 0.18, 4, -90), '#ffffff', op) + flat(starPoly(cx, cy, r * .5, r * .12, 4, -45), '#ffffff', op * .8); }
/* Diagonal glint sweep clipped to a silhouette. */
function glint(id, polys, ph, start = 0, dur = 0.32) {
  const u = ((ph - start) % 1 + 1) % 1; if (u > dur) return '';
  const x = lerp(-50, 200, u / dur), band = [[x - 12, -10], [x + 4, -10], [x - 66, 140], [x - 82, 140]], thin = [[x + 10, -10], [x + 15, -10], [x - 55, 140], [x - 60, 140]];
  return `<defs><clipPath id="${id}">${polys.map(p => `<polygon points="${P(p)}"/>`).join('')}</clipPath></defs><g clip-path="url(#${id})">${flat(band, '#ffffff', .5)}${flat(thin, '#ffffff', .35)}</g>`;
}

/* ---------- reusable motifs ---------- */
function wingParts(side, m, o = {}) {
  const n = o.n || 5, a0 = o.a0 ?? -62, a1 = o.a1 ?? 16, L0 = o.L0 ?? 48, L1 = o.L1 ?? 28, w = o.w ?? 6.5, px = o.px || 0, py = o.py || 0, sc = o.s || 1, flap = (o.flap || 0) * D2R;
  const tx = (x, y) => { const c = Math.cos(flap), s = Math.sin(flap), X = x * c - y * s, Y = x * s + y * c; return [px + X * side * sc, py + Y * sc]; };
  const fe = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0, a = (lerp(a0, a1, t) + (o.sway ? o.sway(i) : 0)) * D2R, L = lerp(L0, L1, t) * (o.len ? o.len(i) : 1);
    const dx = Math.cos(a), dy = Math.sin(a), qx = -dy, qy = dx, ww = w * (1 - t * .2), b = 3, sh = L * .68;
    const pts = [[dx * b - qx * ww * .45, dy * b - qy * ww * .45], [dx * sh - qx * ww, dy * sh - qy * ww], [dx * L, dy * L], [dx * sh + qx * ww, dy * sh + qy * ww], [dx * b + qx * ww * .45, dy * b + qy * ww * .45]].map(q => tx(q[0], q[1]));
    fe.push({ pts, m: o.mf ? o.mf(i) : m, o: { bevel: o.fb ?? 1.3, height: .38, ow: o.ow ?? 2.4, outline: o.oc, seed: (o.seed || 7) + i * 31 } });
  }
  const parts = [];
  for (let i = n - 1; i >= 0; i--) parts.push(fe[i]);
  if (o.noCovert) return parts;
  const dP = (a, r) => [Math.cos(a * D2R) * r, Math.sin(a * D2R) * r];
  const cv = [[-3, 3], [-2, -5], dP(a0 - 4, L0 * .52), dP((a0 + a1) / 2 - 8, L0 * .42), dP(a1, L1 * .45), [2, 8]].map(q => tx(q[0], q[1]));
  parts.push({ pts: cv, m: o.mc || m, o: { bevel: 1.5, height: .3, ow: o.ow ?? 2.4, outline: o.oc, seed: (o.seed || 7) + 999 } });
  return parts;
}

function skullParts(cx, cy, s, m, o = {}) {
  const half = [[0, -34], [15, -31.5], [26, -23], [31, -9], [29.5, 4], [24, 12], [21, 23], [12.5, 29], [0, 30]];
  const T = q => [cx + q[0] * s, cy + q[1] * s], TM = q => [cx - q[0] * s, cy + q[1] * s];
  const right = half.map(T), left = half.map(TM).reverse();
  const whole = half.map(T).concat(half.slice(1, -1).reverse().map(TM));
  const dark = o.socket || MAT.obsid, parts = [];
  parts.push({ pts: whole, m, o: { outlineOnly: true, ow: o.ow ?? 3.2 } });
  parts.push({ pts: right, m, o: { bevel: 2.2 * s, dome: .55, tilt: [.16, 0], outline: false, seed: 11, mode: 'ear' }, noShadow: true });
  parts.push({ pts: left, m, o: { bevel: 2.2 * s, dome: .55, tilt: [-.16, 0], outline: false, seed: 12, mode: 'ear' }, noShadow: true });
  const sock = [[5, -6], [12, -12], [21, -10], [23.5, -2], [18, 5.5], [8.5, 4.5]];
  parts.push({ pts: sock.map(T), m: dark, o: { bevel: 1.8 * s, slope: -1.4, height: -.1, ow: 1.6, seed: 21 }, noShadow: true });
  parts.push({ pts: sock.map(TM).reverse(), m: dark, o: { bevel: 1.8 * s, slope: -1.4, height: -.1, ow: 1.6, seed: 22 }, noShadow: true });
  parts.push({ pts: [[0, 7], [4.5, 14.5], [1.6, 17.5], [0, 16], [-1.6, 17.5], [-4.5, 14.5]].map(T), m: dark, o: { bevel: 1.2 * s, slope: -1.4, height: -.1, ow: 1.4, mode: 'ear' }, noShadow: true });
  parts.push({ pts: [[-13.5, 19.5], [13.5, 19.5], [12, 27], [-12, 27]].map(T), m: dark, o: { mode: 'flat', fill: '#050506', ow: 1.4 }, noShadow: true });
  for (let i = 0; i < 5; i++) { const x0 = -10.6 + i * 4.4; parts.push({ pts: [[x0, 20], [x0 + 3.6, 20], [x0 + 3.4, 25.5], [x0 + .2, 25.5]].map(T), m, o: { bevel: 0, height: .25, ow: .9, seed: 30 + i }, noShadow: true }); }
  return { parts, eyes: [T([14.5, -2.5]), TM([14.5, -2.5])], whole };
}
function eyePixels(eyes, s, col, glowCol, op) {
  let out = '';
  for (const e of eyes) { out += sglow(e[0], e[1], 12 * s, glowCol, op, 3, 8, -90); const k = 3.8 * s, j = 1.6 * s; out += flat(chamferRect(e[0], e[1], 2 * k, 2 * k, 0), col) + flat(chamferRect(e[0], e[1], 2 * j, 2 * j, 0), '#ffffff', .9); }
  return out;
}
function boneParts(cx, cy, len, ang, m) {
  const shaft = chamferRect(0, 0, len, 7, 2), knobs = [[-len / 2, -4.2], [-len / 2, 4.2], [len / 2, -4.2], [len / 2, 4.2]].map(k => regPoly(k[0], k[1], 5.2, 6, 0));
  return [{ pts: shaft, m, o: { bevel: 1.6, height: .25 } }, ...knobs.map((k, i) => ({ pts: k, m, o: { bevel: 1.4, height: .35, seed: 70 + i } }))].map(p => ({ ...p, pts: mv(rot(p.pts, ang), cx, cy) }));
}
function knifeParts(cx, cy, ang, k = 1) {
  const parts = [
    { pts: [[-9, -3.5], [-31, -3.5], [-35, 0], [-31, 3.5], [-9, 3.5]], m: MAT.obsid, o: { bevel: 1.2, height: .3 } },
    { pts: diamond(-37, 0, 4, 4.5), m: MAT.silver, o: { bevel: 0, height: .5, ow: 2 } },
    { pts: [[-4, -5], [32, -5.5], [48, 0], [32, 4.5], [-4, 4.5]], m: MAT.silver, o: { bevel: 1.6, height: .3 } },
    { pts: chamferRect(-6, 0, 5, 20, 1.5), m: MAT.silver, o: { bevel: 1.2, height: .3 } },
  ];
  return parts.map(p => ({ ...p, pts: mv(rot(p.pts.map(q => [q[0] * k, q[1] * k]), ang), cx, cy) }));
}
function tongue(bx, by, dirA, len, w, bend) {
  const d = [Math.cos(dirA * D2R), Math.sin(dirA * D2R)], q = [-d[1], d[0]];
  const p = (a, b) => [bx + d[0] * a + q[0] * b, by + d[1] * a + q[1] * b];
  return [p(0, -w), p(len * .42, -w * .95 + bend * .25), p(len * .75, -w * .45 + bend * .6), p(len, bend), p(len * .72, w * .4 + bend * .55), p(len * .4, w * .9 + bend * .2), p(0, w)];
}

/* Roman numeral glyphs built from straight strokes (I, V, X) — keeps numerals low-poly. */
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function glyphs(str, cx, cy, h) {
  const w = h * 0.28, gap = h * 0.16, widths = str.split('').map(c => (c === 'I' ? w : c === 'V' ? h * 0.8 : h * 0.84));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (str.length - 1), polys = [];
  let x = cx - total / 2; const y = cy - h / 2;
  str.split('').forEach((c, i) => {
    const W = widths[i];
    if (c === 'I') polys.push([[x, y], [x + W, y], [x + W, y + h], [x, y + h]]);
    else if (c === 'V') { const sw = w * 1.15, b = sw * .55, k = (W / 2 - sw) / (W / 2 + b - sw); polys.push([[x, y], [x + sw, y], [x + W / 2, y + h * k], [x + W - sw, y], [x + W, y], [x + W / 2 + b, y + h], [x + W / 2 - b, y + h]]); }
    else { const sw = w * 1.1, mx = x + W / 2, my = y + h / 2, dx = sw / 2, dy = h * sw / (2 * (W - sw)); polys.push([[x, y], [x + sw, y], [mx, my - dy], [x + W - sw, y], [x + W, y], [mx + dx, my], [x + W, y + h], [x + W - sw, y + h], [mx, my + dy], [x + sw, y + h], [x, y + h], [mx - dx, my]]); }
    x += W + gap;
  });
  return { polys, total };
}
function tab(n, cy, mPlate, mNum, extra = {}) {
  const g = glyphs(ROMAN[n], 64, cy, 10.5), W = Math.max(g.total + 16, 24), h = 17;
  const pts = [[64 - W / 2, cy - h / 2], [64 + W / 2, cy - h / 2], [64 + W / 2 + 6, cy], [64 + W / 2, cy + h / 2], [64 - W / 2, cy + h / 2], [64 - W / 2 - 6, cy]];
  const parts = [{ pts, m: mPlate, o: { bevel: 2, height: .12, ow: 3, seed: 900 } }, ...g.polys.map((p, i) => ({ pts: p, m: mNum, o: { bevel: 0, height: .35, ow: 2, dome: .35, seed: 910 + i, bright: extra.bright || 0 } }))];
  return { svg: render(parts, { op: .45 }), sil: pts };
}

/* ---------- ranks (levels 1–75 = 25 ranks × 3 tiers) ---------- */
const FAM = {
  A: { name: 'Enlisted', shape: () => chamferRect(64, 62, 104, 104, 22), rim: MAT.khaki, field: MAT.olive, ins: MAT.khaki, acc: MAT.khaki, pip: MAT.khaki, box: { cx: 64, cy: 56, w: 78, h: 66 }, pipY: 101, maxS: 1.45 },
  B: { name: 'NCO', shape: () => [[12, 12], [116, 12], [116, 56], [108, 82], [90, 104], [64, 121], [38, 104], [20, 82], [12, 56]], rim: MAT.bronze, field: MAT.gun, ins: MAT.bronze, acc: MAT.gold, pip: MAT.bronze, box: { cx: 64, cy: 54, w: 72, h: 70 }, pipY: 99, maxS: 1.4 },
  C: { name: 'Senior NCO / Warrant', shape: () => regPoly(64, 62, 58, 6, 0), rim: MAT.silver, field: MAT.steelb, ins: MAT.silver, acc: MAT.gold, pip: MAT.silver, box: { cx: 64, cy: 56, w: 80, h: 68 }, pipY: 100, maxS: 1.45 },
  D: { name: 'Officer', shape: () => regPoly(64, 62, 54, 6, -90, 60), rim: MAT.gold, field: MAT.navy, ins: MAT.gold, acc: MAT.gold, pip: MAT.gold, box: { cx: 64, cy: 57, w: 70, h: 66 }, pipY: 102, maxS: 1.45 },
  E: { name: 'General', shape: () => starPoly(64, 62, 61, 52, 12, -90), rim: MAT.gold, field: MAT.crimson, ins: MAT.white, acc: MAT.gold, pip: MAT.gold, box: { cx: 64, cy: 57, w: 70, h: 60 }, pipY: 100, maxS: 1.45 },
  X: { name: 'Commander', shape: () => starPoly(64, 62, 62, 51, 16, -90), rim: MAT.gold, field: MAT.obsid, ins: MAT.gold, acc: MAT.white, pip: MAT.gold, box: { cx: 64, cy: 57, w: 92, h: 62 }, pipY: 101, maxS: 1.45 },
};

function chevs(F, k, r, center) {
  const W = 30, H = 14, T = 8, G = 3, S = 10, parts = [], o = { bevel: 2.2, height: .3 };
  for (let i = 0; i < k; i++) { const y = i * (T + G); parts.push({ pts: [[-W, y + H], [0, y], [W, y + H], [W, y + H + T], [0, y + T], [-W, y + H + T]], m: F.ins, o: { ...o, seed: 50 + i } }); }
  const yl = (k - 1) * (T + G), cb = yl + H + T;
  for (let j = 0; j < (r || 0); j++) { const yt = cb + G + j * (T + G), top = [], bot = []; for (let i = 0; i <= 6; i++) { const x = -W + 2 * W * i / 6, u = x / W, y = yt + S * (1 - u * u); top.push([x, y]); bot.push([x, y + T]); } parts.push({ pts: top.concat(bot.reverse()), m: F.ins, o: { ...o, seed: 60 + j } }); }
  if (center) {
    const cy = (yl + T + cb + G + S) / 2 + 1;
    if (center === 'diamond') parts.push({ pts: diamond(0, cy, 8.5, 11.5), m: F.acc, o: { bevel: 1.6, height: .45 } });
    if (center === 'star') parts.push({ pts: starPoly(0, cy + 1, 13, 5.4), m: F.acc, o: { bevel: 1.4, height: .45 } });
    if (center === 'starRing') { parts.push({ pts: arcPoly(0, cy, 14.5, 11, 180, 360, 6), m: F.acc, o: { bevel: 1.1, height: .3 } }, { pts: arcPoly(0, cy, 14.5, 11, 0, 180, 6), m: F.acc, o: { bevel: 1.1, height: .3 } }, { pts: starPoly(0, cy + .5, 9, 3.8), m: F.acc, o: { bevel: 1.2, height: .45 } }); }
  }
  return parts;
}
function specialist(F) {
  return [{ pts: [[-21, -19], [21, -19], [22, 1], [11, 14], [0, 22], [-11, 14], [-22, 1]], m: F.ins, o: { bevel: 2.4, height: .3 } },
    { pts: starPoly(0, -1, 10, 4.2), m: MAT.olive, o: { bevel: 1.5, slope: -1.4, height: -.15, ow: 1.4 }, noShadow: true }];
}
function warrant(F, n) {
  const xs = n === 1 ? [0] : [-17, 0, 17];
  return [{ pts: chamferRect(0, 0, 64, 20, 5), m: F.ins, o: { bevel: 2.4, height: .3 } },
    ...xs.map((x, i) => ({ pts: chamferRect(x, 0, 9, 9, 1), m: MAT.obsid, o: { bevel: 1.6, slope: -1.4, height: -.15, ow: 1.4, seed: 80 + i }, noShadow: true }))];
}
function bars(F, n, metal) { return (n === 1 ? [0] : [-13, 13]).map((x, i) => ({ pts: chamferRect(x, 0, 18, 56, 4.5), m: MAT[metal], o: { bevel: 2.4, height: .25, seed: 90 + i } })); }
function leaf(F, metal) {
  const half = [[0, -36], [7, -30], [6, -24], [15, -21], [12, -14], [22, -10], [17, -3], [25, 3], [17, 8], [21, 15], [11, 16], [12, 23], [4, 22], [3, 34], [0, 34]];
  const m = MAT[metal];
  return [{ pts: half, m, o: { bevel: 1.8, dome: .5, tilt: [.25, 0], mode: 'ear', seed: 101 } }, { pts: mirX(half), m, o: { bevel: 1.8, dome: .5, tilt: [-.25, 0], mode: 'ear', seed: 102 } }];
}
function eagle() {
  const m = MAT.silver;
  return [{ pts: [[-6, 12], [6, 12], [10, 26], [3, 22], [0, 27], [-3, 22], [-10, 26]], m, o: { bevel: 1.4, height: .3 } },
    ...wingParts(-1, m, { px: -4, py: -6, n: 5, a0: -58, a1: 20, L0: 42, L1: 24, w: 5.8, seed: 120 }),
    ...wingParts(1, m, { px: 4, py: -6, n: 5, a0: -58, a1: 20, L0: 42, L1: 24, w: 5.8, seed: 140 }),
    { pts: [[0, -14], [7.5, -6], [7, 8], [0, 17], [-7, 8], [-7.5, -6]], m, o: { bevel: 1.6, height: .4 } },
    { pts: [[0, -26], [6, -22], [6, -15], [0, -11], [-5, -14], [-12, -17], [-6, -20]], m, o: { bevel: 1.2, height: .35 } }];
}
function stars(F, n) {
  const L = { 1: [[0, 0, 26]], 2: [[-20, 0, 18], [20, 0, 18]], 3: [[-30, 5, 15], [0, -4, 15], [30, 5, 15]], 4: [[-16, -15, 14], [16, -15, 14], [-16, 15, 14], [16, 15, 14]], 5: regPoly(0, 0, 23, 5, -90).map(q => [q[0], q[1], 12]) }[n];
  return L.map((s, i) => ({ pts: starPoly(s[0], s[1], s[2], s[2] * .42), m: F.ins, o: { bevel: 1.5, height: .45, seed: 150 + i } }));
}
function commander() {
  return [...wingParts(-1, MAT.silver, { px: -12, py: 0, n: 5, a0: -64, a1: 14, L0: 44, L1: 24, w: 6.5, seed: 160 }),
    ...wingParts(1, MAT.silver, { px: 12, py: 0, n: 5, a0: -64, a1: 14, L0: 44, L1: 24, w: 6.5, seed: 180 }),
    { pts: starPoly(0, 2, 27, 11.5), m: MAT.gold, o: { bevel: 1.8, height: .5 } }];
}

const RANKS = [
  ['Private', 'PVT', 'A', F => chevs(F, 1)],
  ['Private First Class', 'PFC', 'A', F => chevs(F, 1, 1)],
  ['Specialist', 'SPC', 'A', F => specialist(F)],
  ['Corporal', 'CPL', 'A', F => chevs(F, 2)],
  ['Sergeant', 'SGT', 'A', F => chevs(F, 3)],
  ['Staff Sergeant', 'SSG', 'B', F => chevs(F, 3, 1)],
  ['Sergeant First Class', 'SFC', 'B', F => chevs(F, 3, 2)],
  ['Master Sergeant', 'MSG', 'B', F => chevs(F, 3, 3)],
  ['First Sergeant', '1SG', 'B', F => chevs(F, 3, 3, 'diamond')],
  ['Sergeant Major', 'SGM', 'B', F => chevs(F, 3, 3, 'star')],
  ['Command Sergeant Major', 'CSM', 'C', F => chevs(F, 3, 3, 'starRing')],
  ['Warrant Officer', 'WO', 'C', F => warrant(F, 1)],
  ['Chief Warrant Officer', 'CWO', 'C', F => warrant(F, 3)],
  ['Second Lieutenant', '2LT', 'D', F => bars(F, 1, 'gold')],
  ['First Lieutenant', '1LT', 'D', F => bars(F, 1, 'silver')],
  ['Captain', 'CPT', 'D', F => bars(F, 2, 'silver')],
  ['Major', 'MAJ', 'D', F => leaf(F, 'gold')],
  ['Lieutenant Colonel', 'LTC', 'D', F => leaf(F, 'silver')],
  ['Colonel', 'COL', 'D', () => eagle()],
  ['Brigadier General', 'BG', 'E', F => stars(F, 1)],
  ['Major General', 'MG', 'E', F => stars(F, 2)],
  ['Lieutenant General', 'LTG', 'E', F => stars(F, 3)],
  ['General', 'GEN', 'E', F => stars(F, 4)],
  ['General of the Army', 'GA', 'E', F => stars(F, 5)],
  ['Commander', 'CMDR', 'X', () => commander()],
].map(([name, abbr, fam, build]) => ({ name, abbr, fam, build }));

function plate(F) {
  const o = F.shape();
  let s = `<g opacity=".5"><polygon points="${P(mv(o, 2, 3))}" fill="#000" stroke="#000" stroke-width="5" stroke-linejoin="round"/></g>`;
  s += gem(o, F.rim, { bevel: 3, height: .07, ow: 4, jitter: .1, seed: 5 });
  s += gem(inset(o, 7.5), F.field, { bevel: 2.4, slope: -1.3, height: .06, subdiv: 1, outline: '#000', ow: 1.2, jitter: .35, seed: 6 });
  return s;
}
function pips(sub, F) {
  let s = '';
  for (let i = 0; i < 3; i++) {
    const x = 64 + (i - 1) * 13, d = diamond(x, F.pipY, 5, 6.2);
    s += i <= sub ? gem(d, F.pip, { bevel: 0, height: .55, ow: 2.2, seed: 40 + i }) : gem(d, MAT.obsid, { bevel: 0, height: -.3, ow: 2.2, bright: -.08, seed: 40 + i });
  }
  return s;
}
function rankOf(level) { const l = clamp(level | 0, 1, 75), ri = Math.floor((l - 1) / 3); return { level: l, rankIndex: ri, tier: (l - 1) % 3 + 1, ...RANKS[ri] }; }
function levelBadge(level) {
  const r = rankOf(level), F = FAM[r.fam];
  return wrap(plate(F) + render(fit(r.build(F), F.box, F.maxS)) + pips(r.tier - 1, F));
}

/* ---------- prestige 1–10 ---------- */
const S = Math.sin;
function p1() {
  let s = '';
  const fins = [...wingParts(-1, MAT.steel, { px: 38, py: 60, n: 4, a0: -36, a1: 26, L0: 40, L1: 24, w: 6.6, seed: 300 }), ...wingParts(1, MAT.steel, { px: 90, py: 60, n: 4, a0: -36, a1: 26, L0: 40, L1: 24, w: 6.6, seed: 320 })];
  s += render(fins);
  const dia = regPoly(64, 58, 44, 4, -90);
  s += render([{ pts: dia, m: MAT.steel, o: { bevel: 3.5, height: .3, ow: 3.5, seed: 340 } }]);
  s += gem(inset(dia, 9), MAT.gun, { bevel: 2.2, slope: -1.3, height: .05, subdiv: 1, outline: '#000', ow: 1.2, jitter: .35, seed: 341 });
  const ch = [];
  for (let q = 0; q < 4; q++) ch.push({ pts: arcPoly(64, 58, 20, 15, q * 90 + 45 - 31, q * 90 + 45 + 31, 4), m: MAT.red, o: { bevel: 1.4, height: .3, ow: 2.2, seed: 350 + q } });
  for (let q = 0; q < 4; q++) ch.push({ pts: rot(chamferRect(0, -18, 4.4, 20, 1), q * 90).map(p => [p[0] + 64, p[1] + 58]), m: MAT.red, o: { bevel: 1.2, height: .3, ow: 2, seed: 360 + q } });
  ch.push({ pts: diamond(64, 58, 3.6, 3.6), m: MAT.red, o: { bevel: 0, height: .5, ow: 1.8 } });
  s += render(ch, { op: .5, dx: 1.2, dy: 1.6 });
  s += tab(1, 110, MAT.gun, MAT.red).svg;
  return s;
}
function p2() {
  let s = '';
  s += render([...wingParts(-1, MAT.bronze, { px: 46, py: 60, n: 6, a0: -54, a1: 34, L0: 48, L1: 26, w: 6.8, seed: 400 }), ...wingParts(1, MAT.bronze, { px: 82, py: 60, n: 6, a0: -54, a1: 34, L0: 48, L1: 26, w: 6.8, seed: 420 })]);
  const hex = regPoly(64, 58, 28, 6, -90);
  s += render([{ pts: hex, m: MAT.bronze, o: { bevel: 3, height: .3, ow: 3.5, seed: 440 } }]);
  s += gem(inset(hex, 6), MAT.gun, { bevel: 2, slope: -1.3, height: .05, subdiv: 1, outline: '#000', ow: 1.2, jitter: .35, seed: 441 });
  s += render(fit(chevs({ ins: MAT.silver }, 2), { cx: 64, cy: 57, w: 26, h: 24 }, 1));
  s += tab(2, 110, MAT.gun, MAT.bronze).svg;
  return s;
}
function p3() {
  let s = '';
  s += render([...knifeParts(64, 58, -135, 1.32), ...knifeParts(64, 58, -45, 1.32)]);
  const sh = [[-23, -24], [23, -24], [24, 2], [13, 16], [0, 26], [-13, 16], [-24, 2]].map(q => [64 + q[0], 58 + q[1]]);
  s += render([{ pts: sh, m: MAT.silver, o: { bevel: 3, height: .2, ow: 3.5, seed: 460 } }]);
  s += gem(inset(sh, 6), MAT.navy, { bevel: 2, slope: -1.3, height: .05, subdiv: 1, outline: '#000', ow: 1.2, jitter: .35, seed: 461 });
  s += render([{ pts: starPoly(64, 56, 13.5, 5.7), m: MAT.ruby, o: { bevel: 1.5, height: .5, ow: 2.4 } }], { op: .5, dx: 1.2, dy: 1.6 });
  s += tab(3, 110, MAT.navy, MAT.silver).svg;
  return s;
}
function p4(ph, id) {
  let s = '';
  const C = [64, 57], leaves = [], stems = [];
  for (const side of [-1, 1]) {
    stems.push({ pts: arcPoly(C[0], C[1], 46, 43.6, side < 0 ? 100 : -66, side < 0 ? 246 : 80, 10), m: MAT.gold, o: { bevel: 0, height: .2, ow: 1.8, seed: 495 + side } });
    for (let i = 0; i < 9; i++) {
      const a = (side < 0 ? lerp(104, 244, i / 8) : lerp(76, -64, i / 8)) * D2R, rh = [Math.cos(a), Math.sin(a)];
      const tg = side < 0 ? [-Math.sin(a), Math.cos(a)] : [Math.sin(a), -Math.cos(a)];
      for (const io of [-1, 1]) {
        const sp = 30 * D2R, d = [tg[0] * Math.cos(sp) + rh[0] * io * Math.sin(sp), tg[1] * Math.cos(sp) + rh[1] * io * Math.sin(sp)], q = [-d[1], d[0]];
        const b = [C[0] + rh[0] * (45 + io * 1.2), C[1] + rh[1] * (45 + io * 1.2)];
        const p = (u, v) => [b[0] + d[0] * u + q[0] * v, b[1] + d[1] * u + q[1] * v];
        leaves.push({ pts: [p(0, 0), p(5, 3.2), p(11, 2.6), p(15.5, 0), p(11, -2.6), p(5, -3.2)], m: MAT.gold, o: { bevel: 0, height: .5, ow: 1.8, seed: 500 + i * 2 + (io > 0) + (side > 0 ? 40 : 0) } });
      }
    }
  }
  s += render([...stems, ...leaves], { op: .4 });
  const disc = regPoly(C[0], C[1], 36, 12, -90);
  s += render([{ pts: disc, m: MAT.gold, o: { bevel: 3, height: .12, ow: 3.5, seed: 530 } }]);
  s += gem(inset(disc, 6.5), MAT.navy, { bevel: 2, slope: -1.3, height: .05, subdiv: 1, outline: '#000', ow: 1.2, jitter: .35, seed: 531 });
  const star = starPoly(C[0], C[1] + 1, 25, 10.2);
  s += render([{ pts: star, m: MAT.gold, o: { bevel: 1.8, height: .5, ow: 2.6, seed: 532 } }], { op: .5, dx: 1.4, dy: 1.8 });
  s += glint(id + 'g', [disc, star], ph, .1);
  const t = tab(4, 110, MAT.navy, MAT.gold);
  s += t.svg + glint(id + 't', [t.sil], ph, .25, .25);
  return s;
}
function p5(ph, id) {
  let s = '';
  s += render([...boneParts(64, 60, 92, 40, MAT.bone), ...boneParts(64, 60, 92, -40, MAT.bone)]);
  const pl = regPoly(64, 58, 46, 4, -90);
  s += render([{ pts: pl, m: MAT.gold, o: { bevel: 3, height: .18, ow: 3.5, seed: 560 } }]);
  s += gem(inset(pl, 7), MAT.crimson, { bevel: 2.2, slope: -1.3, height: .05, subdiv: 1, outline: '#000', ow: 1.2, jitter: .35, seed: 561 });
  const sk = skullParts(64, 58, .78, MAT.bone);
  s += render(sk.parts, { op: .5 });
  const pulse = .5 + .5 * S(TAU * ph * 2);
  s += eyePixels(sk.eyes, .78, mixHex('#ff2a2a', '#ff9a8a', pulse), '#ff1a1a', .12 + .1 * pulse);
  s += glint(id + 'g', [pl, sk.whole], ph, .05);
  s += tab(5, 110, MAT.crimson, MAT.gold).svg;
  return s;
}
function p6(ph, id) {
  let s = '';
  const pulse = .5 + .5 * S(TAU * ph);
  s += sglow(64, 58, 60, '#2fd98a', .05 + .04 * pulse, 4, 12);
  s += render([{ pts: starPoly(64, 58, 56, 30, 6, -90), m: MAT.gold, o: { bevel: 2.4, height: .3, ow: 3.5, seed: 600 } }]);
  const set = regPoly(64, 58, 35, 6, -90), g = regPoly(64, 58, 28, 6, -90);
  s += render([{ pts: set, m: MAT.gold, o: { bevel: 2.6, height: .1, ow: 3, seed: 601 } }], { op: .3 });
  s += gem(g, mixMat(MAT.emerald, M('#0a4a2c', '#25c47a', '#7bffc2', '#ffffff'), pulse * .5), { bevel: 9, slope: .8, height: .12, ow: 2, seed: 602, jitter: .2 });
  const prongs = regPoly(64, 58, 30.5, 6, -90).map((v, i) => ({ pts: rot([[0, -5.5], [4, 0], [0, 4], [-4, 0]], i * 60).map(q => [v[0] + q[0], v[1] + q[1]]), m: MAT.gold, o: { bevel: 0, height: .5, ow: 1.8, seed: 610 + i } }));
  s += render(prongs, { shadow: false });
  s += glint(id + 'g', [g], ph, .2, .3);
  const tw = clamp(S(TAU * (ph - .55) * 4), 0, 1) * (ph > .55 && ph < .8 ? 1 : 0);
  s += twinkle(51, 45, 9 * tw, tw);
  const tw2 = clamp(S(TAU * (ph - .05) * 4), 0, 1) * (ph > .05 && ph < .3 ? 1 : 0);
  s += twinkle(79, 70, 7 * tw2, tw2);
  s += tab(6, 110, MAT.obsid, MAT.emerald).svg;
  return s;
}
function p7(ph, id) {
  let s = '';
  const pulse = .5 + .5 * S(TAU * ph);
  s += sglow(64, 58, 62, '#7fd0ff', .05 + .04 * pulse, 4, 12);
  const shards = [];
  for (let i = 0; i < 12; i++) { const a = i * 30 + ph * 30; shards.push({ pts: rot([[0, -60], [3.4, -51], [0, -45], [-3.4, -51]], a).map(q => [64 + q[0], 58 + q[1]]), m: MAT.ice, o: { bevel: 0, height: .5, ow: 1.8, seed: 700 } }); }
  s += render(shards, { op: .35 });
  const hot = Math.floor(ph * 6) % 6, hv = S(Math.PI * ((ph * 6) % 1));
  const flake = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 60, b = i === hot ? hv * .3 : 0;
    flake.push({ pts: rot([[0, -46], [5, -30], [0, -6], [-5, -30]], a).map(q => [64 + q[0], 58 + q[1]]), m: MAT.ice, o: { bevel: 1.2, height: .45, ow: 2.6, seed: 720 + i, bright: b } });
    for (const sd of [-1, 1]) { const base = rot([[0, -27]], a)[0], br = rot([[0, -1], [2.6, -6], [0, -14], [-2.6, -6]], a + sd * 52).map(q => [64 + base[0] + q[0], 58 + base[1] + q[1]]); flake.push({ pts: br, m: MAT.ice, o: { bevel: 0, height: .45, ow: 2, seed: 740 + i * 2 + (sd > 0), bright: b } }); }
  }
  s += render(flake, { op: .45 });
  const core = regPoly(64, 58, 16, 6, -90);
  s += render([{ pts: core, m: MAT.sapphire, o: { bevel: 4, slope: .9, height: .15, ow: 2.6, seed: 760 } }], { op: .4 });
  s += glint(id + 'g', [core], ph, .5, .25);
  s += tab(7, 110, MAT.steelb, MAT.ice).svg;
  return s;
}
function p8(ph, id) {
  let s = '';
  const pulse = .5 + .5 * S(TAU * ph * 2);
  s += sglow(64, 58, 64, '#a865ff', .05 + .05 * pulse, 5, 14);
  const ring = [];
  for (let i = 0; i < 8; i++) { const a0 = i * 45 - ph * 45 - 18; ring.push({ pts: arcPoly(64, 58, 56, 50, a0, a0 + 34, 3), m: MAT.amethyst, o: { bevel: 1, height: .3, ow: 2.2, seed: 800 } }); }
  s += render(ring, { op: .4 });
  const rim = regPoly(64, 58, 41, 10, -90);
  s += render([{ pts: rim, m: MAT.amethyst, o: { bevel: 3, height: .12, ow: 3.5, seed: 810 } }]);
  s += gem(inset(rim, 6), MAT.obsid, { bevel: 2.4, slope: -1.3, height: -.05, subdiv: 1, outline: '#000', ow: 1.2, jitter: .45, seed: 811 });
  s += sglow(64, 58, 30, '#c084ff', .08 + .08 * pulse, 4, 10);
  const sc = 1 + .08 * S(TAU * ph * 2), lens = [];
  for (let i = 0; i <= 5; i++) { const t = i / 5, x = lerp(-22, 22, t) * sc, y = -12 * sc * (1 - Math.pow(2 * t - 1, 2)); lens.push([64 + x, 58 + y]); }
  for (let i = 4; i >= 1; i--) { const t = i / 5, x = lerp(-22, 22, t) * sc, y = 12 * sc * (1 - Math.pow(2 * t - 1, 2)); lens.push([64 + x, 58 + y]); }
  s += render([{ pts: lens, m: mixMat(MAT.violet, MAT.amethyst, 1 - pulse), o: { bevel: 2, height: .2, ow: 2.4, seed: 820 } }], { shadow: false });
  s += gem(diamond(64, 58, 4.2 * sc, 10.5 * sc), MAT.obsid, { bevel: 0, height: .3, ow: 1.4, seed: 821 });
  s += flat(chamferRect(64, 58, 3.4, 3.4, 0), '#ffffff', .6 + .4 * pulse);
  const orb = [];
  for (let i = 0; i < 3; i++) { const a = ph * 120 + i * 120; orb.push({ pts: rot([[-8, -47], [0, -50.5], [8, -47], [0, -43.5]], a).map(q => [64 + q[0], 58 + q[1]]), m: MAT.violet, o: { bevel: 0, height: .5, ow: 2, seed: 830 } }); }
  s += render(orb, { op: .4 });
  s += tab(8, 110, MAT.obsid, MAT.amethyst).svg;
  return s;
}
function p9(ph, id) {
  let s = '';
  const rays = [];
  for (let i = 0; i < 16; i++) { const a = i * 22.5 + ph * 45, L = i % 2 ? 50 : 61; rays.push({ pts: rot([[0, -L], [6, -20], [-6, -20]], a).map(q => [64 + q[0], 60 + q[1]]), m: MAT.gold, o: { bevel: 0, height: .4, ow: 2, seed: 900 + (i % 2) } }); }
  s += render(rays, { shadow: false });
  s += render([...wingParts(-1, MAT.gold, { px: 44, py: 58, n: 5, a0: -64, a1: 20, L0: 44, L1: 24, w: 6.6, seed: 920 }), ...wingParts(1, MAT.gold, { px: 84, py: 58, n: 5, a0: -64, a1: 20, L0: 44, L1: 24, w: 6.6, seed: 940 })]);
  const sh = [[-27, -25], [27, -25], [28, 4], [17, 21], [0, 33], [-17, 21], [-28, 4]].map(q => [64 + q[0], 66 + q[1]]);
  s += render([{ pts: sh, m: MAT.gold, o: { bevel: 3, height: .18, ow: 3.5, seed: 960 } }]);
  s += gem(inset(sh, 6), MAT.obsid, { bevel: 2.2, slope: -1.3, height: .05, subdiv: 1, outline: '#000', ow: 1.2, jitter: .4, seed: 961 });
  const sk = skullParts(64, 71, .58, MAT.gold, { ow: 2.6 });
  s += render(sk.parts, { op: .5 });
  const pulse = .5 + .5 * S(TAU * ph * 2);
  s += eyePixels(sk.eyes, .58, mixHex('#fff1a8', '#ffffff', pulse), '#ffd24a', .14 + .1 * pulse);
  const crown = [[46, 50], [82, 50], [85, 31], [75, 39], [64, 23], [53, 39], [43, 31]];
  s += render([{ pts: crown, m: MAT.gold, o: { bevel: 2, height: .25, ow: 3, seed: 970, mode: 'ear', dome: .5 } }], { op: .5 });
  s += render([[43, 30], [64, 22], [85, 30]].map((c, i) => ({ pts: diamond(c[0], c[1], 3.6, 4.4), m: MAT.ruby, o: { bevel: 0, height: .5, ow: 1.8, seed: 975 + i } })), { shadow: false });
  s += render([{ pts: diamond(64, 44, 3.2, 3.6), m: MAT.ruby, o: { bevel: 0, height: .5, ow: 1.6 } }], { shadow: false });
  s += glint(id + 'g', [sh, crown, sk.whole], ph, .15, .3);
  s += tab(9, 112, MAT.obsid, MAT.gold).svg;
  return s;
}
function p10(ph, id) {
  let s = '';
  const pulse = .5 + .5 * S(TAU * ph * 2), R = rng(777), CY = 66;
  s += sglow(64, CY - 4, 66, '#ff4d00', .07 + .05 * pulse, 5, 16);
  // slow-turning ember shards (2-ray pattern, 60° per loop → seamless)
  for (let i = 0; i < 12; i++) { const a = i * 30 + ph * 60, L = i % 2 ? 52 : 63; s += flat(rot([[0, -L], [5, -26], [-5, -26]], a).map(q => [64 + q[0], CY - 4 + q[1]]), i % 2 ? '#6e1000' : '#a82400', .6); }
  const ember = (i, front) => {
    const k = 1 + (i % 2), off = R(), x0 = 10 + R() * 108, amp = 3 + R() * 6, sz = 1.7 + R() * 2;
    const u = (ph * k + off) % 1, y = lerp(122, 4, u), x = x0 + amp * S(TAU * (u + off * 3)), z = sz * Math.min(1, u * 8) * Math.min(1, (1 - u) * 4) * (1 - u * .6);
    if (z < .25) return '';
    const c = u < .3 ? '#fff0a0' : u < .6 ? '#ffb020' : '#ff5a14';
    return flat(diamond(x, y, z * 1.6, z * 2.4), '#ff3a00', front ? .35 : .25) + flat(diamond(x, y, z, z * 1.5), c, front ? 1 : .8);
  };
  for (let i = 0; i < 10; i++) s += ember(i, false);
  // wings of fire: dark-red feathers with white-hot cores; feathers sway, wings flap
  const flap = 5 * S(TAU * ph);
  for (const side of [-1, 1]) {
    const base = { px: 64 + side * 22, py: CY, n: 6, a0: -50, a1: 30, w: 7.2, flap, sway: i => 4.5 * S(TAU * (ph * 2) + i * .9), len: i => 1 + .09 * S(TAU * (ph * 3) + i * 1.7) };
    s += render(wingParts(side, MAT.fireR, { ...base, L0: 49, L1: 28, mf: i => (i % 2 ? MAT.lava : MAT.fireR), mc: MAT.lava, oc: '#2a0400', ow: 2, seed: 1000 + side * 50 }), { shadow: false });
    s += render(wingParts(side, MAT.fireY, { ...base, L0: 34, L1: 19, w: 3.3, fb: 0, oc: false, noCovert: true, seed: 1100 + side * 50 }), { shadow: false });
  }
  // flame crest: three layers of flickering tongues, tallest at the centre
  const layers = [[], [], []], NT = 7;
  for (let i = 0; i < NT; i++) {
    const u = i / (NT - 1), ang = lerp(-146, -34, u), bx = 64 + Math.cos(ang * D2R) * 24, by = CY + Math.sin(ang * D2R) * 24, up = 1 - Math.abs(u - .5) * 2, dirA = lerp(ang, -90, .72);
    const fl = S(TAU * (ph * 3 + i * .37)), fl2 = S(TAU * (ph * 2 + i * .61)), L = (17 + up * 16) * (1 + .15 * fl), bend = 6 * fl2, w = 7.5 + up * 3;
    layers[0].push({ pts: tongue(bx, by, dirA, L, w, bend), m: MAT.fireR, o: { bevel: 0, height: .3, ow: 2, outline: '#2a0400', seed: 1200 + i } });
    layers[1].push({ pts: tongue(bx, by, dirA, L * .74, w * .7, bend * .8), m: MAT.lava, o: { bevel: 0, height: .3, outline: false, seed: 1300 + i } });
    layers[2].push({ pts: tongue(bx, by, dirA, L * .46, w * .42, bend * .6), m: MAT.fireY, o: { bevel: 0, height: .3, outline: false, seed: 1400 + i } });
  }
  s += layers.map(l => render(l, { shadow: false })).join('');
  // twin comets on a tilted orbit — back half behind the plate, front half over it
  const comet = (front) => {
    let o = '';
    for (let k = 0; k < 2; k++) for (let j = 7; j >= 0; j--) {
      const th = TAU * (ph + k / 2) - j * .11, sn = Math.sin(th);
      if ((sn >= 0) !== front) continue;
      const ex = Math.cos(th) * 44, ey = sn * 12, c = Math.cos(-16 * D2R), sv = Math.sin(-16 * D2R);
      const x = 64 + ex * c - ey * sv, y = CY + 2 + ex * sv + ey * c, dep = .5 + .5 * sn, z = (j === 0 ? 3.2 : 2.6 * (1 - j / 9)) * (.8 + .2 * dep);
      o += flat(chamferRect(x, y, z * 2, z * 2, 0), j === 0 ? '#ffffff' : j < 3 ? '#ffe066' : '#ff7a1a', (1 - j / 8) * (.7 + .3 * dep));
    }
    return o;
  };
  s += comet(false);
  // molten plate + obsidian skull
  const pl = regPoly(64, CY, 31, 6, -90);
  s += render([{ pts: pl, m: mixMat(MAT.lava, MAT.fireY, pulse * .45), o: { bevel: 3, height: .16, ow: 3.5, seed: 1500 } }], { op: .55 });
  s += gem(inset(pl, 5.5), MAT.obsid, { bevel: 2, slope: -1.3, height: .05, subdiv: 1, outline: '#000', ow: 1.2, jitter: .45, seed: 1501 });
  s += sglow(64, CY, 26, '#ff5a00', .07 + .07 * pulse, 3, 6);
  const sk = skullParts(64, CY + 1, .6, MAT.magma, { ow: 2.6, socket: M('#000000', '#0a0505', '#1a0c08', '#2a120a') });
  s += render(sk.parts, { op: .5 });
  s += eyePixels(sk.eyes, .6, mixHex('#ffcf3a', '#ffffff', pulse), '#ff7a00', .22 + .12 * pulse);
  s += comet(true);
  for (let i = 10; i < 22; i++) s += ember(i, true);
  const t = tab(10, 113, MAT.obsid, mixMat(MAT.lava, MAT.fireY, .4 + .4 * pulse));
  s += t.svg + glint(id + 't', [t.sil], ph, .4, .28) + glint(id + 'g', [sk.whole, pl], ph, .62, .28);
  return s;
}

const PRESTIGE = [
  { name: 'Iron Sight', material: 'Steel', fn: p1, animated: false },
  { name: 'Bronze Wing', material: 'Bronze', fn: p2, animated: false },
  { name: 'Silver Blade', material: 'Silver', fn: p3, animated: false },
  { name: 'Gold Laurel', material: 'Gold', fn: p4, animated: true },
  { name: 'Crimson Reaper', material: 'Ruby', fn: p5, animated: true },
  { name: 'Emerald Venom', material: 'Emerald', fn: p6, animated: true },
  { name: 'Sapphire Cryo', material: 'Sapphire', fn: p7, animated: true },
  { name: 'Amethyst Void', material: 'Amethyst', fn: p8, animated: true },
  { name: 'Obsidian Sovereign', material: 'Obsidian & Gold', fn: p9, animated: true },
  { name: 'Inferno', material: 'Molten', fn: p10, animated: true },
];
function prestigeBadge(n, ph = STATIC_PHASE, idSuffix = '') { const p = PRESTIGE[clamp(n | 0, 1, 10) - 1]; return wrap(p.fn(((ph % 1) + 1) % 1, 'dpp' + n + idSuffix)); }

const api = { levelBadge, prestigeBadge, rankOf, RANKS: RANKS.map(({ name, abbr, fam }) => ({ name, abbr, family: FAM[fam].name })), PRESTIGE: PRESTIGE.map(({ name, material, animated }) => ({ name, material, animated })), LOOP, FRAMES, STATIC_PHASE };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DeadPixelsBadges = api;
})(typeof window !== 'undefined' ? window : globalThis);
