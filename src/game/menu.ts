import * as THREE from 'three';
import type { Game, MatchConfig, Mode, DifficultyId, Settings } from './game';
import { DIFFICULTIES, MODES } from './game';
import {
  CAMOS, MAGS, MUZZLES, OPTICS, PERKS1, PERKS2, PERKS3, SEC_ATTACH, SECONDARIES, TACTICALS, UNDERS, WEAPONS,
  isUnlocked, lockText, saveClasses, type Choice, type Loadout, type PrimaryId,
} from './loadout';
import { buildWeapon, cfgFromLoadout } from './weapons';
import { buildSoldier } from './soldier';
import { MAX_LEVEL, MAX_PRESTIGE, xpForLevel } from './progression';
import { ART_MAX_LEVEL, badgeImg, prestigeName, rankInfo } from './badges';
import { nextUnlock, unlockTrack } from './unlocks';
import { BANNERS, GEAR, HEADGEAR, UNIFORMS, bannerUnlocked, playerCard } from './cosmetics';
import { MAPS } from './maps';

type Tab = 'mp' | 'bots' | 'cac' | 'soldier' | 'barracks' | 'settings' | 'resume' | 'quit';

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

/** Front-end: main menu, pause menu, create-a-class, soldier, barracks. */
export class Menu {
  private root = document.getElementById('menu') as HTMLDivElement;
  private ctx: Ctx;
  private context: 'main' | 'pause' = 'main';
  private tab: Tab = 'bots';
  private mode: Mode = 'tdm';
  private difficulty: DifficultyId = 'regular';
  private mapId = 'random';
  private openSlot: string | null = null;
  private editIndex = 0;
  private prestigeArmed = false;
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
    return this.ctx.game.profileSummary().level;
  }

  private ctxFor(kills: number) {
    return { level: this.level(), kills, all: this.ctx.settings.unlockAll };
  }

  private render(animateNav = false) {
    const pause = this.context === 'pause';
    this.root.classList.toggle('static', !animateNav);
    const items: [Tab, string, string][] = pause
      ? [['resume', 'RESUME', ''], ['cac', 'CREATE A CLASS', 'next spawn'], ['settings', 'SETTINGS', ''], ['quit', 'QUIT MATCH', '']]
      : [['mp', 'MULTIPLAYER', 'offline'], ['bots', 'BOT MATCH', ''], ['cac', 'CREATE A CLASS', ''], ['soldier', 'SOLDIER', ''], ['barracks', 'BARRACKS', ''], ['settings', 'SETTINGS', '']];
    const title = 'DEAD PIXEL'
      .split('')
      .map((ch, i) => `<span style="animation-delay:${animateNav ? i * 0.05 : 0}s">${ch === ' ' ? '&nbsp;' : ch}</span>`)
      .join('');
    const p = this.ctx.game.profileSummary();
    const base = xpForLevel(p.level);
    const need = p.level >= MAX_LEVEL ? 1 : xpForLevel(p.level + 1) - base;
    const nu = nextUnlock(p.level);
    const ready = this.ctx.game.prestigeReady;
    this.root.innerHTML = `
      <div class="left">
        <div class="rank top">
          ${playerCard(this.ctx.game.profileData)}
          <div class="rk-xp">${p.level >= MAX_LEVEL ? (ready ? '<span style="color:var(--gold)">PRESTIGE AVAILABLE · BARRACKS</span>' : 'MAX LEVEL') : `${(p.xp - base).toLocaleString()} / ${need.toLocaleString()} XP TO LEVEL ${p.level + 1}`}</div>
        </div>
        <h1 class="title glitch">${title}</h1>
        <div class="tag">${pause ? 'PAUSED' : 'PS1 WORLD · MODERN KIT'}</div>
        <nav>${items
          .map(([id, label, small], i) => `<button type="button" data-tab="${id}" class="${this.tab === id ? 'on' : ''}" style="animation-delay:${animateNav ? 0.35 + i * 0.07 : 0}s">${label}${small ? `<small>${small}</small>` : ''}</button>`)
          .join('')}</nav>
        ${nu ? `<div class="rk-next bottom">NEXT UNLOCK · LVL ${nu[0]}<br><b>${nu[1]}</b></div>` : ''}
      </div>
      <div class="panel" id="panel">${this.panelHtml()}</div>`;
    this.root.querySelectorAll<HTMLButtonElement>('nav button').forEach((b) => {
      b.addEventListener('click', () => this.select(b.dataset.tab as Tab));
      b.addEventListener('mouseenter', () => this.ctx.game.sfx.uiMove());
    });
    this.bindPanel();
  }

  private select(t: Tab) {
    this.ctx.game.sfx.uiSelect();
    if (t === 'resume') return this.ctx.resume();
    if (t === 'quit') return this.ctx.quit();
    this.tab = t;
    this.openSlot = null;
    this.prestigeArmed = false;
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
          <button class="go ghost" type="button" data-act="tobots">PLAY BOTS INSTEAD</button></div>`;
      case 'bots': {
        const modes = (Object.keys(MODES) as Mode[])
          .map((m) => `<button type="button" class="card ${this.mode === m ? 'on' : ''}" data-mode="${m}"><b>${MODES[m].label}</b><span>${MODES[m].desc}</span><span>${MODES[m].minutes} MIN LIMIT</span></button>`)
          .join('');
        const diffs = (Object.keys(DIFFICULTIES) as DifficultyId[])
          .map((d) => `<button type="button" class="card ${this.difficulty === d ? 'on' : ''}" data-diff="${d}"><b>${DIFFICULTIES[d].label}</b></button>`)
          .join('');
        return `<h2>BOT MATCH</h2><div class="sub">Bots fight each other and you.</div>
          <div class="label">GAME MODE</div><div class="grid2">${modes}</div>
          <div class="label">BOT DIFFICULTY</div><div class="row">${diffs}</div>
          <div class="label">MAP</div><div class="maps">${this.mapCards()}</div>
          <button class="go" type="button" data-act="start">START MATCH</button>
          <div class="sub" style="margin-top:10px">You pick your class when the match loads.</div>`;
      }
      case 'cac':
        return this.cacHtml();
      case 'soldier':
        return this.soldierHtml();
      case 'barracks':
        return this.barracksHtml();
      case 'settings':
        return this.settingsHtml();
      default:
        return '';
    }
  }

  private settingsHtml() {
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
      <b>C</b> crouch / slide · <b>R</b> reload · <b>1 / 2 / WHEEL</b> switch weapon · <b>G</b> frag · <b>Q</b> tactical · <b>4</b> killstreak ·
      <b>TAB</b> scoreboard · <b>ESC</b> pause</div>`;
  }

  private mapCards() {
    const cards = MAPS.map(
      (m) => `<button type="button" class="card map ${this.mapId === m.id ? 'on' : ''}" data-map="${m.id}">
        <i class="thumb" style="background:${m.swatch}"></i><b>${m.name}</b><span>${m.desc}</span></button>`,
    );
    cards.push(`<button type="button" class="card map ${this.mapId === 'random' ? 'on' : ''}" data-map="random">
      <i class="thumb" style="background:repeating-linear-gradient(45deg,#2a2226 0 8px,#3a3034 8px 16px)"></i><b>RANDOM</b><span>Rotate through the pool.</span></button>`);
    return cards.join('');
  }

  /** A list row that expands to show its options. */
  private slotRow(key: string, label: string, opts: Choice[], current: string, kills: number, weaponName: string, attr = 'set', note = '') {
    const cur = opts.find((o) => o.id === current) ?? opts[0];
    const open = this.openSlot === key;
    // always reserve the swatch column so every row's value lines up
    const sw = `<i class="sw ${cur.swatch ? '' : 'none'}" style="background:${cur.swatch ?? 'transparent'}"></i>`;
    const choices = open
      ? `<div class="choices">${note ? `<div class="sub" style="grid-column:1/-1">${note}</div>` : ''}${opts
          .map((o) => {
            const locked = !isUnlocked(o, this.ctxFor(kills));
            return `<button type="button" class="card ${current === o.id ? 'on' : ''} ${locked ? 'locked' : ''}" data-${attr}="${key}" data-val="${o.id}">
              <b>${o.swatch ? `<i class="sw" style="background:${o.swatch}"></i>` : ''}${o.name}</b>${o.desc ? `<span>${o.desc}</span>` : ''}${locked ? `<span class="lock">UNLOCKS · ${lockText(o, weaponName)}</span>` : ''}</button>`;
          })
          .join('')}</div>`
      : '';
    return `<button type="button" class="slot ${open ? 'open' : ''}" data-slot="${key}"><span class="sl">${label}</span><span class="sv">${sw}${cur.name}</span><span class="chev">${open ? '−' : '+'}</span></button>${choices}`;
  }

  private cacHtml() {
    const c = this.ctx.classes[this.editIndex];
    const pk = this.ctx.game.profileData.weaponKills;
    const prim = WEAPONS[c.weapon];
    const sec = WEAPONS[c.secondary];
    const primKills = pk[c.weapon] ?? 0;
    const secKills = pk[c.secondary] ?? 0;
    const showSecondary = this.openSlot === 'secondary' || this.openSlot === 'secAttach';
    const w = showSecondary ? sec : prim;
    const bars = Object.entries(w.bars)
      .map(([k, v]) => `<div class="stat"><span>${k.toUpperCase()}</span><div class="b"><i style="width:${v * 10}%"></i></div></div>`)
      .join('');
    const primaries: Choice[] = (['kr4', 'vk47'] as PrimaryId[]).map((id) => ({ id, name: WEAPONS[id].name, desc: WEAPONS[id].blurb }));
    const rows = [
      `<div class="group-label">PRIMARY · ${primKills} KILLS</div>`,
      this.slotRow('weapon', 'WEAPON', primaries, c.weapon, primKills, prim.name),
      this.slotRow('optic', 'OPTIC', OPTICS, c.optic, primKills, prim.name),
      this.slotRow('muzzle', 'MUZZLE', MUZZLES, c.muzzle, primKills, prim.name),
      this.slotRow('under', 'UNDERBARREL', UNDERS, c.under, primKills, prim.name),
      this.slotRow('mag', 'MAGAZINE', MAGS, c.mag, primKills, prim.name),
      this.slotRow('camo', 'CAMO', CAMOS, c.camo, primKills, prim.name),
      `<div class="group-label">SECONDARY · ${secKills} KILLS</div>`,
      this.slotRow('secondary', 'SIDEARM', SECONDARIES, c.secondary, secKills, sec.name),
      this.slotRow('secAttach', 'ATTACHMENT', SEC_ATTACH, c.secAttach, secKills, sec.name, 'set', c.secondary === 'r357' ? 'The revolver takes no attachments.' : ''),
      `<div class="group-label">EQUIPMENT & PERKS</div>`,
      this.slotRow('tactical', 'TACTICAL', TACTICALS, c.tactical, 0, ''),
      this.slotRow('perk1', 'PERK 1', PERKS1, c.perk1, 0, ''),
      this.slotRow('perk2', 'PERK 2', PERKS2, c.perk2, 0, ''),
      this.slotRow('perk3', 'PERK 3', PERKS3, c.perk3, 0, ''),
    ].join('');
    return `<h2>CREATE A CLASS</h2><div class="sub">${this.context === 'pause' ? 'Changes apply on your next spawn.' : 'Pick a slot to change it. Attachments unlock with kills on each gun.'}</div>
      <div class="row">${this.ctx.classes
        .map((cl, i) => `<button type="button" class="card ${this.editIndex === i ? 'on' : ''}" data-edit="${i}"><b>${esc(cl.name)}</b><span>${WEAPONS[cl.weapon].name}</span></button>`)
        .join('')}
        <input class="name" id="cname" maxlength="14" aria-label="Class name" value="${esc(c.name)}"></div>
      <div class="studio"><div id="preview-slot" data-kind="${showSecondary ? 'secondary' : 'primary'}"></div><div class="studio-info"><b>${w.name}</b>${bars}</div></div>
      <div class="slots">${rows}</div>`;
  }

  private soldierHtml() {
    const p = this.ctx.game.profileData;
    const lvl = this.level();
    const opt = (key: 'uniform' | 'gear' | 'head', label: string, list: Choice[]) =>
      this.slotRow(key, label, list, p.look[key], 0, '', 'look');
    const banners = BANNERS.map((b) => {
      const locked = !bannerUnlocked(b, lvl, p.prestige, this.ctx.settings.unlockAll);
      return `<button type="button" class="bcard ${p.banner === b.id ? 'on' : ''} ${locked ? 'locked' : ''}" data-banner="${b.id}" style="background:${b.bg}" title="${b.name}">
        ${b.motif ? `<span class="pc-motif">${b.motif}</span>` : ''}<span class="bname">${b.name}</span>${locked ? `<span class="block">${b.prestige ? `PRESTIGE ${b.prestige}` : `LVL ${b.level}`}</span>` : ''}</button>`;
    }).join('');
    return `<h2>SOLDIER</h2><div class="sub">Your operator and calling card. Full customisation (faces, gear sets, emblems) is still to come.</div>
      <div class="soldier-wrap"><div class="studio tall"><div id="preview-slot" data-kind="soldier"></div></div>
        <div class="soldier-side">${playerCard(p)}
          <div class="label">CALLSIGN</div><input class="name" id="callsign" maxlength="16" aria-label="Callsign" value="${esc(p.callsign)}">
          <div class="slots">${opt('uniform', 'UNIFORM', UNIFORMS)}${opt('gear', 'GEAR', GEAR)}${opt('head', 'HEADGEAR', HEADGEAR)}</div>
        </div></div>
      <div class="label">BANNERS</div><div class="banners">${banners}</div>`;
  }

  private barracksHtml() {
    const p = this.ctx.game.profileSummary();
    const ready = this.ctx.game.prestigeReady;
    const track = [...unlockTrack().entries()]
      .map(([l, items]) => `<div class="playlist"><span>LVL ${l} · ${items.join(' · ')}</span><span class="chip ${p.level >= l ? 'ok' : ''}">${p.level >= l ? 'UNLOCKED' : 'LOCKED'}</span></div>`)
      .join('');
    const emblems = Array.from({ length: MAX_PRESTIGE }, (_, i) => `<div class="emb ${p.prestige >= i + 1 ? 'got' : ''}">${badgeImg(MAX_LEVEL, i + 1, 64)}<span>P${i + 1} · ${prestigeName(i + 1).toUpperCase()}</span></div>`).join('');
    const ladder = Array.from({ length: ART_MAX_LEVEL / 3 }, (_, i) => {
      const lvl = i * 3 + 1;
      return `<div class="emb ${p.level >= lvl || p.prestige > 0 ? 'got' : ''}">${badgeImg(lvl + 2, 0, 56)}<span>${lvl}–${lvl + 2} · ${rankInfo(lvl).abbr}</span></div>`;
    }).join('');
    const wk = Object.entries(WEAPONS)
      .map(([id, w]) => `<div class="card"><b>${p.weaponKills[id] ?? 0}</b><span>${w.name}</span></div>`)
      .join('');
    return `<h2>BARRACKS</h2>
      <div class="rankhead">${badgeImg(p.level, p.prestige, 96)}<div><div class="rk-big">${p.prestige ? `PRESTIGE ${p.prestige} · ` : ''}LEVEL ${p.level}</div>
        <div class="sub" style="margin:0">${rankInfo(p.level).name.toUpperCase()}${p.prestige ? ` · ${prestigeName(p.prestige).toUpperCase()}` : ''} · ${p.xp.toLocaleString()} XP this prestige</div></div></div>
      <div class="prestige-box">
        ${ready
          ? `<b>PRESTIGE ${p.prestige + 1} IS AVAILABLE</b><span>Resets you to level 1 and re-locks level unlocks. You keep your stats, weapon kills and a new prestige emblem and banner.</span>
             <button class="go" type="button" data-act="prestige">${this.prestigeArmed ? 'CONFIRM: RESET TO LEVEL 1' : `ENTER PRESTIGE ${p.prestige + 1}`}</button>`
          : `<b>${p.prestige >= MAX_PRESTIGE ? 'MAX PRESTIGE' : `PRESTIGE ${p.prestige + 1} AT LEVEL ${MAX_LEVEL}`}</b><span>Reach level ${MAX_LEVEL} to reset with a new emblem. ${MAX_PRESTIGE} prestiges in total.</span>`}
      </div>
      <div class="label">PRESTIGE EMBLEMS</div><div class="emblems">${emblems}</div>
      <div class="label">RANK LADDER · 25 RANKS × 3 TIERS${MAX_LEVEL > ART_MAX_LEVEL ? ` · LEVELS ${ART_MAX_LEVEL + 1}–${MAX_LEVEL} KEEP COMMANDER III` : ''}</div><div class="emblems">${ladder}</div>
      <div class="label">COMBAT RECORD</div>
      <div class="grid2">
        <div class="card"><b>${p.kills}</b><span>KILLS</span></div><div class="card"><b>${p.deaths}</b><span>DEATHS</span></div>
        <div class="card"><b>${p.headshots}</b><span>HEADSHOTS</span></div><div class="card"><b>${p.bestStreak}</b><span>BEST STREAK</span></div>
      </div>
      <div class="label">WEAPON KILLS</div><div class="grid2">${wk}<div class="card"><b>${p.weaponKills.frag ?? 0}</b><span>FRAG GRENADE</span></div></div>
      <div class="label">UNLOCK TRACK · LEVELS 1–${MAX_LEVEL}</div>${track}`;
  }

  private bindPanel() {
    const panel = this.root.querySelector('#panel') as HTMLDivElement;
    const g = this.ctx.game;
    const rerender = () => {
      const keep = panel.scrollTop;
      this.render();
      (this.root.querySelector('#panel') as HTMLDivElement).scrollTop = keep;
    };
    panel.querySelectorAll<HTMLElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        g.sfx.uiSelect();
        const act = b.dataset.act;
        if (act === 'start') {
          const mapId = this.mapId === 'random' ? MAPS[Math.floor(Math.random() * MAPS.length)].id : this.mapId;
          this.ctx.startMatch({ mode: this.mode, difficulty: this.difficulty, classIndex: 0, mapId });
        }
        if (act === 'tobots') this.select('bots');
        if (act === 'prestige') {
          if (!this.prestigeArmed) this.prestigeArmed = true;
          else {
            g.prestige();
            this.prestigeArmed = false;
          }
          rerender();
        }
      }),
    );
    const pick = (attr: string, fn: (v: string) => void) =>
      panel.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach((b) =>
        b.addEventListener('click', () => {
          if (b.classList.contains('locked')) return;
          g.sfx.uiMove();
          fn(b.dataset[attr]!);
          rerender();
        }),
      );
    pick('mode', (v) => (this.mode = v as Mode));
    pick('diff', (v) => (this.difficulty = v as DifficultyId));
    pick('map', (v) => (this.mapId = v));
    pick('slot', (v) => (this.openSlot = this.openSlot === v ? null : v));
    pick('edit', (v) => {
      this.editIndex = Number(v);
      this.openSlot = null;
    });
    pick('banner', (v) => {
      g.profileData.banner = v;
      g.saveProfileNow();
    });
    panel.querySelectorAll<HTMLElement>('[data-set][data-val]').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.classList.contains('locked')) return;
        const c = this.ctx.classes[this.editIndex] as unknown as Record<string, string>;
        c[b.dataset.set!] = b.dataset.val!;
        if (c.secondary === 'r357') c.secAttach = 'none';
        saveClasses(this.ctx.classes);
        this.openSlot = b.dataset.set === 'secondary' ? 'secondary' : null;
        if (this.context === 'pause') g.setClass(this.editIndex, this.ctx.classes);
        rerender();
      }),
    );
    panel.querySelectorAll<HTMLElement>('[data-look][data-val]').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.classList.contains('locked')) return;
        const look = g.profileData.look as unknown as Record<string, string>;
        look[b.dataset.look!] = b.dataset.val!;
        g.saveProfileNow();
        this.openSlot = null;
        rerender();
      }),
    );
    const name = panel.querySelector('#cname') as HTMLInputElement | null;
    name?.addEventListener('change', () => {
      this.ctx.classes[this.editIndex].name = name.value.trim().toUpperCase().slice(0, 14) || `CLASS ${this.editIndex + 1}`;
      saveClasses(this.ctx.classes);
      this.render();
    });
    const call = panel.querySelector('#callsign') as HTMLInputElement | null;
    call?.addEventListener('change', () => {
      g.profileData.callsign = call.value.trim().toUpperCase().slice(0, 16) || 'OPERATOR';
      g.saveProfileNow();
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
    const slot = panel.querySelector<HTMLElement>('#preview-slot');
    if (slot) {
      this.preview ??= new Preview(g);
      slot.appendChild(this.preview.canvas);
      const kind = slot.dataset.kind;
      const c = this.ctx.classes[this.editIndex];
      if (kind === 'soldier') {
        const look = g.profileData.look;
        const wcfg = cfgFromLoadout(this.ctx.classes[0]);
        this.preview.show('soldier', JSON.stringify([look, wcfg]), () => buildSoldier(g.soldierMats, look, wcfg));
      } else {
        const cfg = cfgFromLoadout(c, kind === 'secondary' ? 'secondary' : 'primary');
        this.preview.show('weapon', JSON.stringify(cfg), () => buildWeapon(g.materials, cfg, false));
      }
    } else {
      this.preview?.stop();
    }
  }
}

