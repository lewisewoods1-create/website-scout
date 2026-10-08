import { WEAPONS, type WeaponId } from './loadout';
/** Fully synthesised SFX — no audio assets needed for the prototype. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  /** effects go here; music has its own bus so it can be mixed separately */
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  volume = 0.7;
  musicVolume = 0.5;
  private track: 'menu' | 'match' | null = null;
  private wantTrack: 'menu' | 'match' | null = null;
  private seqTimer = 0;
  private nextBeat = 0;
  private beat = 0;

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicVolume * 0.5;
    this.musicBus.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.wantTrack) this.music(this.wantTrack);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.value = v;
  }

  setMusicVolume(v: number) {
    this.musicVolume = v;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.1);
  }

  private out(gain: number, pan: number, bus?: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(bus ?? this.sfxBus);
    return g;
  }

  // ------------------------------------------------------------------ music

  /**
   * Synthesised score. 'menu': dark synthwave loop (A minor, 96 bpm) with bass, pads,
   * arpeggio and drums. 'match': low tension bed (drone + slow pulse) under the gunfire.
   * Switching tracks crossfades through the music bus.
   */
  music(track: 'menu' | 'match' | null) {
    this.wantTrack = track;
    if (!this.ctx || track === this.track) return;
    const ctx = this.ctx;
    this.track = track;
    clearInterval(this.seqTimer);
    this.musicBus.gain.cancelScheduledValues(ctx.currentTime);
    this.musicBus.gain.setValueAtTime(0, ctx.currentTime);
    if (!track) return;
    this.musicBus.gain.linearRampToValueAtTime(this.musicVolume * (track === 'menu' ? 0.5 : 0.32), ctx.currentTime + 1.5);
    this.nextBeat = ctx.currentTime + 0.1;
    this.beat = 0;
    const schedule = () => {
      while (this.nextBeat < ctx.currentTime + 0.4) {
        if (this.track === 'menu') this.menuStep(this.nextBeat, this.beat);
        else this.matchStep(this.nextBeat, this.beat);
        this.nextBeat += 60 / (this.track === 'menu' ? 96 : 70) / 4; // 16th notes
        this.beat++;
      }
    };
    schedule();
    this.seqTimer = window.setInterval(schedule, 100);
  }

  private mtone(t: number, dur: number, f: number, type: OscillatorType, peak: number, attack = 0.01, cutoff = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (cutoff) {
      const f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = cutoff;
      f2.Q.value = 4;
      node = o.connect(f2);
    }
    node.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private mnoise(t: number, dur: number, type: BiquadFilterType, freq: number, peak: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  private menuStep(t: number, step: number) {
    const s16 = step % 16;
    const bar = Math.floor(step / 16) % 8;
    // Am - F - C - G, twice; second pass lifts an octave in the arp
    const roots = [55, 43.65, 65.41, 49, 55, 43.65, 65.41, 49];
    const chords = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
    const root = roots[bar];
    const ch = chords[bar % 4];
    const semis = (n: number) => Math.pow(2, n / 12);
    // drums: kick on 1 and 3 (plus a push), snare on 2 and 4, closed hats on 8ths
    if (s16 === 0 || s16 === 8 || (s16 === 14 && bar % 2 === 1)) {
      const ctx = this.ctx!;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.32);
    }
    if (s16 === 4 || s16 === 12) {
      this.mnoise(t, 0.22, 'bandpass', 1800, 0.5);
      this.mtone(t, 0.12, 190, 'triangle', 0.25);
    }
    if (s16 % 2 === 0) this.mnoise(t, 0.04, 'highpass', 8000, s16 % 4 === 2 ? 0.16 : 0.08);
    // bass: driving 8ths on the root, octave jump at the end of the bar
    if (s16 % 2 === 0) this.mtone(t, 0.2, root * (s16 === 14 ? 2 : 1), 'sawtooth', 0.22, 0.005, 420);
    // pad: chord held across the bar
    if (s16 === 0) for (const n of ch) this.mtone(t, 2.4, root * 4 * semis(n), 'sawtooth', 0.045, 0.6, 1400);
    // arp: chord tones in 16ths, brighter in the second half of the loop
    const arpOct = Math.floor(step / 128) % 2 ? 8 : 4;
    const arp = [0, 1, 2, 1, 0, 2, 1, 2];
    this.mtone(t, 0.14, root * arpOct * semis(ch[arp[s16 % 8]] + (s16 >= 8 ? 12 : 0)), 'square', 0.035, 0.003, 2600);
  }

  private matchStep(t: number, step: number) {
    const s16 = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const root = [55, 55, 51.91, 49][bar];
    // low drone pulse + distant war rumble; stays under the gunfire
    if (s16 === 0) {
      this.mtone(t, 3.6, root, 'sawtooth', 0.12, 1.2, 220);
      this.mtone(t, 3.6, root * 1.5, 'sine', 0.05, 1.5);
      this.mnoise(t, 2.5, 'lowpass', 140, 0.25);
    }
    if (s16 % 4 === 0) this.mtone(t, 0.25, root * 2, 'triangle', 0.08, 0.005);
    if (s16 === 10 && bar === 3) this.mtone(t, 1.2, root * 8 * Math.pow(2, 3 / 12), 'sine', 0.03, 0.3);
  }

  // ------------------------------------------------------------------ match flow stings

  /** Countdown tick; `last` is the final GO. */
  countdownBeep(n: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.4, 0);
    if (n > 0) {
      this.tone(out, t, 0.14, n <= 3 ? 880 : 660, n <= 3 ? 880 : 660, 'square', 0.35);
      this.tone(out, t, 0.25, 110, 90, 'sine', 0.5);
    } else {
      [440, 554, 659, 880].forEach((f) => this.tone(out, t, 0.7, f, f, 'sawtooth', 0.12));
      this.burst(out, t, 0.6, 'lowpass', 1200, 0.6, 0.9);
      this.tone(out, t, 0.5, 120, 40, 'sine', 1);
    }
  }

  /** Promotion fanfare for the rank-up screen. */
  rankUp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.35, 0);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone(out, t + i * 0.09, 0.5, f, f, 'triangle', 0.4));
    notes.forEach((f) => this.tone(out, t + 0.42, 1.3, f, f * 1.003, 'sawtooth', 0.09));
    this.burst(out, t + 0.42, 1.4, 'highpass', 5000, 0.5, 0.25);
    this.tone(out, t + 0.42, 0.6, 130, 60, 'sine', 0.8);
  }

  /** Killstreak earned. */
  streakReady() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.35, 0);
    [392, 523.25, 783.99].forEach((f, i) => this.tone(out, t + i * 0.07, 0.35, f, f, 'square', 0.22));
    this.tone(out, t + 0.21, 0.8, 1046.5, 1046.5, 'triangle', 0.3);
    this.burst(out, t, 0.25, 'bandpass', 3000, 1, 0.35);
  }

  /** Killstreak called in: radio squelch + confirm. */
  streakCall() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.35, 0);
    this.burst(out, t, 0.12, 'bandpass', 2200, 4, 0.8);
    this.tone(out, t + 0.12, 0.08, 1200, 1200, 'square', 0.25);
    this.tone(out, t + 0.22, 0.12, 1600, 1600, 'square', 0.25);
    this.burst(out, t + 0.34, 0.1, 'bandpass', 2200, 4, 0.6);
  }

  whistle(distance: number, pan: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(this.out(Math.min(0.5, 14 / (distance + 6)), pan), t, 0.55, 2400, 700, 'sine', 0.5);
  }

  thud(distance: number, pan: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(Math.min(0.8, 10 / (distance + 4)), pan);
    this.tone(out, t, 0.3, 90, 40, 'sine', 1);
    this.burst(out, t, 0.25, 'lowpass', 600, 0.6, 0.8);
  }

  /** Jet passing overhead: rising roar then doppler drop. */
  jet() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(1600, t + 2);
    f.frequency.exponentialRampToValueAtTime(250, t + 4.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 4.4);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + 4.5);
  }

  /** System Crash: a falling digital tear-down. */
  systemCrash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.5, 0);
    for (let i = 0; i < 14; i++) this.tone(out, t + i * 0.12, 0.1, 1800 - i * 110, 1700 - i * 110, 'square', 0.25);
    this.tone(out, t + 1.7, 1.8, 220, 30, 'sawtooth', 0.6);
    this.burst(out, t + 1.7, 2, 'lowpass', 800, 0.5, 1);
  }

  melee(hit: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.4, 0);
    this.burst(out, t, 0.12, 'bandpass', 900, 1.5, 0.5);
    if (hit) {
      this.tone(out, t + 0.08, 0.15, 160, 60, 'sine', 1);
      this.burst(out, t + 0.08, 0.12, 'lowpass', 900, 0.6, 1);
    }
  }

  private burst(dest: AudioNode, t: number, dur: number, type: BiquadFilterType, freq: number, q = 0.7, peak = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  private tone(dest: AudioNode, t: number, dur: number, f0: number, f1: number, type: OscillatorType, peak = 1) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** distance in metres (0 = player's own gun), pan -1..1 */
  gunshot(distance = 0, pan = 0, weapon: string = 'kr4', suppressed = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const near = distance < 1;
    const ak = weapon === 'vk47' || weapon === 'r357';
    const pistol = weapon === 'p9';
    if (suppressed) {
      const out = this.out(near ? 0.45 : Math.min(0.3, 4 / (distance + 4)), pan);
      this.burst(out, t, 0.06, 'bandpass', 900, 1.2, 1);
      this.tone(out, t, 0.06, 220, 90, 'sine', 0.5);
      if (near) this.tone(out, t + 0.02, 0.03, 3200, 2400, 'square', 0.05);
      return;
    }
    // per-class character: crack length, body pitch, tail length, loudness
    const cls = WEAPONS[weapon as WeaponId]?.cls ?? 'ar';
    const prof = {
      ar: { crack: ak ? 0.12 : 0.09, lp: ak ? 6500 : 9000, body: ak ? 900 : 1400, tail: ak ? 0.6 : 0.45, thump: ak ? 110 : 140, len: ak ? 0.18 : 0.13, vol: 0.9 },
      smg: { crack: 0.06, lp: 10000, body: 1700, tail: 0.32, thump: 160, len: 0.09, vol: 0.75 },
      heavy: { crack: 0.13, lp: 6000, body: 800, tail: 0.7, thump: 95, len: 0.22, vol: 1 },
      sniper: { crack: 0.18, lp: 5200, body: 600, tail: 1.6, thump: 70, len: 0.4, vol: 1.15 },
      marksman: { crack: 0.13, lp: 6000, body: 850, tail: 0.8, thump: 100, len: 0.22, vol: 1 },
      handgun: { crack: ak ? 0.12 : 0.06, lp: 900, body: ak ? 900 : 1400, tail: ak ? 0.6 : 0.45, thump: ak ? 110 : 140, len: ak ? 0.18 : 0.13, vol: 0.9 },
    }[cls];
    const att = near ? 1 : Math.min(1, (cls === 'sniper' ? 14 : 9) / (distance + 4));
    const out = this.out(att * (near ? prof.vol : 0.85), pan);
    const lp = near ? prof.lp : Math.max(900, 6000 - distance * 90);
    this.burst(out, t, near ? prof.crack : 0.07, pistol ? 'highpass' : 'lowpass', pistol ? 900 : lp, 0.5, 1.2);
    this.burst(out, t, prof.tail, 'bandpass', near ? prof.body : 700, 0.6, 0.25);
    this.tone(out, t, prof.len, near ? prof.thump : 100, 38, 'sine', near ? 1.2 : 0.6);
    if (near) this.tone(out, t + 0.03, 0.03, cls === 'smg' ? 3600 : ak ? 2400 : 3200, 1900, 'square', 0.04);
    if (cls === 'sniper') this.burst(this.out(att * 0.35, pan), t + 0.08, 1.8, 'lowpass', 420, 0.4, 0.5); // rolling echo
  }

  explosion(distance: number, pan: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const att = Math.min(1, 14 / (distance + 6));
    const out = this.out(att, pan);
    this.burst(out, t, 0.9, 'lowpass', Math.max(500, 2400 - distance * 40), 0.4, 1.4);
    this.burst(out, t, 1.6, 'lowpass', 300, 0.5, 0.6);
    this.tone(out, t, 0.6, 70, 28, 'sine', 1.4);
  }

  stunBang(distance: number, pan: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(Math.min(1, 12 / (distance + 4)), pan);
    this.burst(out, t, 0.35, 'highpass', 1800, 0.5, 1.4);
    this.tone(out, t, 0.2, 180, 60, 'sine', 0.9);
    if (distance < 9) this.tone(this.out(0.12, 0), t + 0.1, 2.2, 3200, 3150, 'sine', 0.5); // tinnitus
  }

  smokePop(distance: number, pan: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(Math.min(0.6, 8 / (distance + 4)), pan);
    this.burst(out, t, 0.08, 'bandpass', 900, 1, 1);
    this.burst(out, t + 0.05, 2.2, 'highpass', 2500, 0.6, 0.35);
  }

  pin() {
    this.click(3200, 0.25);
  }

  /** Menu boot: rising chord + shimmer. */
  boot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.35, 0);
    [130.8, 196, 261.6, 329.6, 392, 523.2].forEach((f, i) => {
      this.tone(out, t + i * 0.06, 2.2 - i * 0.15, f, f * 1.002, i % 2 ? 'triangle' : 'sine', 0.3);
    });
    this.burst(out, t + 0.4, 1.4, 'highpass', 6000, 0.5, 0.15);
  }

  uiMove() {
    if (!this.ctx) return;
    this.tone(this.out(0.15, 0), this.ctx.currentTime, 0.04, 880, 880, 'square', 0.3);
  }

  uiSelect() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.2, 0);
    this.tone(out, t, 0.06, 660, 660, 'square', 0.3);
    this.tone(out, t + 0.06, 0.1, 990, 990, 'square', 0.3);
  }

  hitmarker(kill = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.35, 0);
    this.tone(out, t, 0.04, 2400, 2200, 'square', 0.4);
    if (kill) this.tone(out, t + 0.06, 0.06, 1600, 1500, 'square', 0.35);
  }

  /** Bolt-action: lift, rack back, push home, lock — spread over the cycle. */
  boltCycle(secs: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.3, 0.15);
    for (const [at, f] of [[0.18, 1400], [0.38, 900], [0.6, 1100], [0.8, 1700]] as const) {
      this.burst(out, t + at * secs, 0.035, 'bandpass', f, 3, 0.9);
      this.tone(out, t + at * secs, 0.02, f * 0.5, f * 0.45, 'triangle', 0.25);
    }
  }

  /** Hit on the head: a bright helmet "dink" over a dull crack, distinct from the body hitmarker. */
  headshot(kill = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.45, 0);
    this.tone(out, t, 0.22, 3150, 3050, 'sine', 0.55);
    this.tone(out, t, 0.16, 4720, 4600, 'sine', 0.25);
    this.tone(out, t, 0.05, 2400, 2200, 'square', 0.25);
    this.burst(out, t, 0.05, 'bandpass', 1800, 2, 0.6);
    if (kill) {
      this.tone(out, t + 0.07, 0.09, 1250, 900, 'square', 0.3);
      this.burst(out, t + 0.07, 0.08, 'lowpass', 500, 1, 0.8);
    }
  }

  click(freq = 1800, vol = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(vol, 0.2);
    this.burst(out, t, 0.04, 'highpass', freq, 1, 1);
    this.tone(out, t, 0.02, freq * 0.6, freq * 0.5, 'triangle', 0.3);
  }

  footstep(vol = 0.15) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(this.out(vol, (Math.random() - 0.5) * 0.3), t, 0.07, 'lowpass', 600 + Math.random() * 300, 1, 1);
  }

  hurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.5, 0);
    this.tone(out, t, 0.18, 90, 45, 'sine', 1);
    this.burst(out, t, 0.12, 'lowpass', 500, 1, 0.6);
  }

  whizz(pan: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(this.out(0.25, pan), t, 0.12, 'bandpass', 3000 + Math.random() * 2000, 4, 1);
  }

  dryFire() {
    this.click(2600, 0.2);
  }

  streak() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.3, 0);
    [523, 659, 784, 1046].forEach((f, i) => this.tone(out, t + i * 0.08, 0.18, f, f, 'square', 0.25));
  }

  levelUp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.3, 0);
    [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(out, t + i * 0.07, 0.3, f, f, 'triangle', 0.35));
  }
}
