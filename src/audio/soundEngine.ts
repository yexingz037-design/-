import { LootRarity, MapThemeDef, WeatherType } from '../types/game';

export interface SpatialAudioSource {
  wx: number;
  wy?: number;
  wz: number;
  enclosure?: number;
  isPlayer?: boolean;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  // Master & Spatial Reverb Buses
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private dryBus: GainNode | null = null;
  private tunnelConvolver: ConvolverNode | null = null;
  private tunnelVerbGain: GainNode | null = null;
  private outdoorConvolver: ConvolverNode | null = null;
  private outdoorVerbGain: GainNode | null = null;
  private ambientBus: GainNode | null = null;

  // Listener & Enclosure state
  private listenerX = 70;
  private listenerY = 1.4;
  private listenerZ = 50;
  private enclosureFactor = 0;

  // Active Raid Ambient Soundscape Nodes
  private activeAmbienceStyle: MapThemeDef['groundStyle'] | null = null;
  private pendingAmbienceStyle: MapThemeDef['groundStyle'] | null = null;
  private ambientPaused = false;
  private ambientNodes: AudioNode[] = [];
  private ambientSources: Array<AudioBufferSourceNode | OscillatorNode> = [];
  private outdoorWindGain: GainNode | null = null;
  private outdoorWindFilter: BiquadFilterNode | null = null;
  private tunnelDraftGain: GainNode | null = null;
  private rainAmbienceGain: GainNode | null = null;
  private rainAmbienceFilter: BiquadFilterNode | null = null;
  private activeWeather: WeatherType = 'clear';
  private lastImpactSoundTime = 0;

