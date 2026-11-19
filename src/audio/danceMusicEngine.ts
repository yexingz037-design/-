import { DANCE_MAP, DanceId } from '../data/danceCatalog';

type WaveType = OscillatorType;

interface TrackPattern {
  rootMidi: number;
  bassWave: WaveType;
  leadWave: WaveType;
  bassCutoff: number;
  leadCutoff: number;
  swing: number; // 0..0.18
  kick: number[]; // 16 steps (0 or 1..1.2)
  snare: number[]; // 16 steps
  hat: number[]; // 16 steps
  perc?: number[]; // optional cowbell / rim / tom on 16 steps
  percFreq?: number;
  bass: Array<number | null>; // semitone offsets from rootMidi, 16 steps
  lead: Array<number | null>; // semitone offsets (+12/+24), 16 steps
  chord?: number[][]; // 4 chords across the bar (steps 0, 4, 8, 12)
  leadDetune?: number;
  wobbleRate?: number; // for dubstep/bass modulation
  distorted?: boolean; // for cyber metal / phonk grit
}

// 20 genuinely distinct musical compositions matching each dance's vibe & BPM
const TRACK_PATTERNS: Record<DanceId, TrackPattern> = {
  cyber_shuffle: {
    rootMidi: 45, // A2
    bassWave: 'sawtooth',
    leadWave: 'triangle',
    bassCutoff: 580,
    leadCutoff: 2800,
    swing: 0.03,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    bass: [0, null, 0, 3, null, 0, 7, null, 5, null, 5, 7, null, 3, 2, null],
    lead: [12, null, 15, null, 19, null, 15, 12, 17, null, 19, null, 24, null, 19, 15],
  },
  moonwalk_glide: {
    rootMidi: 42, // F#2
    bassWave: 'square',
    leadWave: 'sine',
    bassCutoff: 760,
    leadCutoff: 3200,
    swing: 0.08,
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    bass: [0, null, 7, 10, 12, null, 10, 7, 5, null, 3, 5, 7, null, 3, 0],
    lead: [null, null, 19, null, 15, 17, null, null, 22, null, 19, 15, null, 17, 15, null],
    chord: [
      [12, 15, 19],
      [10, 14, 17],
      [12, 15, 19],
      [7, 10, 14],
    ],
  },
  robot_popping: {
    rootMidi: 40, // E2
    bassWave: 'sawtooth',
    leadWave: 'square',
    bassCutoff: 920,
    leadCutoff: 2100,
    swing: 0,
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    perc: [0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0],
    percFreq: 1320,
    bass: [0, 0, null, 12, 0, null, 3, null, 5, null, 7, 10, 0, null, 12, 7],
    lead: [24, null, 22, null, 19, null, 22, null, 24, null, 27, null, 24, 19, null, 15],
  },
  tactical_hardbass: {
    rootMidi: 43, // G2
    bassWave: 'sawtooth',
    leadWave: 'sawtooth',
    bassCutoff: 1200,
    leadCutoff: 2900,
    swing: 0,
    distorted: true,
    kick: [1.2, 0, 0, 0, 1.2, 0, 0, 0, 1.2, 0, 0, 0, 1.2, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    // Classic off-beat donk bass
    bass: [null, null, 0, null, null, null, 0, null, null, null, 3, null, null, null, 5, null],
    lead: [12, 12, 15, 12, 19, null, 15, 12, 14, 14, 17, 14, 15, null, 12, 10],
  },
  neon_floss: {
    rootMidi: 48, // C3
    bassWave: 'triangle',
    leadWave: 'square',
    bassCutoff: 700,
    leadCutoff: 3400,
    swing: 0.02,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1],
    bass: [0, null, 7, null, 5, null, 7, null, 9, null, 7, null, 5, 4, 2, null],
    lead: [16, 19, 24, null, 21, 19, 16, null, 14, 16, 19, null, 24, 21, 19, 16],
  },
  victory_salute_spin: {
    rootMidi: 41, // F2
    bassWave: 'sawtooth',
    leadWave: 'sawtooth',
    bassCutoff: 640,
    leadCutoff: 2600,
    swing: 0,
    kick: [1.1, 0, 0, 0, 0, 0, 0, 0, 1.1, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1.1, 0, 0, 0, 0, 0, 0, 0, 1.1, 0, 0, 1],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1],
    bass: [0, null, null, 0, 7, null, 5, null, 3, null, 5, null, 7, null, 10, 12],
    lead: [12, null, 19, null, 24, null, 22, 19, 17, null, 19, null, 24, null, 26, 24],
    chord: [
      [12, 15, 19],
      [12, 15, 19],
      [10, 14, 17],
      [12, 15, 19],
    ],
  },
  breakdance_windmill: {
    rootMidi: 38, // D2
    bassWave: 'triangle',
    leadWave: 'sawtooth',
    bassCutoff: 600,
    leadCutoff: 2400,
    swing: 0.1,
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1],
    perc: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0],
    percFreq: 680,
    bass: [0, null, 0, 3, null, 5, 7, null, 10, null, 7, 5, 3, null, 2, 0],
    lead: [12, 15, null, 17, 19, null, 17, 15, 12, null, 19, 22, 24, null, 19, null],
  },
  synthwave_groove: {
    rootMidi: 45, // A2
    bassWave: 'sawtooth',
    leadWave: 'sawtooth',
    bassCutoff: 520,
    leadCutoff: 1950,
    leadDetune: 11,
    swing: 0,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1.1, 0, 0, 0, 0, 0, 0, 0, 1.1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    bass: [0, 0, 0, 0, 8, 8, 8, 8, 5, 5, 5, 5, 7, 7, 7, 7],
    lead: [19, null, 16, 19, 24, null, 21, null, 17, null, 16, 17, 19, null, 14, null],
    chord: [
      [12, 15, 19],
      [8, 12, 15],
      [5, 8, 12],
      [7, 11, 14],
    ],
  },
  cyber_phonk_walk: {
    rootMidi: 37, // C#2
    bassWave: 'sine',
    leadWave: 'triangle',
    bassCutoff: 340,
    leadCutoff: 2400,
    swing: 0.04,
    distorted: true,
    kick: [1.2, 0, 0, 1, 0, 0, 1, 0, 1.2, 0, 0, 0, 0, 1, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
    // Signature phonk cowbell melody
    perc: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    percFreq: 840,
    bass: [0, null, null, 0, null, null, 0, null, 3, null, null, 3, 1, null, 0, null],
    lead: [24, null, 27, 24, null, 22, null, 19, 24, null, 27, null, 31, null, 27, 24],
  },
  disco_fever: {
    rootMidi: 46, // Bb2
    bassWave: 'triangle',
    leadWave: 'sine',
    bassCutoff: 880,
    leadCutoff: 3600,
    swing: 0.06,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    // Classic disco octave bassline
    bass: [0, 12, 0, 12, 3, 15, 3, 15, 5, 17, 5, 17, 7, 19, 5, 3],
    lead: [19, null, 22, 24, null, 22, 19, null, 17, 19, 22, null, 24, null, 26, 24],
    chord: [
      [12, 15, 19],
      [15, 19, 22],
      [17, 20, 24],
      [19, 22, 26],
    ],
  },
  dubstep_glitch: {
    rootMidi: 36, // C2
    bassWave: 'sawtooth',
    leadWave: 'square',
    bassCutoff: 1100,
    leadCutoff: 2500,
    wobbleRate: 7.5,
    distorted: true,
    swing: 0,
    kick: [1.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 1.2, 0, 0, 0, 0, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1],
    bass: [0, 0, null, 0, 3, 3, null, 1, 0, null, 7, 7, 6, null, 3, 1],
    lead: [24, null, null, 27, null, null, 30, 27, 24, null, null, 19, 22, null, 19, null],
  },
  kpop_sharp_wave: {
    rootMidi: 47, // B2
    bassWave: 'sawtooth',
    leadWave: 'triangle',
    bassCutoff: 740,
    leadCutoff: 3500,
    leadDetune: 7,
    swing: 0.02,
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    bass: [0, null, 0, 7, null, 5, 3, null, 0, null, 3, 5, null, 7, 10, 7],
    lead: [19, 22, 24, null, 22, 19, 15, 19, 24, null, 26, 24, 22, 19, 17, 19],
    chord: [
      [12, 15, 19],
      [10, 14, 17],
      [8, 12, 15],
      [10, 14, 17],
    ],
  },
  gun_kata_drill: {
    rootMidi: 40, // E2
    bassWave: 'sawtooth',
    leadWave: 'square',
    bassCutoff: 490,
    leadCutoff: 1800,
    swing: 0,
    distorted: true,
    kick: [1.1, 0, 0, 0, 1.1, 0, 0, 0, 1.1, 0, 0, 0, 1.1, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    perc: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
    percFreq: 1650,
    bass: [0, 0, null, 0, 1, null, 0, null, 0, 0, null, 3, 1, null, 0, null],
    lead: [12, null, 13, null, 12, null, 19, null, 12, null, 15, null, 13, null, 12, null],
  },
  samba_carnival: {
    rootMidi: 48, // C3
    bassWave: 'triangle',
    leadWave: 'sine',
    bassCutoff: 900,
    leadCutoff: 3400,
    swing: 0.05,
    kick: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
    snare: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1],
    hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    perc: [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0],
    percFreq: 1080,
    bass: [0, null, null, 7, 0, null, null, 7, 5, null, null, 7, 2, null, 7, null],
    lead: [16, 19, null, 21, 19, null, 16, 14, 16, 19, null, 24, 21, 19, 16, null],
  },
  shadow_boxing_rap: {
    rootMidi: 41, // F2
    bassWave: 'sine',
    leadWave: 'triangle',
    bassCutoff: 420,
    leadCutoff: 2000,
    swing: 0.12,
    kick: [1.1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1.1, 0, 0, 0, 0, 0, 0, 0, 1.1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    bass: [0, null, null, 3, null, null, 5, 7, null, null, 3, null, 0, null, -2, null],
    lead: [19, null, 15, null, 12, null, 15, 17, 19, null, null, 17, 15, null, 12, null],
    chord: [
      [12, 15, 19],
      [12, 15, 19],
      [10, 14, 17],
      [8, 12, 15],
    ],
  },
  zero_g_levitate: {
    rootMidi: 44, // Ab2
    bassWave: 'sine',
    leadWave: 'sine',
    bassCutoff: 460,
    leadCutoff: 2600,
    leadDetune: 14,
    swing: 0,
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0],
    bass: [0, null, null, null, 3, null, null, null, 5, null, null, null, 7, null, 5, null],
    lead: [24, null, 27, null, 31, null, 27, 24, 29, null, 27, null, 24, null, 19, null],
    chord: [
      [12, 16, 19, 23],
      [15, 19, 22, 26],
      [17, 20, 24, 27],
      [19, 23, 26, 31],
    ],
  },
  pixel_8bit_hop: {
    rootMidi: 50, // D3
    bassWave: 'square',
    leadWave: 'square',
    bassCutoff: 1800,
    leadCutoff: 4200,
    swing: 0,
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    bass: [0, 12, 0, 12, 5, 17, 5, 17, 7, 19, 7, 19, 4, 16, 7, 19],
    lead: [12, 16, 19, 24, 21, 19, 16, 19, 14, 17, 21, 26, 24, 21, 19, 16],
  },
  eurobeat_drift: {
    rootMidi: 45, // A2
    bassWave: 'sawtooth',
    leadWave: 'sawtooth',
    bassCutoff: 1100,
    leadCutoff: 3800,
    leadDetune: 12,
    swing: 0,
    kick: [1.1, 0, 0, 0, 1.1, 0, 0, 0, 1.1, 0, 0, 0, 1.1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
    bass: [0, 12, 0, 12, 0, 12, 3, 15, 5, 17, 5, 17, 7, 19, 10, 22],
    lead: [24, 24, 22, 19, 22, 24, 27, 24, 22, 19, 17, 19, 22, 24, 27, 31],
  },
  heavy_metal_headbang: {
    rootMidi: 38, // Drop D2
    bassWave: 'sawtooth',
    leadWave: 'sawtooth',
    bassCutoff: 1400,
    leadCutoff: 2400,
    distorted: true,
    swing: 0,
    kick: [1.2, 1, 0, 0, 1.2, 1, 0, 0, 1.2, 1, 0, 1, 1.2, 0, 1, 0],
    snare: [0, 0, 0, 0, 1.2, 0, 0, 0, 0, 0, 0, 0, 1.2, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    bass: [0, 0, 0, 3, 0, 0, 5, 3, 0, 0, 0, 6, 5, 3, 1, 0],
    lead: [12, 12, 19, 15, 12, 12, 17, 15, 12, 12, 19, 18, 17, 15, 13, 12],
  },
  trance_rave_laser: {
    rootMidi: 43, // G2
    bassWave: 'sawtooth',
    leadWave: 'sawtooth',
    bassCutoff: 950,
    leadCutoff: 3600,
    leadDetune: 15,
    swing: 0,
    kick: [1.1, 0, 0, 0, 1.1, 0, 0, 0, 1.1, 0, 0, 0, 1.1, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    // Rolling 16th trance bassline
    bass: [0, 0, 12, 0, 0, 0, 12, 0, 8, 8, 20, 8, 10, 10, 22, 10],
    lead: [19, 22, 26, 31, 26, 22, 19, 22, 20, 24, 27, 32, 29, 26, 22, 26],
    chord: [
      [12, 15, 19],
      [12, 15, 19],
      [8, 12, 15],
      [10, 14, 17],
    ],
  },
};

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class DanceMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private distCurve: Float32Array<ArrayBuffer> | null = null;
  private muted = false;

  private activeDanceId: DanceId | null = null;
  private timerId: number | null = null;
  private stepIndex = 0;
  private nextNoteTime = 0;
  private endAudioTime = 0;
  private lastBeatTime = 0;
  private stepDurationSec = 0.125;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.42;

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -12;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.16;

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (!this.noiseBuffer) {
      const len = Math.floor(this.ctx.sampleRate * 0.6);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    if (!this.distCurve) {
      const n = 256;
      const curve = new Float32Array(new ArrayBuffer(n * 4));
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = Math.tanh(x * 3.4);
      }
      this.distCurve = curve;
    }
    return this.ctx;
  }

  public setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : 0.42, this.ctx.currentTime, 0.03);
    }
  }

  public start(danceId: DanceId) {
    this.stop();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const def = DANCE_MAP[danceId];
    if (!def) return;

    this.activeDanceId = danceId;
    this.stepIndex = 0;
    this.stepDurationSec = 60 / def.bpm / 4; // 16th note
    this.nextNoteTime = ctx.currentTime + 0.04;
    this.endAudioTime = this.nextNoteTime + def.durationSec;
    this.lastBeatTime = performance.now();

    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.42, ctx.currentTime);
    }

    const scheduleAhead = 0.14;
    const scheduler = () => {
      if (!this.activeDanceId || !this.ctx) return;
      const pat = TRACK_PATTERNS[this.activeDanceId];
      while (this.nextNoteTime < this.ctx.currentTime + scheduleAhead) {
        if (this.nextNoteTime >= this.endAudioTime - 0.05) {
          // Graceful tail fade-out right before duration ends
          if (this.masterGain && !this.muted) {
            this.masterGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.09);
          }
          this.stopTimerOnly();
          return;
        }
        const step = this.stepIndex % 16;
        const bar = Math.floor(this.stepIndex / 16);
        const swingOffset = step % 2 === 1 ? this.stepDurationSec * pat.swing : 0;
        const t = this.nextNoteTime + swingOffset;

        this.triggerStep(this.ctx, pat, step, bar, t, this.stepDurationSec);

        this.nextNoteTime += this.stepDurationSec;
        this.stepIndex += 1;
      }
    };

    scheduler();
    this.timerId = window.setInterval(scheduler, 30);
  }

  private stopTimerOnly() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public stop() {
    this.stopTimerOnly();
    this.activeDanceId = null;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.04);
    }
  }

  /** Returns 0..1 rhythmic pulse synced to the current dance track's quarter-note beat */
  public getBeatEnergy(danceId: DanceId | null, danceElapsedSec: number): number {
    if (!danceId) return 0;
    const def = DANCE_MAP[danceId];
    if (!def) return 0;
    const beatDur = 60 / def.bpm;
    const phase = (danceElapsedSec % beatDur) / beatDur;
    // Fast attack, exponential punchy decay matching kick drum transient
    return Math.exp(-phase * 5.2);
  }

  private triggerStep(
    ctx: AudioContext,
    pat: TrackPattern,
    step: number,
    bar: number,
    time: number,
    stepDur: number
  ) {
    if (!this.compressor) return;
    const out = this.compressor;

    // 1. Kick Drum
    const kickAmt = pat.kick[step];
    if (kickAmt > 0) {
      this.playKick(ctx, out, time, kickAmt);
      this.lastBeatTime = performance.now();
    }

    // 2. Snare / Clap
    const snareAmt = pat.snare[step];
    if (snareAmt > 0) {
      this.playSnare(ctx, out, time, snareAmt);
    }

    // 3. Hi-Hat
    const hatAmt = pat.hat[step];
    if (hatAmt > 0) {
      this.playHat(ctx, out, time, step % 4 === 2 ? 0.12 : 0.065);
    }

    // 4. Optional Cowbell / Metallic Perc
    if (pat.perc && pat.perc[step]) {
      this.playCowbell(ctx, out, time, pat.percFreq || 840);
    }

    // 5. Bass Synth
    const bassOffset = pat.bass[step];
    if (bassOffset !== null && bassOffset !== undefined) {
      // Subtle bar-2 harmonic variation so 5-15s tracks feel musical and evolving
      const barShift = bar % 4 === 3 && step >= 12 ? 2 : 0;
      const freq = midiToHz(pat.rootMidi + bassOffset + barShift);
      this.playBass(ctx, out, time, freq, stepDur * 1.45, pat);
    }

    // 6. Lead Melody / Arpeggio
    const leadOffset = pat.lead[step];
    if (leadOffset !== null && leadOffset !== undefined) {
      const octaveLift = bar % 2 === 1 && step >= 8 ? 12 : 0;
      const freq = midiToHz(pat.rootMidi + leadOffset + octaveLift);
      this.playLead(ctx, out, time, freq, stepDur * 1.25, pat);
    }

    // 7. Chord Pad Stabs on quarter-bar boundaries
    if (pat.chord && step % 4 === 0) {
      const chordIdx = Math.floor(step / 4) % pat.chord.length;
      const notes = pat.chord[chordIdx];
      this.playChordStab(ctx, out, time, pat.rootMidi, notes, stepDur * 3.4);
    }
  }

  private playKick(ctx: AudioContext, dest: AudioNode, time: number, level: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(148, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.085);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.22);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.68 * level, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  private playSnare(ctx: AudioContext, dest: AudioNode, time: number, level: number) {
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1850;
      filter.Q.value = 0.85;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.32 * level, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(time);
      noise.stop(time + 0.17);
    }
    const tone = ctx.createOscillator();
    const tGain = ctx.createGain();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(210, time);
    tone.frequency.exponentialRampToValueAtTime(110, time + 0.07);
    tGain.gain.setValueAtTime(0.24 * level, time);
    tGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    tone.connect(tGain);
    tGain.connect(dest);
    tone.start(time);
    tone.stop(time + 0.1);
  }

  private playHat(ctx: AudioContext, dest: AudioNode, time: number, level: number) {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.048);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(dest);
    src.start(time);
    src.stop(time + 0.055);
  }

  private playCowbell(ctx: AudioContext, dest: AudioNode, time: number, baseFreq: number) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'square';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(baseFreq, time);
    osc2.frequency.setValueAtTime(baseFreq * 1.48, time);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = baseFreq * 1.2;
    bp.Q.value = 2.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    osc1.connect(bp);
    osc2.connect(bp);
    bp.connect(gain);
    gain.connect(dest);
    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.12);
    osc2.stop(time + 0.12);
  }

  private playBass(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    freq: number,
    dur: number,
    pat: TrackPattern
  ) {
    const osc = ctx.createOscillator();
    osc.type = pat.bassWave;
    osc.frequency.setValueAtTime(freq, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(pat.bassCutoff * 1.4, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(180, pat.bassCutoff * 0.55), time + dur);
    filter.Q.value = pat.wobbleRate ? 5.2 : 1.6;

    if (pat.wobbleRate) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = pat.wobbleRate;
      lfoGain.gain.value = pat.bassCutoff * 0.65;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start(time);
      lfo.stop(time + dur + 0.04);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.32, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    if (pat.distorted && this.distCurve) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = this.distCurve;
      osc.connect(shaper);
      shaper.connect(filter);
    } else {
      osc.connect(filter);
    }
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  private playLead(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    freq: number,
    dur: number,
    pat: TrackPattern
  ) {
    const osc = ctx.createOscillator();
    osc.type = pat.leadWave;
    osc.frequency.setValueAtTime(freq, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(pat.leadCutoff, time);
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.16, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);

    if (pat.leadDetune) {
      const osc2 = ctx.createOscillator();
      osc2.type = pat.leadWave;
      osc2.frequency.setValueAtTime(freq, time);
      osc2.detune.setValueAtTime(pat.leadDetune, time);
      osc2.connect(filter);
      osc2.start(time);
      osc2.stop(time + dur + 0.03);
    }

    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  private playChordStab(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    rootMidi: number,
    offsets: number[],
    dur: number
  ) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1750, time);
    filter.frequency.exponentialRampToValueAtTime(620, time + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.075, time + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    filter.connect(gain);
    gain.connect(dest);

    for (let i = 0; i < offsets.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(midiToHz(rootMidi + offsets[i]), time);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.03);
    }
  }
}

export const danceMusicEngine = new DanceMusicEngine();
