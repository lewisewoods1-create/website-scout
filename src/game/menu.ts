import * as THREE from 'three';
import type { Game, MatchConfig, Mode, DifficultyId, Settings } from './game';
import { DIFFICULTIES, MODES } from './game';
import {
  CAMOS, MUZZLES, OPTICS, PERKS1, PERKS2, PERKS3, UNDERS, WEAPONS, saveClasses, type Loadout, type WeaponId,
} from './loadout';
import { buildWeapon, cfgFromLoadout } from './weapons';
import { levelForXp, xpForLevel, UNLOCKS, MAX_LEVEL } from './progression';

type Tab = 'mp' | 'bots' | 'cac' | 'barracks' | 'settings' | 'resume' | 'quit';

interface Ctx {
  game: Game;
  classes: Loadout[];
  settings: Settings;
  saveSettings(): void;
  startMatch(cfg: MatchConfig): void;
  resume(): void;
  quit(): void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Front-end: main menu, pause menu, create-a-class with a live 3D preview. */
export class Menu {
  private root = document.getElementById('menu') as HTMLDivElement;
  private ctx: Ctx;
  private context: 'main' | 'pause' = 'main';
  private tab: Tab = 'bots';
  private mode: Mode = 'tdm';
  private difficulty: DifficultyId = 'regular';
  private classIndex = 0;
  private editIndex = 0;
  private preview: Preview | null = null;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  get isOpen() {
    return this.root.classList.contains('open');
  }

  open(context: 'main' | 'pause') {
    this.context = context;
    this.tab = context === 'pause' ? 'resume' : this.tab === 'resume' ? 'bots' : this.tab;
    this.root.classList.add('open');
    this.render(true);
  }

  close() {
    this.root.classList.remove('open');
    this.preview?.stop();
  }

  private level() {
    return this.ctx.settings.unlockAll ? MAX_LEVEL : levelForXp(this.ctx.game.profileSummary().xp);
  }

  private render(animateNav = false) {
    const pause = this.context === 'pause';
    this.root.classList.toggle('static', !animateNav);
    const items: [Tab, string, string][] = pause
      ? [['resume', 'RESUME', ''], ['cac', 'CREATE A CLASS', 'next spawn'], ['settings', 'SETTINGS', ''], ['quit', 'QUIT MATCH', '']]
      : [['mp', 'MULTIPLAYER', 'offline'], ['bots', 'BOT MATCH', ''], ['cac', 'CREATE A CLASS', ''], ['barracks', 'BARRACKS', ''], ['settings', 'SETTINGS', '']];
    const title = 'DEAD PIXEL'
      .split('')
      .map((ch, i) => `<span style="animation-delay:${animateNav ? i * 0.05 : 0}s">${ch === ' ' ? '&nbsp;' : ch}</span>`)
      .join('');
    const p = this.ctx.game.profileSummary();
    const base = xpForLevel(p.level);
    const need = p.level >= MAX_LEVEL ? 1 : xpForLevel(p.level + 1) - base;
    this.root.innerHTML = `
      <div class="left">
        <h1 class="title glitch">${title}</h1>
        <div class="tag">${pause ? 'PAUSED' : 'PS1 WORLD · MODERN KIT'}</div>
        <nav>${items
          .map(([id, label, small], i) => `<button type="button" data-tab="${id}" class="${this.tab === id ? 'on' : ''}" style="animation-delay:${animateNav ? 0.35 + i * 0.07 : 0}s">${label}${small ? `<small>${small}</small>` : ''}</button>`)
          .join('')}</nav>
      </div>
      <div class="panel" id="panel">${this.panelHtml()}</div>
      <div class="profilebar"><span class="lvl">LVL ${p.level}</span><div class="xp"><i style="width:${((p.xp - base) / need) * 100}%"></i></div>
        <span>${p.xp.toLocaleString()} XP · ${p.kills} KILLS · K/D ${p.deaths ? (p.kills / p.deaths).toFixed(2) : p.kills}</span></div>`;
    this.root.querySelectorAll<HTMLButtonElement>('nav button').forEach((b) =>
      b.addEventListener('click', () => this.select(b.dataset.tab as Tab)),
    );
    this.root.querySelectorAll<HTMLButtonElement>('nav button').forEach((b) => b.addEventListener('mouseenter', () => this.ctx.game.sfx.uiMove()));
    this.bindPanel();
  }

  private select(t: Tab) {
    this.ctx.game.sfx.uiSelect();
    if (t === 'resume') return this.ctx.resume();
    if (t === 'quit') return this.ctx.quit();
    this.tab = t;
    this.render();
  }