  public unlock() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx
        .resume()
        .then(() => {
          if (this.pendingAmbienceStyle && !this.activeAmbienceStyle && !this.muted) {
            const st = this.pendingAmbienceStyle;
            this.pendingAmbienceStyle = null;
            this.startRaidAmbience(st);
          }
        })
        .catch(() => {});
    } else if (this.ctx && this.ctx.state === 'running') {
      this.ensureGraph(this.ctx);
      if (this.pendingAmbienceStyle && !this.activeAmbienceStyle && !this.muted) {
        const st = this.pendingAmbienceStyle;
        this.pendingAmbienceStyle = null;
        this.startRaidAmbience(st);
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.04);
    }
    if (m) {
      this.stopRaidAmbienceNodes();
    } else if (this.pendingAmbienceStyle && !this.activeAmbienceStyle) {
      const st = this.pendingAmbienceStyle;
      this.startRaidAmbience(st);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private ensureCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return null;
    this.ensureGraph(this.ctx);
    return this.ctx;
  }

  private ensureGraph(ctx: AudioContext) {
    if (this.masterGain) return;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1;
    this.masterGain.connect(ctx.destination);

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.2;
    this.compressor.connect(this.masterGain);

    this.dryBus = ctx.createGain();
    this.dryBus.gain.value = 1.0;
    this.dryBus.connect(this.compressor);

    // Concrete Tunnel / Bunker Impulse Response (dense metallic-concrete slapback echoes + dark tail)
    this.tunnelConvolver = ctx.createConvolver();
    this.tunnelConvolver.buffer = this.createTunnelImpulseBuffer(ctx);
    this.tunnelVerbGain = ctx.createGain();
    this.tunnelVerbGain.gain.value = 0.85;
    this.tunnelConvolver.connect(this.tunnelVerbGain);
    this.tunnelVerbGain.connect(this.compressor);

    // Open-Air Dam Canyon / Industrial Courtyard Impulse Response
    this.outdoorConvolver = ctx.createConvolver();
    this.outdoorConvolver.buffer = this.createOutdoorImpulseBuffer(ctx);
    this.outdoorVerbGain = ctx.createGain();
    this.outdoorVerbGain.gain.value = 0.42;
    this.outdoorConvolver.connect(this.outdoorVerbGain);
    this.outdoorVerbGain.connect(this.compressor);

    this.ambientBus = ctx.createGain();
    this.ambientBus.gain.value = this.ambientPaused ? 0.0001 : 1.0;
    this.ambientBus.connect(this.compressor);
  }

  private createTunnelImpulseBuffer(ctx: AudioContext): AudioBuffer {
    const duration = 1.85;
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    const sr = ctx.sampleRate;

    // Early concrete tunnel slapback reflections (left/right alternating bounces)
    const earlyTaps = [
      { time: 0.024, ampL: 0.72, ampR: 0.35 },
      { time: 0.048, ampL: 0.34, ampR: 0.68 },
      { time: 0.079, ampL: 0.56, ampR: 0.48 },
      { time: 0.122, ampL: 0.42, ampR: 0.52 },
      { time: 0.178, ampL: 0.35, ampR: 0.31 },
      { time: 0.245, ampL: 0.24, ampR: 0.27 },
    ];

    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 2.55);
        const white = Math.random() * 2 - 1;
        // Concrete absorption darkens tail over time
        lp = lp * 0.72 + white * 0.28;
        data[i] = lp * env * 0.45;
      }
      for (const tap of earlyTaps) {
        const idx = Math.floor(tap.time * sr);
        const amp = ch === 0 ? tap.ampL : tap.ampR;
        for (let k = 0; k < 28 && idx + k < len; k++) {
          data[idx + k] += (Math.random() * 2 - 1) * amp * Math.exp(-k / 9);
        }
      }
    }
    return buf;
  }

  private createOutdoorImpulseBuffer(ctx: AudioContext): AudioBuffer {
    const duration = 0.95;
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    const sr = ctx.sampleRate;

    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 4.4);
        const white = Math.random() * 2 - 1;
        lp = lp * 0.8 + white * 0.2;
        data[i] = lp * env * 0.28;
      }
      // Distant cliff/dam wall slapback around 160ms & 290ms
      const idx1 = Math.floor((0.155 + ch * 0.014) * sr);
      const idx2 = Math.floor((0.285 + (1 - ch) * 0.018) * sr);
      for (let k = 0; k < 36; k++) {
        if (idx1 + k < len) data[idx1 + k] += (Math.random() * 2 - 1) * 0.22 * Math.exp(-k / 12);
        if (idx2 + k < len) data[idx2 + k] += (Math.random() * 2 - 1) * 0.14 * Math.exp(-k / 14);
      }
    }
    return buf;
  }

  private createPanner(ctx: AudioContext, wx: number, wy: number, wz: number, maxDist = 135): PannerNode {
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 8.5;
    panner.maxDistance = maxDist;
    panner.rolloffFactor = 1.1;
    const now = ctx.currentTime;
    if ('positionX' in panner) {
      panner.positionX.setValueAtTime(wx, now);
      panner.positionY.setValueAtTime(wy, now);
      panner.positionZ.setValueAtTime(wz, now);
    } else {
      (panner as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(wx, wy, wz);
    }
    return panner;
  }

  public updateSpatialListener(
    wx: number,
    wy: number,
    wz: number,
    enclosureFactor: number,
    forwardX = 0,
    forwardY = -0.42,
    forwardZ = -0.91
  ) {
    this.listenerX = wx;
    this.listenerY = wy;
    this.listenerZ = wz;
    this.enclosureFactor = Math.max(0, Math.min(1, enclosureFactor));

    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const listener = ctx.listener;

    if ('positionX' in listener) {
      listener.positionX.setTargetAtTime(wx, now, 0.03);
      listener.positionY.setTargetAtTime(wy, now, 0.03);
      listener.positionZ.setTargetAtTime(wz, now, 0.03);
      listener.forwardX.setTargetAtTime(forwardX, now, 0.03);
      listener.forwardY.setTargetAtTime(forwardY, now, 0.03);
      listener.forwardZ.setTargetAtTime(forwardZ, now, 0.03);
      listener.upX.setValueAtTime(0, now);
      listener.upY.setValueAtTime(1, now);
      listener.upZ.setValueAtTime(0, now);
    } else {
      const legacy = listener as unknown as {
        setPosition?: (x: number, y: number, z: number) => void;
        setOrientation?: (fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) => void;
      };
      legacy.setPosition?.(wx, wy, wz);
      legacy.setOrientation?.(forwardX, forwardY, forwardZ, 0, 1, 0);
    }

    this.applyWeatherAmbienceMix(now);
  }

  private applyWeatherAmbienceMix(now: number) {
    const outdoorScale = 1 - this.enclosureFactor * 0.62;
    const w = this.activeWeather;

    if (this.outdoorWindGain && this.outdoorWindFilter) {
      const baseWindGain = w === 'snow' ? 0.175 : w === 'rain' ? 0.13 : w === 'smog' ? 0.095 : 0.105;
      const baseWindFreq =
        w === 'snow'
          ? 760
          : w === 'smog'
            ? 320
            : w === 'rain'
              ? 560
              : this.activeAmbienceStyle === 'desert_city'
                ? 640
                : 520;
      this.outdoorWindGain.gain.setTargetAtTime(baseWindGain * outdoorScale, now, 0.25);
      this.outdoorWindFilter.frequency.setTargetAtTime(
        Math.max(150, baseWindFreq - this.enclosureFactor * 280),
        now,
        0.25
      );
    }

    if (this.rainAmbienceGain && this.rainAmbienceFilter) {
      const targetRainGain = w === 'rain' ? 0.18 * (1 - this.enclosureFactor * 0.55) : 0.0001;
      const targetRainFreq = 1950 - this.enclosureFactor * 1100;
      this.rainAmbienceGain.gain.setTargetAtTime(targetRainGain, now, 0.45);
      this.rainAmbienceFilter.frequency.setTargetAtTime(Math.max(550, targetRainFreq), now, 0.25);
    }

    if (this.tunnelDraftGain) {
      const smogBed = w === 'smog' ? 0.045 : 0;
      const draftVol = 0.02 + this.enclosureFactor * 0.11 + smogBed;
      this.tunnelDraftGain.gain.setTargetAtTime(draftVol, now, 0.25);
    }
  }

  public setWeatherAmbience(weather: WeatherType) {
    this.activeWeather = weather;
    if (this.ctx && this.ctx.state === 'running') {
      this.applyWeatherAmbienceMix(this.ctx.currentTime);
    }
  }

  public startRaidAmbience(groundStyle: MapThemeDef['groundStyle']) {
    this.pendingAmbienceStyle = groundStyle;
    const ctx = this.ensureCtx();
    if (!ctx || !this.ambientBus) return;
    if (this.activeAmbienceStyle === groundStyle && this.ambientSources.length > 0) return;

    this.stopRaidAmbienceNodes();
    this.activeAmbienceStyle = groundStyle;
    const now = ctx.currentTime;

    // 1. Seamless 4.5s pink/brown atmospheric wind & terrain noise loop
    const loopDur = 4.5;
    const bufLen = Math.floor(ctx.sampleRate * loopDur);
    const noiseBuf = ctx.createBuffer(2, bufLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = noiseBuf.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufLen; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
      }
      // Crossfade loop seam cleanly
      const fadeSamples = Math.floor(ctx.sampleRate * 0.15);
      for (let i = 0; i < fadeSamples; i++) {
        const w = i / fadeSamples;
        d[i] = d[i] * w + d[bufLen - fadeSamples + i] * (1 - w);
      }
    }

    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuf;
    windSrc.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = groundStyle === 'valley_forest' ? 'bandpass' : 'lowpass';
    windFilter.frequency.value =
      groundStyle === 'desert_city'
        ? 640
        : groundStyle === 'space_tarmac'
          ? 440
          : groundStyle === 'valley_forest'
            ? 460
            : 520;
    windFilter.Q.value = groundStyle === 'valley_forest' ? 0.85 : 0.7;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.11;

    // Gust LFO modulating atmospheric filter sweep
    const gustLfo = ctx.createOscillator();
    gustLfo.type = 'sine';
    gustLfo.frequency.value = groundStyle === 'desert_city' ? 0.14 : 0.09;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = groundStyle === 'desert_city' ? 190 : 120;
    gustLfo.connect(gustDepth);
    gustDepth.connect(windFilter.frequency);

    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.ambientBus);

    windSrc.start(now);
    gustLfo.start(now);

    this.outdoorWindFilter = windFilter;
    this.outdoorWindGain = windGain;
    this.ambientSources.push(windSrc, gustLfo);
    this.ambientNodes.push(windFilter, windGain, gustDepth);

    // 2. Enclosed Tunnel Air Draft & Deep Concrete Structural Drone
    const draftSrc = ctx.createBufferSource();
    draftSrc.buffer = noiseBuf;
    draftSrc.loop = true;

    const draftFilter = ctx.createBiquadFilter();
    draftFilter.type = 'lowpass';
    draftFilter.frequency.value = 175;
    draftFilter.Q.value = 1.4;

    const draftGain = ctx.createGain();
    draftGain.gain.value = 0.03;

    draftSrc.connect(draftFilter);
    draftFilter.connect(draftGain);
    draftGain.connect(this.ambientBus);
    draftSrc.start(now);

    this.tunnelDraftGain = draftGain;
    this.ambientSources.push(draftSrc);
    this.ambientNodes.push(draftFilter, draftGain);

    // 3. Biome-specific industrial/hydro/cryo/river sub-bed texture
    if (groundStyle === 'dam_concrete' || groundStyle === 'space_tarmac') {
      const humOsc = ctx.createOscillator();
      humOsc.type = 'sine';
      humOsc.frequency.value = groundStyle === 'dam_concrete' ? 56 : 64;
      const humGain = ctx.createGain();
      humGain.gain.value = 0.032;
      humOsc.connect(humGain);
      humGain.connect(this.ambientBus);
      humOsc.start(now);
      this.ambientSources.push(humOsc);
      this.ambientNodes.push(humGain);
    } else if (groundStyle === 'valley_forest') {
      // Flowing mountain river bed murmur
      const riverSrc = ctx.createBufferSource();
      riverSrc.buffer = noiseBuf;
      riverSrc.loop = true;
      const riverFilter = ctx.createBiquadFilter();
      riverFilter.type = 'bandpass';
      riverFilter.frequency.value = 880;
      riverFilter.Q.value = 1.1;
      const riverGain = ctx.createGain();
      riverGain.gain.value = 0.045;
      riverSrc.connect(riverFilter);
      riverFilter.connect(riverGain);
      riverGain.connect(this.ambientBus);
      riverSrc.start(now);
      this.ambientSources.push(riverSrc);
      this.ambientNodes.push(riverFilter, riverGain);
    }

    // 4. Dedicated Dynamic Rainstorm Layer (crossfaded cleanly when weather transitions to rain)
    const rainLen = Math.floor(ctx.sampleRate * 3.0);
    const rainBuf = ctx.createBuffer(2, rainLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = rainBuf.getChannelData(ch);
      for (let i = 0; i < rainLen; i++) {
        // Fine stereo hiss + occasional sharp droplet transients
        const drop = Math.random() < 0.004 ? (Math.random() * 2 - 1) * 0.7 : 0;
        d[i] = (Math.random() * 2 - 1) * 0.24 + drop;
      }
    }
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = rainBuf;
    rainSrc.loop = true;

    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1850;
    rainFilter.Q.value = 0.65;

    const rainGain = ctx.createGain();
    rainGain.gain.value = this.activeWeather === 'rain' ? 0.16 : 0.0001;

    rainSrc.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(this.ambientBus);
    rainSrc.start(now);

    this.rainAmbienceFilter = rainFilter;
    this.rainAmbienceGain = rainGain;
    this.ambientSources.push(rainSrc);
    this.ambientNodes.push(rainFilter, rainGain);

    this.applyWeatherAmbienceMix(now);
  }

  public playThunder() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus || !this.outdoorConvolver) return;
    const now = ctx.currentTime;
    const dur = 2.6;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        const rumbleEnv =
          (t < 0.18 ? t / 0.18 : Math.exp(-(t - 0.18) * 1.15)) *
          (0.75 + 0.25 * Math.sin(t * 14 + ch * 1.7));
        const white = Math.random() * 2 - 1;
        lp = lp * 0.94 + white * 0.06;
        d[i] = lp * rumbleEnv * 1.5;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(190, now);
    lpFilter.frequency.exponentialRampToValueAtTime(65, now + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(lpFilter);
    lpFilter.connect(gain);
    gain.connect(this.dryBus);
    gain.connect(this.outdoorConvolver);
    src.start(now);
  }

  public playFootstep(weather: WeatherType, sprinting: boolean) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus) return;
    const now = ctx.currentTime;
    const dur = weather === 'rain' ? 0.085 : weather === 'snow' ? 0.095 : 0.06;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.sin(t * Math.PI) * Math.exp(-t * (weather === 'snow' ? 2.4 : 4.2));
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    if (weather === 'rain') {
      // Splashy wet boot step
      filter.type = 'bandpass';
      filter.frequency.value = 1650 + Math.random() * 450;
      filter.Q.value = 0.85;
    } else if (weather === 'snow') {
      // Soft crunchy snow compression
      filter.type = 'bandpass';
      filter.frequency.value = 2400 + Math.random() * 600;
      filter.Q.value = 1.4;
    } else {
      // Gritty dry tactical boot thud
      filter.type = 'lowpass';
      filter.frequency.value = 520 + Math.random() * 140;
    }
    const gain = ctx.createGain();
    const vol = (sprinting ? 0.11 : 0.055) * (weather === 'rain' ? 1.25 : weather === 'snow' ? 0.85 : 1.0);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryBus);
    src.start(now);
  }

  public setRaidAudioPaused(paused: boolean) {
    this.ambientPaused = paused;
    if (this.ambientBus && this.ctx) {
      this.ambientBus.gain.setTargetAtTime(paused ? 0.0001 : 1.0, this.ctx.currentTime, 0.08);
    }
  }

  private stopRaidAmbienceNodes() {
    for (const src of this.ambientSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore stopped source
      }
    }
    for (const node of this.ambientNodes) {
      try {
        node.disconnect();
      } catch {
        // ignore
      }
    }
    this.ambientSources = [];
    this.ambientNodes = [];
    this.outdoorWindGain = null;
    this.outdoorWindFilter = null;
    this.tunnelDraftGain = null;
    this.rainAmbienceGain = null;
    this.rainAmbienceFilter = null;
    this.activeAmbienceStyle = null;
  }

  public stopRaidAmbience() {
    this.pendingAmbienceStyle = null;
    this.ambientPaused = false;
    this.stopRaidAmbienceNodes();
  }

  public playDistantAlarm(wx: number, wy: number, wz: number, kind: 'facility' | 'extract' | 'boss') {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus || !this.tunnelConvolver || !this.outdoorConvolver) return;

    const now = ctx.currentTime;
    const dist = Math.hypot(wx - this.listenerX, wz - this.listenerZ);
    const panner = this.createPanner(ctx, wx, wy, wz, 220);

    // Distance-attenuated lowpass so distant klaxons sound muffled across concrete walls
    const mufflingFilter = ctx.createBiquadFilter();
    mufflingFilter.type = 'lowpass';
    mufflingFilter.frequency.value = Math.max(480, 1550 - dist * 11);

    const drySend = ctx.createGain();
    drySend.gain.value = 0.35;
    const verbSend = ctx.createGain();
    verbSend.gain.value = 0.78;

    panner.connect(mufflingFilter);
    mufflingFilter.connect(drySend);
    mufflingFilter.connect(verbSend);
    drySend.connect(this.dryBus);
    verbSend.connect(this.tunnelConvolver);
    verbSend.connect(this.outdoorConvolver);

    const pulses = kind === 'boss' ? 3 : kind === 'extract' ? 2 : 2;
    const baseGain = kind === 'boss' ? 0.18 : kind === 'extract' ? 0.14 : 0.11;

    for (let i = 0; i < pulses; i++) {
      const t0 = now + i * 0.76;
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const pulseGain = ctx.createGain();

      oscA.type = 'sawtooth';
      oscB.type = 'triangle';

      if (kind === 'boss') {
        oscA.frequency.setValueAtTime(420, t0);
        oscA.frequency.linearRampToValueAtTime(640, t0 + 0.28);
        oscA.frequency.linearRampToValueAtTime(380, t0 + 0.56);
        oscB.frequency.setValueAtTime(424, t0);
        oscB.frequency.linearRampToValueAtTime(646, t0 + 0.28);
        oscB.frequency.linearRampToValueAtTime(384, t0 + 0.56);
      } else if (kind === 'extract') {
        oscA.frequency.setValueAtTime(520, t0);
        oscA.frequency.setValueAtTime(690, t0 + 0.24);
        oscB.frequency.setValueAtTime(522, t0);
        oscB.frequency.setValueAtTime(693, t0 + 0.24);
      } else {
        oscA.frequency.setValueAtTime(490, t0);
        oscA.frequency.exponentialRampToValueAtTime(310, t0 + 0.52);
        oscB.frequency.setValueAtTime(494, t0);
        oscB.frequency.exponentialRampToValueAtTime(313, t0 + 0.52);
      }

      pulseGain.gain.setValueAtTime(0.0001, t0);
      pulseGain.gain.linearRampToValueAtTime(baseGain, t0 + 0.05);
      pulseGain.gain.setValueAtTime(baseGain * 0.85, t0 + 0.42);
      pulseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.62);

      oscA.connect(pulseGain);
      oscB.connect(pulseGain);
      pulseGain.connect(panner);

      oscA.start(t0);
      oscB.start(t0);
      oscA.stop(t0 + 0.65);
      oscB.stop(t0 + 0.65);
    }
  }

  public playUiClick() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.045);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.dryBus);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playGunshot(
    suppressed: boolean,
    caliber: 'smg' | 'rifle' | 'heavy' | 'sniper',
    spatial?: SpatialAudioSource
  ) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus || !this.tunnelConvolver || !this.outdoorConvolver) return;
    const now = ctx.currentTime;

    const wx = spatial?.wx ?? this.listenerX;
    const wy = spatial?.wy ?? 1.25;
    const wz = spatial?.wz ?? this.listenerZ;
    const dist = spatial ? Math.hypot(wx - this.listenerX, wz - this.listenerZ) : 0;
    const localEnclosure = spatial?.enclosure ?? this.enclosureFactor;
    const effectiveEnclosure = Math.max(localEnclosure, this.enclosureFactor * 0.65);

    // Noise burst for supersonic transient crack
    const dur = suppressed ? 0.068 : caliber === 'sniper' ? 0.24 : 0.12;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * (suppressed ? 0.25 : 0.35)));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = suppressed ? 'bandpass' : 'lowpass';
    const baseCutoff = suppressed
      ? 1100
      : caliber === 'sniper'
        ? 2800
        : caliber === 'heavy'
          ? 2000
          : 3100;
    const distAttenuatedCutoff = Math.max(580, baseCutoff * Math.exp(-dist * 0.022));
    filter.frequency.setValueAtTime(distAttenuatedCutoff, now);

    const shotMix = ctx.createGain();
    const vol = suppressed ? 0.14 : caliber === 'sniper' ? 0.34 : caliber === 'heavy' ? 0.26 : 0.22;
    shotMix.gain.setValueAtTime(vol, now);
    shotMix.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(shotMix);

    // Low muzzle thump oscillator
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    const startFreq = suppressed ? 180 : caliber === 'sniper' ? 140 : 205;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.075);
    oscGain.gain.setValueAtTime(suppressed ? 0.09 : 0.21, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(oscGain);

    // Spatial Panner & Reverb Sends (Dry + Outdoor Canyon + Concrete Tunnel Reverb & Slapback Echoes)
    const outNode: AudioNode = spatial
      ? this.createPanner(ctx, spatial.isPlayer ? this.listenerX : wx, wy, spatial.isPlayer ? this.listenerZ - 0.5 : wz, 145)
      : this.dryBus;

    shotMix.connect(outNode);
    oscGain.connect(outNode);

    if (spatial && outNode !== this.dryBus) {
      const drySend = ctx.createGain();
      drySend.gain.value = Math.max(0.25, 1.0 - effectiveEnclosure * 0.18);
      outNode.connect(drySend);
      drySend.connect(this.dryBus);

      // Tunnel / indoor concrete reverberation send
      const tunnelSend = ctx.createGain();
      tunnelSend.gain.value = (suppressed ? 0.12 : 0.24) + effectiveEnclosure * (suppressed ? 0.42 : 0.92);
      outNode.connect(tunnelSend);
      tunnelSend.connect(this.tunnelConvolver);

      // Outdoor canyon/courtyard echo tail
      const outdoorSend = ctx.createGain();
      outdoorSend.gain.value = (suppressed ? 0.08 : 0.38) * (1 - effectiveEnclosure * 0.5);
      outNode.connect(outdoorSend);
      outdoorSend.connect(this.outdoorConvolver);

      // Distinct early-reflection tunnel slapback echoes when firing inside/near tunnels or enclosed corridors
      if (effectiveEnclosure > 0.22 && !suppressed) {
        [0.082, 0.178].forEach((delaySec, tapIdx) => {
          const dly = ctx.createDelay(0.5);
          dly.delayTime.setValueAtTime(delaySec + effectiveEnclosure * 0.024, now);
          const echoBp = ctx.createBiquadFilter();
          echoBp.type = 'bandpass';
          echoBp.frequency.value = tapIdx === 0 ? 860 : 540;
          echoBp.Q.value = 0.85;
          const echoGain = ctx.createGain();
          echoGain.gain.value = effectiveEnclosure * (tapIdx === 0 ? 0.34 : 0.2);

          outNode.connect(dly);
          dly.connect(echoBp);
          echoBp.connect(echoGain);
          echoGain.connect(this.tunnelConvolver!);
          echoGain.connect(this.dryBus!);
        });
      }
    }

    noise.start(now);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playBallisticImpact(
    surface: 'concrete' | 'metal' | 'wood' | 'kevlar',
    wx: number,
    wy: number,
    wz: number,
    enclosure = 0
  ) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus || !this.tunnelConvolver) return;
    const now = ctx.currentTime;
    if (now - this.lastImpactSoundTime < 0.038) return;
    this.lastImpactSoundTime = now;

    const panner = this.createPanner(ctx, wx, wy, wz, 95);
    const drySend = ctx.createGain();
    drySend.gain.value = 0.65;
    const verbSend = ctx.createGain();
    verbSend.gain.value = 0.18 + Math.max(enclosure, this.enclosureFactor * 0.6) * 0.55;
    panner.connect(drySend);
    panner.connect(verbSend);
    drySend.connect(this.dryBus);
    verbSend.connect(this.tunnelConvolver);

    const dur = surface === 'metal' ? 0.095 : 0.055;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.28));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = surface === 'metal' || surface === 'concrete' ? 'bandpass' : 'lowpass';
    filter.frequency.value =
      surface === 'metal' ? 2100 : surface === 'concrete' ? 1250 : surface === 'wood' ? 680 : 480;
    filter.Q.value = surface === 'metal' ? 1.8 : 0.9;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(surface === 'metal' ? 0.11 : 0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    noise.start(now);

    if (surface === 'metal') {
      const ping = ctx.createOscillator();
      const pingGain = ctx.createGain();
      ping.type = 'triangle';
      ping.frequency.setValueAtTime(1650 + Math.random() * 650, now);
      ping.frequency.exponentialRampToValueAtTime(920, now + 0.085);
      pingGain.gain.setValueAtTime(0.055, now);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      ping.connect(pingGain);
      pingGain.connect(panner);
      ping.start(now);
      ping.stop(now + 0.095);
    }
  }

  public playEmptyClick() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.025);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain);
    gain.connect(this.dryBus);
    osc.start(now);
    osc.stop(now + 0.032);
  }

  public playReload() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus) return;
    const now = ctx.currentTime;
    [0, 0.14].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 420 : 620, now + offset);
      osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 280 : 880, now + offset + 0.06);
      gain.gain.setValueAtTime(0.09, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.07);
      osc.connect(gain);
      gain.connect(this.dryBus!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.075);
    });
  }

  public playHitmarker(isKill: boolean, armorBreak: boolean) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = armorBreak ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(isKill ? 1320 : armorBreak ? 940 : 1080, now);
    osc.frequency.exponentialRampToValueAtTime(isKill ? 1760 : 520, now + (isKill ? 0.09 : 0.045));
    gain.gain.setValueAtTime(isKill ? 0.16 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isKill ? 0.1 : 0.05));
    osc.connect(gain);
    gain.connect(this.dryBus);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playDamageTaken() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.dryBus);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playSkill(
    kind: 'recon' | 'heal' | 'smoke' | 'overdrive' | 'explosion',
    spatial?: SpatialAudioSource
  ) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus || !this.tunnelConvolver || !this.outdoorConvolver) return;
    const now = ctx.currentTime;

    if (kind === 'explosion') {
      const dur = 0.56;
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.34));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(760, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      noise.connect(filter);
      filter.connect(gain);

      if (spatial) {
        const panner = this.createPanner(ctx, spatial.wx, spatial.wy ?? 1.0, spatial.wz, 165);
        const enc = Math.max(spatial.enclosure ?? 0, this.enclosureFactor * 0.65);
        const drySend = ctx.createGain();
        drySend.gain.value = 0.9;
        const verbSend = ctx.createGain();
        verbSend.gain.value = 0.35 + enc * 0.9;
        gain.connect(panner);
        panner.connect(drySend);
        panner.connect(verbSend);
        drySend.connect(this.dryBus);
        verbSend.connect(this.tunnelConvolver);
        verbSend.connect(this.outdoorConvolver);
      } else {
        gain.connect(this.dryBus);
      }
      noise.start(now);
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (kind === 'recon') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(720, now);
      osc.frequency.exponentialRampToValueAtTime(1480, now + 0.25);
      gain.gain.setValueAtTime(0.13, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    } else if (kind === 'heal') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    } else if (kind === 'overdrive') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.24);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    }
    osc.connect(gain);
    if (spatial && kind === 'smoke') {
      const panner = this.createPanner(ctx, spatial.wx, spatial.wy ?? 0.6, spatial.wz, 110);
      gain.connect(panner);
      panner.connect(this.dryBus);
      panner.connect(this.outdoorConvolver);
    } else {
      gain.connect(this.dryBus);
    }
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playSearchTick() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(920 + Math.random() * 160, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain);
    gain.connect(this.dryBus);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playLootReveal(rarity: LootRarity) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus) return;
    const now = ctx.currentTime;
    const freqMap: Record<LootRarity, number[]> = {
      common: [520],
      uncommon: [587, 740],
      rare: [659, 880],
      epic: [659, 880, 1175],
      legendary: [587, 880, 1175, 1568],
    };
    const notes = freqMap[rarity];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = rarity === 'legendary' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.06);
      gain.gain.setValueAtTime(rarity === 'legendary' ? 0.16 : 0.1, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.22);
      osc.connect(gain);
      gain.connect(this.dryBus!);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.24);
    });
  }

  public playExtractPing(progress: number) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660 + progress * 440, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.dryBus);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playVictory() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.14, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.35);
      osc.connect(gain);
      gain.connect(this.dryBus!);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.38);
    });
  }

  public playDefeat() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.dryBus) return;
    const now = ctx.currentTime;
    [320, 260, 195].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.11, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.32);
      osc.connect(gain);
      gain.connect(this.dryBus!);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.35);
    });
  }
}

export const soundEngine = new SoundEngine();
