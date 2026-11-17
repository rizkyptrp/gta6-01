// Synthesized sound for Solara Bay: every effect and the music loop are
// built from WebAudio oscillators and noise, so the game ships no audio
// files and makes no network request.

export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this._noiseBuffer = null;
  }

  ensureStarted() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.context.destination);
    this._startEngineHum();
    this._startMusicLoop();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  _noise() {
    if (this._noiseBuffer) return this._noiseBuffer;
    const length = this.context.sampleRate * 0.5;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buffer;
    return buffer;
  }

  _startEngineHum() {
    this.engineOsc = this.context.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 42;
    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngineSpeed(speedNorm, driving) {
    if (!this.engineGain) return;
    const target = driving ? 0.05 + speedNorm * 0.11 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.context.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(42 + speedNorm * 130, this.context.currentTime, 0.08);
  }

  _tone(freq, duration, type, volume, slideTo) {
    if (!this.context) return;
    const osc = this.context.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, this.context.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, this.context.currentTime + duration);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.context.currentTime + duration + 0.02);
  }

  _burst(duration, volume, filterFreq) {
    if (!this.context) return;
    const source = this.context.createBufferSource();
    source.buffer = this._noise();
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    source.stop(this.context.currentTime + duration + 0.02);
  }

  playGunshot() {
    this._burst(0.14, 0.5, 2600);
    this._tone(160, 0.08, 'square', 0.18, 60);
  }

  playHit() {
    this._tone(220, 0.12, 'triangle', 0.25, 90);
  }

  playCrash() {
    this._burst(0.35, 0.6, 500);
    this._tone(70, 0.3, 'sine', 0.4, 35);
  }

  playPickup() {
    this._tone(660, 0.09, 'sine', 0.25);
    setTimeout(() => this._tone(990, 0.14, 'sine', 0.25), 90);
  }

  playMissionComplete() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      setTimeout(() => this._tone(freq, 0.22, 'triangle', 0.3), i * 120);
    });
    // A cash-register chime on top of the fanfare.
    setTimeout(() => this._tone(1568, 0.3, 'sine', 0.18), 480);
    setTimeout(() => this._tone(2093, 0.4, 'sine', 0.14), 560);
  }

  playUiClick() {
    this._tone(880, 0.06, 'sine', 0.2);
  }

  playSirenBlip() {
    this._tone(950, 0.35, 'sine', 0.12, 700);
    setTimeout(() => this._tone(700, 0.35, 'sine', 0.12, 950), 350);
  }

  playBusted() {
    [392, 330, 262, 196].forEach((freq, i) => {
      setTimeout(() => this._tone(freq, 0.3, 'sawtooth', 0.2), i * 180);
    });
  }

  // A lazy, sunny bass-and-keys loop: two chords, a walking bass line.
  _startMusicLoop() {
    const bassLine = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
    const chords = [220, 261.6, 329.6, 392];
    this.musicTimer = setInterval(() => {
      if (!this.context || this.muted) return;
      const step = this.musicStep % 8;
      const bass = bassLine[step];
      this._tone(bass, 0.42, 'triangle', 0.16);
      if (step % 2 === 0) {
        const chord = chords[(this.musicStep / 2) % 4 | 0];
        this._tone(chord, 0.5, 'sine', 0.05);
        this._tone(chord * 1.5, 0.5, 'sine', 0.04);
      }
      if (step === 4) this._burst(0.08, 0.05, 4000);
      this.musicStep += 1;
    }, 430);
  }
}
