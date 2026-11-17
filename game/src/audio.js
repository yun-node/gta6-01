// audio.js — all sound is synthesized with WebAudio; no audio files.
export class AudioSys {
  constructor() {
    this.ctx = null; this.muted = false;
    this._engineOsc = null; this._engineGain = null;
    this._sirenOsc = null; this._sirenGain = null; this._sirenT = 0;
  }
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._master = this.ctx.createGain(); this._master.gain.value = 0.5;
        this._master.connect(this.ctx.destination);
      } catch (_) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  toggleMute() { this.muted = !this.muted; if (this._master) this._master.gain.value = this.muted ? 0 : 0.5; return this.muted; }
  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this._master); o.start(t); o.stop(t + dur + 0.02);
  }
  _noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.4;
    src.connect(f); f.connect(g); g.connect(this._master); src.start(t);
  }
  shoot() { this._noise(0.14, 0.5, 2800); this._tone(160, 0.1, 'square', 0.18, 60); }
  enemyShoot() { this._noise(0.12, 0.22, 1800); }
  hit() { this._tone(220, 0.08, 'triangle', 0.25, 110); }
  pickup() { this._tone(660, 0.09, 'sine', 0.25); setTimeout(() => this._tone(990, 0.14, 'sine', 0.25), 90); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 'triangle', 0.28), i * 110)); }
  missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this._tone(f, 0.3, 'sawtooth', 0.15), i * 150)); }
  crash() { this._noise(0.25, 0.5, 700); }
  door() { this._tone(300, 0.07, 'square', 0.12, 180); }
  engineStart(speed01) {
    if (!this.ctx || this.muted) return;
    if (!this._engineOsc) {
      this._engineOsc = this.ctx.createOscillator(); this._engineOsc.type = 'sawtooth';
      this._engineGain = this.ctx.createGain(); this._engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      this._engineOsc.connect(f); f.connect(this._engineGain); this._engineGain.connect(this._master);
      this._engineOsc.start();
    }
    this._engineOsc.frequency.value = 55 + speed01 * 130;
    this._engineGain.gain.value = 0.05 + speed01 * 0.06;
  }
  engineStop() { if (this._engineGain) this._engineGain.gain.value = 0; }
  siren(dt, wanted) {
    if (!this.ctx) return;
    if (wanted <= 0) { if (this._sirenGain) this._sirenGain.gain.value = 0; return; }
    if (!this._sirenOsc) {
      this._sirenOsc = this.ctx.createOscillator(); this._sirenOsc.type = 'sine';
      this._sirenGain = this.ctx.createGain(); this._sirenGain.gain.value = 0;
      this._sirenOsc.connect(this._sirenGain); this._sirenGain.connect(this._master);
      this._sirenOsc.start();
    }
    if (this.muted) { this._sirenGain.gain.value = 0; return; }
    this._sirenT += dt;
    const hi = Math.sin(this._sirenT * 3.4) > 0;
    this._sirenOsc.frequency.value = hi ? 880 : 660;
    this._sirenGain.gain.value = 0.045;
  }
}
