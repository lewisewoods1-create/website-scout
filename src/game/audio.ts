interface GunSfx {
  crackF: number;
  crackDur: number;
  bodyF: number;
  bodyDur: number;
  boomF0: number;
  boomF1: number;
  boomDur: number;
  boomAmp: number;
  /** action noise: frequency and delay after the shot (0 = none, e.g. bolt guns and revolvers) */
  mechF: number;
  mechT: number;
  /** reverb send */
  send: number;
  vol: number;
}

const gs = (crackF: number, crackDur: number, bodyF: number, bodyDur: number, boomF0: number, boomF1: number, boomDur: number, boomAmp: number, mechF: number, mechT: number, send: number, vol: number): GunSfx =>
  ({ crackF, crackDur, bodyF, bodyDur, boomF0, boomF1, boomDur, boomAmp, mechF, mechT, send, vol });

/** Per-gun shot recipes: SMGs snap, rifles bark, LMGs and snipers boom and roll. */
const GUN_SFX: Record<string, GunSfx> = {
  kr4: gs(2600, 0.035, 1100, 0.11, 140, 45, 0.14, 1.0, 3200, 0.045, 0.35, 0.9),
  vk47: gs(2000, 0.045, 800, 0.15, 110, 38, 0.2, 1.2, 2400, 0.05, 0.45, 1),
  vx9: gs(3200, 0.025, 1500, 0.07, 170, 60, 0.09, 0.7, 3800, 0.03, 0.25, 0.75),
  sp45: gs(2400, 0.03, 900, 0.09, 130, 50, 0.12, 0.9, 2600, 0.035, 0.3, 0.85),
  lm5: gs(2400, 0.04, 1000, 0.13, 120, 40, 0.17, 1.15, 2000, 0.05, 0.45, 1),
  pk7: gs(1800, 0.05, 750, 0.17, 100, 34, 0.22, 1.3, 1800, 0.06, 0.5, 1.05),
  kestrel: gs(1800, 0.06, 700, 0.22, 85, 30, 0.35, 1.5, 0, 0, 0.8, 1.15),
  warden: gs(1500, 0.07, 600, 0.28, 75, 26, 0.45, 1.7, 0, 0, 0.95, 1.25),
  talon: gs(1900, 0.055, 750, 0.2, 90, 32, 0.3, 1.4, 2200, 0.05, 0.75, 1.1),
  vulture: gs(2000, 0.05, 780, 0.2, 95, 34, 0.28, 1.35, 2300, 0.05, 0.7, 1.1),
  sk10: gs(2200, 0.045, 850, 0.16, 105, 36, 0.22, 1.2, 2500, 0.05, 0.55, 1),
  mk20: gs(2000, 0.05, 800, 0.18, 100, 34, 0.24, 1.25, 2300, 0.05, 0.6, 1.05),
  p9: gs(3000, 0.025, 1300, 0.07, 180, 70, 0.08, 0.7, 3500, 0.03, 0.25, 0.8),
  r357: gs(1800, 0.05, 800, 0.16, 110, 40, 0.2, 1.3, 0, 0, 0.5, 1.05),
  mp18: gs(3300, 0.022, 1500, 0.06, 190, 75, 0.07, 0.65, 3800, 0.025, 0.22, 0.75),
  d50: gs(1600, 0.06, 700, 0.2, 95, 34, 0.26, 1.45, 2600, 0.04, 0.6, 1.15),
};