  // ------------------------------------------------------------------ panels

  private panelHtml(): string {
    switch (this.tab) {
      case 'mp':
        return `<h2>MULTIPLAYER</h2><div class="sub">Online play arrives in Phase 2: matchmaking, parties, 6v6 on dedicated servers.</div>
          ${['TEAM DEATHMATCH · 6v6', 'FREE-FOR-ALL · 12 PLAYERS', 'DOMINATION · 6v6', 'SEARCH & DESTROY · 6v6', 'GROUND WAR · 9v9']
            .map((n) => `<div class="playlist"><span>${n}</span><span class="chip">OFFLINE</span></div>`)
            .join('')}
          <div class="row"><button class="go" type="button" disabled>FIND MATCH</button>
          <button class="go" type="button" data-act="tobots" style="background:transparent;color:var(--gold);box-shadow:inset 0 0 0 2px var(--gold)">PLAY BOTS INSTEAD</button></div>`;
      case 'bots': {
        const modes = (Object.keys(MODES) as Mode[])
          .map((m) => `<button type="button" class="card ${this.mode === m ? 'on' : ''}" data-mode="${m}"><b>${MODES[m].label}</b><span>${MODES[m].desc}</span><span>${MODES[m].minutes} MIN LIMIT</span></button>`)
          .join('');
        const diffs = (Object.keys(DIFFICULTIES) as DifficultyId[])
          .map((d) => `<button type="button" class="card ${this.difficulty === d ? 'on' : ''}" data-diff="${d}"><b>${DIFFICULTIES[d].label}</b></button>`)
          .join('');
        return `<h2>BOT MATCH</h2><div class="sub">Depot · dusk. Bots fight each other and you.</div>
          <div class="label">GAME MODE</div><div class="grid2">${modes}</div>
          <div class="label">BOT DIFFICULTY</div><div class="row">${diffs}</div>
          <div class="label">CLASS</div><div class="grid2">${this.classCards(this.classIndex, 'pick')}</div>
          <button class="go" type="button" data-act="start">START MATCH</button>`;
      }
      case 'cac':
        return this.cacHtml();
      case 'barracks': {
        const p = this.ctx.game.profileSummary();
        const rows = Object.entries(UNLOCKS)
          .map(([l, u]) => `<div class="playlist"><span>LVL ${l} · ${u}</span><span class="chip ${p.level >= Number(l) ? 'ok' : ''}">${p.level >= Number(l) ? 'UNLOCKED' : 'LOCKED'}</span></div>`)
          .join('');
        return `<h2>BARRACKS</h2><div class="sub">Level ${p.level} of ${MAX_LEVEL} · ${p.xp.toLocaleString()} XP</div>
          <div class="grid2">
            <div class="card"><b>${p.kills}</b><span>KILLS</span></div><div class="card"><b>${p.deaths}</b><span>DEATHS</span></div>
            <div class="card"><b>${p.headshots}</b><span>HEADSHOTS</span></div><div class="card"><b>${p.bestStreak}</b><span>BEST STREAK</span></div>
          </div><div class="label">UNLOCK TRACK</div>${rows}`;
      }
      case 'settings': {
        const s = this.ctx.settings;
        return `<h2>SETTINGS</h2><div class="settings">
          <label for="s-sens">SENSITIVITY</label><input id="s-sens" type="range" min="0.2" max="3" step="0.05" value="${s.sensitivity}"><span id="s-sens-v">${s.sensitivity.toFixed(2)}</span>
          <label for="s-fov">FIELD OF VIEW</label><input id="s-fov" type="range" min="65" max="100" step="1" value="${s.fov}"><span id="s-fov-v">${s.fov}°</span>
          <label for="s-vol">VOLUME</label><input id="s-vol" type="range" min="0" max="1" step="0.05" value="${s.volume}"><span id="s-vol-v">${Math.round(s.volume * 100)}%</span>
          <label for="s-res">WORLD RESOLUTION</label><select id="s-res">${[240, 360, 480, 720].map((r) => `<option value="${r}" ${s.lowHeight === r ? 'selected' : ''}>${r}p${r === 240 ? ' (true PS1)' : r === 480 ? ' (default)' : ''}</option>`).join('')}</select><span></span>
          <label for="s-dither">DITHERING</label><input id="s-dither" type="checkbox" ${s.dither ? 'checked' : ''}><span></span>
          <label for="s-unlock">UNLOCK ALL (TESTING)</label><input id="s-unlock" type="checkbox" ${s.unlockAll ? 'checked' : ''}><span></span>
        </div>
        <div class="keys"><b>WASD</b> move · <b>MOUSE</b> aim · <b>LMB</b> fire · <b>RMB</b> aim down sights · <b>SHIFT</b> sprint · <b>SPACE</b> jump ·
          <b>C</b> crouch / slide · <b>R</b> reload · <b>4</b> killstreak · <b>TAB</b> scoreboard · <b>ESC</b> pause</div>`;
      }
      default:
        return '';
    }
  }

