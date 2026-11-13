import type { WeaponId } from '../shared/gameData.ts';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.noiseBuffer) {
      const sampleRate = this.ctx.sampleRate;
      const len = sampleRate * 1.5;
      const buf = this.ctx.createBuffer(1, len, sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public playShoot(weapon: WeaponId, distance = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const attenuation = Math.max(0.05, 1 - distance / 85);
    const now = ctx.currentTime;

    if (weapon === 'knife') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.frequency.exponentialRampToValueAtTime(700, now + 0.12);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22 * attenuation, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.15);
      return;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    if (weapon === 'awp') {
      // Iconic heavy thunderous AWP boom
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3400, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 0.42);
      gain.gain.setValueAtTime(0.68 * attenuation, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.25);
      oscGain.gain.setValueAtTime(0.55 * attenuation, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      // Bolt cycle click after 0.55s
      if (distance < 3) {
        setTimeout(() => this.playClick(950, 0.08), 550);
        setTimeout(() => this.playClick(1250, 0.08), 720);
      }
    } else if (weapon === 'ak47') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1450, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.16);
      filter.Q.value = 0.8;
      gain.gain.setValueAtTime(0.45 * attenuation, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(185, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.1);
      oscGain.gain.setValueAtTime(0.28 * attenuation, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    } else if (weapon === 'm4a1' || weapon === 'usp') {
      // Suppressed crisp snap
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.frequency.exponentialRampToValueAtTime(650, now + 0.09);
      filter.Q.value = 1.4;
      gain.gain.setValueAtTime(0.22 * attenuation, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(85, now + 0.06);
      oscGain.gain.setValueAtTime(0.16 * attenuation, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    } else if (weapon === 'deagle') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2800, now);
      filter.frequency.exponentialRampToValueAtTime(260, now + 0.24);
      gain.gain.setValueAtTime(0.5 * attenuation, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.type = 'square';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.15);
      oscGain.gain.setValueAtTime(0.24 * attenuation, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    } else {
      // Glock
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1900, now);
      filter.frequency.exponentialRampToValueAtTime(420, now + 0.11);
      gain.gain.setValueAtTime(0.3 * attenuation, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);
      oscGain.gain.setValueAtTime(0.2 * attenuation, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    }

    noise.connect(filter).connect(gain).connect(ctx.destination);
    osc.connect(oscGain).connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.5);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playClick(freq = 850, vol = 0.1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playReload(): void {
    this.playClick(620, 0.11);
    setTimeout(() => this.playClick(920, 0.12), 450);
    setTimeout(() => this.playClick(1180, 0.14), 1150);
  }

  public playHit(headshot: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = headshot ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(headshot ? 1750 : 480, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 2300 : 180, now + 0.09);
    gain.gain.setValueAtTime(headshot ? 0.25 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playBombBeep(urgent = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(urgent ? 3100 : 2450, now);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(45, now + 1.4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 1.48);
  }

  public playFootstep(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.08);
  }
}

export const soundEngine = new SoundEngine();
