/**
 * Save data: every persisted blob (profile, classes, settings) goes through here.
 *
 * - Each key is written with a rolling backup (`<key>.bak`) holding the last good copy,
 *   so a torn or corrupt write falls back instead of wiping progress.
 * - The browser is asked to keep storage persistent (not evicted under disk pressure).
 * - A whole save can be exported as a code or a file and imported on another browser.
 * - `setRemoteSync` is the hook for cloud saves (accounts arrive with online play): when an
 *   adapter is set, every write is pushed (debounced) and `pullRemote` restores from it.
 *   Nothing is sent anywhere until an adapter is registered.
 */
export const SAVE_VERSION = 3;

export const SAVE_KEYS = {
  profile: 'deadpixel.profile.v1',
  classes: 'deadpixel.classes.v1',
  settings: 'deadpixel.settings.v1',
} as const;
type SaveKey = (typeof SAVE_KEYS)[keyof typeof SAVE_KEYS];

/** Storage backend; localStorage by default, memory when that is unavailable. */
export interface SaveStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const memory = new Map<string, string>();
const memoryStore: SaveStore = {
  get: (k) => memory.get(k) ?? null,
  set: (k, v) => void memory.set(k, v),
  remove: (k) => void memory.delete(k),
};

function pickStore(): SaveStore {
  try {
    const probe = '__dp_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return {
      get: (k) => localStorage.getItem(k),
      set: (k, v) => localStorage.setItem(k, v),
      remove: (k) => localStorage.removeItem(k),
    };
  } catch {
    return memoryStore;
  }
}

let store: SaveStore = pickStore();
export const storageOk = () => store !== memoryStore;
/** Swap the backend (tests, or a host page that provides its own storage). */
export function setSaveStore(s: SaveStore) {
  store = s;
}

let lastSaved = 0;
export const lastSavedAt = () => lastSaved;

/** Read a saved value, falling back to the backup copy if the main one is missing or corrupt. */
export function readSave<T>(key: SaveKey): T | null {
  for (const k of [key, `${key}.bak`]) {
    try {
      const raw = store.get(k);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // try the backup
    }
  }
  return null;
}

/** Write a value; the previous good copy is kept as the backup. */
export function writeSave(key: SaveKey, value: unknown) {
  try {
    const json = JSON.stringify(value);
    const prev = store.get(key);
    if (prev && prev !== json) {
      try {
        JSON.parse(prev);
        store.set(`${key}.bak`, prev);
      } catch {
        // previous copy was corrupt; don't promote it
      }
    }
    store.set(key, json);
    lastSaved = Date.now();
    scheduleRemote();
  } catch {
    // quota or private mode: keep playing, progress lives in memory this session
    memoryStore.set(key, JSON.stringify(value));
  }
}

/** Ask the browser not to evict our storage. Resolves true when granted. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- export / import

export interface SaveSnapshot {
  v: number;
  at: number;
  profile: unknown;
  classes: unknown;
  settings: unknown;
}

export function snapshot(): SaveSnapshot {
  return {
    v: SAVE_VERSION,
    at: Date.now(),
    profile: readSave(SAVE_KEYS.profile),
    classes: readSave(SAVE_KEYS.classes),
    settings: readSave(SAVE_KEYS.settings),
  };
}

function checksum(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

const toB64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const fromB64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

/** A copy-paste save code: DP<version>.<base64 json>.<checksum> */
export function exportCode(): string {
  const body = toB64(JSON.stringify(snapshot()));
  return `DP${SAVE_VERSION}.${body}.${checksum(body)}`;
}

/** Validate a save code (or exported file text); returns the snapshot or an error message. */
export function parseCode(code: string): SaveSnapshot | string {
  const m = code.trim().match(/^DP(\d+)\.([A-Za-z0-9+/=]+)\.([a-z0-9]+)$/);
  if (!m) return 'That is not a DEAD PIXEL save code.';
  if (checksum(m[2]) !== m[3]) return 'The save code is damaged (checksum mismatch).';
  try {
    const snap = JSON.parse(fromB64(m[2])) as SaveSnapshot;
    if (!snap || typeof snap !== 'object' || !snap.profile) return 'The save code has no profile in it.';
    return snap;
  } catch {
    return 'The save code could not be read.';
  }
}

/** Replace the current save with a snapshot (the caller reloads the page afterwards). */
export function applySnapshot(snap: SaveSnapshot) {
  if (snap.profile) writeSave(SAVE_KEYS.profile, snap.profile);
  if (snap.classes) writeSave(SAVE_KEYS.classes, snap.classes);
  if (snap.settings) writeSave(SAVE_KEYS.settings, snap.settings);
}

/**
 * Offer the save as a downloadable .txt file. Inside the claude.ai artifact viewer the
 * download goes through the viewer's `downloads` capability (it asks the player first);
 * anywhere else a normal download link is used. Resolves a short status message.
 */
export async function downloadSave(): Promise<string> {
  const filename = `dead-pixel-save-${new Date().toISOString().slice(0, 10)}.txt`;
  const data = exportCode();
  type Downloads = { save(r: { filename: string; data: string }): Promise<unknown> };
  const host = (window as unknown as { claude?: { use(n: string): Promise<Downloads | null> } }).claude;
  if (host?.use) {
    const dl = await host.use('downloads').catch(() => null);
    if (dl) {
      try {
        await dl.save({ filename, data });
        return 'Save file downloaded.';
      } catch (e) {
        const code = (e as { code?: string }).code;
        return code === 'declined' ? 'Download cancelled.' : 'Downloads are not available here. Use COPY SAVE CODE instead.';
      }
    }
  }
  const blob = new Blob([data], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'Save file downloaded.';
}

// ---------------------------------------------------------------- cloud hook (ready, unused)

export interface RemoteSync {
  push(snap: SaveSnapshot): Promise<void>;
  pull(): Promise<SaveSnapshot | null>;
}

let remote: RemoteSync | null = null;
let remoteTimer = 0;

/** Register a cloud backend; from then on saves are pushed a few seconds after each write. */
export function setRemoteSync(r: RemoteSync | null) {
  remote = r;
}

function scheduleRemote() {
  if (!remote) return;
  clearTimeout(remoteTimer);
  remoteTimer = window.setTimeout(() => void remote?.push(snapshot()).catch(() => {}), 4000);
}

/** Restore from the cloud if its copy is newer than ours. Returns true when it replaced the local save. */
export async function pullRemote(): Promise<boolean> {
  if (!remote) return false;
  const snap = await remote.pull();
  if (!snap || snap.at <= lastSaved) return false;
  applySnapshot(snap);
  return true;
}
