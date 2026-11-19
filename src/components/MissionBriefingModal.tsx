import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Clock,
  Compass,
  Crosshair,
  MapPin,
  Radio,
  ShieldAlert,
  Target,
} from 'lucide-react';
import {
  ARMOR_TIERS,
  OPERATORS,
  TACTICAL_GEAR,
  WEAPONS,
  WORLD_HEIGHT,
  WORLD_SCALE,
  WORLD_WIDTH,
} from '../data/gameData';
import {
  GearCooldownRecord,
  LoadoutConfig,
  MapDef,
  TacticalGearId,
  TacticalSlotKey,
} from '../types/game';

interface MissionBriefingModalProps {
  mapDef: MapDef;
  loadout: LoadoutConfig;
  gearCooldowns?: Partial<Record<TacticalGearId, GearCooldownRecord>>;
  onDeploy: (initialSlotCooldowns: Partial<Record<TacticalSlotKey, number>>) => void;
}

function getBearingLabel(dx: number, dy: number): string {
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const compass = (deg + 450) % 360;
  const dirs = ['正北', '东北', '正东', '东南', '正南', '西南', '正西', '西北'];
  return dirs[Math.round(compass / 45) % 8];
}

function getThreatMeta(mapDef: MapDef) {
  const level = mapDef.threatLevel || 'ELEVATED';
  if (level === 'CRITICAL') {
    return {
      code: 'CLASS-S // 绝密高危',
      label: '极高威胁',
      bars: 4,
      color: '#F43F5E',
      badgeBg: 'rgba(244, 63, 94, 0.16)',
      badgeBorder: 'rgba(244, 63, 94, 0.6)',
      advice: '建议穿甲弹药 + 3级以上护甲 + 干扰器',
    };
  }
  if (level === 'HIGH') {
    return {
      code: 'CLASS-A // 高危交火',
      label: '高威胁战区',
      bars: 3,
      color: '#F59E0B',
      badgeBg: 'rgba(245, 158, 11, 0.16)',
      badgeBorder: 'rgba(245, 158, 11, 0.6)',
      advice: '注意远距狙击视野与首领重甲卫队',
    };
  }
  if (level === 'MODERATE') {
    return {
      code: 'CLASS-C // 常规警戒',
      label: '中等威胁',
      bars: 1,
      color: '#00E59B',
      badgeBg: 'rgba(0, 229, 155, 0.14)',
      badgeBorder: 'rgba(0, 229, 155, 0.5)',
      advice: '适合常规渗透搜刮并稳步转点撤离',
    };
  }
  return {
    code: 'CLASS-B // 警戒冲突',
    label: '中上威胁',
    bars: 2,
    color: '#38BDF8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    badgeBorder: 'rgba(56, 189, 248, 0.55)',
    advice: '核心金库守备严密，警惕交火引援',
  };
}

