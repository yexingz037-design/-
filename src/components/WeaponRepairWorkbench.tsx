import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Hammer, ShieldCheck, Wrench } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import {
  RARITY_CONFIG,
  WEAPON_REPAIR_PART_LIST,
  WEAPON_SKINS,
  WEAPONS,
  formatWeightKg,
  getWeaponJamRiskInfo,
} from '../data/gameData';
import { getRepairPartCounts, getWeaponDurability } from '../storage/profileStore';
import { PlayerProfile, WeaponId, WeaponSkinId } from '../types/game';
import { CharacterShowcase3D } from './CharacterShowcase3D';

interface WeaponRepairWorkbenchProps {
  profile: PlayerProfile;
  onRepairWithPart: (weaponId: WeaponId, partTemplateId: string) => void;
  onAutoRepairWeapon: (weaponId: WeaponId) => void;
  onGoToDeploy: () => void;
}

export function WeaponRepairWorkbench({
  profile,
  onRepairWithPart,
  onAutoRepairWeapon,
  onGoToDeploy,
}: WeaponRepairWorkbenchProps) {
  const [selectedWeaponId, setSelectedWeaponId] = useState<WeaponId>(profile.loadout.weaponId);
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);

  const unlockedList = useMemo(() => {
    const list = profile.unlockedWeapons
      .map((id) => WEAPONS[id])
      .filter((w): w is NonNullable<typeof w> => Boolean(w));
    return list.length > 0 ? list : [WEAPONS.m4a1];
  }, [profile.unlockedWeapons]);

  const activeWeapon = WEAPONS[selectedWeaponId] || WEAPONS[profile.loadout.weaponId] || WEAPONS.m4a1;
  const durability = getWeaponDurability(profile, activeWeapon.id);
  const risk = getWeaponJamRiskInfo(durability);

  const partCounts = useMemo(() => getRepairPartCounts(profile), [profile]);
  const totalPartsOwned = useMemo(
    () => Object.values(partCounts).reduce((acc, v) => acc + v, 0),
    [partCounts]
  );

  const hoveredPart = useMemo(
    () => WEAPON_REPAIR_PART_LIST.find((p) => p.templateId === hoveredPartId) || null,
    [hoveredPartId]
  );
  const previewDurability = hoveredPart
    ? Math.min(100, Number((durability + hoveredPart.restoreDurability).toFixed(1)))
    : durability;
  const previewRisk = getWeaponJamRiskInfo(previewDurability);

  const equippedSkinId: WeaponSkinId =
    profile.loadout.weaponSkins?.[activeWeapon.id] || 'factory_standard';
  const skinDef = WEAPON_SKINS.find((s) => s.id === equippedSkinId) || WEAPON_SKINS[0];

  const damagedWeaponsCount = useMemo(
    () => unlockedList.filter((w) => getWeaponDurability(profile, w.id) < 80).length,
    [unlockedList, profile]
  );

  const subsystems = useMemo(() => {
    const barrelScore = Math.min(100, Math.max(10, Math.round(durability * 1.03)));
    const firingPinScore = Math.min(100, Math.max(5, Math.round(durability * 0.96)));
    const feedRampScore = Math.min(100, Math.max(8, Math.round(durability * 0.99)));
    return [
      { label: '枪管膛线气密性', value: barrelScore },
      { label: '击针与复进系统', value: firingPinScore },
      { label: '供弹坡道洁净度', value: feedRampScore },
    ];
  }, [durability]);

  return (
    <div className="h-full overflow-hidden bg-[#090C11] grid grid-cols-1 lg:grid-cols-12">
      {/* Left Column: Unlocked Armory & Durability List */}
      <aside className="lg:col-span-3 border-r border-slate-800/90 bg-[#0D121B] flex flex-col overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#00E59B]" />
              <span>军械库耐久总览</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono-tabular mt-0.5">
              已解锁 {unlockedList.length} 把 ·{' '}
              <span className={damagedWeaponsCount > 0 ? 'text-amber-400' : 'text-[#00E59B]'}>
                {damagedWeaponsCount > 0 ? `${damagedWeaponsCount} 把存在卡壳隐患` : '全械工况良好'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {unlockedList.map((w) => {
            const wDur = getWeaponDurability(profile, w.id);
            const wRisk = getWeaponJamRiskInfo(wDur);
            const isSelected = activeWeapon.id === w.id;
            const isEquipped = profile.loadout.weaponId === w.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setSelectedWeaponId(w.id);
                }}
                className={`w-full p-3 rounded-sm border text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#152234] border-[#00E59B]'
                    : 'bg-[#090D15] border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">{w.name}</span>
                  <span className="font-mono-tabular text-xs font-bold shrink-0" style={{ color: wRisk.color }}>
                    {wDur.toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono-tabular mt-1">
                  <span>
                    {w.caliber}
                    {isEquipped ? ' · 当前主武器' : ''}
                  </span>
                  <span style={{ color: wRisk.color }}>{wRisk.shortStatus}</span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full transition-all duration-200"
                    style={{ width: `${wDur}%`, backgroundColor: wRisk.color }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Center Column: 3D Weapon Inspection & Mechanical Diagnostics */}
      <section className="lg:col-span-5 relative flex flex-col overflow-hidden bg-[#0A0E16]">
        <div className="px-5 py-4 border-b border-slate-800/90 bg-[#0D121B]/95 flex flex-wrap items-center justify-between gap-3 z-10">
          <div>
            <div className="text-[11px] font-mono-tabular text-slate-400">
              {activeWeapon.category} · {activeWeapon.caliber} · 涂装 {skinDef.name}
            </div>
            <h2 className="font-display text-xl font-extrabold text-white tracking-wide">
              {activeWeapon.name} · 维修与排障检测台
            </h2>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-mono-tabular">预计单发卡壳率</div>
            <div className="font-mono-tabular text-lg font-bold" style={{ color: previewRisk.color }}>
              {previewRisk.jamProbPerShotPct === 0 ? '0.0% (可靠)' : `${previewRisk.jamProbPerShotPct}%`}
            </div>
          </div>
        </div>

        {/* 3D Interactive Weapon Stage */}
        <div className="relative flex-1 min-h-[260px]">
          <CharacterShowcase3D
            operatorId={profile.loadout.operatorId}
            weaponId={activeWeapon.id}
            attachments={
              activeWeapon.id === profile.loadout.weaponId
                ? profile.loadout.attachments
                : { optic: null, barrel: null, muzzle: null, grip: null, stock: null, mag: null }
            }
            armorTier={profile.loadout.armorTier}
            mode="weapon_only"
            cameraPreset="weapon"
            weaponSkin={equippedSkinId}
          />

          {/* Top-Left Durability Overlay */}
          <div className="absolute top-3 left-3 bg-[#0B1018]/92 border border-slate-700/80 df-chamfer-sm px-3.5 py-2.5 w-72 pointer-events-none">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-semibold">整枪结构耐久度</span>
              <span className="font-mono-tabular font-bold" style={{ color: risk.color }}>
                {durability.toFixed(1)}%
                {hoveredPart && previewDurability > durability && (
                  <span className="text-[#00E59B] ml-1.5">→ {previewDurability.toFixed(1)}%</span>
                )}
              </span>
            </div>

            <div className="mt-2 h-2 w-full bg-slate-800 overflow-hidden relative">
              {hoveredPart && previewDurability > durability && (
                <div
                  className="absolute inset-y-0 left-0 bg-[#00E59B]/45 transition-all duration-150"
                  style={{ width: `${previewDurability}%` }}
                />
              )}
              <div
                className="relative h-full transition-all duration-200"
                style={{ width: `${durability}%`, backgroundColor: risk.color }}
              />
            </div>

            <div className="mt-1.5 flex items-center gap-1.5 text-[11px]" style={{ color: risk.color }}>
              {durability >= 80 ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{risk.label}</span>
            </div>
          </div>
        </div>

        {/* Bottom Subsystem Telemetry Strip */}
        <div className="border-t border-slate-800/90 bg-[#0D121B] p-4 space-y-3 z-10">
          <div className="grid grid-cols-3 gap-3">
            {subsystems.map((sub) => {
              const subColor =
                sub.value >= 80 ? '#00E59B' : sub.value >= 55 ? '#F59E0B' : '#FB7185';
              return (
                <div key={sub.label} className="p-2.5 bg-[#090C11] border border-slate-800">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 truncate">{sub.label}</span>
                    <span className="font-mono-tabular font-bold" style={{ color: subColor }}>
                      {sub.value}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 bg-slate-800 overflow-hidden">
                    <div
                      className="h-full transition-all duration-200"
                      style={{ width: `${sub.value}%`, backgroundColor: subColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400 bg-[#090C11] border border-slate-800 px-3 py-2">
            <span>
              说明：战局每次射击都会磨损枪械；耐久低于 <strong className="text-amber-300 font-mono-tabular">80%</strong> 后交火有概率触发供弹卡壳（需按 <strong className="text-white font-mono-tabular">[R]</strong> 紧急排障）。
            </span>
          </div>
        </div>
      </section>

      {/* Right Column: Looted Repair Parts Rack & Maintenance Actions */}
      <aside className="lg:col-span-4 border-l border-slate-800/90 bg-[#0D121B] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Hammer className="w-4 h-4 text-amber-400" />
              <span>战区搜刮维修零件库</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono-tabular mt-0.5">
              仓库可用零件总数：<strong className="text-amber-300">{totalPartsOwned} 件</strong>
            </div>
          </div>

          <button
            type="button"
            disabled={durability >= 100 || totalPartsOwned === 0}
            onClick={() => {
              soundEngine.playReload();
              onAutoRepairWeapon(activeWeapon.id);
            }}
            className="px-3.5 py-2 df-chamfer-sm bg-[#00E59B] hover:bg-[#34F5B5] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
          >
            智能一键满修
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {WEAPON_REPAIR_PART_LIST.map((part) => {
            const count = partCounts[part.templateId] || 0;
            const rarityCfg = RARITY_CONFIG[part.rarity];
            const canApply = count > 0 && durability < 100;
            return (
              <div
                key={part.templateId}
                onMouseEnter={() => setHoveredPartId(part.templateId)}
                onMouseLeave={() => setHoveredPartId((curr) => (curr === part.templateId ? null : curr))}
                className="p-3.5 bg-[#090C11] border border-slate-800 hover:border-slate-600 transition-colors space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-bold font-mono-tabular"
                        style={{ color: rarityCfg.color }}
                      >
                        [{rarityCfg.label}]
                      </span>
                      <span className="text-sm font-bold text-white truncate">{part.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      作用：{part.subsystemLabel} · 重量 {formatWeightKg(part.weight)} · 掉落：{part.dropHint}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono-tabular font-bold text-[#00E59B]">
                      +{part.restoreDurability}% 耐久
                    </div>
                    <div
                      className={`text-[11px] font-mono-tabular mt-0.5 ${
                        count > 0 ? 'text-amber-300' : 'text-slate-500'
                      }`}
                    >
                      库存 ×{count}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">{part.description}</p>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-[10px] font-mono-tabular text-slate-500">
                    {durability >= 100
                      ? '当前枪械已达 100% 满耐久'
                      : count > 0
                        ? `维修后预计：${Math.min(100, Number((durability + part.restoreDurability).toFixed(1)))}%`
                        : '需在战斗中搜刮该零件'}
                  </span>

                  <button
                    type="button"
                    disabled={!canApply}
                    onClick={() => {
                      soundEngine.playReload();
                      onRepairWithPart(activeWeapon.id, part.templateId);
                    }}
                    className="px-3 py-1.5 bg-[#162436] hover:bg-[#1E334D] border border-[#00E59B]/60 disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600 text-xs font-semibold text-white cursor-pointer transition-colors"
                  >
                    使用零件维修
                  </button>
                </div>
              </div>
            );
          })}

          {totalPartsOwned === 0 && (
            <div className="p-4 bg-[#101622] border border-amber-500/40 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>如何获取武器维修零件？</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                进入任意战区行动后，靠近地图上的<strong className="text-white">武器箱、战术补给箱或保险箱</strong>按 <strong className="text-[#00E59B] font-mono-tabular">[F]</strong> 搜刮即可获得各类枪械维护油组与核心机械零件，成功撤离或存入安全箱即可带回工作台！
              </p>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onGoToDeploy();
                }}
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors"
              >
                返回大厅前往战区搜刮零件 →
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