/** Fully synthesised SFX — no audio assets needed for the prototype. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  /** effects go here; music has its own bus so it can be mixed separately */
  private sfxBus!: GainNode;
  private verb!: GainNode;
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
    // outdoor reverb: generated impulse (early slap off walls, then a long decaying tail)
    this.verb = this.ctx.createGain();
    this.verb.gain.value = 0.55;
    const conv = this.ctx.createConvolver();
    const sr = this.ctx.sampleRate;
    const ir = this.ctx.createBuffer(2, Math.floor(sr * 1.8), sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        const tt = i / sr;
        const slap = tt > 0.045 && tt < 0.06 ? 0.6 : tt > 0.11 && tt < 0.125 ? 0.35 : 0;
        d[i] = (Math.random() * 2 - 1) * (Math.exp(-tt * 3.2) * 0.5 + slap);
      }
    }
    conv.buffer = ir;
    const verbLp = this.ctx.createBiquadFilter();
    verbLp.type = 'lowpass';
    verbLp.frequency.value = 3200;
    this.verb.connect(conv).connect(verbLp).connect(this.sfxBus);
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

  /** System Crash: modem-like data chatter as the screen is taken over. */
  systemCrash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.4, 0);
    for (let i = 0; i < 24; i++) {
      const f = 600 + Math.random() * 2400;
      this.tone(out, t + i * 0.045, 0.04, f, f, 'square', 0.22);
    }
    this.burst(out, t, 1.1, 'bandpass', 2600, 6, 0.4);
    this.tone(out, t + 1.1, 0.5, 1800, 200, 'sawtooth', 0.3);
  }

  /** The System Crash wave: a crackling electric surge and a deep boom. */
  electricWave() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const out = this.out(0.6, 0);
    for (let i = 0; i < 18; i++) this.burst(out, t + Math.random() * 1.1, 0.05 + Math.random() * 0.08, 'highpass', 3000 + Math.random() * 4000, 1, 0.9);
    this.tone(out, t, 1.6, 90, 25, 'sawtooth', 0.8);
    this.tone(out, t, 0.9, 1200, 60, 'square', 0.25);
    this.burst(out, t, 2.2, 'lowpass', 600, 0.5, 1.1);
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
    const near = distance < 1;
    // sound travels: distant shots arrive late and lose their top end
    const t = this.ctx.currentTime + (near ? 0 : Math.min(0.3, distance / 343));
    const g = GUN_SFX[weapon] ?? GUN_SFX.kr4;
    const vary = 0.96 + Math.random() * 0.08; // round-robin feel: no two shots identical
    if (suppressed) {
      const out = this.send(near ? 0.55 : Math.min(0.35, 5 / (distance + 4)), pan, 0.12);
      this.sweep(out, t, 0.09, 'bandpass', 1400 * vary, 500, 1.4, 1);
      this.tone(out, t, 0.07, 240 * vary, 90, 'sine', 0.6);
      if (near && g.mechF) this.sweep(out, t + g.mechT, 0.03, 'bandpass', g.mechF, g.mechF * 0.8, 6, 0.7);
      return;
    }
    const att = near ? 1 : Math.min(1, (g.send > 0.7 ? 16 : 10) / (distance + 4));
    const wet = near ? g.send : Math.min(0.95, g.send + distance / 60);
    const out = this.send(att * g.vol, pan, wet);
    const far = near ? 1 : Math.max(0.15, 1 - distance / 70);
    // 1. supersonic crack: very short, bright
    this.sweep(out, t, g.crackDur, 'highpass', g.crackF * far, g.crackF * 0.6 * far, 0.7, 1.4 * (near ? 1 : far));
    // 2. body: the mid-range bark of the cartridge
    this.sweep(out, t, g.bodyDur, 'bandpass', g.bodyF * vary * (near ? 1 : 0.7), g.bodyF * 0.55, 1.1, 1.1);
    // 3. boom: low-end punch with a fast pitch drop
    this.tone(out, t, g.boomDur, g.boomF0 * vary, g.boomF1, 'sine', g.boomAmp * (near ? 1 : 0.7));
    this.tone(out, t, g.boomDur * 0.6, g.boomF0 * 2 * vary, g.boomF1 * 2, 'triangle', g.boomAmp * 0.25 * far);
    // 4. the action cycling, only audible up close
    if (near && g.mechF) {
      this.sweep(out, t + g.mechT, 0.025, 'bandpass', g.mechF, g.mechF * 0.85, 7, 0.35);
      this.sweep(out, t + g.mechT + 0.035, 0.02, 'bandpass', g.mechF * 1.3, g.mechF * 1.1, 7, 0.22);
    }
  }

  /** A gain stage panned into the dry bus with a share sent to the outdoor reverb. */
  private send(gain: number, pan: number, wet: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(this.sfxBus);
    const w = ctx.createGain();
    w.gain.value = wet;
    g.connect(w).connect(this.verb);
    return g;
  }

  /** Noise through a filter whose cutoff sweeps from f0 to f1, with an exponential decay. */
  private sweep(dest: AudioNode, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, peak: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(Math.max(20, f0), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5, dur + 0.05);
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
