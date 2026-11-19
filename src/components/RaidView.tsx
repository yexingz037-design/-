import { useEffect, useRef, useState } from 'react';
import {
  Backpack,
  CloudFog,
  CloudRain,
  CloudSnow,
  Eye,
  Flashlight,
  Moon,
  Settings,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import {
  MAPS,
  OPERATORS,
  RARITY_CONFIG,
  TACTICAL_GEAR,
  WEAPON_REPAIR_PARTS,
  WEAPONS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  formatWeightKg,
  getItemWeight,
  getWeaponJamRiskInfo,
} from '../data/gameData';
import {
  BallisticImpactPayload,
  BallisticShotPayload,
  Raid3DEngine,
} from '../three/raid3DEngine';
import { loadControlSettings, saveControlSettings } from '../storage/settingsStore';
import {
  BodyPartId,
  GearCooldownRecord,
  HudSnapshot,
  LoadoutConfig,
  RaidOutcome,
  TacticalControlSettings,
  TacticalGearId,
  TacticalSlotKey,
} from '../types/game';
import { MissionBriefingModal } from './MissionBriefingModal';
import { TacticalSettingsModal } from './TacticalSettingsModal';

interface CanvasTracer {
  wx: number;
  wy: number;
  wz: number;
  ex: number;
  ey: number;
  ez: number;
  progress: number;
  totalLen: number;
  speed3d: number;
  caliberWeight: number;
  cadence: number;
  fromPlayer: boolean;
  color: string;
}

interface CanvasShockwave {
  wx: number;
  wy: number;
  wz: number;
  dirX: number;
  dirZ: number;
  age: number;
  maxAge: number;
  radius: number;
  color: string;
}

interface CanvasDustParticle {
  wx: number;
  wy: number;
  wz: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  startSize: number;
  endSize: number;
  alpha: number;
  rgb: string;
  isGrit: boolean;
}

interface CanvasSpark {
  wx: number;
  wy: number;
  wz: number;
  prevWx: number;
  prevWy: number;
  prevWz: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  rgb: string;
}

function getPartColor(hp: number, maxHp: number, bleeding: boolean): string {
  if (bleeding) return '#F43F5E';
  const ratio = hp / Math.max(1, maxHp);
  if (ratio <= 0.32) return '#EF4444';
  if (ratio <= 0.68) return '#F59E0B';
  return '#10B981';
}

interface RaidViewProps {
  loadout: LoadoutConfig;
  initialWeaponDurability?: number;
  gearCooldowns?: Partial<Record<TacticalGearId, GearCooldownRecord>>;
  muted: boolean;
  onToggleMute: () => void;
  onRaidEnd: (outcome: RaidOutcome) => void;
}

export function RaidView({
  loadout,
  initialWeaponDurability = 100,
  gearCooldowns,
  muted,
  onToggleMute,
  onRaidEnd,
}: RaidViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const ballisticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Raid3DEngine | null>(null);
  const pausedRef = useRef(false);
  const showBriefingRef = useRef(true);

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showBackpackModal, setShowBackpackModal] = useState(false);
  const [showBriefing, setShowBriefing] = useState(true);
  const [controlSettings, setControlSettings] = useState<TacticalControlSettings>(() => loadControlSettings());

  const handleUpdateSettings = (next: TacticalControlSettings) => {
    const saved = saveControlSettings(next);
    setControlSettings(saved);
    engineRef.current?.updateControlSettings(saved);
  };

  const op = OPERATORS[loadout.operatorId];
  const weapon = WEAPONS[loadout.weaponId];
  const activeMap = MAPS[loadout.mapId || 'zero_dam'] || MAPS.zero_dam;

  useEffect(() => {
    const mountEl = mountRef.current;
    const canvasEl = ballisticCanvasRef.current;
    if (!mountEl || !canvasEl) return;

    const tracers: CanvasTracer[] = [];
    const shockwaves: CanvasShockwave[] = [];
    const dustParticles: CanvasDustParticle[] = [];
    const sparks: CanvasSpark[] = [];
    const projA = { x: 0, y: 0, scale: 1 };
    const projB = { x: 0, y: 0, scale: 1 };
    const muzzleInfo = { wx: 0, wy: 1.1, wz: 0, dirX: 1, dirZ: 0 };

    const pushDust = (p: CanvasDustParticle) => {
      if (dustParticles.length >= 260) dustParticles.shift();
      dustParticles.push(p);
    };

    const handleBallisticShot = (ev: BallisticShotPayload) => {
      const dx = ev.ex - ev.wx;
      const dy = ev.ey - ev.wy;
      const dz = ev.ez - ev.wz;
      const totalLen = Math.max(0.25, Math.hypot(dx, dy, dz));
      if (tracers.length >= 90) tracers.shift();
      tracers.push({
        wx: ev.wx,
        wy: ev.wy,
        wz: ev.wz,
        ex: ev.ex,
        ey: ev.ey,
        ez: ev.ez,
        progress: 0,
        totalLen,
        speed3d: Math.max(24, ev.speed3d),
        caliberWeight: ev.caliberWeight,
        cadence: ev.firingCadence,
        fromPlayer: ev.fromPlayer,
        color: ev.color,
      });

      const dirLen = Math.hypot(dx, dz) || 1;
      const dirX = dx / dirLen;
      const dirZ = dz / dirLen;
      if (ev.fromPlayer) {
        if (shockwaves.length >= 24) shockwaves.shift();
        shockwaves.push({
          wx: ev.wx,
          wy: ev.wy,
          wz: ev.wz,
          dirX,
          dirZ,
          age: 0,
          maxAge: 0.095 + ev.firingCadence * 0.03,
          radius: (18 + ev.firingCadence * 16) * ev.caliberWeight,
          color: ev.color,
        });

        // Muzzle propellant smoke & ground dust kick-up scaled dynamically with firing cadence
        const muzzleDustCount = Math.min(
          10,
          Math.round((2 + ev.firingCadence * 5.2) * ev.caliberWeight)
        );
        for (let i = 0; i < muzzleDustCount; i++) {
          const side = (Math.random() - 0.5) * 1.4;
          const fwd = 1.6 + Math.random() * (2.6 + ev.firingCadence * 2.2);
          const isGrit = i % 3 === 0;
          pushDust({
            wx: ev.wx + dirX * 0.16,
            wy: ev.wy - 0.05 + (Math.random() - 0.5) * 0.16,
            wz: ev.wz + dirZ * 0.16,
            vx: dirX * fwd - dirZ * side,
            vy: 0.35 + Math.random() * (0.9 + ev.firingCadence * 0.8),
            vz: dirZ * fwd + dirX * side,
            age: 0,
            maxAge: (isGrit ? 0.38 : 0.68) + Math.random() * 0.35 + ev.firingCadence * 0.45,
            startSize: isGrit ? 2.2 : 10 + ev.firingCadence * 6,
            endSize: isGrit ? 3.5 : (26 + ev.firingCadence * 22) * ev.caliberWeight,
            alpha: isGrit
              ? Math.min(0.82, 0.35 + ev.firingCadence * 0.3)
              : Math.min(0.42, 0.14 + ev.firingCadence * 0.18),
            rgb: isGrit ? '194,186,170' : '203,213,225',
            isGrit,
          });
        }
      }
    };

    const handleBallisticImpact = (ev: BallisticImpactPayload) => {
      const surfaceRgb =
        ev.surface === 'metal'
          ? '148,163,184'
          : ev.surface === 'wood'
            ? '182,145,100'
            : ev.surface === 'kevlar'
              ? '168,162,148'
              : '205,201,192';

      // Wall/cover impact dust cloud expanding outward along struck face normal (scaled with firing frequency)
      const dustCount = Math.min(
        18,
        Math.round((4 + ev.firingCadence * 8.5) * (0.85 + ev.caliberWeight * 0.28))
      );
      for (let i = 0; i < dustCount; i++) {
        const isGrit = i % 3 === 1;
        const spread = (Math.random() - 0.5) * (2.6 + ev.firingCadence * 1.4);
        const normalPush = (1.1 + Math.random() * 2.8) * (1 + ev.firingCadence * 0.65);
        pushDust({
          wx: ev.wx + ev.nx * 0.08,
          wy: ev.wy + (Math.random() - 0.5) * 0.22,
          wz: ev.wz + ev.nz * 0.08,
          vx: ev.nx * normalPush - ev.nz * spread,
          vy: (isGrit ? 1.4 : 0.45) + Math.random() * (1.4 + ev.firingCadence * 1.1),
          vz: ev.nz * normalPush + ev.nx * spread,
          age: 0,
          maxAge: (isGrit ? 0.45 : 0.72) + Math.random() * 0.42 + ev.firingCadence * 0.55,
          startSize: isGrit ? 2.4 : 11 + ev.firingCadence * 7,
          endSize: isGrit ? 3.2 : (30 + ev.firingCadence * 26) * ev.caliberWeight,
          alpha: isGrit
            ? Math.min(0.85, 0.42 + ev.firingCadence * 0.25)
            : Math.min(0.56, 0.22 + ev.firingCadence * 0.22),
          rgb: surfaceRgb,
          isGrit,
        });
      }

      // Ricochet sparks & masonry/wood chips flying along normal
      const sparkCount = Math.min(
        14,
        Math.round((ev.surface === 'metal' ? 7 : 4) * (0.8 + ev.caliberWeight * 0.35))
      );
      const sparkRgb =
        ev.surface === 'metal'
          ? '254,240,138'
          : ev.surface === 'wood'
            ? '214,176,124'
            : '226,232,240';
      for (let i = 0; i < sparkCount; i++) {
        if (sparks.length >= 140) sparks.shift();
        const spread = (Math.random() - 0.5) * 4.8;
        const speedN = 2.8 + Math.random() * 5.2;
        sparks.push({
          wx: ev.wx + ev.nx * 0.05,
          wy: ev.wy,
          wz: ev.wz + ev.nz * 0.05,
          prevWx: ev.wx,
          prevWy: ev.wy,
          prevWz: ev.wz,
          vx: ev.nx * speedN - ev.nz * spread,
          vy: 1.5 + Math.random() * 3.8,
          vz: ev.nz * speedN + ev.nx * spread,
          age: 0,
          maxAge: 0.16 + Math.random() * 0.18,
          rgb: sparkRgb,
        });
      }
    };

    const engine = new Raid3DEngine({
      mountEl,
      loadout,
      initialWeaponDurability,
      initialControlSettings: loadControlSettings(),
      onHudUpdate: (snap) => setHud(snap),
      onRaidEnd: (outcome) => onRaidEnd(outcome),
      onToggleBackpack: () => {
        if (showBriefingRef.current) return;
        setShowSettings(false);
        setShowBackpackModal((prev) => !prev);
      },
      onTogglePause: () => {
        // Raid cannot be paused once started; Esc closes backpack or toggles live settings modal
        if (showBriefingRef.current) return;
        setShowBackpackModal((bpOpen) => {
          if (bpOpen) return false;
          setShowSettings((prev) => !prev);
          return false;
        });
      },
      onBallisticShot: handleBallisticShot,
      onBallisticImpact: handleBallisticImpact,
    });

    engineRef.current = engine;
    if (showBriefingRef.current) {
      pausedRef.current = true;
      engine.setPaused(true);
    }
    engine.start();

    const ctx = canvasEl.getContext('2d');
    let canvasW = mountEl.clientWidth || window.innerWidth;
    let canvasH = Math.max(1, mountEl.clientHeight || window.innerHeight);

    const syncCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasW = mountEl.clientWidth || window.innerWidth;
      canvasH = Math.max(1, mountEl.clientHeight || window.innerHeight);
      canvasEl.width = Math.floor(canvasW * dpr);
      canvasEl.height = Math.floor(canvasH * dpr);
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    syncCanvasSize();

    const resizeObserver = new ResizeObserver(syncCanvasSize);
    resizeObserver.observe(mountEl);

    let rafId = 0;
    let lastTs = performance.now();
    let ambientDustAccum = 0;

    const renderBallisticCanvas = (now: number) => {
      rafId = requestAnimationFrame(renderBallisticCanvas);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      if (!ctx) return;

      ctx.clearRect(0, 0, canvasW, canvasH);
      const activePaused = pausedRef.current;
      const cadence = engine.getFiringCadence();

      // Sustained rapid-fire airborne dust turbulence around firing corridor
      if (!activePaused && cadence > 0.14 && engine.getMuzzleTelemetry(muzzleInfo)) {
        ambientDustAccum += dt * cadence * 46;
        while (ambientDustAccum >= 1) {
          ambientDustAccum -= 1;
          const forwardDist = 0.6 + Math.random() * (4.5 + cadence * 4.5);
          const lateral = (Math.random() - 0.5) * (1.8 + cadence * 2.2);
          const isGrit = Math.random() < 0.42;
          pushDust({
            wx: muzzleInfo.wx + muzzleInfo.dirX * forwardDist - muzzleInfo.dirZ * lateral,
            wy: 0.35 + Math.random() * 1.1,
            wz: muzzleInfo.wz + muzzleInfo.dirZ * forwardDist + muzzleInfo.dirX * lateral,
            vx: muzzleInfo.dirX * (0.5 + cadence * 1.1) + (Math.random() - 0.5) * 1.2,
            vy: 0.25 + Math.random() * 0.75,
            vz: muzzleInfo.dirZ * (0.5 + cadence * 1.1) + (Math.random() - 0.5) * 1.2,
            age: 0,
            maxAge: 0.65 + Math.random() * 0.55 + cadence * 0.35,
            startSize: isGrit ? 1.8 : 12 + cadence * 9,
            endSize: isGrit ? 2.6 : 28 + cadence * 24,
            alpha: isGrit
              ? Math.min(0.65, 0.24 + cadence * 0.24)
              : Math.min(0.24, 0.06 + cadence * 0.11),
            rgb: isGrit ? '214,206,190' : '192,200,210',
            isGrit,
          });
        }
      }

      // 1. Update & Draw Dynamic Firing-Frequency Dust & Airborne Grit
      for (let i = dustParticles.length - 1; i >= 0; i--) {
        const p = dustParticles[i];
        if (!activePaused) {
          p.age += dt;
          if (p.age >= p.maxAge) {
            dustParticles.splice(i, 1);
            continue;
          }
          const drag = Math.exp(-dt * 2.4);
          p.vx *= drag;
          p.vz *= drag;
          p.vy = p.vy * drag + dt * (p.isGrit ? -2.2 : 0.35);
          p.wx += p.vx * dt;
          p.wy = Math.max(0.08, p.wy + p.vy * dt);
          p.wz += p.vz * dt;
        }
        if (!engine.projectWorldToScreen(p.wx, p.wy, p.wz, projA)) continue;
        const t = p.age / p.maxAge;
        const fadeIn = t < 0.14 ? t / 0.14 : 1;
        const fadeOut = 1 - t;
        const a = p.alpha * fadeIn * fadeOut * fadeOut;
        if (a <= 0.01) continue;

        const r = Math.max(1.2, (p.startSize + (p.endSize - p.startSize) * Math.pow(t, 0.65)) * projA.scale);
        if (p.isGrit) {
          ctx.fillStyle = `rgba(${p.rgb},${a.toFixed(3)})`;
          ctx.fillRect(projA.x - r * 0.5, projA.y - r * 0.5, r, r);
        } else {
          const grad = ctx.createRadialGradient(projA.x, projA.y, 0, projA.x, projA.y, r);
          grad.addColorStop(0, `rgba(${p.rgb},${a.toFixed(3)})`);
          grad.addColorStop(0.55, `rgba(${p.rgb},${(a * 0.45).toFixed(3)})`);
          grad.addColorStop(1, `rgba(${p.rgb},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(projA.x, projA.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Update & Draw Ballistic Tracers + Supersonic Wake
      for (let i = tracers.length - 1; i >= 0; i--) {
        const tr = tracers[i];
        if (!activePaused) {
          tr.progress += (tr.speed3d * dt) / tr.totalLen;
          if (tr.progress >= 1.14) {
            tracers.splice(i, 1);
            continue;
          }
        }
        const headT = Math.min(1, tr.progress);
        const tailLenRatio = Math.min(0.45, 5.2 / tr.totalLen);
        const tailT = Math.max(0, tr.progress - tailLenRatio);
        if (headT <= tailT) continue;

        const hx = tr.wx + (tr.ex - tr.wx) * headT;
        const hy = tr.wy + (tr.ey - tr.wy) * headT;
        const hz = tr.wz + (tr.ez - tr.wz) * headT;
        const tx = tr.wx + (tr.ex - tr.wx) * tailT;
        const ty = tr.wy + (tr.ey - tr.wy) * tailT;
        const tz = tr.wz + (tr.ez - tr.wz) * tailT;

        if (!engine.projectWorldToScreen(tx, ty, tz, projA)) continue;
        if (!engine.projectWorldToScreen(hx, hy, hz, projB)) continue;

        const lifeAlpha = Math.max(0, 1 - Math.max(0, tr.progress - 0.85) / 0.3);
        const width = Math.max(1.4, (1.8 + tr.caliberWeight * 0.9 + tr.cadence * 0.65) * projB.scale);

        const grad = ctx.createLinearGradient(projA.x, projA.y, projB.x, projB.y);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(
          0.55,
          tr.fromPlayer
            ? `rgba(253,224,71,${(0.42 * lifeAlpha).toFixed(3)})`
            : `rgba(248,113,113,${(0.42 * lifeAlpha).toFixed(3)})`
        );
        grad.addColorStop(1, tr.color);

        ctx.save();
        ctx.lineCap = 'round';
        // Outer supersonic wake glow
        ctx.strokeStyle = tr.fromPlayer
          ? `rgba(250,204,21,${(0.2 * lifeAlpha).toFixed(3)})`
          : `rgba(239,68,68,${(0.2 * lifeAlpha).toFixed(3)})`;
        ctx.lineWidth = width * 2.5;
        ctx.beginPath();
        ctx.moveTo(projA.x, projA.y);
        ctx.lineTo(projB.x, projB.y);
        ctx.stroke();

        // Crisp luminous ballistic streak
        ctx.strokeStyle = grad;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(projA.x, projA.y);
        ctx.lineTo(projB.x, projB.y);
        ctx.stroke();

        // Hot round tip
        ctx.fillStyle = `rgba(255,255,255,${(0.9 * lifeAlpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(projB.x, projB.y, Math.max(1.2, width * 0.68), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 3. Update & Draw Muzzle Overpressure Shockwaves
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        if (!activePaused) {
          sw.age += dt;
          if (sw.age >= sw.maxAge) {
            shockwaves.splice(i, 1);
            continue;
          }
        }
        if (!engine.projectWorldToScreen(sw.wx, sw.wy, sw.wz, projA)) continue;
        const t = sw.age / sw.maxAge;
        const r = sw.radius * (0.28 + t * 0.95) * projA.scale;
        const alpha = (1 - t) * 0.48;
        ctx.strokeStyle = `rgba(254,240,138,${alpha.toFixed(3)})`;
        ctx.lineWidth = Math.max(1, 2.4 * (1 - t));
        ctx.beginPath();
        ctx.arc(projA.x, projA.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 4. Update & Draw Wall/Cover Ricochet Sparks & Chips
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        if (!activePaused) {
          sp.age += dt;
          if (sp.age >= sp.maxAge) {
            sparks.splice(i, 1);
            continue;
          }
          sp.prevWx = sp.wx;
          sp.prevWy = sp.wy;
          sp.prevWz = sp.wz;
          sp.vy -= 14 * dt;
          sp.wx += sp.vx * dt;
          sp.wy = Math.max(0.05, sp.wy + sp.vy * dt);
          sp.wz += sp.vz * dt;
        }
        if (!engine.projectWorldToScreen(sp.prevWx, sp.prevWy, sp.prevWz, projA)) continue;
        if (!engine.projectWorldToScreen(sp.wx, sp.wy, sp.wz, projB)) continue;
        const alpha = Math.max(0, 1 - sp.age / sp.maxAge);
        ctx.strokeStyle = `rgba(${sp.rgb},${alpha.toFixed(3)})`;
        ctx.lineWidth = Math.max(1.2, 2.0 * projB.scale);
        ctx.beginPath();
        ctx.moveTo(projA.x, projA.y);
        ctx.lineTo(projB.x, projB.y);
        ctx.stroke();
      }
    };

    rafId = requestAnimationFrame(renderBallisticCanvas);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, [loadout, initialWeaponDurability, onRaidEnd]);

  useEffect(() => {
    showBriefingRef.current = showBriefing;
    // Once deployed from pre-raid briefing, the battlefield NEVER pauses — looting & settings run live!
    const isPaused = showBriefing;
    pausedRef.current = isPaused;
    engineRef.current?.setPaused(isPaused);
    engineRef.current?.setInputBlocked(showBackpackModal || showSettings);
  }, [showBackpackModal, showSettings, showBriefing]);

  const handleDeployFromBriefing = (initialSlotCooldowns: Partial<Record<TacticalSlotKey, number>>) => {
    soundEngine.unlock();
    soundEngine.playUiClick();
    engineRef.current?.applyBriefingCooldowns(initialSlotCooldowns);
    showBriefingRef.current = false;
    setShowBriefing(false);
  };

  const timeMin = hud ? Math.floor(hud.raidTimeRemaining / 60) : 20;
  const timeSec = hud ? Math.floor(hud.raidTimeRemaining % 60) : 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#06080C] select-none">
      {/* Isolated 3D WebGL Mount Container */}
      <div
        ref={mountRef}
        className={`w-full h-full ${
          hud?.cameraMode === 'first' && hud?.pointerLocked && !showBackpackModal && !showSettings && !showBriefing
            ? 'cursor-none'
            : 'cursor-crosshair'
        }`}
      />

      {/* 2D Canvas Ballistic Tracers, Muzzle Shockwaves & Firing-Frequency Dynamic Dust */}
      <canvas
        ref={ballisticCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-[5]"
      />

      {/* Crisp Military Film Vignette & Arterial Bleeding Peripheral Tint (no backdrop-filter) */}
      <div
        className="absolute inset-0 pointer-events-none z-[6]"
        style={{ background: 'radial-gradient(circle at 50% 50%, transparent 56%, rgba(4,6,10,0.68) 100%)' }}
      />
      {hud?.bleeding && (
        <div
          className="absolute inset-0 pointer-events-none z-[7]"
          style={{
            background: `radial-gradient(circle at 50% 50%, transparent 50%, rgba(185, 28, 28, ${Math.min(0.45, 0.2 + hud.bleedingCount * 0.08)}) 100%)`,
          }}
        />
      )}
      {hud && hud.damageFlash > 0.02 && (
        <div
          className="absolute inset-0 pointer-events-none z-[8]"
          style={{
            background: `radial-gradient(circle at 50% 50%, transparent 44%, rgba(220, 38, 38, ${Math.min(0.65, hud.damageFlash * 0.62).toFixed(3)}) 100%)`,
          }}
        />
      )}

      {/* First-Person Tactical Crosshair, High-Zoom Scope Reticle & Lean Indicator */}
      {hud &&
        hud.cameraMode === 'first' &&
        !hud.introActive &&
        !showBackpackModal &&
        !showSettings &&
        !showBriefing && (
          <div className="absolute inset-0 pointer-events-none z-[9] flex items-center justify-center">
            {hud.isAds && (hud.activeScopeTier === '4x' || hud.activeScopeTier === '8x') ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      hud.activeScopeTier === '8x'
                        ? 'radial-gradient(circle at 50% 50%, transparent 25%, rgba(3,5,10,0.92) 31%, rgba(2,4,8,0.98) 100%)'
                        : 'radial-gradient(circle at 50% 50%, transparent 29%, rgba(3,5,10,0.86) 36%, rgba(2,4,8,0.96) 100%)',
                  }}
                />
                <div
                  className={`relative rounded-full border border-slate-500/70 flex items-center justify-center ${
                    hud.activeScopeTier === '8x' ? 'w-[340px] h-[340px]' : 'w-[380px] h-[380px]'
                  }`}
                >
                  <div className="absolute inset-x-0 top-1/2 h-[1px] bg-slate-950/90" />
                  <div className="absolute inset-y-0 left-1/2 w-[1px] bg-slate-950/90" />
                  <div className="absolute inset-x-10 top-1/2 h-[1px] bg-[#00E59B]/45" />
                  <div className="absolute inset-y-10 left-1/2 w-[1px] bg-[#00E59B]/45" />
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.95)]" />
                  {/* Mil-dot range ticks */}
                  {[-3, -2, -1, 1, 2, 3].map((step) => (
                    <div
                      key={`h_${step}`}
                      className="absolute top-1/2 -translate-y-1/2 w-[1px] h-2 bg-slate-200/80"
                      style={{ left: `calc(50% + ${step * 22}px)` }}
                    />
                  ))}
                  {[-2, -1, 1, 2, 3].map((step) => (
                    <div
                      key={`v_${step}`}
                      className="absolute left-1/2 -translate-x-1/2 h-[1px] w-2.5 bg-slate-200/80"
                      style={{ top: `calc(50% + ${step * 22}px)` }}
                    />
                  ))}
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-mono-tabular text-[#00E59B] bg-[#060911]/80 px-2 py-0.5">
                    {hud.activeScopeLabel}
                  </div>
                </div>
              </div>
            ) : hud.isAds ? (
              <div className="relative w-12 h-12 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00E59B] shadow-[0_0_8px_rgba(0,229,155,0.95)]" />
                <div className="absolute top-1/2 left-0 w-3 h-[1.5px] -translate-y-1/2 bg-[#00E59B]/75" />
                <div className="absolute top-1/2 right-0 w-3 h-[1.5px] -translate-y-1/2 bg-[#00E59B]/75" />
                <div className="absolute left-1/2 top-0 h-3 w-[1.5px] -translate-x-1/2 bg-[#00E59B]/75" />
                <div className="absolute left-1/2 bottom-0 h-3 w-[1.5px] -translate-x-1/2 bg-[#00E59B]/75" />
              </div>
            ) : (
              (() => {
                const gap = hud.isJammed ? 14 : hud.isSprinting ? 14 : hud.traumaEffects.armTremor ? 12 : 7;
                const col = hud.isJammed ? '#FB7185' : '#E2E8F0';
                return (
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <div
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: hud.isJammed ? '#FB7185' : '#00E59B' }}
                    />
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-[1.5px] h-2.5"
                      style={{ bottom: `calc(50% + ${gap}px)`, backgroundColor: col }}
                    />
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-[1.5px] h-2.5"
                      style={{ top: `calc(50% + ${gap}px)`, backgroundColor: col }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-[1.5px] w-2.5"
                      style={{ right: `calc(50% + ${gap}px)`, backgroundColor: col }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-[1.5px] w-2.5"
                      style={{ left: `calc(50% + ${gap}px)`, backgroundColor: col }}
                    />
                  </div>
                );
              })()
            )}
            {hud.leanState !== 0 && (
              <div className="absolute top-[58%] px-2.5 py-0.5 bg-[#0B1018]/85 border border-[#00E59B]/60 text-[11px] font-mono-tabular text-[#00E59B] font-bold">
                {hud.leanState < 0 ? '← 左探头 [Z]' : '右探头 [C] →'}
              </div>
            )}
            {!hud.pointerLocked && (
              <div className="absolute bottom-24 px-3.5 py-1 bg-[#0B1018]/88 border border-slate-700/80 text-[11px] font-mono-tabular text-slate-200 tracking-wide">
                点击画面锁定第一人称准星 · [Z/C] 探头 · [V] 切换视角 · [Esc] 设置
              </div>
            )}
          </div>
        )}
      {hud?.introActive && (
        <>
          <div className="absolute top-0 inset-x-0 h-8 bg-[#030407] border-b border-white/10 pointer-events-none z-20" />
          <div className="absolute bottom-0 inset-x-0 h-8 bg-[#030407] border-t border-white/10 pointer-events-none z-20" />
        </>
      )}

      {/* Low-Occlusion HUD Overlay (pointer-events: none, no backdrop-filter) */}
      {hud && (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4">
          {/* TOP ROW */}
          <div className="flex items-start justify-between gap-4">
            {/* Top-Left: Vitals, Armor Plates & Anatomical Trauma Silhouette */}
            <div className="bg-[#0B1018]/92 border border-slate-700/80 df-chamfer-sm p-3 w-80 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <img
                  src={op.portrait}
                  alt={op.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-sm object-cover border border-[#00E59B]/60 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white truncate">{op.name}</span>
                    <span className="font-mono-tabular text-[#00E59B] shrink-0">淘汰 {hud.kills}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-300 mt-0.5">
                    <span>
                      生命 {hud.hp}/{hud.maxHp} · 护甲 {hud.armor}/{hud.maxArmor}
                    </span>
                    {hud.bleeding && (
                      <span className="text-rose-400 font-bold">
                        {hud.bleedingCount}处失血
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Segmented 4-Plate Armor Bar */}
              <div className="grid grid-cols-4 gap-1">
                {[0, 1, 2, 3].map((seg) => {
                  const segFill = Math.max(0, Math.min(1, (hud.armor / Math.max(1, hud.maxArmor)) * 4 - seg));
                  return (
                    <div key={seg} className="h-1.5 bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-sky-400 transition-all duration-100"
                        style={{ width: `${segFill * 100}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="h-2 w-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    hud.bleeding || hud.hp / hud.maxHp < 0.3 ? 'bg-rose-500' : 'bg-[#00E59B]'
                  }`}
                  style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }}
                />
              </div>
              {/* Stamina Bar (Weight-Affected Recovery & Exhausted Slow-Walk State) */}
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between text-[10px] font-mono-tabular">
                  <span className="text-slate-300">
                    体力{' '}
                    <strong
                      className={
                        hud.isStaminaExhausted
                          ? 'text-rose-400'
                          : hud.isSprinting
                            ? 'text-amber-300'
                            : 'text-white'
                      }
                    >
                      {hud.stamina}/{hud.maxStamina}
                    </strong>
                  </span>
                  <span
                    className={
                      hud.isStaminaExhausted
                        ? 'text-rose-400 font-bold'
                        : hud.isSprinting
                          ? 'text-amber-300'
                          : hud.staminaRegenRatePct < 75
                            ? 'text-amber-400'
                            : 'text-[#00E59B]'
                    }
                  >
                    {hud.isStaminaExhausted
                      ? `力竭慢走 · 恢复 ${hud.staminaRegenRatePct}%`
                      : hud.isSprinting
                        ? '冲刺消耗'
                        : `恢复速率 ${hud.staminaRegenRatePct}%`}
                  </span>
                </div>
                <div className="relative h-1.5 w-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      hud.isStaminaExhausted
                        ? 'bg-rose-500'
                        : hud.stamina / Math.max(1, hud.maxStamina) < 0.28
                          ? 'bg-amber-500'
                          : 'bg-amber-400'
                    }`}
                    style={{ width: `${(hud.stamina / Math.max(1, hud.maxStamina)) * 100}%` }}
                  />
                  {hud.isStaminaExhausted && (
                    <div
                      className="absolute inset-y-0 w-0.5 bg-white/80"
                      style={{ left: '25%' }}
                      title="恢复至 25% 解除强制慢走"
                    />
                  )}
                </div>
              </div>

              {/* Hardcore Trauma Model: Anatomical Body Zone Diagram & Debuffs */}
              <div className="pt-2 border-t border-slate-800/90 flex items-center gap-3">
                <svg
                  width="54"
                  height="64"
                  viewBox="0 0 54 64"
                  aria-label="部位创伤监测图"
                  className="shrink-0"
                >
                  {/* Head */}
                  <circle
                    cx="27"
                    cy="9"
                    r="6"
                    fill={getPartColor(hud.bodyParts.head.hp, hud.bodyParts.head.maxHp, hud.bodyParts.head.bleeding)}
                    fillOpacity="0.32"
                    stroke={getPartColor(hud.bodyParts.head.hp, hud.bodyParts.head.maxHp, hud.bodyParts.head.bleeding)}
                    strokeWidth="1.6"
                  />
                  {/* Chest / Torso */}
                  <rect
                    x="18"
                    y="17"
                    width="18"
                    height="20"
                    rx="2"
                    fill={getPartColor(hud.bodyParts.chest.hp, hud.bodyParts.chest.maxHp, hud.bodyParts.chest.bleeding)}
                    fillOpacity="0.32"
                    stroke={getPartColor(hud.bodyParts.chest.hp, hud.bodyParts.chest.maxHp, hud.bodyParts.chest.bleeding)}
                    strokeWidth="1.6"
                  />
                  {/* Arms */}
                  <rect
                    x="9"
                    y="18"
                    width="6"
                    height="19"
                    rx="2"
                    fill={getPartColor(hud.bodyParts.arms.hp, hud.bodyParts.arms.maxHp, hud.bodyParts.arms.bleeding)}
                    fillOpacity="0.32"
                    stroke={getPartColor(hud.bodyParts.arms.hp, hud.bodyParts.arms.maxHp, hud.bodyParts.arms.bleeding)}
                    strokeWidth="1.5"
                  />
                  <rect
                    x="39"
                    y="18"
                    width="6"
                    height="19"
                    rx="2"
                    fill={getPartColor(hud.bodyParts.arms.hp, hud.bodyParts.arms.maxHp, hud.bodyParts.arms.bleeding)}
                    fillOpacity="0.32"
                    stroke={getPartColor(hud.bodyParts.arms.hp, hud.bodyParts.arms.maxHp, hud.bodyParts.arms.bleeding)}
                    strokeWidth="1.5"
                  />
                  {/* Legs */}
                  <rect
                    x="18"
                    y="39"
                    width="7"
                    height="22"
                    rx="2"
                    fill={getPartColor(hud.bodyParts.legs.hp, hud.bodyParts.legs.maxHp, hud.bodyParts.legs.bleeding)}
                    fillOpacity="0.32"
                    stroke={getPartColor(hud.bodyParts.legs.hp, hud.bodyParts.legs.maxHp, hud.bodyParts.legs.bleeding)}
                    strokeWidth="1.5"
                  />
                  <rect
                    x="29"
                    y="39"
                    width="7"
                    height="22"
                    rx="2"
                    fill={getPartColor(hud.bodyParts.legs.hp, hud.bodyParts.legs.maxHp, hud.bodyParts.legs.bleeding)}
                    fillOpacity="0.32"
                    stroke={getPartColor(hud.bodyParts.legs.hp, hud.bodyParts.legs.maxHp, hud.bodyParts.legs.bleeding)}
                    strokeWidth="1.5"
                  />
                </svg>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] font-mono-tabular">
                    {(
                      [
                        { id: 'head', label: '头' },
                        { id: 'chest', label: '胸' },
                        { id: 'arms', label: '臂' },
                        { id: 'legs', label: '腿' },
                      ] as Array<{ id: BodyPartId; label: string }>
                    ).map((p) => {
                      const st = hud.bodyParts[p.id];
                      const pct = Math.round((st.hp / Math.max(1, st.maxHp)) * 100);
                      const col = getPartColor(st.hp, st.maxHp, st.bleeding);
                      return (
                        <div key={p.id} className="flex items-center justify-between">
                          <span className="text-slate-400">{p.label}</span>
                          <span style={{ color: col }} className="font-bold">
                            {pct}%{st.bleeding ? ' 血' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {(hud.bleeding || hud.traumaEffects.armTremor || hud.traumaEffects.legFractured || hud.traumaEffects.headConcussed) && (
                    <div className="text-[10px] leading-snug text-rose-300 font-medium pt-0.5">
                      {hud.bleeding && (
                        <div>
                          {hud.medkits > 0
                            ? '持续失血中 · 按 [1] 手动止血'
                            : '失血警告 · 随身医疗包已耗尽'}
                        </div>
                      )}
                      {hud.traumaEffects.armTremor && <div className="text-amber-300">手臂受创 · 散布与换弹恶化</div>}
                      {hud.traumaEffects.legFractured && <div className="text-amber-300">腿部受创 · 移动受限</div>}
                      {hud.traumaEffects.headConcussed && <div className="text-amber-300">头部震荡 · 视野受损</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top-Center: Delta Force Tactical Compass + Raid Timer + Boss Bar */}
            <div className="flex flex-col items-center gap-2">
              <div className="px-4 py-1.5 bg-[#0B1018]/92 border border-slate-700/80 df-chamfer-sm flex items-center gap-4">
                <span className="text-xs font-mono-tabular text-[#00E59B] font-bold">
                  {(() => {
                    const deg = Math.round(((hud.playerAngle * 180) / Math.PI + 450) % 360);
                    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
                    const label = dirs[Math.round(deg / 45) % 8];
                    return `${label} ${String(deg).padStart(3, '0')}°`;
                  })()}
                </span>
                <span className="text-xs text-slate-300 font-medium">{hud.mapName}</span>
                <span
                  className={`font-mono-tabular text-lg font-bold ${
                    hud.raidTimeRemaining < 180
                      ? 'text-rose-400'
                      : hud.raidTimeRemaining < 360
                        ? 'text-amber-300'
                        : 'text-white'
                  }`}
                >
                  {String(timeMin).padStart(2, '0')}:{String(timeSec).padStart(2, '0')}
                </span>
              </div>

              {/* Dynamic Weather & Day-Night Tactical Telemetry */}
              <div className="px-3.5 py-1 bg-[#0B1018]/90 border border-slate-700/75 df-chamfer-sm flex items-center gap-2.5 text-[11px] font-mono-tabular pointer-events-auto">
                <span className="flex items-center gap-1 text-slate-200 whitespace-nowrap">
                  {hud.timeOfDayPhase === 'dawn' ? (
                    <Sunrise className="w-3.5 h-3.5 text-amber-300" />
                  ) : hud.timeOfDayPhase === 'day' ? (
                    <Sun className="w-3.5 h-3.5 text-amber-300" />
                  ) : hud.timeOfDayPhase === 'dusk' ? (
                    <Sunset className="w-3.5 h-3.5 text-orange-400" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-sky-300" />
                  )}
                  <span>
                    {String(Math.floor(hud.timeOfDayHours)).padStart(2, '0')}:
                    {String(Math.floor((hud.timeOfDayHours % 1) * 60)).padStart(2, '0')} {hud.timeOfDayLabel}
                  </span>
                </span>
                <span className="text-slate-600">·</span>
                <span
                  className={`flex items-center gap-1 font-semibold whitespace-nowrap ${
                    hud.weather === 'rain'
                      ? 'text-sky-300'
                      : hud.weather === 'snow'
                        ? 'text-cyan-200'
                        : hud.weather === 'smog'
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                  }`}
                >
                  {hud.weather === 'rain' ? (
                    <CloudRain className="w-3.5 h-3.5" />
                  ) : hud.weather === 'snow' ? (
                    <CloudSnow className="w-3.5 h-3.5" />
                  ) : hud.weather === 'smog' ? (
                    <CloudFog className="w-3.5 h-3.5" />
                  ) : (
                    <Sun className="w-3.5 h-3.5" />
                  )}
                  <span>{hud.weatherLabel}</span>
                </span>
                <span className="text-slate-600">·</span>
                <span
                  className={`whitespace-nowrap ${
                    hud.enemyVisionMult <= 0.72
                      ? 'text-[#00E59B]'
                      : hud.enemyVisionMult < 0.95
                        ? 'text-sky-300'
                        : 'text-slate-300'
                  }`}
                  title={hud.weatherEffectSummary}
                >
                  敌视 {Math.round(hud.enemyVisionMult * 100)}%
                </span>
                <span className="text-slate-600">·</span>
                <span
                  className={`whitespace-nowrap ${
                    hud.playerNoiseMult > 1.05
                      ? 'text-amber-300 font-bold'
                      : hud.playerNoiseMult < 0.95
                        ? 'text-cyan-300'
                        : 'text-slate-300'
                  }`}
                >
                  声播 {Math.round(hud.playerNoiseMult * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.unlock();
                    soundEngine.playUiClick();
                    engineRef.current?.cycleWeatherManual();
                  }}
                  title="手动切换战区天气测试战术影响"
                  className="ml-1 pl-2 border-l border-slate-700/80 text-slate-300 hover:text-[#00E59B] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  切天气
                </button>
              </div>

              {/* Extraction Lever & Corner Extraction Objective Strip */}
              <div
                className={`px-3.5 py-1 df-chamfer-sm border flex items-center gap-2 text-[11px] font-mono-tabular ${
                  hud.extractionLever.pulled
                    ? 'bg-[#0A1A15]/92 border-emerald-500/70 text-emerald-300'
                    : 'bg-[#1A1308]/92 border-amber-500/70 text-amber-200'
                }`}
              >
                <Zap
                  className={`w-3.5 h-3.5 shrink-0 ${
                    hud.extractionLever.pulled ? 'text-[#00E59B]' : 'text-amber-400'
                  }`}
                />
                {hud.extractionLever.pulled ? (
                  <span>撤离总闸已通电 · 前往任意角落撤离点坚守 03:00 完成撤离</span>
                ) : (
                  <span>
                    未拉闸锁定 · 随机电闸：
                    <strong className="text-amber-300">{hud.extractionLever.zoneName}</strong>（
                    {hud.extractionLever.distanceMeters}m）· 拉闸后需在角落撤离点坚守 03:00
                  </span>
                )}
              </div>

              {hud.bossEngaged && hud.bossHpRatio !== null && (
                <div className="w-72 bg-[#1A0E14]/95 border border-rose-500/70 df-chamfer-sm px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-rose-300 font-bold mb-1">
                    <span>战区首领 · {hud.bossDisplayName}</span>
                    <span className="font-mono-tabular">{Math.ceil(hud.bossHpRatio * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 transition-all duration-100"
                      style={{ width: `${hud.bossHpRatio * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {(hud.laserActiveRemaining > 0 ||
                hud.binocularsActiveRemaining > 0 ||
                hud.irActiveRemaining > 0 ||
                hud.droneActiveRemaining > 0 ||
                hud.radioReconActiveRemaining > 0 ||
                hud.jammerActiveCount > 0) && (
                <div className="px-3.5 py-1 bg-[#0B1018]/92 border border-emerald-500/50 df-chamfer-sm text-[11px] font-mono-tabular text-emerald-300 flex flex-wrap items-center gap-3">
                  {hud.droneActiveRemaining > 0 && (
                    <span>便携无人机巡航侦察 {Math.ceil(hud.droneActiveRemaining)}s</span>
                  )}
                  {hud.radioReconActiveRemaining > 0 && (
                    <span className="text-sky-300">无线电侦察呼叫扫描 {Math.ceil(hud.radioReconActiveRemaining)}s</span>
                  )}
                  {hud.laserActiveRemaining > 0 && (
                    <span>激光标定激活 {Math.ceil(hud.laserActiveRemaining)}s</span>
                  )}
                  {hud.binocularsActiveRemaining > 0 && (
                    <span>测距望远镜扫描 {Math.ceil(hud.binocularsActiveRemaining)}s</span>
                  )}
                  {hud.irActiveRemaining > 0 && (
                    <span>热像侦测激活 {Math.ceil(hud.irActiveRemaining)}s</span>
                  )}
                  {hud.jammerActiveCount > 0 && (
                    <span className="text-sky-300">信号干扰站运行中 ×{hud.jammerActiveCount}</span>
                  )}
                </div>
              )}

              {hud.statusBanner && (
                <div className="px-4 py-1.5 bg-[#0B1018]/95 border border-amber-500/60 df-chamfer-sm text-xs font-medium text-amber-200">
                  {hud.statusBanner}
                </div>
              )}
            </div>

            {/* Top-Right: Tactical Minimap + Controls */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.unlock();
                    soundEngine.playUiClick();
                    engineRef.current?.toggleCameraMode();
                  }}
                  aria-label="切换第一或第三人称视角"
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded bg-[#0F1623]/92 border border-slate-700/80 hover:border-[#00E59B]/70 text-xs font-mono-tabular text-slate-100 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Eye className="w-3.5 h-3.5 text-[#00E59B]" />
                  <span>[V] {hud.cameraMode === 'first' ? '第一人称' : '第三人称'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.unlock();
                    soundEngine.playUiClick();
                    engineRef.current?.toggleFlashlight();
                  }}
                  aria-label="切换战术枪灯"
                  className={`flex items-center gap-1 px-2.5 py-2 rounded border text-xs font-mono-tabular cursor-pointer whitespace-nowrap shrink-0 ${
                    hud.flashlightOn
                      ? 'bg-[#172622]/95 border-[#00E59B]/80 text-[#00E59B]'
                      : 'bg-[#0F1623]/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <Flashlight className="w-3.5 h-3.5" />
                  <span>[L]</span>
                </button>
                <button
                  onClick={() => {
                    soundEngine.unlock();
                    onToggleMute();
                  }}
                  aria-label="切换静音"
                  className="p-2 rounded bg-[#0F1623]/90 border border-slate-700/80 text-slate-200 hover:border-slate-500 cursor-pointer"
                >
                  {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.unlock();
                    soundEngine.playUiClick();
                    setShowBackpackModal(false);
                    setShowSettings((s) => !s);
                  }}
                  aria-label="打开实时操控设置"
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded border text-xs font-mono-tabular cursor-pointer whitespace-nowrap shrink-0 ${
                    showSettings
                      ? 'bg-[#172622]/95 border-[#00E59B] text-[#00E59B]'
                      : 'bg-[#0F1623]/92 border-slate-700/80 text-slate-100 hover:border-[#00E59B]/70'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 text-[#00E59B]" />
                  <span>[Esc] 设置</span>
                </button>
              </div>

              <div className="bg-[#0F1623]/92 border border-slate-700/80 rounded-md p-1.5">
                {(() => {
                  const currentMap = MAPS[hud.mapId] || MAPS.zero_dam;
                  return (
                    <svg width="192" height="140" viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} className="bg-[#090D16] rounded-sm">
                      {currentMap.zones.map((z) => (
                        <rect
                          key={z.id}
                          x={z.x}
                          y={z.y}
                          width={z.w}
                          height={z.h}
                          fill={z.color}
                          fillOpacity={0.5}
                          stroke="rgba(148,163,184,0.16)"
                          strokeWidth={12}
                        />
                      ))}
                      {currentMap.roads?.map((r, idx) => (
                        <rect
                          key={`rd_${idx}`}
                          x={r.x}
                          y={r.y}
                          width={r.w}
                          height={r.h}
                          fill={r.color || '#1e293b'}
                          fillOpacity={0.85}
                        />
                      ))}
                      {currentMap.waterBodies?.map((wb, idx) => (
                        <rect
                          key={`wb_${idx}`}
                          x={wb.x}
                          y={wb.y}
                          width={wb.w}
                          height={wb.h}
                          fill="#0E7490"
                          fillOpacity={0.72}
                        />
                      ))}
                      {currentMap.obstacles.map((o) => {
                        if (o.id.startsWith('riv_')) return null;
                        const fill =
                          o.kind === 'building'
                            ? '#64748B'
                            : o.kind === 'container'
                              ? '#94A3B8'
                              : o.kind === 'sandbag'
                                ? '#78716C'
                                : '#475569';
                        return (
                          <rect
                            key={o.id}
                            x={o.x}
                            y={o.y}
                            width={o.w}
                            height={o.h}
                            fill={fill}
                            fillOpacity={o.kind === 'building' ? 0.92 : 0.78}
                          />
                        );
                      })}
                      {hud.minimapContainers.map((c, idx) => (
                        <circle
                          key={idx}
                          cx={c.x}
                          cy={c.y}
                          r={38}
                          fill={c.searched ? '#334155' : c.kind === 'safe' ? '#F59E0B' : '#38BDF8'}
                        />
                      ))}
                      {hud.minimapExtracts.map((ext, idx) => (
                        <circle
                          key={idx}
                          cx={ext.x}
                          cy={ext.y}
                          r={110}
                          fill={ext.active ? 'rgba(16,185,129,0.28)' : 'rgba(239,68,68,0.22)'}
                          stroke={ext.active ? '#10B981' : '#EF4444'}
                          strokeWidth={30}
                        />
                      ))}
                      <g transform={`translate(${hud.extractionLever.x}, ${hud.extractionLever.y}) rotate(45)`}>
                        <rect
                          x={-64}
                          y={-64}
                          width={128}
                          height={128}
                          fill={hud.extractionLever.pulled ? 'rgba(16,185,129,0.35)' : '#F59E0B'}
                          stroke={hud.extractionLever.pulled ? '#10B981' : '#FEF08A'}
                          strokeWidth={24}
                        />
                      </g>
                      {hud.minimapEnemies.map((e, idx) => (
                        <circle key={idx} cx={e.x} cy={e.y} r={e.kind === 'boss' ? 82 : 50} fill="#EF4444" />
                      ))}
                      <circle cx={hud.playerX} cy={hud.playerY} r={62} fill="#10B981" stroke="#FFFFFF" strokeWidth={24} />
                    </svg>
                  );
                })()}
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono-tabular mt-1 px-0.5 gap-1">
                  <span className="text-amber-300">黄菱:拉闸点</span>
                  <span className={hud.extractionLever.pulled ? 'text-emerald-400' : 'text-rose-400'}>
                    {hud.extractionLever.pulled ? '绿圈:撤离点' : '红圈:未通电'}
                  </span>
                  <span className="text-amber-400">金点:保险箱</span>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER CONTEXTUAL PROMPTS */}
          <div className="flex flex-col items-center gap-2">
            {(hud.isJammed || hud.jamClearing) && (
              <button
                type="button"
                onClick={() => engineRef.current?.triggerClearJam()}
                className="pointer-events-auto bg-[#1D0B11]/95 border border-rose-500 rounded-md px-5 py-2.5 w-80 text-center cursor-pointer"
              >
                <div className="text-xs font-bold text-rose-300 font-mono-tabular">
                  {hud.jamClearing
                    ? `正在拉栓退壳排除卡壳 · ${Math.round(hud.jamClearProgress * 100)}%`
                    : '枪械供弹卡壳停射！按 [R] 键立即排障清膛'}
                </div>
                {hud.jamClearing && (
                  <div className="mt-1.5 h-1.5 w-full bg-slate-900 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-rose-400 transition-all duration-75"
                      style={{ width: `${Math.min(100, hud.jamClearProgress * 100)}%` }}
                    />
                  </div>
                )}
              </button>
            )}

            {hud.extractionLever.canPull && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  engineRef.current?.triggerPullLever();
                }}
                className="pointer-events-auto bg-[#1D1508]/95 border border-amber-400 rounded-md px-5 py-2.5 w-96 text-center cursor-pointer hover:bg-[#291E0B]"
              >
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-300 font-mono-tabular">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>按 [F] 拉动「{hud.extractionLever.name}」</span>
                </div>
                <div className="text-[11px] text-amber-100/85 mt-0.5">
                  通电开启全部地图角落撤离点（抵达后需坚守 03:00 完成撤离）
                </div>
              </button>
            )}

            {hud.activeExtraction && (
              <div
                className={`rounded-md px-5 py-3 w-96 text-center border ${
                  hud.activeExtraction.isInside
                    ? 'bg-[#091A16]/95 border-[#00E59B]'
                    : 'bg-[#1D1408]/95 border-amber-500'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-bold">
                  <span className={hud.activeExtraction.isInside ? 'text-[#00E59B]' : 'text-amber-300'}>
                    {hud.activeExtraction.isInside
                      ? `撤离坚守倒计时 · ${hud.activeExtraction.name}`
                      : `已离开撤离区 · ${hud.activeExtraction.name}`}
                  </span>
                  <span className="font-mono-tabular text-base text-white">
                    {String(Math.floor(hud.activeExtraction.remainingSec / 60)).padStart(2, '0')}:
                    {String(Math.floor(hud.activeExtraction.remainingSec % 60)).padStart(2, '0')}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full bg-slate-900 rounded-sm overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      hud.activeExtraction.isInside ? 'bg-[#00E59B]' : 'bg-amber-400'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (hud.activeExtraction.progress / hud.activeExtraction.holdDuration) * 100
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono-tabular mt-1.5 text-slate-300">
                  <span>
                    {hud.activeExtraction.isInside
                      ? '请坚守区域内防范敌军围攻，倒计时归零自动撤离'
                      : '⚠ 撤离进度正在缓慢回退，请立即返回绿色撤离区域'}
                  </span>
                  <span className="text-white font-bold">
                    {Math.floor((hud.activeExtraction.progress / hud.activeExtraction.holdDuration) * 100)}%
                  </span>
                </div>
              </div>
            )}

            {!hud.activeExtraction && hud.nearbyExtract && !hud.nearbyExtract.leverPulled && (
              <div className="bg-[#1D0B11]/95 border border-rose-500/85 rounded-md px-5 py-2.5 w-96 text-center">
                <div className="text-xs font-bold text-rose-300">
                  {hud.nearbyExtract.name} 未通电锁定（无法撤离）
                </div>
                <div className="text-[11px] text-rose-100/85 mt-1 font-mono-tabular">
                  请先前往随机电闸【{hud.extractionLever.zoneName}】（距你 {hud.extractionLever.distanceMeters}m）按 [F] 拉闸
                </div>
              </div>
            )}

            {hud.nearbyContainer && !hud.nearbyContainer.searching && !hud.nearbyContainer.searched && (
              <div className="bg-[#0F1623]/92 border border-sky-500/60 rounded px-4 py-1.5 text-xs font-semibold text-sky-200">
                按 [F] 搜刮：{hud.nearbyContainer.name}
              </div>
            )}

            {hud.nearbyContainer && hud.nearbyContainer.searching && (
              <div className="bg-[#0F1623]/95 border border-amber-500/80 rounded-md px-5 py-2.5 w-72 text-center">
                <div className="text-xs font-semibold text-amber-300">
                  正在破译搜刮：{hud.nearbyContainer.name}
                </div>
                <div className="mt-1.5 h-1.5 w-full bg-slate-800 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-100"
                    style={{ width: `${hud.nearbyContainer.progress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM ROW */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-center gap-2.5 pointer-events-auto">
              <button
                onClick={() => engineRef.current?.triggerUseMedkit()}
                className={`px-3 py-2 rounded-md border text-xs font-mono-tabular transition-colors cursor-pointer ${
                  hud.bleeding
                    ? 'bg-rose-950/90 border-rose-500 text-rose-200 hover:bg-rose-900'
                    : 'bg-[#0F1623]/90 border-slate-700/80 text-slate-200 hover:border-emerald-500/60'
                }`}
              >
                <span className={hud.bleeding ? 'text-rose-200 font-bold' : 'text-slate-400'}>
                  {hud.bleeding ? '[1] 急救止血 ' : '[1] 医疗包 '}
                </span>
                <strong className={hud.bleeding ? 'text-white' : 'text-emerald-400'}>×{hud.medkits}</strong>
              </button>
              <button
                onClick={() => engineRef.current?.triggerUseArmorPlate()}
                className="px-3 py-2 rounded-md bg-[#0F1623]/90 border border-slate-700/80 hover:border-sky-500/60 text-xs font-mono-tabular cursor-pointer"
              >
                <span className="text-slate-400">[2] 护甲板 </span>
                <strong className="text-sky-400">×{hud.armorPlates}</strong>
              </button>
              <button
                onClick={() => setShowBackpackModal(true)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#0F1623]/90 border text-xs font-mono-tabular cursor-pointer ${
                  hud.encumbrancePenaltyPct >= 25
                    ? 'border-rose-500/70'
                    : hud.encumbrancePenaltyPct >= 10
                      ? 'border-amber-500/70'
                      : 'border-slate-700/80 hover:border-amber-500'
                }`}
              >
                <Backpack className="w-4 h-4 text-amber-400" />
                <span>
                  [Tab] 背包 {hud.backpack.length}/{hud.backpackCapacity} · 安全箱 {hud.safeBox.length}/{hud.safeBoxCapacity}
                </span>
                <span
                  className={`pl-2 border-l border-slate-700 font-bold ${
                    hud.encumbrancePenaltyPct >= 25
                      ? 'text-rose-400'
                      : hud.encumbrancePenaltyPct >= 10
                        ? 'text-amber-300'
                        : 'text-slate-300'
                  }`}
                >
                  {formatWeightKg(hud.carriedWeightKg)}
                  {hud.encumbrancePenaltyPct > 0 ? ` (-${hud.encumbrancePenaltyPct}%移速)` : ''}
                </span>
              </button>
              <span className="hidden xl:inline text-[11px] text-slate-400 font-mono-tabular ml-2">
                [Z/C] 探头 · [V] 视角 · [L] 枪灯 · [Esc] 设置 · 右键
                {controlSettings.adsMode === 'toggle' ? '点击' : '长按'}开镜（{hud.activeScopeLabel}）
              </span>
            </div>

            {/* Bottom-Right: Non-Lethal Tactical Gear Slots (Q / E / X) + Weapon */}
            <div className="flex items-end gap-2.5 pointer-events-auto">
              {(['Q', 'E', 'X'] as TacticalSlotKey[]).map((slot) => {
                const gear = TACTICAL_GEAR[loadout.tacticalGear?.[slot]];
                if (!gear) return null;
                const cd = slot === 'Q' ? hud.qCooldown : slot === 'E' ? hud.eCooldown : hud.xCooldown;
                const charges = slot === 'Q' ? hud.qCharges : slot === 'E' ? hud.eCharges : hud.xCharges;
                const depleted = charges !== null && charges <= 0;
                const isActive =
                  (gear.id === 'laser_designator' && hud.laserActiveRemaining > 0) ||
                  (gear.id === 'tactical_binoculars' && hud.binocularsActiveRemaining > 0) ||
                  (gear.id === 'ir_monocular' && hud.irActiveRemaining > 0) ||
                  (gear.id === 'recon_drone' && hud.droneActiveRemaining > 0) ||
                  (gear.id === 'radio_recon' && hud.radioReconActiveRemaining > 0) ||
                  (gear.id === 'signal_jammer' && hud.jammerActiveCount > 0);
                return (
                  <button
                    key={slot}
                    onClick={() => engineRef.current?.triggerGearSlot(slot)}
                    className={`w-28 p-2 rounded-md border text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#102620]/95 border-[#00E59B] text-white'
                        : depleted
                          ? 'bg-[#090D16]/90 border-slate-800/80 text-slate-600'
                          : cd <= 0
                            ? 'bg-[#0F1623]/92 border-slate-600 hover:border-[#00E59B]/70 text-white'
                            : 'bg-[#090D16]/90 border-slate-800 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono-tabular font-bold">
                      <span>
                        [{slot}] {depleted ? '已耗尽' : cd > 0 ? `${Math.ceil(cd)}s` : '就绪'}
                      </span>
                      <span className={depleted ? 'text-slate-600' : 'text-[#00E59B]'}>
                        {charges !== null ? `×${charges}` : '光学'}
                      </span>
                    </div>
                    <div className="text-[11px] truncate mt-0.5 font-medium">{gear.shortName}</div>
                  </button>
                );
              })}

              {(() => {
                const risk = getWeaponJamRiskInfo(hud.weaponDurability);
                return (
                  <div
                    className={`bg-[#0F1623]/92 border rounded-md px-4 py-2.5 min-w-[184px] ${
                      hud.isJammed ? 'border-rose-500' : 'border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-300 font-semibold truncate">{weapon.name}</span>
                      <span
                        className="font-mono-tabular font-bold shrink-0"
                        style={{ color: hud.isJammed ? '#FB7185' : risk.color }}
                      >
                        {hud.isJammed ? '卡壳' : `${Math.round(hud.weaponDurability)}%`}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="font-mono-tabular text-2xl font-bold text-white">{hud.ammoInMag}</span>
                      <span className="font-mono-tabular text-xs text-slate-400">/ {hud.reserveAmmo}</span>
                    </div>
                    {/* Weapon durability gauge */}
                    <div className="mt-1.5 space-y-1">
                      <div className="h-1 w-full bg-slate-800 rounded-sm overflow-hidden">
                        <div
                          className="h-full transition-all duration-150"
                          style={{
                            width: `${Math.max(0, Math.min(100, hud.weaponDurability))}%`,
                            backgroundColor: risk.color,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400">
                        <span>耐久 {hud.weaponDurability.toFixed(0)}%</span>
                        <span style={{ color: hud.isJammed ? '#FB7185' : risk.color }}>
                          {hud.jamClearing
                            ? '正在排障...'
                            : hud.isJammed
                              ? '[R] 排障清膛'
                              : risk.shortStatus}
                        </span>
                      </div>
                    </div>
                    {hud.jamClearing && (
                      <div className="mt-1 h-1 w-full bg-slate-800 rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-rose-400"
                          style={{ width: `${Math.min(100, hud.jamClearProgress * 100)}%` }}
                        />
                      </div>
                    )}
                    {!hud.jamClearing && hud.isReloading && (
                      <div className="mt-1 h-1 w-full bg-slate-800 rounded-sm overflow-hidden">
                        <div className="h-full bg-amber-400" style={{ width: `${hud.reloadProgress * 100}%` }} />
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* BACKPACK, CONTAINER LOOT & SAFEBOX MODAL */}
      {showBackpackModal && hud && (
        <div className="absolute inset-0 z-30 bg-[#060911]/62 flex items-center justify-center p-6">
          <div className="w-full max-w-4xl bg-[#131A26]/95 border border-slate-700 rounded-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Backpack className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-white">战术物资整理（容器 / 背包 / 安全箱）</span>
                <span className="text-xs font-mono-tabular text-amber-300 font-semibold">
                  实时战区 · 搜刮中敌人仍在行动
                </span>
                <span
                  className={`text-xs font-mono-tabular pl-2.5 border-l border-slate-700 ${
                    hud.encumbrancePenaltyPct >= 25
                      ? 'text-rose-300 font-bold'
                      : hud.encumbrancePenaltyPct >= 10
                        ? 'text-amber-300 font-bold'
                        : 'text-slate-300'
                  }`}
                >
                  当前负重 {formatWeightKg(hud.carriedWeightKg)} · 移速{' '}
                  {hud.encumbrancePenaltyPct > 0 ? `-${hud.encumbrancePenaltyPct}%` : '无衰减'}
                </span>
              </div>
              <button
                onClick={() => setShowBackpackModal(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>关闭 (Tab)</span>
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="text-sm font-bold text-white flex items-center justify-between">
                  <span>{hud.nearbyContainer ? hud.nearbyContainer.name : '附近无打开的战利品容器'}</span>
                  {hud.nearbyContainer && (
                    <span className="text-xs font-mono-tabular text-slate-400">
                      剩余 {hud.nearbyContainer.items.length} 件
                    </span>
                  )}
                </div>

                {!hud.nearbyContainer || hud.nearbyContainer.items.length === 0 ? (
                  <div className="h-64 border border-dashed border-slate-800 rounded-md flex items-center justify-center text-xs text-slate-500">
                    {hud.nearbyContainer ? '该容器已被搜刮一空' : '靠近战场容器按 F 搜刮战利品'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {hud.nearbyContainer.items
                      .filter((i) => i.revealed)
                      .map((item) => {
                        const cfg = RARITY_CONFIG[item.rarity];
                        const repairDef = WEAPON_REPAIR_PARTS[item.templateId];
                        const itemWeight = getItemWeight(item.templateId, item.weight);
                        return (
                          <div
                            key={item.uid}
                            style={{ borderColor: cfg.border, backgroundColor: cfg.bg }}
                            className="p-3 rounded-md border flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">{item.name}</span>
                                <span className="text-[11px] font-mono-tabular text-slate-200 bg-slate-950/70 px-1.5 py-0.5 border border-slate-700/80">
                                  {formatWeightKg(itemWeight)}
                                </span>
                              </div>
                              <div className="text-xs font-mono-tabular mt-0.5" style={{ color: cfg.color }}>
                                {cfg.label} · {item.value.toLocaleString()} 哈夫币 · 重量 {formatWeightKg(itemWeight)}
                              </div>
                              {repairDef && (
                                <div className="text-[11px] text-[#00E59B] font-mono-tabular mt-0.5">
                                  维修零件 · 基地工作台 +{repairDef.restoreDurability}% 耐久
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => engineRef.current?.takeLootItem(hud.nearbyContainer!.id, item.uid, false)}
                                className="px-2.5 py-1.5 rounded bg-slate-900/90 hover:bg-slate-800 text-xs text-slate-200 cursor-pointer"
                              >
                                放背包
                              </button>
                              <button
                                onClick={() => engineRef.current?.takeLootItem(hud.nearbyContainer!.id, item.uid, true)}
                                className="px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 cursor-pointer"
                              >
                                塞安全箱
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-[#0E141F] border border-amber-500/50 rounded-md p-3.5">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-400 mb-2.5">
                    <span>安全箱（阵亡亦百分百保留）</span>
                    <span className="font-mono-tabular">
                      {hud.safeBox.length}/{hud.safeBoxCapacity}
                    </span>
                  </div>
                  {hud.safeBox.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3 text-center">暂无高价值保底物资</div>
                  ) : (
                    <div className="space-y-1.5">
                      {hud.safeBox.map((item) => {
                        const cfg = RARITY_CONFIG[item.rarity];
                        const itemWeight = getItemWeight(item.templateId, item.weight);
                        return (
                          <div
                            key={item.uid}
                            className="px-3 py-2 rounded bg-[#151E2E] border border-slate-700 flex items-center justify-between text-xs gap-2"
                          >
                            <span className="font-semibold truncate" style={{ color: cfg.color }}>
                              {item.name} ({item.value.toLocaleString()} · {formatWeightKg(itemWeight)})
                            </span>
                            <button
                              onClick={() => engineRef.current?.moveBetweenBackpackAndSafeBox(item.uid, 'safebox')}
                              className="text-slate-400 hover:text-white cursor-pointer shrink-0"
                            >
                              移至背包
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-[#0E141F] border border-slate-800 rounded-md p-3.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-200 mb-2.5">
                    <span>战术背包（成功撤离可带出）</span>
                    <span className="font-mono-tabular">
                      {hud.backpack.length}/{hud.backpackCapacity}
                    </span>
                  </div>
                  {hud.backpack.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4 text-center">背包空空如也</div>
                  ) : (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {hud.backpack.map((item) => {
                        const cfg = RARITY_CONFIG[item.rarity];
                        const itemWeight = getItemWeight(item.templateId, item.weight);
                        return (
                          <div
                            key={item.uid}
                            className="px-3 py-2 rounded bg-[#151E2E] border border-slate-800 flex items-center justify-between text-xs gap-2"
                          >
                            <span className="font-semibold truncate" style={{ color: cfg.color }}>
                              {item.name} ({item.value.toLocaleString()} · {formatWeightKg(itemWeight)})
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => engineRef.current?.moveBetweenBackpackAndSafeBox(item.uid, 'backpack')}
                                className="text-amber-400 hover:text-amber-300 cursor-pointer"
                              >
                                进安全箱
                              </button>
                              <button
                                onClick={() => engineRef.current?.dropFromBackpack(item.uid)}
                                className="text-slate-500 hover:text-rose-400 cursor-pointer"
                              >
                                丢弃
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIVE TACTICAL SETTINGS MODAL (NO PAUSE ONCE RAID BEGINS) */}
      {showSettings && !showBriefing && (
        <TacticalSettingsModal
          inRaid
          settings={controlSettings}
          onChange={handleUpdateSettings}
          onClose={() => setShowSettings(false)}
          muted={muted}
          onToggleMute={onToggleMute}
          activeScopeTier={hud?.activeScopeTier}
          onAbandonRaid={() => {
            setShowSettings(false);
            engineRef.current?.forceAbandonRaid();
          }}
        />
      )}
      {/* PRE-RAID MISSION BRIEFING MODAL */}
      {showBriefing && (
        <MissionBriefingModal
          mapDef={activeMap}
          loadout={loadout}
          gearCooldowns={gearCooldowns}
          onDeploy={handleDeployFromBriefing}
        />
      )}
    </div>
  );
}
