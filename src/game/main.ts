import { Game, type Settings } from './game';

const SETTINGS_KEY = 'deadpixel.settings.v1';
const defaults: Settings = { sensitivity: 1, fov: 80, dither: true, lowHeight: 240, volume: 0.7 };

function loadSettings(): Settings {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { ...defaults };
  }
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

const canvas = document.getElementById('view') as HTMLCanvasElement;
const menu = document.getElementById('menu') as HTMLDivElement;
const deploy = document.getElementById('deploy') as HTMLButtonElement;
const profileEl = document.getElementById('profile') as HTMLDivElement;
const settings = loadSettings();
const game = new Game(canvas, settings);
const debug = new URLSearchParams(location.search).has('debug');
game.input.forceActive = debug;

function bindRange(id: string, key: 'sensitivity' | 'fov' | 'volume', fmt: (v: number) => string) {
  const input = document.getElementById(id) as HTMLInputElement;
  const out = document.getElementById(`${id}-v`) as HTMLSpanElement;
  input.value = String(settings[key]);
  out.textContent = fmt(settings[key]);
  input.addEventListener('input', () => {
    settings[key] = Number(input.value);
    out.textContent = fmt(settings[key]);
    game.applySettings();
    saveSettings(settings);
  });
}
bindRange('sens', 'sensitivity', (v) => v.toFixed(2));
bindRange('fov', 'fov', (v) => `${v}°`);
bindRange('vol', 'volume', (v) => `${Math.round(v * 100)}%`);

const res = document.getElementById('res') as HTMLSelectElement;
res.value = String(settings.lowHeight);
res.addEventListener('change', () => {
  settings.lowHeight = Number(res.value);
  game.applySettings();
  saveSettings(settings);
});
const dither = document.getElementById('dither') as HTMLInputElement;
dither.checked = settings.dither;
dither.addEventListener('change', () => {
  settings.dither = dither.checked;
  game.applySettings();
  saveSettings(settings);
});

function renderProfile() {
  const p = game.profileSummary();
  const kd = p.deaths ? (p.kills / p.deaths).toFixed(2) : p.kills.toFixed(2);
  profileEl.innerHTML = `LVL <b>${p.level}</b> · ${p.xp.toLocaleString()} XP · K/D ${kd} · BEST STREAK ${p.bestStreak}`;
}

function showMenu(resume: boolean) {
  renderProfile();
  deploy.textContent = resume ? 'RESUME' : 'DEPLOY';
  menu.style.display = 'flex';
  game.setPaused(true);
}

deploy.addEventListener('click', () => {
  game.sfx.init();
  if (debug) {
    menu.style.display = 'none';
    game.setPaused(false);
    return;
  }
  game.input.lock();
  // Some embeds refuse pointer lock: fall back to free mouse-look
  setTimeout(() => {
    if (document.pointerLockElement === canvas) return;
    game.input.forceActive = true;
    menu.style.display = 'none';
    game.setPaused(false);
  }, 500);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && game.input.forceActive && !debug && !game.paused) {
    game.input.forceActive = false;
    showMenu(true);
  }
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    menu.style.display = 'none';
    game.setPaused(false);
  } else {
    showMenu(true);
  }
});

window.addEventListener('resize', () => game.resize());

let last = performance.now();
function frame(t: number) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  if (!game.paused) game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
showMenu(false);
requestAnimationFrame(frame);

if (debug) (window as unknown as { game: Game }).game = game;
