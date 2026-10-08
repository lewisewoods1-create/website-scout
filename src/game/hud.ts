import type { Box } from './map';

const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; font-weight: 600; color: #ece6d4;
  text-shadow: 0 1px 3px rgba(0,0,0,.8); user-select: none; font-variant-numeric: tabular-nums; }
#hud .vignette { position: absolute; inset: 0; opacity: 0; transition: opacity .15s;
  background: radial-gradient(ellipse at center, rgba(120,0,0,0) 35%, rgba(150,0,0,.55) 75%, rgba(90,0,0,.9) 100%); }
#hud .xhair { position: absolute; left: 50%; top: 50%; }
#hud .xhair i { position: absolute; background: #f2ecd8; box-shadow: 0 0 0 1px rgba(0,0,0,.6); }
#hud .xhair .t, #hud .xhair .b { width: 2px; height: 9px; left: -1px; }
#hud .xhair .l, #hud .xhair .r { width: 9px; height: 2px; top: -1px; }
#hud .hit { position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px; opacity: 0; }
#hud .hit::before, #hud .hit::after { content: ''; position: absolute; left: 12px; top: -2px; width: 2px; height: 30px;
  background: linear-gradient(#fff 0 35%, transparent 35% 65%, #fff 65%); transform: rotate(45deg); }
#hud .hit::after { transform: rotate(-45deg); }
#hud .hit.kill::before, #hud .hit.kill::after { background: linear-gradient(#ff3b2a 0 35%, transparent 35% 65%, #ff3b2a 65%); }
#hud .ammo { position: absolute; right: 36px; bottom: 28px; text-align: right; }
#hud .ammo .n { font-size: 52px; line-height: .8; }
#hud .ammo .n small { font-size: 25px; opacity: .7; }
#hud .ammo .w { font-size: 18px; letter-spacing: 2px; opacity: .85; }
#hud .ammo .bullets { display: flex; gap: 2px; justify-content: flex-end; margin-top: 6px; }
#hud .ammo .bullets b { width: 3px; height: 12px; background: #d8c48a; }
#hud .ammo .bullets b.spent { background: rgba(255,255,255,.12); }
#hud .ammo .low { color: #ff5a3a; font-size: 18px; }
#hud .rank { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); width: min(520px, 60vw); text-align: center; font-size: 15px; }
#hud .rank .bar { height: 5px; background: rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.25); margin-top: 3px; }
#hud .rank .bar i { display: block; height: 100%; background: #e0b23c; width: 0; transition: width .4s; }
#hud .score { position: absolute; left: 196px; top: 16px; font-size: 18px; line-height: 1.1; }
#hud .score .big { font-size: 28px; }
#hud .feed { position: absolute; right: 20px; top: 16px; font-size: 17px; text-align: right; }
#hud .feed div { animation: feedIn .2s; }
#hud .feed .you { color: #9fd36b; }
#hud .feed .enemy { color: #ff6b4a; }
#hud .popups { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); text-align: center; }
#hud .popups div { font-size: 23px; color: #f2d36b; animation: pop 1.2s forwards; }
#hud .popups div.hs { color: #ff9a5a; }
#hud .banner { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); text-align: center; opacity: 0; transition: opacity .3s; }
#hud .banner .t { font-size: 36px; color: #f2d36b; letter-spacing: 3px; }
#hud .banner .s { font-size: 18px; }
#hud .streak { position: absolute; right: 36px; bottom: 150px; font-size: 16px; text-align: right; }
#hud .streak .ready { color: #9fd36b; animation: blink 1s infinite; }
#hud .dmg { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
#hud .dmg i { position: absolute; left: -60px; top: -170px; width: 120px; height: 30px; border-radius: 50% 50% 0 0;
  border-top: 6px solid rgba(255,40,20,.85); opacity: 0; transition: opacity .6s; }
#hud .reload { position: absolute; left: 50%; top: 62%; transform: translateX(-50%); font-size: 20px; opacity: 0; }
#hud canvas.map { position: absolute; left: 16px; top: 16px; width: 168px; height: 168px; border: 2px solid rgba(232,226,208,.4);
  background: rgba(10,14,10,.55); }
#hud .dead { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column;
  background: rgba(60,0,0,.35); font-size: 25px; }
#hud .dead .t { font-size: 52px; color: #ff5a3a; letter-spacing: 4px; }
#hud .match { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); display: flex; gap: 14px; align-items: center; font-size: 21px; }
#hud .match .a { color: #7ec8ff; } #hud .match .e { color: #ff6b4a; } #hud .match .clock { font-size: 18px; opacity: .85; }
#hud .match .bar { width: 110px; height: 6px; background: rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.2); }
#hud .match .bar i { display: block; height: 100%; }
#hud .tags { position: absolute; inset: 0; }
#hud .tags div { position: absolute; transform: translate(-50%, -100%); font-size: 15px; white-space: nowrap; }
#hud .tags .f { color: #7ec8ff; } #hud .tags .e { color: #ff5a3a; }
#hud .tags .f::after { content: ''; display: block; margin: 1px auto 0; width: 0; border: 5px solid transparent; border-top-color: #7ec8ff; }
#hud .board { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(8,8,10,.86);
  border: 1px solid rgba(232,226,208,.3); padding: 14px 18px; display: none; gap: 20px; font-size: 16px; }
