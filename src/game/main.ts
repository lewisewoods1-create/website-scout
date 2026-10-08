import { Game, type MatchConfig, type Settings } from './game';
import { Menu } from './menu';
import { loadClasses } from './loadout';

const SETTINGS_KEY = 'deadpixel.settings.v1';
const defaults: Settings = { sensitivity: 1, fov: 80, dither: true, lowHeight: 240, volume: 0.7, unlockAll: false };

function loadSettings(): Settings {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { ...defaults };
  }
}

const canvas = document.getElementById('view') as HTMLCanvasElement;
const boot = document.getElementById('boot') as HTMLDivElement;
const scan = document.querySelector('.scan') as HTMLDivElement;
const settings = loadSettings();
const classes = loadClasses();
const game = new Game(canvas, settings);
const debug = new URLSearchParams(location.search).has('debug');
game.input.forceActive = debug;

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
  scan.style.display = 'none';
  game.setPaused(false);
}

function openPause() {
  game.setPaused(true);
  scan.style.display = '';
  menu.open('pause');
}

const menu = new Menu({
  game,
  classes,
  settings,
  saveSettings,
  startMatch(cfg: MatchConfig) {
    game.startMatch(cfg, classes);
    lockOrFallback();
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

game.onExit = () => {
  game.quitToMenu();
  scan.style.display = '';
  menu.open('main');
};

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) enterPlay();
  else if (game.phase === 'match' && !menu.isOpen) openPause();
});

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
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (debug) Object.assign(window, { game, menu, finishBoot });