export function MissionBriefingModal({
  mapDef,
  loadout,
  gearCooldowns,
  onDeploy,
}: MissionBriefingModalProps) {
  const [telemetryPct, setTelemetryPct] = useState(0);
  const [scanOffset, setScanOffset] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [focusedExtId, setFocusedExtId] = useState<string>(
    mapDef.extractions[0]?.id || ''
  );

  const op = OPERATORS[loadout.operatorId];
  const weapon = WEAPONS[loadout.weaponId];
  const armor =
    ARMOR_TIERS.find((a) => a.tier === loadout.armorTier) || ARMOR_TIERS[0];
  const threat = useMemo(() => getThreatMeta(mapDef), [mapDef]);

  const enemyBreakdown = useMemo(() => {
    let grunts = 0;
    let heavies = 0;
    let snipers = 0;
    let bosses = 0;
    for (const e of mapDef.enemies) {
      if (e.kind === 'grunt') grunts++;
      else if (e.kind === 'heavy') heavies++;
      else if (e.kind === 'sniper') snipers++;
      else if (e.kind === 'boss') bosses++;
    }
    return {
      total: mapDef.enemies.length,
      grunts,
      heavies,
      snipers,
      bosses,
    };
  }, [mapDef.enemies]);

  const extractDetails = useMemo(() => {
    return mapDef.extractions.map((ext) => {
      const dx = ext.x - mapDef.spawnPoint.x;
      const dy = ext.y - mapDef.spawnPoint.y;
      const distMeters = Math.round(Math.hypot(dx, dy) * WORLD_SCALE);
      const bearing = getBearingLabel(dx, dy);
      const coordX = Math.round(ext.x * WORLD_SCALE);
      const coordZ = Math.round(ext.y * WORLD_SCALE);
      return {
        ...ext,
        distMeters,
        bearing,
        coordX,
        coordZ,
      };
    });
  }, [mapDef]);

  const highValueZones = useMemo(
    () =>
      mapDef.zones.filter((z) => z.danger === 'HIGH' || z.danger === 'BOSS'),
    [mapDef.zones]
  );

  const intelLines = useMemo(
    () =>
      mapDef.tacticalIntel && mapDef.tacticalIntel.length > 0
        ? mapDef.tacticalIntel
        : [mapDef.description],
    [mapDef]
  );

  // Smooth telemetry sweep & recon radar scanline using requestAnimationFrame
  useEffect(() => {
    let raf = 0;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsedSec = (now - startTime) / 1000;
      const pct = Math.min(100, Math.round((elapsedSec / 0.85) * 100));
      setTelemetryPct(pct);
      setScanOffset(((elapsedSec * 0.42) % 1) * WORLD_HEIGHT);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mapDef.id]);

  // Live 100ms ticker for usage-based tactical gear cooldown indicators
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  const slotReadiness = useMemo(() => {
    return (['Q', 'E', 'X'] as TacticalSlotKey[]).map((slot) => {
      const gearId = loadout.tacticalGear?.[slot];
      const gear = TACTICAL_GEAR[gearId];
      const rec = gearId ? gearCooldowns?.[gearId] : undefined;
      const remainingSec = rec ? Math.max(0, (rec.readyAt - nowMs) / 1000) : 0;
      const isReady = remainingSec <= 0.05;
      const totalCycleSec = rec?.cooldownDurationSec || gear?.cooldown || 10;
      const readinessPct = isReady
        ? 100
        : Math.max(4, Math.min(99, Math.round((1 - remainingSec / Math.max(1, totalCycleSec)) * 100)));
      const carryOverSec =
        isReady || !gear ? 0 : Math.min(gear.cooldown, Number(remainingSec.toFixed(1)));
      return {
        slot,
        gear,
        rec,
        remainingSec,
        isReady,
        readinessPct,
        carryOverSec,
        lastRaidUses: rec?.lastRaidUses || 0,
        totalUses: rec?.totalUses || 0,
      };
    });
  }, [loadout.tacticalGear, gearCooldowns, nowMs]);

  const unequippedMonitorGear = useMemo(() => {
    const equippedSet = new Set(Object.values(loadout.tacticalGear || {}));
    const watchIds: TacticalGearId[] = ['recon_drone', 'radio_recon', 'signal_jammer'];
    for (const [id, rec] of Object.entries(gearCooldowns || {}) as Array<
      [TacticalGearId, GearCooldownRecord | undefined]
    >) {
      if (rec && rec.readyAt > nowMs && !watchIds.includes(id)) {
        watchIds.push(id);
      }
    }
    return watchIds
      .filter((id) => !equippedSet.has(id) && TACTICAL_GEAR[id])
      .map((id) => {
        const gear = TACTICAL_GEAR[id];
        const rec = gearCooldowns?.[id];
        const remainingSec = rec ? Math.max(0, (rec.readyAt - nowMs) / 1000) : 0;
        return {
          gear,
          rec,
          remainingSec,
          isReady: remainingSec <= 0.05,
        };
      });
  }, [loadout.tacticalGear, gearCooldowns, nowMs]);

  const activeCooldownCount = slotReadiness.filter((s) => !s.isReady).length;

  const triggerDeploy = useCallback(() => {
    const currentNow = Date.now();
    const initialSlotCooldowns: Partial<Record<TacticalSlotKey, number>> = {};
    (['Q', 'E', 'X'] as TacticalSlotKey[]).forEach((slot) => {
      const gearId = loadout.tacticalGear?.[slot];
      const gear = gearId ? TACTICAL_GEAR[gearId] : undefined;
      const rec = gearId ? gearCooldowns?.[gearId] : undefined;
      if (gear && rec) {
        const rem = Math.max(0, (rec.readyAt - currentNow) / 1000);
        if (rem > 0.05) {
          initialSlotCooldowns[slot] = Math.min(gear.cooldown, rem);
        }
      }
    });
    onDeploy(initialSlotCooldowns);
  }, [loadout.tacticalGear, gearCooldowns, onDeploy]);

  // Allow Enter or Space to immediately confirm briefing & deploy
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        triggerDeploy();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [triggerDeploy]);

  const stage1Ready = telemetryPct >= 28;
  const stage2Ready = telemetryPct >= 58;
  const stage3Ready = telemetryPct >= 86;

  return (
    <div className="absolute inset-0 z-50 bg-[#05080E]/92 flex items-center justify-center p-4 md:p-5">
      <div className="w-full max-w-6xl max-h-[94vh] overflow-y-auto bg-[#0C121C] border border-slate-700/90 df-chamfer shadow-2xl flex flex-col">
        {/* TOP BRIEFING CLASSIFICATION BAR */}
        <div className="px-5 py-3.5 bg-[#080D14] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-[#0F1E24] border border-[#00E59B]/60 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4 text-[#00E59B]" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-mono-tabular tracking-wider text-[#00E59B]">
                <span>G.T.I. 战区前线指挥部 // 任务简报</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-300">
                  {telemetryPct < 100
                    ? `卫星链路上行 ${telemetryPct}%`
                    : '战区态势同步完毕'}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-display font-extrabold tracking-wide text-white leading-tight mt-0.5">
                {mapDef.name}{' '}
                <span className="text-xs md:text-sm font-mono-tabular font-semibold text-slate-400 ml-1.5">
                  {mapDef.subtitle}
                </span>
              </h1>
            </div>
          </div>

          <div
            style={{
              backgroundColor: threat.badgeBg,
              borderColor: threat.badgeBorder,
            }}
            className="px-3.5 py-1.5 border df-chamfer-sm flex items-center gap-2.5"
          >
            <AlertTriangle
              className="w-4 h-4 shrink-0"
              style={{ color: threat.color }}
            />
            <div className="text-right">
              <div
                className="text-[10px] font-mono-tabular font-bold tracking-wider"
                style={{ color: threat.color }}
              >
                {threat.code}
              </div>
              <div className="text-xs font-bold text-white">
                {mapDef.dangerLabel}
              </div>
            </div>
          </div>
        </div>

        {/* TELEMETRY SYNC PROGRESS STRIP */}
        <div className="h-1 w-full bg-slate-900 overflow-hidden">
          <div
            className="h-full bg-[#00E59B] transition-all duration-75"
            style={{ width: `${telemetryPct}%` }}
          />
        </div>

        {/* MAIN BRIEFING BODY */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT: INTERACTIVE RECON MAP & EXTRACTION VECTORS */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="bg-[#080C14] border border-slate-800 rounded-md p-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#00E59B]" />
                  <span>战区实时侦察态势图 (220m × 160m)</span>
                </span>
                <span className="text-[10px] font-mono-tabular text-slate-400">
                  点击右侧撤离点标定路线
                </span>
              </div>

              <svg
                viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
                className="w-full h-auto bg-[#06090F] rounded-sm border border-slate-800/80"
              >
                {/* Zones */}
                {mapDef.zones.map((z) => (
                  <g key={z.id}>
                    <rect
                      x={z.x}
                      y={z.y}
                      width={z.w}
                      height={z.h}
                      fill={z.color}
                      fillOpacity={0.55}
                      stroke={
                        z.danger === 'BOSS'
                          ? 'rgba(244,63,94,0.5)'
                          : z.danger === 'HIGH'
                            ? 'rgba(245,158,11,0.35)'
                            : 'rgba(148,163,184,0.18)'
                      }
                      strokeWidth={14}
                    />
                    <text
                      x={z.x + z.w / 2}
                      y={z.y + z.h / 2}
                      textAnchor="middle"
                      fill={
                        z.danger === 'BOSS'
                          ? '#FDA4AF'
                          : z.danger === 'HIGH'
                            ? '#FCD34D'
                            : '#94A3B8'
                      }
                      fontSize={95}
                      fontWeight={700}
                      opacity={0.78}
                    >
                      {z.name.split('·')[0].trim()}
                    </text>
                  </g>
                ))}

                {/* Roads */}
                {mapDef.roads?.map((r, idx) => (
                  <rect
                    key={`br_rd_${idx}`}
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    fill={r.color || '#1E293B'}
                    fillOpacity={0.8}
                  />
                ))}

                {/* Water */}
                {mapDef.waterBodies?.map((wb, idx) => (
                  <rect
                    key={`br_wb_${idx}`}
                    x={wb.x}
                    y={wb.y}
                    width={wb.w}
                    height={wb.h}
                    fill="#0E7490"
                    fillOpacity={0.74}
                  />
                ))}

                {/* Buildings & Obstacles */}
                {mapDef.obstacles.map((o) => {
                  if (o.id.startsWith('riv_')) return null;
                  return (
                    <rect
                      key={`br_obs_${o.id}`}
                      x={o.x}
                      y={o.y}
                      width={o.w}
                      height={o.h}
                      fill={o.kind === 'building' ? '#64748B' : '#475569'}
                      fillOpacity={o.kind === 'building' ? 0.92 : 0.72}
                    />
                  );
                })}

                {/* Extraction Vector Lines from Spawn */}
                {extractDetails.map((ext) => {
                  const isFocused = ext.id === focusedExtId;
                  const strokeCol =
                    ext.activatesAtSec === 0 ? '#10B981' : '#F59E0B';
                  return (
                    <g key={`vec_${ext.id}`}>
                      <line
                        x1={mapDef.spawnPoint.x}
                        y1={mapDef.spawnPoint.y}
                        x2={ext.x}
                        y2={ext.y}
                        stroke={strokeCol}
                        strokeWidth={isFocused ? 24 : 12}
                        strokeDasharray="65 45"
                        strokeOpacity={isFocused ? 0.92 : 0.35}
                      />
                      <circle
                        cx={ext.x}
                        cy={ext.y}
                        r={isFocused ? 175 : 130}
                        fill={
                          ext.activatesAtSec === 0
                            ? 'rgba(16,185,129,0.22)'
                            : 'rgba(245,158,11,0.22)'
                        }
                        stroke={strokeCol}
                        strokeWidth={isFocused ? 36 : 22}
                      />
                      <text
                        x={ext.x - 140}
                        y={Math.max(150, ext.y - 210)}
                        fill={strokeCol}
                        fontSize={105}
                        fontWeight={800}
                      >
                        撤离 · {ext.distMeters}m
                      </text>
                    </g>
                  );
                })}

                {/* Spawn / Drop Point Marker */}
                <circle
                  cx={mapDef.spawnPoint.x}
                  cy={mapDef.spawnPoint.y}
                  r={110}
                  fill="rgba(56,189,248,0.24)"
                  stroke="#38BDF8"
                  strokeWidth={28}
                />
                <circle
                  cx={mapDef.spawnPoint.x}
                  cy={mapDef.spawnPoint.y}
                  r={46}
                  fill="#FFFFFF"
                />
                <text
                  x={mapDef.spawnPoint.x + 135}
                  y={mapDef.spawnPoint.y + 35}
                  fill="#7DD3FC"
                  fontSize={105}
                  fontWeight={800}
                >
                  空降点
                </text>

                {/* Dynamic Sweeping Recon Scanline */}
                <line
                  x1={0}
                  y1={scanOffset}
                  x2={WORLD_WIDTH}
                  y2={scanOffset}
                  stroke="#00E59B"
                  strokeOpacity={0.55}
                  strokeWidth={18}
                />
              </svg>

              <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono-tabular text-slate-400">
                <span className="text-sky-300">● 白蓝标：己方空降潜入点</span>
                <span className="text-emerald-400">◎ 绿圈：常驻撤离</span>
                <span className="text-amber-400">◎ 金圈：限时撤离</span>
              </div>
            </div>

            {/* High-Value & Boss Zone Summary */}
            <div className="bg-[#0E1521] border border-slate-800 rounded-md p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-rose-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-rose-400" />
                  <span>首领悬赏目标：{mapDef.bossName}</span>
                </span>
                <span className="font-mono-tabular text-[11px] text-rose-200 bg-rose-950/60 border border-rose-500/40 px-2 py-0.5 rounded-sm">
                  {mapDef.bossZone}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {highValueZones.map((hz) => (
                  <span
                    key={hz.id}
                    className={`text-[11px] px-2 py-0.5 rounded-sm border font-medium ${
                      hz.danger === 'BOSS'
                        ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                        : 'bg-amber-950/40 border-amber-500/35 text-amber-200'
                    }`}
                  >
                    {hz.danger === 'BOSS' ? '首领区' : '高危高爆率'} · {hz.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: EXTRACTION POINTS, THREAT LEVEL & TACTICAL INTEL */}
          <div className="lg:col-span-7 flex flex-col gap-3.5">
            {/* 1. EXTRACTION POINTS LOCATION & SCHEDULE */}
            <div
              className={`bg-[#0E1521] border border-slate-800 rounded-md p-3.5 transition-all duration-300 ${
                stage1Ready ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-1'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h2 className="text-xs font-bold tracking-wider uppercase text-emerald-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>地图角落固定撤离点 ({extractDetails.length})</span>
                </h2>
                <span className="text-[11px] font-mono-tabular text-amber-300 font-semibold">
                  限时 20:00 · 须先随机拉闸 · 坚守 03:00 撤离
                </span>
              </div>

              <div className="mb-2.5 px-3 py-2 rounded bg-[#181209] border border-amber-500/45 text-[11px] text-amber-100/90 leading-relaxed">
                <strong className="text-amber-300">撤离机制与战损警告：</strong>
                本局最长 <strong className="font-mono-tabular text-white">20 分钟</strong>。进入战区后须先前往地图中<strong className="text-amber-300">随机刷新的撤离总闸</strong>按 <strong className="font-mono-tabular text-white">[F]</strong> 拉闸通电，随后抵达任意角落撤离点坚守 <strong className="font-mono-tabular text-[#00E59B]">3 分钟 (03:00)</strong> 方可撤离；若未拉闸撤离超时或战斗阵亡，将导致背包物资遗失与资产惩罚扣除。
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {extractDetails.map((ext) => {
                  const isFocused = ext.id === focusedExtId;
                  return (
                    <button
                      key={ext.id}
                      type="button"
                      onClick={() => setFocusedExtId(ext.id)}
                      className={`text-left p-3 rounded border transition-colors cursor-pointer ${
                        isFocused
                          ? 'bg-[#112224] border-[#00E59B]/80'
                          : 'bg-[#090E16] border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">
                          {ext.name}
                        </span>
                        <span className="text-[10px] font-mono-tabular px-1.5 py-0.5 rounded-sm shrink-0 font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          先拉闸 · 坚守 03:00
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono-tabular text-sky-300 mt-1.5">
                        <span>
                          方位：{ext.bearing} {ext.distMeters}m
                        </span>
                        <span className="text-slate-500">|</span>
                        <span className="text-slate-300">
                          坐标 [{ext.coordX}m, {ext.coordZ}m]
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {ext.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. ESTIMATED THREAT LEVEL & FORCE BREAKDOWN */}
            <div
              className={`bg-[#0E1521] border border-slate-800 rounded-md p-3.5 transition-all duration-300 ${
                stage2Ready ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-1'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <h2 className="text-xs font-bold tracking-wider uppercase text-amber-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>预计威胁等级评估：{threat.label}</span>
                </h2>
                <span className="text-[11px] font-mono-tabular text-slate-400">
                  {threat.advice}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className="h-2 rounded-sm bg-slate-800 overflow-hidden"
                  >
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: step <= threat.bars && stage2Ready ? '100%' : '0%',
                        backgroundColor: threat.color,
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono-tabular">
                <div className="bg-[#090E16] border border-slate-800/90 px-2.5 py-2 rounded-sm flex items-center justify-between">
                  <span className="text-slate-400">已探明敌军</span>
                  <strong className="text-white">{enemyBreakdown.total} 组</strong>
                </div>
                <div className="bg-[#090E16] border border-slate-800/90 px-2.5 py-2 rounded-sm flex items-center justify-between">
                  <span className="text-slate-400">重装盾卫</span>
                  <strong className="text-amber-300">{enemyBreakdown.heavies} 名</strong>
                </div>
                <div className="bg-[#090E16] border border-slate-800/90 px-2.5 py-2 rounded-sm flex items-center justify-between">
                  <span className="text-slate-400">狙击哨位</span>
                  <strong className="text-sky-300">{enemyBreakdown.snipers} 处</strong>
                </div>
                <div className="bg-[#090E16] border border-slate-800/90 px-2.5 py-2 rounded-sm flex items-center justify-between">
                  <span className="text-slate-400">战区首领</span>
                  <strong className="text-rose-400">{enemyBreakdown.bosses} 名</strong>
                </div>
              </div>
            </div>

            {/* 3. TARGET AREA TACTICAL INTEL */}
            <div
              className={`bg-[#0E1521] border border-slate-800 rounded-md p-3.5 flex-1 transition-all duration-300 ${
                stage3Ready ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-1'
              }`}
            >
              <h2 className="text-xs font-bold tracking-wider uppercase text-sky-300 flex items-center gap-1.5 mb-2.5">
                <Crosshair className="w-3.5 h-3.5 text-sky-400" />
                <span>目标区域战术情报 · BRIEFING INTEL</span>
              </h2>
              <div className="space-y-2">
                {intelLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-slate-200 leading-relaxed bg-[#090E16]/85 border border-slate-800/70 px-3 py-2 rounded-sm"
                  >
                    <span className="font-mono-tabular text-[#00E59B] font-bold shrink-0">
                      0{idx + 1}
                    </span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* BOTTOM FULL-WIDTH: USAGE-BASED TACTICAL GEAR COOLDOWN & READINESS INDICATOR */}
          <div
            className={`lg:col-span-12 bg-[#0E1521] border border-slate-800 rounded-md p-3.5 transition-all duration-300 ${
              stage3Ready ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-1'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <BatteryCharging className="w-4 h-4 text-[#00E59B]" />
                <h2 className="text-xs font-bold tracking-wider uppercase text-slate-100">
                  硬核战术装备可用状态与使用冷却时间指示器 · TACTICAL GEAR READINESS
                </h2>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono-tabular">
                {activeCooldownCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-sm bg-amber-500/15 border border-amber-500/45 text-amber-300">
                    {activeCooldownCount} 件装备基于上局消耗整备冷却中
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-sm bg-emerald-500/15 border border-emerald-500/45 text-emerald-300">
                    全槽位 100% 就绪 · 无整备延迟
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {slotReadiness.map((item) => {
                if (!item.gear) return null;
                const radius = 18;
                const circumference = 2 * Math.PI * radius;
                const dashOffset = circumference * (1 - item.readinessPct / 100);
                const accentColor = item.isReady ? '#00E59B' : '#F59E0B';

                return (
                  <div
                    key={item.slot}
                    className={`p-3 rounded border transition-colors ${
                      item.isReady
                        ? 'bg-[#091214] border-emerald-500/35'
                        : 'bg-[#14100A] border-amber-500/45'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 text-[10px] font-mono-tabular font-bold rounded-xs bg-slate-900 border border-slate-700 text-[#00E59B]">
                            [{item.slot}]
                          </span>
                          <span className="text-xs font-bold text-white truncate">
                            {item.gear.shortName}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 truncate">
                          {item.gear.categoryLabel}
                        </div>
                      </div>

                      {/* Circular SVG Cooldown / Readiness Gauge */}
                      <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                        <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
                          <circle
                            cx="24"
                            cy="24"
                            r={radius}
                            fill="none"
                            stroke="rgba(51,65,85,0.55)"
                            strokeWidth="3.5"
                          />
                          <circle
                            cx="24"
                            cy="24"
                            r={radius}
                            fill="none"
                            stroke={accentColor}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                          />
                        </svg>
                        <span
                          className="absolute text-[10px] font-mono-tabular font-bold"
                          style={{ color: accentColor }}
                        >
                          {item.isReady ? '100%' : `${item.readinessPct}%`}
                        </span>
                      </div>
                    </div>

                    {/* Availability & Live Cooldown Countdown Row */}
                    <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono-tabular">
                      <span
                        className={`flex items-center gap-1 font-bold ${
                          item.isReady ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {item.isReady ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>就绪 · 可立即触发</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>整备冷却 {item.remainingSec.toFixed(1)}s</span>
                          </>
                        )}
                      </span>
                      <span className="text-slate-400">
                        战区冷却 {item.gear.cooldown}s
                      </span>
                    </div>

                    {/* Linear Progress Meter */}
                    <div className="mt-1.5 h-1.5 w-full bg-slate-800/90 rounded-xs overflow-hidden">
                      <div
                        className="h-full transition-all duration-100"
                        style={{
                          width: `${item.readinessPct}%`,
                          backgroundColor: accentColor,
                        }}
                      />
                    </div>

                    {/* Usage Telemetry & Carryover Warning */}
                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono-tabular text-slate-400">
                      <span>
                        上局使用 <strong className="text-slate-200">{item.lastRaidUses}</strong> 次 · 累计{' '}
                        <strong className="text-slate-200">{item.totalUses}</strong> 次
                      </span>
                      <span>
                        {item.gear.maxCharges !== null
                          ? `携行 ${item.gear.maxCharges} 组 · 持续 ${item.gear.durationSec}s`
                          : `可复用 · 持续 ${item.gear.durationSec}s`}
                      </span>
                    </div>

                    {!item.isReady && (
                      <div className="mt-1 text-[10px] font-mono-tabular text-amber-300/90">
                        提前空降将带入 {item.carryOverSec.toFixed(1)}s 初期整备延迟
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {unequippedMonitorGear.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tabular">
                <span className="text-slate-400">基地战术库重点器材监控（未挂载至本次出战槽位）：</span>
                <div className="flex flex-wrap items-center gap-2">
                  {unequippedMonitorGear.map((ug) => (
                    <span
                      key={ug.gear.id}
                      className={`px-2 py-0.5 rounded-sm border ${
                        ug.isReady
                          ? 'bg-[#090F17] border-slate-700 text-slate-300'
                          : 'bg-amber-950/35 border-amber-500/40 text-amber-300'
                      }`}
                    >
                      {ug.gear.shortName} ·{' '}
                      {ug.isReady
                        ? `待命就绪 (冷却 ${ug.gear.cooldown}s)`
                        : `整备冷却 ${ug.remainingSec.toFixed(1)}s`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER: SQUAD LOADOUT CONFIRMATION & DEPLOY CTA */}
        <div className="px-5 py-3.5 bg-[#080D14] border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <img
                src={op.portrait}
                alt={op.name}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-sm object-cover border border-[#00E59B]/50"
              />
              <div>
                <div className="font-bold text-white leading-none">{op.name}</div>
                <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
                  {weapon.name} · {armor.name}
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono-tabular text-slate-300">
              {slotReadiness.map((sr) => {
                if (!sr.gear) return null;
                return (
                  <span
                    key={sr.slot}
                    className={`px-2 py-0.5 border rounded-sm ${
                      sr.isReady
                        ? 'bg-[#101826] border-slate-700 text-slate-200'
                        : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                    }`}
                  >
                    [{sr.slot}] {sr.gear.shortName}{' '}
                    {sr.isReady ? '· 就绪' : `· ${sr.remainingSec.toFixed(1)}s`}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 justify-end">
            <span
              className={`text-[11px] font-mono-tabular hidden sm:inline ${
                activeCooldownCount > 0 ? 'text-amber-300' : 'text-slate-400'
              }`}
            >
              {activeCooldownCount > 0
                ? `${activeCooldownCount} 件器材冷却中，提前进入将同步剩余整备时间`
                : '全套装备就绪，战区倒计时将在确认渗透后启动'}
            </span>
            <button
              type="button"
              onClick={triggerDeploy}
              className="px-6 py-2.5 bg-[#00E59B] hover:bg-[#1ef5ad] text-[#05100C] font-bold text-sm tracking-wide df-chamfer-sm transition-colors cursor-pointer shrink-0"
            >
              确认简报 · 开始渗透 [Enter]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