#hud .board table { border-collapse: collapse; min-width: 300px; }
#hud .board th { text-align: left; font-weight: normal; opacity: .6; padding: 2px 10px; }
#hud .board td { padding: 2px 10px; font-variant-numeric: tabular-nums; }
#hud .board tr.me td { background: rgba(242,211,107,.18); }
#hud .board h3 { margin: 0 0 6px; font-weight: normal; font-size: 21px; }
#hud .end { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column;
  background: rgba(5,3,4,.82); pointer-events: auto; gap: 12px; }
#hud .end .t { font-size: 69px; letter-spacing: 6px; line-height: .9; }
#hud .end .win { color: #f2d36b; } #hud .end .lose { color: #ff5a3a; }
#hud .end button { font-family: inherit; font-size: 26px; letter-spacing: 4px; padding: 4px 34px; cursor: pointer;
  background: #f2d36b; color: #1a1210; border: none; box-shadow: 5px 5px 0 #6b1a10; }
#hud .picker { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 18px;
  background: radial-gradient(ellipse at center, rgba(5,3,4,.55), rgba(5,3,4,.85)); pointer-events: auto; }
#hud .picker h2 { margin: 0; font-size: 44px; font-weight: 800; color: #f2d36b; letter-spacing: 2px; }
#hud .picker .sub { font-size: 17px; opacity: .75; font-family: 'Barlow', sans-serif; font-weight: 500; }
#hud .picker .cards { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; padding: 0 16px; }
#hud .picker button { all: unset; cursor: pointer; width: 230px; padding: 14px 16px; border: 1px solid rgba(232,226,208,.3); background: rgba(12,9,11,.85);
  display: flex; flex-direction: column; gap: 4px; box-sizing: border-box; transition: border-color .15s, transform .15s; }
#hud .picker button:hover, #hud .picker button:focus-visible { border-color: #f2d36b; transform: translateY(-3px); }
#hud .picker button .k { font-size: 14px; color: #f2d36b; letter-spacing: 2px; }
#hud .picker button b { font-size: 26px; font-weight: 800; letter-spacing: .5px; }
#hud .picker button span { font-family: 'Barlow', sans-serif; font-weight: 500; font-size: 13px; opacity: .75; line-height: 1.4; }
#hud .hint { position: absolute; left: 16px; top: 190px; font-size: 13px; opacity: .6; letter-spacing: 1px; }
#hud .dead .cls { font-size: 16px; opacity: .85; margin-top: 10px; font-family: 'Barlow', sans-serif; }
#hud .dead .cls b { color: #f2d36b; }
@keyframes pop { 0% { transform: scale(1.4); opacity: 0 } 12% { transform: scale(1); opacity: 1 } 75% { opacity: 1 } 100% { opacity: 0; transform: translateY(-24px) } }
@keyframes feedIn { from { transform: translateX(20px); opacity: 0 } }
@keyframes blink { 50% { opacity: .4 } }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  parent.appendChild(e);
  return e;
}

export interface MapMarker {
  x: number;
  z: number;
  color: string;
}