  private classCards(selected: number, act: 'pick' | 'edit') {
    return this.ctx.classes
      .map((c, i) => `<button type="button" class="card ${selected === i ? 'on' : ''}" data-${act}="${i}"><b>${esc(c.name)}</b><span>${WEAPONS[c.weapon].name}</span></button>`)
      .join('');
  }

  private cacHtml() {
    const c = this.ctx.classes[this.editIndex];
    const lvl = this.level();
    const opt = <T extends string>(key: keyof Loadout, list: { id: T; name: string; desc: string; level: number }[]) =>
      list
        .map((o) => {
          const locked = o.level > lvl;
          return `<button type="button" class="card ${c[key] === o.id ? 'on' : ''} ${locked ? 'locked' : ''}" data-set="${key}" data-val="${o.id}" ${locked ? 'aria-disabled="true"' : ''}>
            <b>${o.name}</b><span>${o.desc}</span>${locked ? `<span class="lock">UNLOCKS AT LVL ${o.level}</span>` : ''}</button>`;
        })
        .join('');
    const weapons = (Object.keys(WEAPONS) as WeaponId[])
      .map((id) => {
        const w = WEAPONS[id];
        const bars = Object.entries(w.bars)
          .map(([k, v]) => `<div class="stat"><span>${k.toUpperCase()}</span><div class="b"><i style="width:${v * 10}%"></i></div></div>`)
          .join('');
        return `<button type="button" class="card ${c.weapon === id ? 'on' : ''}" data-set="weapon" data-val="${id}"><b>${w.name}</b><span>${w.blurb}</span>${bars}</button>`;
      })
      .join('');
    const camos = CAMOS.map((o) => {
      const locked = o.level > lvl;
      return `<button type="button" class="swatch ${c.camo === o.id ? 'on' : ''} ${locked ? 'locked' : ''}" style="background:${o.swatch}" title="${o.name}${locked ? ` (LVL ${o.level})` : ''}" aria-label="${o.name}" data-set="camo" data-val="${o.id}"></button>`;
    }).join('');
    return `<h2>CREATE A CLASS</h2><div class="sub">${this.context === 'pause' ? 'Changes apply on your next spawn.' : 'Three custom classes. Locked items open up as you level.'}</div>
      <div class="row">${this.classCards(this.editIndex, 'edit')}</div>
      <div class="label">CLASS NAME</div><input class="name" id="cname" maxlength="14" value="${esc(c.name)}">
      <div id="preview-slot"></div>
      <div class="label">PRIMARY</div><div class="grid2">${weapons}</div>
      <div class="label">OPTIC</div><div class="grid2">${opt('optic', OPTICS)}</div>
      <div class="label">MUZZLE</div><div class="grid2">${opt('muzzle', MUZZLES)}</div>
      <div class="label">UNDERBARREL</div><div class="grid2">${opt('under', UNDERS)}</div>
      <div class="label">CAMO · ${CAMOS.find((o) => o.id === c.camo)?.name ?? ''}</div><div class="row">${camos}</div>
      <div class="label">PERK 1</div><div class="grid2">${opt('perk1', PERKS1)}</div>
      <div class="label">PERK 2</div><div class="grid2">${opt('perk2', PERKS2)}</div>
      <div class="label">PERK 3</div><div class="grid2">${opt('perk3', PERKS3)}</div>`;
  }

