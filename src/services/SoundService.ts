import { HapticService } from './HapticService';

class SoundServiceClass {
  private ctx: AudioContext | null = null;
  private _enabled: boolean = true;
  private ambientSources: AudioNode[] = [];
  private ambientGain: GainNode | null = null;
  private ambientTimeout: ReturnType<typeof setTimeout> | null = null;
  private isAmbientPlaying: boolean = false;
  private currentAmbientType: 'off' | 'rain' | 'waves' | 'binaural' | 'focus' = 'off';
  private _ambientVolume: number = 0.6;

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
   * Generador de sonido ambiente sintético de alta fidelidad para modo Secuencia y Zen.
   * Totalmente offline, sin descargas externas, reactivo y relajante.
   */
  public startAmbientSound(type: 'rain' | 'waves' | 'binaural' | 'focus' = 'rain') {
    if (typeof window === 'undefined') return;
    // Detener sonido previo de inmediato para evitar superposiciones
    this.stopAmbientSound(true);

    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      const now = this.ctx.currentTime;
      const createdSources: AudioNode[] = [];

      // Master Gain para el sonido ambiente
      const masterGain = this.ctx.createGain();
      const targetVolume = type === 'waves' ? 0.32 : type === 'rain' ? 0.28 : type === 'binaural' ? 0.22 : 0.30;
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.linearRampToValueAtTime(targetVolume * this._ambientVolume, now + 0.8);
      masterGain.connect(this.ctx.destination);

      if (type === 'rain' || type === 'waves' || type === 'focus') {
        // Buffer de ruido estéreo de 4 segundos
        const bufferLength = 4 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(2, bufferLength, this.ctx.sampleRate);
        const leftChannel = noiseBuffer.getChannelData(0);
        const rightChannel = noiseBuffer.getChannelData(1);

        let lastL = 0.0;
        let lastR = 0.0;

        for (let i = 0; i < bufferLength; i++) {
          const whiteL = Math.random() * 2 - 1;
          const whiteR = Math.random() * 2 - 1;

          if (type === 'rain') {
            // Ruido rosa suave con mayor presencia en agudos (gotas)
            lastL = (lastL + 0.03 * whiteL) / 1.03;
            lastR = (lastR + 0.03 * whiteR) / 1.03;
            leftChannel[i] = lastL * 3.8;
            rightChannel[i] = lastR * 3.8;
          } else {
            // Ruido marrón cálido y profundo (mar / foco)
            lastL = (lastL + 0.015 * whiteL) / 1.015;
            lastR = (lastR + 0.015 * whiteR) / 1.015;
            leftChannel[i] = lastL * 4.6;
            rightChannel[i] = lastR * 4.6;
          }
        }

        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        if (type === 'rain') {
          // Lluvia: paso bajo suave a 950Hz + paso alto a 220Hz para eliminar retumbes
          const lowpass = this.ctx.createBiquadFilter();
          lowpass.type = 'lowpass';
          lowpass.frequency.setValueAtTime(950, now);

          const highpass = this.ctx.createBiquadFilter();
          highpass.type = 'highpass';
          highpass.frequency.setValueAtTime(220, now);

          noiseSource.connect(lowpass);
          lowpass.connect(highpass);
          highpass.connect(masterGain);
        } else if (type === 'waves') {
          // Olas de mar: Modulación mediante LFO en filtro y ganancia (vaivén natural cada 8 segundos)
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(320, now);
          filter.Q.setValueAtTime(1.2, now);

          const waveGain = this.ctx.createGain();
          waveGain.gain.setValueAtTime(0.5, now);

          // LFO para el oleaje
          const lfo = this.ctx.createOscillator();
          lfo.frequency.setValueAtTime(0.12, now); // ~8.3 segundos por ciclo de ola

          const lfoFilterGain = this.ctx.createGain();
          lfoFilterGain.gain.setValueAtTime(260, now); // Modula frecuencia entre 160Hz y 580Hz

          const lfoAmpGain = this.ctx.createGain();
          lfoAmpGain.gain.setValueAtTime(0.4, now); // Modula volumen de la ola

          lfo.connect(lfoFilterGain);
          lfoFilterGain.connect(filter.frequency);

          lfo.connect(lfoAmpGain);
          lfoAmpGain.connect(waveGain.gain);

          noiseSource.connect(filter);
          filter.connect(waveGain);
          waveGain.connect(masterGain);

          lfo.start(now);
          createdSources.push(lfo);
        } else {
          // Foco / Ruido marrón puro: tono aterciopelado
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(420, now);

          noiseSource.connect(filter);
          filter.connect(masterGain);
        }

        noiseSource.start(now);
        createdSources.push(noiseSource);
      } else if (type === 'binaural') {
        // Ondas Alfa Zen: 432 Hz y 442 Hz (frecuencia binaural de 10 Hz para relajación y foco)
        // Canal izquierdo: 432 Hz
        const oscLeft = this.ctx.createOscillator();
        oscLeft.type = 'sine';
        oscLeft.frequency.setValueAtTime(432, now);

        // Canal derecho: 442 Hz
        const oscRight = this.ctx.createOscillator();
        oscRight.type = 'sine';
        oscRight.frequency.setValueAtTime(442, now);

        // Sub-drone 108 Hz cálido en el centro
        const subOsc = this.ctx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(108, now);

        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(0.3, now);

        const toneGain = this.ctx.createGain();
        toneGain.gain.setValueAtTime(0.65, now);

        oscLeft.connect(toneGain);
        oscRight.connect(toneGain);
        subOsc.connect(subGain);
        subGain.connect(toneGain);
        toneGain.connect(masterGain);

        oscLeft.start(now);
        oscRight.start(now);
        subOsc.start(now);

        createdSources.push(oscLeft, oscRight, subOsc);
      }

      this.ambientSources = createdSources;
      this.ambientGain = masterGain;
      this.isAmbientPlaying = true;
      this.currentAmbientType = type;
    } catch (e) {
      console.error('Ambient audio start error:', e);
    }
  }

  public stopAmbientSound(immediate: boolean = false) {
    if (this.ambientTimeout) {
      clearTimeout(this.ambientTimeout);
      this.ambientTimeout = null;
    }

    const oldSources = [...this.ambientSources];
    const oldGain = this.ambientGain;
    this.ambientSources = [];
    this.ambientGain = null;
    this.isAmbientPlaying = false;
    this.currentAmbientType = 'off';

    if (!oldGain || !this.ctx) {
      oldSources.forEach(s => {
        try { (s as any).stop?.(); s.disconnect(); } catch {}
      });
      return;
    }

    if (immediate) {
      try {
        oldGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        oldSources.forEach(s => {
          try { (s as any).stop?.(); s.disconnect(); } catch {}
        });
        oldGain.disconnect();
      } catch {}
      return;
    }

    try {
      oldGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.35);
      this.ambientTimeout = setTimeout(() => {
        oldSources.forEach(s => {
          try { (s as any).stop?.(); s.disconnect(); } catch {}
        });
        try { oldGain.disconnect(); } catch {}
        this.ambientTimeout = null;
      }, 380);
    } catch {
      oldSources.forEach(s => {
        try { (s as any).stop?.(); s.disconnect(); } catch {}
      });
      try { oldGain.disconnect(); } catch {}
    }
  }

  public get isPlayingAmbient(): boolean {
    return this.isAmbientPlaying;
  }

  public get ambientType(): 'off' | 'rain' | 'waves' | 'binaural' | 'focus' {
    return this.currentAmbientType;
  }

  public get ambientVolume(): number {
    return this._ambientVolume;
  }

  public setAmbientVolume(val: number) {
    this._ambientVolume = Math.max(0, Math.min(1, val));
    if (this.ambientGain && this.ctx) {
      try {
        this.ambientGain.gain.linearRampToValueAtTime(this._ambientVolume * 0.35, this.ctx.currentTime + 0.1);
      } catch {}
    }
  }
}

export const SoundService = new SoundServiceClass();