export class Hud {
  readonly root: HTMLDivElement;
  private vignette: HTMLDivElement;
  private xhair: HTMLDivElement;
  private xh: HTMLElement[];
  private hit: HTMLDivElement;
  private ammoN: HTMLDivElement;
  private ammoW: HTMLDivElement;
  private bullets: HTMLDivElement;
  private rankText: HTMLDivElement;
  private rankBar: HTMLElement;
  private score: HTMLDivElement;
  private feed: HTMLDivElement;
  private popups: HTMLDivElement;
  private banner: HTMLDivElement;
  private streak: HTMLDivElement;
  private dmg: HTMLDivElement;
  private reload: HTMLDivElement;
  private dead: HTMLDivElement;
  private map: HTMLCanvasElement;
  private mapCtx: CanvasRenderingContext2D;
  private match: HTMLDivElement;
  private tagLayer: HTMLDivElement;
  private tagEls: HTMLDivElement[] = [];
  private board: HTMLDivElement;
  private end: HTMLDivElement;
  private picker: HTMLDivElement;
  private hitT = 0;
  private bannerT = 0;
  private dmgArcs: { e: HTMLElement; t: number; angle: number }[] = [];

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = el('div', '', document.body);
    this.root.id = 'hud';
    this.vignette = el('div', 'vignette', this.root);
    this.dmg = el('div', 'dmg', this.root);
    this.xhair = el('div', 'xhair', this.root);
    this.xh = ['t', 'b', 'l', 'r'].map((c) => el('i', c, this.xhair));
    this.hit = el('div', 'hit', this.root);
    const ammo = el('div', 'ammo', this.root);
    this.ammoN = el('div', 'n', ammo);
    this.bullets = el('div', 'bullets', ammo);
    this.ammoW = el('div', 'w', ammo);
    this.reload = el('div', 'reload', this.root, 'RELOADING');
    const rank = el('div', 'rank', this.root);
    rank.style.display = 'none';
    this.rankText = el('div', '', rank);
    this.rankBar = el('i', '', el('div', 'bar', rank));
    this.score = el('div', 'score', this.root);
    this.feed = el('div', 'feed', this.root);
    this.popups = el('div', 'popups', this.root);
    this.banner = el('div', 'banner', this.root);
    this.streak = el('div', 'streak', this.root);
    this.dead = el('div', 'dead', this.root, '<div class="t">K.I.A.</div><div class="s"></div><div class="cls"></div>');
    this.tagLayer = el('div', 'tags', this.root);
    this.match = el('div', 'match', this.root);
    this.board = el('div', 'board', this.root);
    this.end = el('div', 'end', this.root);
    this.picker = el('div', 'picker', this.root);
    el('div', 'hint', this.root, 'TAB · SCOREBOARD');
    this.map = el('canvas', 'map', this.root);
    this.map.width = 168;
    this.map.height = 168;
    this.mapCtx = this.map.getContext('2d')!;
  }

  setVisible(v: boolean) {
    this.root.style.display = v ? '' : 'none';
  }

  crosshair(spreadPx: number, ads: number, hidden: boolean) {
    this.xhair.style.opacity = hidden ? '0' : String(1 - ads);
    const g = 6 + spreadPx;
    const [t, b, l, r] = this.xh;
    t.style.top = `${-g - 9}px`;
    b.style.top = `${g}px`;
    l.style.left = `${-g - 9}px`;
    r.style.left = `${g}px`;
  }

  hitmarker(kill: boolean) {
    this.hit.classList.toggle('kill', kill);
    this.hitT = kill ? 0.35 : 0.2;
  }

  ammo(name: string, ammo: number, reserve: number, mag: number, reloading: boolean) {
    this.ammoN.innerHTML = `${ammo}<small> / ${reserve}</small>`;
    this.ammoW.textContent = name;
    if (this.bullets.childElementCount !== mag) {
      this.bullets.innerHTML = '';
      for (let i = 0; i < mag; i++) el('b', '', this.bullets);
    }
    for (let i = 0; i < mag; i++) (this.bullets.children[i] as HTMLElement).className = i < mag - ammo ? 'spent' : '';
    this.reload.style.opacity = reloading ? '1' : ammo === 0 ? '1' : '0';
    this.reload.textContent = reloading ? 'RELOADING' : reserve > 0 ? 'PRESS [R] TO RELOAD' : 'NO AMMO';
    this.ammoN.style.color = ammo <= mag * 0.2 ? '#ff5a3a' : '';
  }

  rank(level: number, xpIn: number, xpNeed: number, next: string) {
    this.rankText.innerHTML = `LVL ${level} &nbsp;·&nbsp; ${xpIn} / ${xpNeed} XP${next ? ` &nbsp;·&nbsp; <span style="opacity:.7">NEXT: ${next}</span>` : ''}`;
    this.rankBar.style.width = `${Math.min(100, (xpIn / Math.max(1, xpNeed)) * 100)}%`;
  }

  scoreboard(kills: number, deaths: number, streak: number, matchXp: number) {
    this.score.innerHTML = `<div class="big">${matchXp} XP</div>K ${kills} &nbsp; D ${deaths}<br>STREAK ${streak}`;
  }

  killfeed(html: string) {
    const d = el('div', '', this.feed, html);
    setTimeout(() => d.remove(), 5000);
    while (this.feed.childElementCount > 5) this.feed.firstElementChild?.remove();
  }

  popup(text: string, cls = '') {
    const d = el('div', cls, this.popups, text);
    setTimeout(() => d.remove(), 1200);
  }

  showBanner(title: string, sub: string, secs = 3) {
    this.banner.innerHTML = `<div class="t">${title}</div><div class="s">${sub}</div>`;
    this.bannerT = secs;
  }

  streakInfo(html: string) {
    this.streak.innerHTML = html;
  }

  damageFrom(angle: number) {
    const e = el('i', '', this.dmg);
    e.style.transformOrigin = '60px 170px';
    this.dmgArcs.push({ e, t: 1.2, angle });
  }

  deadScreen(show: boolean, text = '', classHtml = '') {
    this.dead.style.display = show ? 'flex' : 'none';
    if (!show) return;
    (this.dead.querySelector('.s') as HTMLElement).textContent = text;
    const c = this.dead.querySelector('.cls') as HTMLElement;
    if (c.innerHTML !== classHtml) c.innerHTML = classHtml;
  }

  /** Choose-class overlay; cards are [title, detail] pairs. */
  classPicker(cards: [string, string][] | null, onPick?: (i: number) => void, title = 'CHOOSE CLASS', sub = '') {
    this.picker.style.display = cards ? 'flex' : 'none';
    if (!cards) return;
    this.picker.innerHTML = `<h2>${title}</h2><div class="sub">${sub}</div><div class="cards">${cards
      .map(([t, d], i) => `<button type="button" data-i="${i}"><span class="k">[${i + 1}]</span><b>${t}</b><span>${d}</span></button>`)
      .join('')}</div>`;
    this.picker.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => onPick?.(Number(b.dataset.i))));
  }

  matchBar(html: string) {
    if (this.match.innerHTML !== html) this.match.innerHTML = html;
  }

  /** Name tags in screen pixels. */
  tags(list: { x: number; y: number; text: string; friendly: boolean }[]) {
    while (this.tagEls.length < list.length) this.tagEls.push(el('div', '', this.tagLayer));
    this.tagEls.forEach((e, i) => {
      const t = list[i];
      if (!t) {
        e.style.display = 'none';
        return;
      }
      e.style.display = '';
      e.className = t.friendly ? 'f' : 'e';
      e.textContent = t.text;
      e.style.left = `${t.x}px`;
      e.style.top = `${t.y}px`;
    });
  }

  scoreboardTable(show: boolean, html = '') {
    this.board.style.display = show ? 'flex' : 'none';
    if (show && this.board.innerHTML !== html) this.board.innerHTML = html;
  }

  endScreen(html: string | null, onContinue?: () => void) {
    this.end.style.display = html ? 'flex' : 'none';
    if (!html) return;
    this.end.innerHTML = html + '<button type="button">CONTINUE</button>';
    this.end.querySelector('button')!.addEventListener('click', () => onContinue?.());
  }

  update(dt: number, health: number, attackerAngle: (a: number) => number) {
    this.hitT -= dt;
    this.hit.style.opacity = this.hitT > 0 ? '1' : '0';
    this.bannerT -= dt;
    this.banner.style.opacity = this.bannerT > 0 ? '1' : '0';
    this.vignette.style.opacity = String(Math.min(1, ((100 - health) / 100) * 1.3));
    for (const a of this.dmgArcs) {
      a.t -= dt;
      a.e.style.opacity = String(Math.max(0, Math.min(1, a.t)));
      a.e.style.transform = `rotate(${attackerAngle(a.angle)}rad)`;
    }
    this.dmgArcs = this.dmgArcs.filter((a) => {
      if (a.t <= 0) a.e.remove();
      return a.t > 0;
    });
  }

  /** Rotating radar: player-up, enemies shown when they fire or during SWEEP. */
  minimap(boxes: Box[], half: number, px: number, pz: number, yaw: number, enemies: MapMarker[], sweepK: number) {
    const c = this.mapCtx;
    const S = 168;
    const scale = 2.6; // px per metre
    c.clearRect(0, 0, S, S);
    c.save();
    c.translate(S / 2, S / 2);
    c.rotate(yaw);
    c.scale(scale, scale);
    c.translate(-px, -pz);
    c.fillStyle = 'rgba(190,200,170,0.45)';
    for (const b of boxes) {
      if (b.max.y < 0.5 || b.max.x - b.min.x > half) continue;
      c.fillRect(b.min.x, b.min.z, b.max.x - b.min.x, b.max.z - b.min.z);
    }
    c.strokeStyle = 'rgba(190,200,170,0.7)';
    c.lineWidth = 0.6;
    c.strokeRect(-half, -half, half * 2, half * 2);
    for (const e of enemies) {
      c.fillStyle = e.color;
      c.beginPath();
      c.arc(e.x, e.z, 1.1, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    if (sweepK > 0) {
      c.strokeStyle = `rgba(160,255,120,${0.5 * sweepK})`;
      c.beginPath();
      c.arc(S / 2, S / 2, ((performance.now() / 8) % 120) + 4, 0, Math.PI * 2);
      c.stroke();
    }
    // player arrow
    c.fillStyle = '#f2e9c8';
    c.beginPath();
    c.moveTo(S / 2, S / 2 - 7);
    c.lineTo(S / 2 + 5, S / 2 + 5);
    c.lineTo(S / 2, S / 2 + 2);
    c.lineTo(S / 2 - 5, S / 2 + 5);
    c.fill();
  }
}
