import { Game, type MatchConfig, type Settings } from './game';
import { Menu } from './menu';
import { loadClasses } from './loadout';
import { startBadgeAnimation } from './badges';

const SETTINGS_KEY = 'deadpixel.settings.v1';
const defaults: Settings = { sensitivity: 1, fov: 80, dither: true, lowHeight: 480, volume: 0.7, music: 0.5, unlockAll: false };

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings> & { v?: number };
    // v2: default world resolution raised to 480p
    if ((saved.v ?? 1) < 2) {
      delete saved.lowHeight;
      saved.v = 2;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(saved));
    }
    return { ...defaults, ...saved };
  } catch {
    return { ...defaults };
  }
}

const canvas = document.getElementById('view') as HTMLCanvasElement;
const boot = document.getElementById('boot') as HTMLDivElement;
const settings = loadSettings();
const classes = loadClasses();
const t0 = performance.now();
const game = new Game(canvas, settings);
startBadgeAnimation();
const tGame = performance.now() - t0;
const debug = new URLSearchParams(location.search).has('debug');
game.input.forceActive = debug;

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, v: 2 }));
  } catch {
    // ignore
  }
  game.applySettings();
}

function lockOrFallback() {
  if (debug) {
    enterPlay();
    return;
  }
  game.input.lock();
  // Some embeds refuse pointer lock: fall back to free mouse-look
  setTimeout(() => {
    if (document.pointerLockElement === canvas) return;
    game.input.forceActive = true;
    enterPlay();
  }, 500);
}

function enterPlay() {
  menu.close();
  game.setPaused(false);
}

function openPause() {
  game.setPaused(true);
  menu.open('pause');
}

const menu = new Menu({
  game,
  classes,
  settings,
  saveSettings,
  startMatch(cfg: MatchConfig) {
    game.startMatch(cfg, classes);
    // class picker is shown in the HUD; pointer locks once a class is chosen
    menu.close();
    game.setPaused(false);
  },
  resume() {
    lockOrFallback();
  },
  quit() {
    game.setPaused(false);
    game.quitToMenu();
    menu.open('main');
  },
});

game.onClassChosen = () => lockOrFallback();

game.onExit = () => {
  game.quitToMenu();
  menu.open('main');
};

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) enterPlay();
  else if (game.phase === 'match' && !menu.isOpen) openPause();
});

window.addEventListener(
  'keydown',
  (e) => {
    // keep Tab for the scoreboard instead of moving focus out of the game
    if (e.code === 'Tab' && game.phase === 'match') e.preventDefault();
    if (game.choosingClass && /^Digit[1-3]$/.test(e.code)) game.chooseClass(Number(e.code.slice(5)) - 1);
  },
  { capture: true },
);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && game.input.forceActive && !debug && game.phase === 'match' && !menu.isOpen) {
    game.input.forceActive = false;
    openPause();
  }
});

// boot: title letters, then "press any key"
const bootTitle = document.getElementById('boot-title') as HTMLHeadingElement;
bootTitle.innerHTML = 'DEAD PIXEL'
  .split('')
  .map((ch, i) => `<span style="animation-delay:${1 + i * 0.07}s">${ch === ' ' ? '&nbsp;' : ch}</span>`)
  .join('');
let booted = false;
function finishBoot() {
  if (booted) return;
  booted = true;
  game.sfx.init();
  game.sfx.boot();
  boot.classList.add('out');
  setTimeout(() => boot.remove(), 700);
  menu.open('main');
}
boot.addEventListener('click', finishBoot);
window.addEventListener('keydown', finishBoot, { once: true });

window.addEventListener('resize', () => game.resize());

let last = performance.now();
function frame(t: number) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  if (game.phase === 'ended' && document.pointerLockElement) document.exitPointerLock();
  if (!(game.phase === 'match' && game.paused)) game.update(dt);
  const tr = performance.now();
  game.render();
  if (debug && frameCount++ < 3) console.info(`[boot] frame ${frameCount} render ${(performance.now() - tr).toFixed(0)}ms`);
  requestAnimationFrame(frame);
}
let frameCount = 0;
requestAnimationFrame(frame);

if (debug) console.info(`[boot] game constructed in ${tGame.toFixed(0)}ms`);
if (debug) Object.assign(window, { game, menu, finishBoot });