  private bindPanel() {
    const panel = this.root.querySelector('#panel') as HTMLDivElement;
    const g = this.ctx.game;
    panel.querySelectorAll<HTMLElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        g.sfx.uiSelect();
        if (b.dataset.act === 'start') this.ctx.startMatch({ mode: this.mode, difficulty: this.difficulty, classIndex: this.classIndex });
        if (b.dataset.act === 'tobots') this.select('bots');
      }),
    );
    const pick = (attr: string, fn: (v: string) => void) =>
      panel.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach((b) =>
        b.addEventListener('click', () => {
          if (b.classList.contains('locked')) return;
          g.sfx.uiMove();
          fn(b.dataset[attr]!);
          const keep = panel.scrollTop;
          this.render();
          (this.root.querySelector('#panel') as HTMLDivElement).scrollTop = keep;
        }),
      );
    pick('mode', (v) => (this.mode = v as Mode));
    pick('diff', (v) => (this.difficulty = v as DifficultyId));
    pick('pick', (v) => (this.classIndex = Number(v)));
    pick('edit', (v) => (this.editIndex = Number(v)));
    panel.querySelectorAll<HTMLElement>('[data-set]').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.classList.contains('locked')) return;
        g.sfx.uiMove();
        const c = this.ctx.classes[this.editIndex] as unknown as Record<string, string>;
        c[b.dataset.set!] = b.dataset.val!;
        saveClasses(this.ctx.classes);
        if (this.context === 'pause') g.setClass(this.editIndex, this.ctx.classes);
        const keep = panel.scrollTop;
        this.render();
        (this.root.querySelector('#panel') as HTMLDivElement).scrollTop = keep;
      }),
    );
    const name = panel.querySelector('#cname') as HTMLInputElement | null;
    name?.addEventListener('change', () => {
      this.ctx.classes[this.editIndex].name = name.value.trim().toUpperCase().slice(0, 14) || `CLASS ${this.editIndex + 1}`;
      saveClasses(this.ctx.classes);
      this.render();
    });

    // settings
    const s = this.ctx.settings;
    const range = (id: string, key: 'sensitivity' | 'fov' | 'volume', fmt: (v: number) => string) => {
      const i = panel.querySelector(`#${id}`) as HTMLInputElement | null;
      i?.addEventListener('input', () => {
        s[key] = Number(i.value);
        (panel.querySelector(`#${id}-v`) as HTMLElement).textContent = fmt(s[key]);
        this.ctx.saveSettings();
      });
    };
    range('s-sens', 'sensitivity', (v) => v.toFixed(2));
    range('s-fov', 'fov', (v) => `${v}°`);
    range('s-vol', 'volume', (v) => `${Math.round(v * 100)}%`);
    panel.querySelector('#s-res')?.addEventListener('change', (e) => {
      s.lowHeight = Number((e.target as HTMLSelectElement).value);
      this.ctx.saveSettings();
    });
    panel.querySelector('#s-dither')?.addEventListener('change', (e) => {
      s.dither = (e.target as HTMLInputElement).checked;
      this.ctx.saveSettings();
    });
    panel.querySelector('#s-unlock')?.addEventListener('change', (e) => {
      s.unlockAll = (e.target as HTMLInputElement).checked;
      this.ctx.saveSettings();
    });

    // live 3D preview
    const slot = panel.querySelector('#preview-slot');
    if (slot) {
      this.preview ??= new Preview(g);
      slot.appendChild(this.preview.canvas);
      this.preview.show(this.ctx.classes[this.editIndex]);
    } else {
      this.preview?.stop();
    }
  }
}

/** Rotating weapon render for create-a-class (one persistent WebGL context). */
class Preview {
  readonly canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(24, 21 / 8, 0.05, 10);
  private weapon: THREE.Object3D | null = null;
  private key = '';
  private raf = 0;
  private game: Game;

  constructor(game: Game) {
    this.game = game;
    this.canvas.className = 'preview';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.environment = game.envMap;
    this.scene.environmentIntensity = 0.5;
    const key = new THREE.DirectionalLight(0xffd2a0, 2.6);
    key.position.set(-1, 1.5, 1);
    const rim = new THREE.DirectionalLight(0x9ab0ff, 1.6);
    rim.position.set(1, 0.5, -1.2);
    this.scene.add(key, rim, new THREE.AmbientLight(0x40303a, 0.8));
    this.camera.position.set(0, 0.05, 1.3);
    this.camera.lookAt(0, 0, 0);
  }

  show(l: Loadout) {
    const key = JSON.stringify(cfgFromLoadout(l));
    if (key !== this.key || !this.weapon) {
      if (this.weapon) this.scene.remove(this.weapon);
      const w = buildWeapon(this.game.materials, cfgFromLoadout(l), false);
      const holder = new THREE.Group();
      w.position.set(0, -0.02, 0.06);
      holder.add(w);
      this.scene.add(holder);
      this.weapon = holder;
      this.key = key;
    }
    cancelAnimationFrame(this.raf);
    const loop = (t: number) => {
      if (!this.canvas.isConnected) return;
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      if (w && this.canvas.width !== Math.floor(w * devicePixelRatio)) {
        this.renderer.setPixelRatio(devicePixelRatio);
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }
      if (this.weapon) this.weapon.rotation.y = Math.PI / 2 + Math.sin(t * 0.0006) * 0.5;
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }
}