/** Studio-lit render of a weapon or a soldier (one persistent WebGL context). */
class Preview {
  readonly canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
  private persp = new THREE.PerspectiveCamera(24, 1, 0.1, 20);
  private holder: THREE.Group | null = null;
  private kind: 'weapon' | 'soldier' = 'weapon';
  private span = 1;
  private key = '';
  private raf = 0;

  constructor(game: Game) {
    this.canvas.className = 'preview';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.environment = game.envMap;
    this.scene.environmentIntensity = 1;
    const key = new THREE.DirectionalLight(0xfff2e0, 3.2);
    key.position.set(-1.2, 2.4, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -1.2;
    key.shadow.camera.right = 1.2;
    key.shadow.camera.top = 2.2;
    key.shadow.camera.bottom = -0.2;
    key.shadow.bias = -0.0005;
    const fill = new THREE.DirectionalLight(0xc8d8ff, 1.3);
    fill.position.set(1.2, 0.4, 1.4);
    const rim = new THREE.DirectionalLight(0xffffff, 2.4);
    rim.position.set(0.4, 1.4, -2);
    this.scene.add(key, fill, rim, new THREE.AmbientLight(0x8a8078, 0.8));
    // soft floor that only catches shadows
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), new THREE.ShadowMaterial({ opacity: 0.35 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    this.scene.add(floor);
    this.ortho.position.set(0, 0.04, 3);
    this.ortho.lookAt(0, 0.04, 0);
    this.persp.position.set(0, 1.1, 4.4);
    this.persp.lookAt(0, 0.98, 0);
  }

  show(kind: 'weapon' | 'soldier', key: string, build: () => THREE.Object3D) {
    if (key !== this.key || !this.holder) {
      if (this.holder) this.scene.remove(this.holder);
      const obj = build();
      this.holder = new THREE.Group();
      if (kind === 'weapon') {
        const box = new THREE.Box3().setFromObject(obj);
        obj.position.sub(box.getCenter(new THREE.Vector3()));
        this.span = box.max.z - box.min.z;
      } else {
        obj.traverse((o) => {
          o.layers.set(0);
          o.castShadow = true;
        });
      }
      this.holder.add(obj);
      this.scene.add(this.holder);
      this.key = key;
      this.kind = kind;
    }
    (this.scene.getObjectByName('floor') as THREE.Mesh).visible = kind === 'soldier';
    this.canvas.classList.toggle('tall', kind === 'soldier');
    cancelAnimationFrame(this.raf);
    const loop = (t: number) => {
      if (!this.canvas.isConnected) return;
      const cw = this.canvas.clientWidth;
      const ch = this.canvas.clientHeight;
      if (cw && this.canvas.width !== Math.floor(cw * devicePixelRatio)) {
        this.renderer.setPixelRatio(devicePixelRatio);
        this.renderer.setSize(cw, ch, false);
      }
      const aspect = cw / Math.max(1, ch);
      let cam: THREE.Camera;
      if (this.kind === 'weapon') {
        const halfW = this.span * 0.58;
        const halfH = Math.max(halfW / aspect, 0.16);
        const o = this.ortho;
        if (o.right !== halfH * aspect) {
          o.left = -halfH * aspect;
          o.right = halfH * aspect;
          o.top = halfH;
          o.bottom = -halfH;
          o.updateProjectionMatrix();
        }
        if (this.holder) {
          this.holder.rotation.y = Math.PI / 2 + Math.sin(t * 0.0005) * 0.28;
          this.holder.rotation.x = Math.sin(t * 0.0003) * 0.05;
        }
        cam = o;
      } else {
        if (this.persp.aspect !== aspect) {
          this.persp.aspect = aspect;
          this.persp.updateProjectionMatrix();
        }
        if (this.holder) {
          this.holder.rotation.set(0, 0.5 + Math.sin(t * 0.0004) * 0.6, 0);
        }
        cam = this.persp;
      }
      this.renderer.render(this.scene, cam);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }
}
