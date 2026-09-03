import { HapticService } from './HapticService';

class SoundServiceClass {
  private ctx: AudioContext | null = null;
  private _enabled: boolean = true;
  private ambientSource: AudioNode | null = null;
  private ambientGain: GainNode | null = null;
  private isAmbientPlaying: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('recordatorios_sound_enabled');
      this._enabled = stored !== null ? stored === 'true' : true;
    }
  }

  public get enabled(): boolean {
    return this._enabled;
  }

  public set enabled(val: boolean) {
    this._enabled = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('recordatorios_sound_enabled', String(val));
    }
  }

  public toggleSound(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) this.playPop();
    return this.enabled;
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Chime armónico de doble nota tipo Apple Reminders (C6 -> E6)
   */
  public playComplete() {
    HapticService.notification('success');
    if (!this._enabled || typeof window === 'undefined') return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Nota 1 (C6: 1046.5 Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1046.5, now);
      gain1.gain.setValueAtTime(0.09, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.16);

      // Nota 2 (E6: 1318.5 Hz con retardo sutil de 45ms)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.5, now + 0.045);
      gain2.gain.setValueAtTime(0.0001, now);
      gain2.gain.setValueAtTime(0.12, now + 0.045);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.045);
      osc2.stop(now + 0.28);
    } catch {}
  }

  /**
   * Tono suave descendente al desmarcar
   */
  public playUncomplete() {
    HapticService.impact('medium');
    if (!this._enabled || typeof window === 'undefined') return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.09); // A4
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {}
  }

  /**
   * Swoop acústico suave al eliminar
   */
  public playDelete() {
    HapticService.impact('heavy');
    if (!this._enabled || typeof window === 'undefined') return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {}
  }

  /**
   * Click háptico / pop de interfaz para botones y selección
   */
  public playPop() {
    HapticService.impact('light');
    if (!this._enabled || typeof window === 'undefined') return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.025);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.025);
    } catch {}
  }

  /**
   * Generador de sonido ambiente sintético para modo Zen (lluvia / ruido marrón / binaural)
   */
  public startAmbientSound(type: 'rain' | 'waves' | 'binaural' = 'rain') {
    if (typeof window === 'undefined') return;
    this.stopAmbientSound();
    try {
      this.initCtx();
      if (!this.ctx) return;
      
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;

      for (let i = 0; i < bufferSize; i++) {
        if (type === 'rain') {
          // Pink / rain noise
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        } else {
          // Brown noise / calm waves
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + (0.01 * white)) / 1.01;
          lastOut = output[i];
          output[i] *= 4.0;
        }
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = type === 'rain' ? 'lowpass' : 'bandpass';
      filter.frequency.value = type === 'rain' ? 800 : 400;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 1.5);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start();
      this.ambientSource = whiteNoise;
      this.ambientGain = gain;
      this.isAmbientPlaying = true;
    } catch (e) {
      console.error('Ambient audio error:', e);
    }
  }

  public stopAmbientSound() {
    if (this.ambientGain && this.ctx) {
      try {
        this.ambientGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5);
        setTimeout(() => {
          if (this.ambientSource) {
            (this.ambientSource as any).stop?.();
            this.ambientSource.disconnect();
            this.ambientSource = null;
          }
          this.ambientGain = null;
          this.isAmbientPlaying = false;
        }, 500);
      } catch {
        this.ambientSource = null;
        this.ambientGain = null;
        this.isAmbientPlaying = false;
      }
    }
  }

  public get isPlayingAmbient(): boolean {
    return this.isAmbientPlaying;
  }
}

export const SoundService = new SoundServiceClass();
