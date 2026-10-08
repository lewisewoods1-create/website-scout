import * as THREE from 'three';
import type { Game, MatchConfig, Mode, DifficultyId, Settings } from './game';
import { DIFFICULTIES, MODES } from './game';
import {
  MAGS, MUZZLES, OPTICS, PERKS1, PERKS2, PERKS3, SEC_ATTACH, SECONDARIES, TACTICALS, UNDERS, WEAPONS, WEAPON_CLASSES, CAMOS, GOLD_HEADS,
  PRIMARY_IDS, camosFor, computeStats, fitsWeapon, fixAttachments, hasGold, hasMastery, isUnlocked, lockText, saveClasses,
  type Choice, type Loadout, type UnlockCtx, type WeaponClassId, type WeaponId,
} from './loadout';
import { buildWeapon, cfgFromLoadout } from './weapons';
import { buildSoldier } from './soldier';
import { MAX_LEVEL, MAX_PRESTIGE, xpForLevel } from './progression';
import { ART_MAX_LEVEL, badgeImg, prestigeName, rankInfo } from './badges';
import { nextUnlock, unlockTrack } from './unlocks';
import { BANNERS, GEAR, HEADGEAR, UNIFORMS, bannerUnlocked, playerCard, type Banner } from './cosmetics';
import { CHALLENGES, THEMES, TIER_NAMES, cardArt, isDone, statValue } from './challenges';
import { MAPS } from './maps';
import { STREAKS, STREAK_ORDER, streakIcon, type StreakId } from './killstreaks';

const CLASS_ORDER: WeaponClassId[] = ['ar', 'smg', 'heavy', 'marksman', 'sniper', 'handgun'];

type Page = 'mp' | 'bots' | 'cac' | 'soldier' | 'challenges' | 'barracks' | 'settings';
type Tab = Page | 'resume' | 'quit';

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
const bar = (pct: number) => `<div class="pbar"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></i></div>`;

const DIFF_INFO: Record<DifficultyId, string> = {
  recruit: 'Slow to react, sprays wide. Learn the maps.',
  regular: 'A fair fight. Bots flank and use cover.',
  hardened: 'Quick target pickup, tight groupings.',
  veteran: 'Near-instant reactions. Every peek is a duel.',
};

/**
 * Front-end. The home screen is the nav over the live bot battle; every tab
 * opens as its own full page (top tabs to hop between pages, Back / Esc to return).
 */
