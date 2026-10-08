/** Fully synthesised SFX — no audio assets needed for the prototype. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  volume = 0.7;

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
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.value = v;
  }

  private out(gain: number, pan: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(this.master);
    return g;
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
  gunshot(distance = 0, pan = 0, weapon: 'kr4' | 'vk47' = 'kr4', suppressed = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const near = distance < 1;
    const ak = weapon === 'vk47';
    if (suppressed) {
      const out = this.out(near ? 0.45 : Math.min(0.3, 4 / (distance + 4)), pan);
      this.burst(out, t, 0.06, 'bandpass', 900, 1.2, 1);
      this.tone(out, t, 0.06, 220, 90, 'sine', 0.5);
      if (near) this.tone(out, t + 0.02, 0.03, 3200, 2400, 'square', 0.05);
      return;
    }
    const att = near ? 1 : Math.min(1, 9 / (distance + 4));
    const out = this.out(att * (near ? 0.9 : 0.85), pan);
    const lp = near ? (ak ? 6500 : 9000) : Math.max(900, 6000 - distance * 90);
    this.burst(out, t, near ? (ak ? 0.12 : 0.09) : 0.07, 'lowpass', lp, 0.5, 1.2);
    this.burst(out, t, ak ? 0.6 : 0.45, 'bandpass', near ? (ak ? 900 : 1400) : 700, 0.6, 0.25);
    this.tone(out, t, ak ? 0.18 : 0.13, near ? (ak ? 110 : 140) : 100, 38, 'sine', near ? 1.2 : 0.6);
    if (near) this.tone(out, t + 0.03, 0.03, ak ? 2400 : 3200, 1900, 'square', 0.04);
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