export class Menu {
  private root = document.getElementById('menu') as HTMLDivElement;
  private ctx: Ctx;
  private context: 'main' | 'pause' = 'main';
  /** null = home screen */
  private page: Page | null = null;
  private mode: Mode = 'tdm';
  private difficulty: DifficultyId = 'regular';
  private mapId = 'random';
  private openSlot: string | null = null;
  private editIndex = 0;
  private prestigeArmed = false;
  private chFilter: 'all' | 'open' | 'done' = 'all';
  private cacTab: 'classes' | 'streaks' = 'classes';
  /** killstreak picks while fewer than three are chosen */
  private streakDraft: StreakId[] | null = null;
  private preview: Preview | null = null;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || !this.isOpen || !this.page) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      e.preventDefault();
      this.back();
    });
  }

  get isOpen() {
    return this.root.classList.contains('open');
  }

  open(context: 'main' | 'pause') {
    this.context = context;
    this.page = null;
    this.ctx.game.syncChallenges();
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

  private ctxFor(u: Partial<UnlockCtx> = {}): UnlockCtx {
    return { level: this.level(), kills: 0, all: this.ctx.settings.unlockAll, ...u };
  }

  private weaponCtx(w: WeaponId): Partial<UnlockCtx> {
    const p = this.ctx.game.profileData;
    return { kills: p.weaponKills[w] ?? 0, heads: p.weaponHeads[w] ?? 0, allHeads: p.weaponHeads };
  }

  private navItems(): [Tab, string, string][] {
    const done = this.ctx.game.profileData.challenges.length;
    return this.context === 'pause'
      ? [['resume', 'RESUME', ''], ['cac', 'CREATE A CLASS', 'next spawn'], ['challenges', 'CHALLENGES', `${done}/100`], ['settings', 'SETTINGS', ''], ['quit', 'QUIT MATCH', '']]
      : [
          ['mp', 'MULTIPLAYER', 'offline'], ['bots', 'BOT MATCH', ''], ['cac', 'CREATE A CLASS', ''], ['soldier', 'SOLDIER', ''],
          ['challenges', 'CHALLENGES', `${done}/100`], ['barracks', 'BARRACKS', ''], ['settings', 'SETTINGS', ''],
        ];
  }

  private render(animate = false) {
    this.root.classList.toggle('static', !animate);
    this.root.classList.toggle('home', !this.page);
    this.root.classList.toggle('paged', !!this.page);
    this.root.innerHTML = this.page ? this.pageShell(this.page) : this.homeHtml(animate);
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      b.addEventListener('click', () => this.select(b.dataset.tab as Tab));
      b.addEventListener('mouseenter', () => this.ctx.game.sfx.uiMove());
    });
    this.root.querySelector('[data-back]')?.addEventListener('click', () => this.back());
    this.bindPanel();
  }

  private homeHtml(animate: boolean) {
    const pause = this.context === 'pause';
    const title = 'DEAD PIXEL'
      .split('')
      .map((ch, i) => `<span style="animation-delay:${animate ? i * 0.05 : 0}s">${ch === ' ' ? '&nbsp;' : ch}</span>`)
      .join('');
    const p = this.ctx.game.profileSummary();
    const base = xpForLevel(p.level);
    const need = p.level >= MAX_LEVEL ? 1 : xpForLevel(p.level + 1) - base;
    const nu = nextUnlock(p.level);
    const ready = this.ctx.game.prestigeReady;
    return `
      <div class="left">
        <div class="rank top">
          ${playerCard(this.ctx.game.profileData)}
          <div class="rk-xp">${p.level >= MAX_LEVEL ? (ready ? '<span style="color:var(--gold)">PRESTIGE AVAILABLE · BARRACKS</span>' : 'MAX LEVEL') : `${(p.xp - base).toLocaleString()} / ${need.toLocaleString()} XP TO LEVEL ${p.level + 1}`}</div>
        </div>
        <h1 class="title glitch">${title}</h1>
        <div class="tag">${pause ? 'PAUSED' : 'PS1 WORLD · MODERN KIT'}</div>
        <nav>${this.navItems()
          .map(([id, label, small], i) => `<button type="button" data-tab="${id}" style="animation-delay:${animate ? 0.35 + i * 0.07 : 0}s">${label}${small ? `<small>${small}</small>` : ''}</button>`)
          .join('')}</nav>
        ${nu ? `<div class="rk-next bottom">NEXT UNLOCK · LVL ${nu[0]}<br><b>${nu[1]}</b></div>` : ''}
      </div>
      ${pause ? '' : `<aside class="home-side">${this.nearlyThere()}</aside>`}`;
  }

  /** Home teaser: the three open challenges closest to done. */
  private nearlyThere() {
    const p = this.ctx.game.profileData;
    const lvl = this.level();
    const open = CHALLENGES.filter((c) => !isDone(p, c))
      .map((c) => ({ c, k: statValue(p, c.stat, lvl) / c.target }))
      .sort((a, b) => b.k - a.k)
      .slice(0, 3);
    if (!open.length) return '';
    return `<div class="label" style="margin-top:0">NEARLY THERE</div>${open
      .map(({ c }) => {
        const v = Math.min(c.target, statValue(p, c.stat, lvl));
        return `<button type="button" class="mini-ch" data-tab="challenges"><b>${c.name}</b><span>${c.desc}</span>${bar((v / c.target) * 100)}<em>${v} / ${c.target}</em></button>`;
      })
      .join('')}`;
  }

  private pageShell(page: Page) {
    const tabs = this.navItems().filter(([id]) => id !== 'resume' && id !== 'quit');
    return `<div class="page">
      <header class="ph">
        <button type="button" class="back" data-back aria-label="Back">‹ BACK <small>ESC</small></button>
        <nav class="ptabs">${tabs.map(([id, label]) => `<button type="button" data-tab="${id}" class="${page === id ? 'on' : ''}">${label}</button>`).join('')}</nav>
        <div class="ph-card">${playerCard(this.ctx.game.profileData, { compact: true })}</div>
      </header>
      <main class="pbody" id="panel"><div class="pinner">${this.pageHtml(page)}</div></main>
    </div>`;
  }

  private select(t: Tab) {
    this.ctx.game.sfx.uiSelect();
    if (t === 'resume') return this.ctx.resume();
    if (t === 'quit') return this.ctx.quit();
    this.page = t;
    this.openSlot = null;
    this.prestigeArmed = false;
    this.render(true);
  }

  private back() {
    this.ctx.game.sfx.uiMove();
    this.page = null;
    this.preview?.stop();
    this.render(true);
  }

  // ------------------------------------------------------------------ pages

  private pageHtml(page: Page): string {
    switch (page) {
      case 'mp':
        return this.mpHtml();
      case 'bots':
        return this.botsHtml();
      case 'cac':
        return this.cacHtml();
      case 'soldier':
        return this.soldierHtml();
      case 'challenges':
        return this.challengesHtml();
      case 'barracks':
        return this.barracksHtml();
      case 'settings':
        return this.settingsHtml();
    }
  }

  private mpHtml() {
    const lists: [string, string][] = [
      ['TEAM DEATHMATCH · 6v6', 'Two squads. Most kills wins.'],
      ['FREE-FOR-ALL · 12 PLAYERS', 'Everyone for themselves.'],
      ['DOMINATION · 6v6', 'Hold three flags to tick up score.'],
      ['SEARCH & DESTROY · 6v6', 'One life per round. Plant or defuse.'],
      ['GROUND WAR · 9v9', 'Bigger lobbies on the largest maps.'],
    ];
    return `<h2>MULTIPLAYER</h2><div class="sub">Online play arrives in Phase 2. Until then, bot matches earn the same XP, unlocks, camos and challenges.</div>
      <div class="cols2">
        <div><div class="label">PLAYLISTS</div>${lists.map(([n, d]) => `<div class="playlist"><span>${n}<small>${d}</small></span><span class="chip">OFFLINE</span></div>`).join('')}
          <div class="row"><button class="go" type="button" disabled>FIND MATCH</button><button class="go ghost" type="button" data-act="tobots">PLAY BOTS INSTEAD</button></div></div>
        <div><div class="label">WHAT'S COMING</div>
          <div class="info-list">
            <div><b>DEDICATED SERVERS</b><span>30Hz authoritative servers in EU-West and US-East first.</span></div>
            <div><b>PARTIES</b><span>Squad up with friends and queue together.</span></div>
            <div><b>BOT BACKFILL</b><span>Lobbies are always full: bots hold slots until real players join.</span></div>
            <div><b>CROSS-SAVE</b><span>Your level, prestige, camos and banners carry over from bot play.</span></div>
          </div></div>
      </div>`;
  }

  private botsHtml() {
    const modes = (Object.keys(MODES) as Mode[])
      .map((m) => `<button type="button" class="card ${this.mode === m ? 'on' : ''}" data-mode="${m}"><b>${MODES[m].label}</b><span>${MODES[m].desc}</span><span>FIRST TO ${MODES[m].scoreLimit} · ${MODES[m].minutes} MIN</span></button>`)
      .join('');
    const diffs = (Object.keys(DIFFICULTIES) as DifficultyId[])
      .map((d) => {
        const D = DIFFICULTIES[d];
        return `<button type="button" class="card ${this.difficulty === d ? 'on' : ''}" data-diff="${d}"><b>${D.label}</b><span>${DIFF_INFO[d]}</span>
          <div class="stat"><span>REACTION</span>${bar((1 / D.react) * 55)}</div><div class="stat"><span>AIM</span>${bar(D.accuracy * 75)}</div><div class="stat"><span>DAMAGE</span>${bar(D.damage * 75)}</div></button>`;
      })
      .join('');
    const sel = MAPS.find((m) => m.id === this.mapId);
    const p = this.ctx.game.profileData;
    return `<h2>BOT MATCH</h2><div class="sub">Bots fight each other and you. Everything you earn here counts.</div>
      <div class="cols2 wide-right">
        <div>
          <div class="label">GAME MODE</div><div class="grid2">${modes}</div>
          <div class="label">BOT DIFFICULTY</div><div class="grid2 diffs">${diffs}</div>
        </div>
        <div>
          <div class="label">MAP</div>
          <div class="map-hero" style="background:${sel ? sel.swatch : 'repeating-linear-gradient(45deg,#2a2226 0 8px,#3a3034 8px 16px)'}">
            <div><b>${sel ? sel.name : 'RANDOM'}</b><span>${sel ? sel.desc : 'A different map from the pool each match.'}</span>
            ${sel ? `<em>${p.stats[`win_${sel.id}`] ?? 0} WINS HERE</em>` : ''}</div></div>
          <div class="maps">${this.mapCards()}</div>
          <button class="go" type="button" data-act="start">START MATCH</button>
          <div class="sub" style="margin-top:10px">You pick your class when the match loads.</div>
        </div>
      </div>`;
  }

  private settingsHtml() {
    const s = this.ctx.settings;
    return `<h2>SETTINGS</h2><div class="cols2"><div><div class="label">GAME</div><div class="settings">
      <label for="s-sens">SENSITIVITY</label><input id="s-sens" type="range" min="0.2" max="3" step="0.05" value="${s.sensitivity}"><span id="s-sens-v">${s.sensitivity.toFixed(2)}</span>
      <label for="s-fov">FIELD OF VIEW</label><input id="s-fov" type="range" min="65" max="100" step="1" value="${s.fov}"><span id="s-fov-v">${s.fov}°</span>
      <label for="s-vol">MASTER VOLUME</label><input id="s-vol" type="range" min="0" max="1" step="0.05" value="${s.volume}"><span id="s-vol-v">${Math.round(s.volume * 100)}%</span>
      <label for="s-mus">MUSIC</label><input id="s-mus" type="range" min="0" max="1" step="0.05" value="${s.music}"><span id="s-mus-v">${Math.round(s.music * 100)}%</span>
      <label for="s-res">WORLD RESOLUTION</label><select id="s-res">${[240, 360, 480, 720].map((r) => `<option value="${r}" ${s.lowHeight === r ? 'selected' : ''}>${r}p${r === 240 ? ' (true PS1)' : r === 480 ? ' (default)' : ''}</option>`).join('')}</select><span></span>
      <label for="s-dither">DITHERING</label><input id="s-dither" type="checkbox" ${s.dither ? 'checked' : ''}><span></span>
      <label for="s-unlock">UNLOCK ALL (TESTING)</label><input id="s-unlock" type="checkbox" ${s.unlockAll ? 'checked' : ''}><span></span>
    </div></div>
    <div><div class="label">CONTROLS</div><div class="keys grid-keys">
      <span><b>WASD</b> move</span><span><b>MOUSE</b> aim</span><span><b>LMB</b> fire</span><span><b>RMB</b> aim down sights</span>
      <span><b>SHIFT</b> sprint</span><span><b>SPACE</b> jump</span><span><b>C</b> crouch / slide</span><span><b>R</b> reload</span>
      <span><b>1 / 2 / WHEEL</b> switch weapon</span><span><b>V</b> melee</span><span><b>G</b> frag</span><span><b>Q</b> tactical</span><span><b>4</b> killstreak</span>
      <span><b>SHIFT (SCOPED)</b> hold breath</span>
      <span><b>TAB</b> scoreboard</span><span><b>ESC</b> pause / back</span></div></div></div>`;
  }

  private mapCards() {
    const cards = MAPS.map(
      (m) => `<button type="button" class="card map ${this.mapId === m.id ? 'on' : ''}" data-map="${m.id}">
        <i class="thumb" style="background:${m.swatch}"></i><b>${m.name}</b></button>`,
    );
    cards.push(`<button type="button" class="card map ${this.mapId === 'random' ? 'on' : ''}" data-map="random">
      <i class="thumb" style="background:repeating-linear-gradient(45deg,#2a2226 0 8px,#3a3034 8px 16px)"></i><b>RANDOM</b></button>`);
    return cards.join('');
  }

  private slotRow(key: string, label: string, opts: Choice[], current: string, u: Partial<UnlockCtx>, weaponName: string, attr = 'set', note = '') {
    const cur = opts.find((o) => o.id === current) ?? opts[0];
    const open = this.openSlot === key;
    // always reserve the swatch column so every row's value lines up
    const sw = `<i class="sw ${cur.swatch ? '' : 'none'}" style="background:${cur.swatch ?? 'transparent'}"></i>`;
    const choices = open
      ? `<div class="choices">${note ? `<div class="sub" style="grid-column:1/-1">${note}</div>` : ''}${opts
          .map((o, i) => {
            const grp = (o as Choice & { group?: string }).group;
            const head = grp && grp !== (opts[i - 1] as Choice & { group?: string } | undefined)?.group ? `<div class="choice-group">${grp}</div>` : '';
            const locked = !isUnlocked(o, this.ctxFor(u));
            const prog = locked && o.heads ? `<span class="prog">${Math.min(u.heads ?? 0, o.heads)} / ${o.heads}</span>${bar(((u.heads ?? 0) / o.heads) * 100)}` : '';
            return `${head}<button type="button" class="card ${current === o.id ? 'on' : ''} ${locked ? 'locked' : ''}" data-${attr}="${key}" data-val="${o.id}">
              <b>${o.swatch ? `<i class="sw" style="background:${o.swatch}"></i>` : ''}${o.name}</b>${o.desc ? `<span>${o.desc}</span>` : ''}${locked ? `<span class="lock">UNLOCKS · ${lockText(o, weaponName)}</span>${prog}` : ''}</button>`;
          })
          .join('')}</div>`
      : '';
    return `<button type="button" class="slot ${open ? 'open' : ''}" data-slot="${key}"><span class="sl">${label}</span><span class="sv">${sw}${cur.name}</span><span class="chev">${open ? '−' : '+'}</span></button>${choices}`;
  }

  /** Numbers behind the bars: what the current attachments actually do. */
  private statSheet(l: Loadout, slot: 'primary' | 'secondary') {
    const st = computeStats(l, slot);
    const w = slot === 'primary' ? l.weapon : l.secondary;
    const p = this.ctx.game.profileData;
    const heads = p.weaponHeads[w] ?? 0;
    const next = CAMOS.find((c) => (c.heads ?? 0) > heads);
    const rows: [string, string][] = [
      st.cls === 'sniper'
        ? ['DAMAGE', 'ONE SHOT: HEAD, TORSO · TWO: ARMS, LEGS']
        : ['DAMAGE', `${Math.round(st.damageAt(0))} – ${Math.round(st.damageAt(999))} · LIMBS ${Math.round(st.zoneDamage('limb', 0))}`],
      ['HEADSHOT', st.cls === 'sniper' ? 'KILL' : `${Math.round(st.zoneDamage('head', 0))} (×${WEAPONS[w].headMult})`],
      ['CLASS', `${WEAPON_CLASSES[st.cls].name} · ${st.move >= 1 ? 'FAST' : st.move >= 0.95 ? 'STEADY' : 'HEAVY'} MOVEMENT${st.bolt ? ' · BOLT ACTION' : ''}`],
      ['FIRE RATE', `${st.rpm} RPM${st.auto ? '' : ' · SEMI'}`],
      ['MAGAZINE', `${st.mag} + ${st.reserve}`],
      ['RELOAD', `${st.reload.toFixed(1)}s / ${st.reloadEmpty.toFixed(1)}s empty`],
      ['KILLS', `${p.weaponKills[w] ?? 0}`],
      ['HEADSHOT KILLS', `${heads}${next ? ` · ${next.name} AT ${next.heads}` : ' · GOLD'}`],
    ];
    return `<div class="sheet">${rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')}</div>`;
  }

  private cacTabs() {
    return `<div class="fchips"><button type="button" class="fchip ${this.cacTab === 'classes' ? 'on' : ''}" data-cact="classes">CLASSES</button>
      <button type="button" class="fchip ${this.cacTab === 'streaks' ? 'on' : ''}" data-cact="streaks">KILLSTREAKS</button></div>`;
  }

  /** Pick three killstreaks; they apply to every class. */
  private streaksHtml() {
    const p = this.ctx.game.profileData;
    const lvl = this.level();
    const draft = this.streakDraft ?? [...p.streaks];
    const cards = STREAK_ORDER.map((id) => {
      const s = STREAKS[id];
      const locked = !this.ctx.settings.unlockAll && (s.level ?? 1) > lvl && p.prestige === 0;
      const slot = draft.indexOf(id);
      return `<button type="button" class="card streakcard ${slot >= 0 ? 'on' : ''} ${locked ? 'locked' : ''}" data-streak="${id}">
        <div class="sk-ic">${streakIcon(id, 44)}</div>
        <b>${s.name}</b><span class="kc">${s.kills} KILLS</span><span>${s.desc}</span>
        ${locked ? `<span class="lock">UNLOCKS · LVL ${s.level}</span>` : ''}${slot >= 0 ? `<em class="slotn">${slot + 1}</em>` : ''}</button>`;
    }).join('');
    const picked = [...draft].sort((a, b) => STREAKS[a].kills - STREAKS[b].kills);
    const rail = [0, 1, 2]
      .map((i) => (picked[i] ? `<div class="pick">${streakIcon(picked[i], 30)}<b>${STREAKS[picked[i]].name}</b><span>${STREAKS[picked[i]].kills} KILLS</span></div>` : '<div class="pick empty"><b>EMPTY</b><span>PICK ONE</span></div>'))
      .join('');
    return `<h2>CREATE A CLASS</h2><div class="sub">Pick three killstreaks. Earn them with kills in a single life, then press [4] in a match to call in the newest one. They apply to every class.</div>
      ${this.cacTabs()}
      <div class="picks">${rail}</div>
      ${draft.length < 3 ? '<div class="sub" style="color:var(--gold)">Pick one more to save.</div>' : '<div class="sub">Tap a picked streak to swap it out.</div>'}
      <div class="streakgrid">${cards}</div>`;
  }

  private cacHtml() {
    if (this.cacTab === 'streaks') return this.streaksHtml();
    const c = this.ctx.classes[this.editIndex];
    const pk = this.ctx.game.profileData.weaponKills;
    const prim = WEAPONS[c.weapon];
    const sec = WEAPONS[c.secondary];
    const primKills = pk[c.weapon] ?? 0;
    const secKills = pk[c.secondary] ?? 0;
    const showSecondary = ['secondary', 'secAttach', 'secCamo'].includes(this.openSlot ?? '');
    const w = showSecondary ? sec : prim;
    const bars = Object.entries(w.bars)
      .map(([k, v]) => `<div class="stat"><span>${k.toUpperCase()}</span><div class="b"><i style="width:${v * 10}%"></i></div></div>`)
      .join('');
    // every primary, grouped by weapon class (the group header is drawn by slotRow)
    const primaries: (Choice & { group: string })[] = PRIMARY_IDS.map((id) => ({
      id, name: WEAPONS[id].name, desc: WEAPONS[id].blurb, level: WEAPONS[id].level, group: WEAPON_CLASSES[WEAPONS[id].cls].name,
    })).sort((a, b) => CLASS_ORDER.indexOf(WEAPONS[a.id].cls) - CLASS_ORDER.indexOf(WEAPONS[b.id].cls));
    const pu = this.weaponCtx(c.weapon);
    const su = this.weaponCtx(c.secondary);
    const rows = [
      `<div class="group-label">PRIMARY · ${primKills} KILLS</div>`,
      this.slotRow('weapon', 'WEAPON', primaries, c.weapon, {}, prim.name),
      this.slotRow('optic', 'OPTIC', fitsWeapon(OPTICS, c.weapon), c.optic, pu, prim.name),
      this.slotRow('muzzle', 'MUZZLE', MUZZLES, c.muzzle, pu, prim.name),
      this.slotRow('under', 'UNDERBARREL', fitsWeapon(UNDERS, c.weapon), c.under, pu, prim.name),
      this.slotRow('mag', 'MAGAZINE', MAGS, c.mag, pu, prim.name),
      this.slotRow('camo', 'CAMO', camosFor(c.weapon), c.camo, pu, prim.name),
      `<div class="group-label">SECONDARY · ${secKills} KILLS</div>`,
      this.slotRow('secondary', 'SIDEARM', SECONDARIES, c.secondary, {}, sec.name),
      this.slotRow('secAttach', 'ATTACHMENT', SEC_ATTACH, c.secAttach, su, sec.name, 'set', c.secondary === 'r357' ? 'The revolver takes no attachments.' : ''),
      this.slotRow('secCamo', 'CAMO', camosFor(c.secondary), c.secCamo, su, sec.name),
      `<div class="group-label">EQUIPMENT & PERKS</div>`,
      this.slotRow('tactical', 'TACTICAL', TACTICALS, c.tactical, {}, ''),
      this.slotRow('perk1', 'PERK 1', PERKS1, c.perk1, {}, ''),
      this.slotRow('perk2', 'PERK 2', PERKS2, c.perk2, {}, ''),
      this.slotRow('perk3', 'PERK 3', PERKS3, c.perk3, {}, ''),
    ].join('');
    const classList = this.ctx.classes
      .map((cl, i) => `<button type="button" class="card ${this.editIndex === i ? 'on' : ''}" data-edit="${i}"><b>${esc(cl.name)}</b><span>${WEAPONS[cl.weapon].name}</span><span>${WEAPONS[cl.secondary].name} · ${TACTICALS.find((t) => t.id === cl.tactical)?.name ?? ''}</span></button>`)
      .join('');
    return `<h2>CREATE A CLASS</h2><div class="sub">${this.context === 'pause' ? 'Changes apply on your next spawn.' : 'Attachments unlock with kills on each gun. Camos unlock with headshot kills.'}</div>
      ${this.cacTabs()}
      <div class="cac-layout">
        <div class="cac-classes"><div class="label" style="margin-top:0">CLASSES</div>${classList}
          <div class="label">NAME</div><input class="name" id="cname" maxlength="14" aria-label="Class name" value="${esc(c.name)}"></div>
        <div class="cac-view">
          <div class="studio" style="margin-top:0"><div id="preview-slot" data-kind="${showSecondary ? 'secondary' : 'primary'}"></div><div class="studio-info"><b>${w.name}</b>${bars}</div></div>
          <div class="label">${showSecondary ? 'SIDEARM' : 'PRIMARY'} STATS</div>${this.statSheet(c, showSecondary ? 'secondary' : 'primary')}
        </div>
        <div class="slots">${rows}</div>
      </div>`;
  }

  private bannerCard(b: Banner, locked: boolean, on: boolean, lockLabel: string) {
    return `<button type="button" class="bcard ${b.art ? 'art' : ''} ${on ? 'on' : ''} ${locked ? 'locked' : ''}" data-banner="${b.id}" style="background:${b.bg}" title="${b.name}">
      ${b.motif ? `<span class="pc-motif">${b.motif}</span>` : ''}${b.art ? '' : `<span class="bname">${b.name}</span>`}${locked ? `<span class="block">${lockLabel}</span>` : ''}</button>`;
  }

  private soldierHtml() {
    const p = this.ctx.game.profileData;
    const lvl = this.level();
    const all = this.ctx.settings.unlockAll;
    const opt = (key: 'uniform' | 'gear' | 'head', label: string, list: Choice[]) => this.slotRow(key, label, list, p.look[key], {}, '', 'look');
    const group = (list: Banner[], lockLabel: (b: Banner) => string) =>
      list.map((b) => this.bannerCard(b, !bannerUnlocked(b, lvl, p.prestige, all, p.challenges), p.banner === b.id, lockLabel(b))).join('');
    const rankB = BANNERS.filter((b) => !b.prestige && !b.challenge);
    const presB = BANNERS.filter((b) => b.prestige);
    const chB = BANNERS.filter((b) => b.challenge);
    const chGot = chB.filter((b) => bannerUnlocked(b, lvl, p.prestige, all, p.challenges)).length;
    return `<h2>SOLDIER</h2><div class="sub">Your operator and calling card. Faces and gear sets are still to come.</div>
      <div class="soldier-wrap"><div class="studio tall"><div id="preview-slot" data-kind="soldier"></div></div>
        <div class="soldier-side">${playerCard(p)}
          <div class="label">CALLSIGN</div><input class="name" id="callsign" maxlength="16" aria-label="Callsign" value="${esc(p.callsign)}">
          <div class="label">LOOK</div>
          <div class="slots">${opt('uniform', 'UNIFORM', UNIFORMS)}${opt('gear', 'GEAR', GEAR)}${opt('head', 'HEADGEAR', HEADGEAR)}</div>
        </div></div>
      <div class="label">RANK BANNERS</div><div class="banners">${group(rankB, (b) => `LVL ${b.level ?? 1}`)}</div>
      <div class="label">PRESTIGE BANNERS</div><div class="banners">${group(presB, (b) => `PRESTIGE ${b.prestige}`)}</div>
      <div class="label">CALLING CARDS · ${chGot} / ${chB.length} · EARNED FROM CHALLENGES</div><div class="banners cards">${group(chB, () => 'LOCKED')}</div>`;
  }

  private challengesHtml() {
    const p = this.ctx.game.profileData;
    const lvl = this.level();
    const doneN = p.challenges.length;
    const chips = (['all', 'open', 'done'] as const)
      .map((f) => `<button type="button" class="fchip ${this.chFilter === f ? 'on' : ''}" data-chf="${f}">${{ all: 'ALL', open: 'IN PROGRESS', done: 'COMPLETE' }[f]}</button>`)
      .join('');
    const keep = (done: boolean) => this.chFilter === 'all' || (this.chFilter === 'done') === done;
    const sections = THEMES.map((t) => {
      const list = CHALLENGES.filter((c) => c.theme === t.key && keep(isDone(p, c)));
      if (!list.length) return '';
      const got = CHALLENGES.filter((c) => c.theme === t.key && isDone(p, c)).length;
      const cards = list
        .map((c) => {
          const done = isDone(p, c);
          const v = Math.min(c.target, statValue(p, c.stat, lvl));
          return `<div class="chcard ${done ? 'done' : ''}">
            <div class="chban" style="background:url(${cardArt(c.id)}) center / 100% 100% no-repeat, #111">${done ? '<span class="chk">✓</span>' : ''}</div>
            <div class="chtxt"><span class="tier t${c.tier}">${TIER_NAMES[c.tier - 1]}</span><span>${c.desc}</span>${bar((v / c.target) * 100)}
              <div class="chfoot"><em>${done ? 'COMPLETE' : `${v.toLocaleString()} / ${c.target.toLocaleString()}`}</em><em>+${c.xp.toLocaleString()} XP · CARD</em></div></div></div>`;
        })
        .join('');
      return `<section class="chtheme"><div class="label">${t.name} · ${got}/5</div><div class="chgrid">${cards}</div></section>`;
    }).join('');
    return `<h2>CHALLENGES</h2><div class="sub">${doneN} of ${CHALLENGES.length} complete. Each challenge unlocks its calling card: 20 sets of 5, from a gunmetal frame up to gold mastery.</div>
      ${bar(doneN)}
      <div class="fchips">${chips}</div>
      ${sections || '<div class="sub">Nothing here yet.</div>'}`;
  }

  private camoTrack() {
    const p = this.ctx.game.profileData;
    const all = this.ctx.settings.unlockAll;
    const cls = Object.entries(WEAPON_CLASSES) as [WeaponClassId, (typeof WEAPON_CLASSES)[WeaponClassId]][];
    return cls
      .map(([id, wc]) => {
        const mastered = all || hasMastery(p.weaponHeads, id);
        const golds = wc.weapons.filter((w) => hasGold(p.weaponHeads, w)).length;
        const rows = wc.weapons
          .map((w) => {
            const h = p.weaponHeads[w] ?? 0;
            const swatches = CAMOS.slice(1)
              .map((c) => `<i class="sw ${h >= (c.heads ?? 0) || all ? '' : 'off'}" style="background:${c.swatch}" title="${c.name} · ${c.heads} headshot kills"></i>`)
              .join('');
            return `<div class="camo-row"><b>${WEAPONS[w].name}</b><span class="sws">${swatches}</span><span class="hk">${Math.min(h, GOLD_HEADS)} / ${GOLD_HEADS}</span>${bar((h / GOLD_HEADS) * 100)}</div>`;
          })
          .join('');
        return `<div class="mastery ${mastered ? 'got' : ''}">
          <div class="mh"><i class="sw big" style="background:${wc.camo.swatch}"></i><div><b>${wc.name} · ${wc.camo.name}</b>
            <span>${mastered ? 'MASTERY CAMO UNLOCKED for every weapon in this class.' : `Gold on every ${wc.name.toLowerCase().replace(/s$/, '')} unlocks it · ${golds} / ${wc.weapons.length} GOLD`}</span></div></div>
          ${rows}</div>`;
      })
      .join('');
  }

  private barracksHtml() {
    const p = this.ctx.game.profileSummary();
    const ready = this.ctx.game.prestigeReady;
    const track = [...unlockTrack().entries()]
      .map(([l, items]) => `<div class="playlist"><span>LVL ${l} · ${items.join(' · ')}</span><span class="chip ${p.level >= l || p.prestige > 0 ? 'ok' : ''}">${p.level >= l ? 'UNLOCKED' : 'LOCKED'}</span></div>`)
      .join('');
    const emblems = Array.from({ length: MAX_PRESTIGE }, (_, i) => `<div class="emb ${p.prestige >= i + 1 ? 'got' : ''}">${badgeImg(MAX_LEVEL, i + 1, 64)}<span>P${i + 1} · ${prestigeName(i + 1).toUpperCase()}</span></div>`).join('');
    const ladder = Array.from({ length: ART_MAX_LEVEL / 3 }, (_, i) => {
      const lvl = i * 3 + 1;
      return `<div class="emb ${p.level >= lvl || p.prestige > 0 ? 'got' : ''}">${badgeImg(lvl + 2, 0, 56)}<span>${lvl}–${lvl + 2} · ${rankInfo(lvl).abbr}</span></div>`;
    }).join('');
    const s = p.stats;
    const kd = p.deaths ? (p.kills / p.deaths).toFixed(2) : String(p.kills);
    const matches = s.matches ?? 0;
    const record: [string, string | number][] = [
      ['KILLS', p.kills], ['DEATHS', p.deaths], ['K/D', kd], ['HEADSHOTS', p.headshots],
      ['HEADSHOT %', p.kills ? `${Math.round((p.headshots / p.kills) * 100)}%` : '0%'], ['BEST STREAK', p.bestStreak],
      ['MATCHES', matches], ['WINS', s.wins ?? 0], ['WIN %', matches ? `${Math.round(((s.wins ?? 0) / matches) * 100)}%` : '0%'],
      ['BEST MATCH', `${s.best_match_kills ?? 0} KILLS`], ['LONGSHOTS', s.longshots ?? 0], ['FRAG KILLS', s.frag_kills ?? 0],
    ];
    const wk = (Object.keys(WEAPONS) as WeaponId[])
      .map((id) => `<div class="card"><b>${p.weaponKills[id] ?? 0}</b><span>${WEAPONS[id].name} · ${p.weaponHeads[id] ?? 0} HEADSHOT KILLS</span></div>`)
      .join('');
    return `<h2>BARRACKS</h2>
      <div class="cols2">
        <div>
          <div class="rankhead">${badgeImg(p.level, p.prestige, 96)}<div><div class="rk-big">${p.prestige ? `PRESTIGE ${p.prestige} · ` : ''}LEVEL ${p.level}</div>
            <div class="sub" style="margin:0">${rankInfo(p.level).name.toUpperCase()}${p.prestige ? ` · ${prestigeName(p.prestige).toUpperCase()}` : ''} · ${p.xp.toLocaleString()} XP this prestige</div></div></div>
          <div class="prestige-box">
            ${ready
              ? `<b>PRESTIGE ${p.prestige + 1} IS AVAILABLE</b><span>Resets you to level 1 and re-locks level unlocks. You keep your stats, weapon kills, camos, challenges and a new prestige emblem and banner.</span>
                 <button class="go" type="button" data-act="prestige">${this.prestigeArmed ? 'CONFIRM: RESET TO LEVEL 1' : `ENTER PRESTIGE ${p.prestige + 1}`}</button>`
              : `<b>${p.prestige >= MAX_PRESTIGE ? 'MAX PRESTIGE' : `PRESTIGE ${p.prestige + 1} AT LEVEL ${MAX_LEVEL}`}</b><span>Reach level ${MAX_LEVEL} to reset with a new emblem. ${MAX_PRESTIGE} prestiges in total.</span>`}
          </div>
          <div class="label">COMBAT RECORD</div>
          <div class="record">${record.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>
          <div class="label">WEAPON KILLS</div><div class="grid2">${wk}<div class="card"><b>${p.weaponKills.frag ?? 0}</b><span>FRAG GRENADE</span></div></div>
        </div>
        <div>
          <div class="label" style="margin-top:0">CAMOS & MASTERY</div>
          <div class="sub">Five camos per weapon from headshot kills, then gold at ${GOLD_HEADS}. Gold on every weapon in a class unlocks that class's mastery camo.</div>
          ${this.camoTrack()}
        </div>
      </div>
      <div class="label">PRESTIGE EMBLEMS</div><div class="emblems">${emblems}</div>
      <div class="label">RANK LADDER · 25 RANKS × 3 TIERS</div><div class="emblems">${ladder}</div>
      <div class="label">UNLOCK TRACK · LEVELS 1–${MAX_LEVEL}</div>${track}`;
  }

  private bindPanel() {
    const panel = this.root.querySelector('#panel') as HTMLDivElement | null;
    if (!panel) return;
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
    pick('chf', (v) => (this.chFilter = v as typeof this.chFilter));
    pick('cact', (v) => (this.cacTab = v as typeof this.cacTab));
    pick('streak', (v) => {
      const id = v as StreakId;
      const draft = this.streakDraft ?? [...g.profileData.streaks];
      const i = draft.indexOf(id);
      if (i >= 0) draft.splice(i, 1);
      else if (draft.length < 3) draft.push(id);
      if (draft.length === 3) {
        g.profileData.streaks = draft;
        g.saveProfileNow();
        this.streakDraft = null;
      } else this.streakDraft = draft;
    });
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
        const key = b.dataset.set!;
        c[key] = b.dataset.val!;
        if (c.secondary === 'r357') c.secAttach = 'none';
        if (key === 'weapon') fixAttachments(this.ctx.classes[this.editIndex]);
        // a new gun keeps its camo only if that camo is earned on the new gun too
        if (key === 'weapon' || key === 'secondary') {
          const camoKey = key === 'weapon' ? 'camo' : 'secCamo';
          const w = c[key] as WeaponId;
          const camo = camosFor(w).find((o) => o.id === c[camoKey]);
          if (!camo || !isUnlocked(camo, this.ctxFor(this.weaponCtx(w)))) c[camoKey] = 'none';
        }
        saveClasses(this.ctx.classes);
        this.openSlot = key === 'secondary' ? 'secondary' : null;
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
      rerender();
    });
    const call = panel.querySelector('#callsign') as HTMLInputElement | null;
    call?.addEventListener('change', () => {
      g.profileData.callsign = call.value.trim().toUpperCase().slice(0, 16) || 'OPERATOR';
      g.saveProfileNow();
      rerender();
    });

    // settings
    const s = this.ctx.settings;
    const range = (id: string, key: 'sensitivity' | 'fov' | 'volume' | 'music', fmt: (v: number) => string) => {
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
    range('s-mus', 'music', (v) => `${Math.round(v * 100)}%`);
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
      rerender();
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
