import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Camera,
  ChevronDown,
  Crosshair,
  Hammer,
  Music,
  Package,
  RotateCcw,
  Settings,
  Shield,
  Shuffle,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { danceMusicEngine } from '../audio/danceMusicEngine';
import { soundEngine } from '../audio/soundEngine';
import {
  DANCE_CATALOG,
  DANCE_CATEGORY_LABELS,
  DANCE_MAP,
  DanceCategory,
  DanceId,
} from '../data/danceCatalog';
import {
  ARMOR_TIERS,
  BOSS_SAEED_PORTRAIT,
  MAPS,
  OPERATORS,
  RARITY_CONFIG,
  TACTICAL_GEAR,
  TACTICAL_GEAR_BY_SLOT,
  TACTICAL_MEDALS,
  WEAPON_REPAIR_PARTS,
  WEAPON_SKINS,
  WEAPONS,
  computeWeaponStats,
  formatCreditsDisplay,
  formatWeightKg,
  getItemWeight,
  getWeaponJamRiskInfo,
} from '../data/gameData';
import {
  applyOperatorRecommendedGear,
  applySkinToAllWeapons,
  autoRepairWeaponWithParts,
  claimAllCompletedMissions,
  claimMissionReward,
  equipOrBuyAttachment,
  equipOrBuyTacticalGear,
  equipOrBuyWeaponSkin,
  getDeploymentCost,
  getMissionProgressSummary,
  getWeaponDurability,
  repairWeaponWithPart,
  resetWeaponAttachments,
  selectMap,
  selectOperator,
  selectOrBuyWeapon,
  sellAllStashItems,
  sellStashItem,
  updateTacticalSupplies,
  upgradeContainer,
} from '../storage/profileStore';
import { loadControlSettings, saveControlSettings } from '../storage/settingsStore';
import {
  AttachmentSlot,
  MapId,
  OperatorId,
  PlayerProfile,
  TacticalControlSettings,
  TacticalGearId,
  TacticalSlotKey,
  WeaponId,
  WeaponSkinId,
} from '../types/game';
import { CharacterShowcase3D, ShowcaseCameraPreset } from './CharacterShowcase3D';
import { Gunsmith } from './Gunsmith';
import { MissionsPanel } from './MissionsPanel';
import { TacticalSettingsModal } from './TacticalSettingsModal';
import { WeaponRepairWorkbench } from './WeaponRepairWorkbench';

type HubTab = 'operators' | 'gunsmith' | 'repair' | 'stash' | 'missions';

interface HideoutHubProps {
  profile: PlayerProfile;
  onUpdateProfile: (next: PlayerProfile) => void;
  onDeploy: () => void;
  onResetProfile: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export function HideoutHub({
  profile,
  onUpdateProfile,
  onDeploy,
  onResetProfile,
  muted,
  onToggleMute,
}: HideoutHubProps) {
  const [activeTab, setActiveTab] = useState<HubTab>('operators');
  const [cameraPreset, setCameraPreset] = useState<ShowcaseCameraPreset>('fullbody');
  const [activeGearSlot, setActiveGearSlot] = useState<TacticalSlotKey | null>('Q');
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [controlSettings, setControlSettings] = useState<TacticalControlSettings>(() => loadControlSettings());

  const handleUpdateSettings = (next: TacticalControlSettings) => {
    setControlSettings(saveControlSettings(next));
  };

  // Operator Lobby 20-Dance Emote & Synced Music State
  const [activeDanceId, setActiveDanceId] = useState<DanceId | null>(null);
  const [danceTriggerKey, setDanceTriggerKey] = useState(0);
  const [danceRemainingSec, setDanceRemainingSec] = useState(0);
  const [danceDrawerOpen, setDanceDrawerOpen] = useState(false);
  const [danceCategory, setDanceCategory] = useState<'all' | DanceCategory>('all');
  const danceStartPerfRef = useRef<number>(0);

  const activeDanceDef = activeDanceId ? DANCE_MAP[activeDanceId] : null;
  const filteredDances = useMemo(
    () =>
      danceCategory === 'all'
        ? DANCE_CATALOG
        : DANCE_CATALOG.filter((d) => d.category === danceCategory),
    [danceCategory]
  );

  const stopDance = useCallback(() => {
    danceMusicEngine.stop();
    setActiveDanceId(null);
    setDanceRemainingSec(0);
  }, []);

  const startDance = useCallback(
    (danceId: DanceId) => {
      const def = DANCE_MAP[danceId];
      if (!def) return;
      soundEngine.unlock();
      danceMusicEngine.setMuted(muted);
      danceMusicEngine.start(danceId);
      danceStartPerfRef.current = performance.now();
      setActiveDanceId(danceId);
      setDanceRemainingSec(def.durationSec);
      setDanceTriggerKey((k) => k + 1);
      setCameraPreset((prev) => (prev === 'weapon' || prev === 'upper' ? 'fullbody' : prev));
    },
    [muted]
  );

  const triggerRandomDance = useCallback(() => {
    const pool = DANCE_CATALOG.filter((d) => d.id !== activeDanceId);
    const pick = pool[Math.floor(Math.random() * pool.length)] || DANCE_CATALOG[0];
    startDance(pick.id);
  }, [activeDanceId, startDance]);

  useEffect(() => {
    danceMusicEngine.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    if (activeTab !== 'operators') {
      stopDance();
      setDanceDrawerOpen(false);
    }
  }, [activeTab, stopDance]);

  useEffect(() => {
    return () => {
      danceMusicEngine.stop();
    };
  }, []);

  useEffect(() => {
    if (!activeDanceId) return;
    const def = DANCE_MAP[activeDanceId];
    if (!def) return;
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - danceStartPerfRef.current) / 1000;
      const rem = Math.max(0, def.durationSec - elapsed);
      setDanceRemainingSec(rem);
      if (rem <= 0.02) {
        stopDance();
      }
    }, 80);
    return () => clearInterval(timer);
  }, [activeDanceId, danceTriggerKey, stopDance]);

  const selectedOp = OPERATORS[profile.loadout.operatorId];
  const selectedWeapon = WEAPONS[profile.loadout.weaponId] || WEAPONS.m4a1;
  const equippedSkinId: WeaponSkinId =
    profile.loadout.weaponSkins?.[selectedWeapon.id] || 'factory_standard';
  const equippedSkinDef = WEAPON_SKINS.find((s) => s.id === equippedSkinId) || WEAPON_SKINS[0];
  const selectedMap = MAPS[profile.loadout.mapId || 'zero_dam'] || MAPS.zero_dam;
  const computedStats = useMemo(
    () => computeWeaponStats(profile.loadout.weaponId, profile.loadout.attachments),
    [profile.loadout.weaponId, profile.loadout.attachments]
  );

  const deployCost = useMemo(() => getDeploymentCost(profile), [profile]);
  const stashValue = useMemo(() => profile.stash.reduce((acc, i) => acc + i.value, 0), [profile.stash]);
  const missionSummary = useMemo(() => getMissionProgressSummary(profile), [profile]);
  const featuredMission = useMemo(
    () =>
      missionSummary.items.find((i) => i.claimable) ||
      missionSummary.items.find((i) => !i.completed) ||
      missionSummary.items[0],
    [missionSummary.items]
  );
  const extractRate =
    profile.stats.raidsPlayed > 0
      ? Math.round((profile.stats.raidsExtracted / profile.stats.raidsPlayed) * 100)
      : 0;

  const equippedSlotCount = useMemo(
    () => Object.values(profile.loadout.attachments).filter(Boolean).length,
    [profile.loadout.attachments]
  );
  const equippedWeaponDurability = getWeaponDurability(profile, selectedWeapon.id);
  const equippedWeaponRisk = getWeaponJamRiskInfo(equippedWeaponDurability);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((curr) => (curr === msg ? null : curr)), 2800);
  };

  const handleSelectOperator = (id: OperatorId) => {
    soundEngine.playUiClick();
    onUpdateProfile(selectOperator(profile, id));
  };

  const handleEquipOrBuyGear = (slot: TacticalSlotKey, gearId: TacticalGearId) => {
    soundEngine.playUiClick();
    const res = equipOrBuyTacticalGear(profile, slot, gearId);
    if (res.error) showNotice(res.error);
    else onUpdateProfile(res.profile);
  };

  const handleApplyRecommendedGear = () => {
    soundEngine.playUiClick();
    const res = applyOperatorRecommendedGear(profile, selectedOp.id);
    if (res.error) showNotice(res.error);
    else {
      onUpdateProfile(res.profile);
      showNotice(`已装配「${selectedOp.name.split(' · ')[0]}」推荐非致命战术装备`);
    }
  };

  const handleWeaponClick = (id: WeaponId) => {
    soundEngine.playUiClick();
    const res = selectOrBuyWeapon(profile, id);
    if (res.error) showNotice(res.error);
    else onUpdateProfile(res.profile);
  };

  const handleAttachmentClick = (slot: AttachmentSlot, attId: string | null) => {
    soundEngine.playUiClick();
    const res = equipOrBuyAttachment(profile, slot, attId);
    if (res.error) showNotice(res.error);
    else onUpdateProfile(res.profile);
  };

  const handleResetAttachments = () => {
    onUpdateProfile(resetWeaponAttachments(profile));
  };

  const handleEquipOrBuySkin = (skinId: WeaponSkinId) => {
    soundEngine.playUiClick();
    const res = equipOrBuyWeaponSkin(profile, profile.loadout.weaponId, skinId);
    if (res.error) showNotice(res.error);
    else onUpdateProfile(res.profile);
  };

  const handleApplySkinToAll = (skinId: WeaponSkinId) => {
    soundEngine.playUiClick();
    const updated = applySkinToAllWeapons(profile, skinId);
    onUpdateProfile(updated);
    const skinName = WEAPON_SKINS.find((s) => s.id === skinId)?.name || '涂装';
    showNotice(`已将「${skinName}」同步装配至全库 20 把枪械`);
  };

  const handleClaimMission = (missionId: string) => {
    const res = claimMissionReward(profile, missionId);
    if (res.error) {
      soundEngine.playUiClick();
      showNotice(res.error);
      return;
    }
    soundEngine.playLootReveal('legendary');
    onUpdateProfile(res.profile);
    if (res.mission) {
      const medal = TACTICAL_MEDALS[res.mission.rewardMedalId];
      showNotice(
        `任务完成奖励已领取：获得「${medal.name}」×${res.mission.rewardMedalCount} 及 +${res.mission.rewardCredits.toLocaleString()} 哈夫币`
      );
    }
  };

  const handleClaimAllMissions = () => {
    const res = claimAllCompletedMissions(profile);
    if (res.claimedCount === 0) return;
    soundEngine.playLootReveal('legendary');
    onUpdateProfile(res.profile);
    showNotice(
      `已一键领取 ${res.claimedCount} 项任务奖励：共获得 ${res.medalsAwarded} 枚战术勋章及 +${res.creditsAwarded.toLocaleString()} 哈夫币`
    );
  };

  const handleFocusMissionMap = (mapId?: MapId) => {
    soundEngine.playUiClick();
    if (mapId) {
      onUpdateProfile(selectMap(profile, mapId));
    }
    setActiveTab('operators');
  };

  const handleRepairWeaponWithPart = (weaponId: WeaponId, partTemplateId: string) => {
    const res = repairWeaponWithPart(profile, weaponId, partTemplateId);
    if (res.error) {
      showNotice(res.error);
      return;
    }
    onUpdateProfile(res.profile);
    const wName = WEAPONS[weaponId]?.name || '枪械';
    const pName = WEAPON_REPAIR_PARTS[partTemplateId]?.name || '维修零件';
    showNotice(
      `已消耗「${pName}」维修 ${wName}：耐久恢复 +${res.restoredAmount}%（当前 ${res.newDurability}%）`
    );
  };

  const handleAutoRepairWeapon = (weaponId: WeaponId) => {
    const res = autoRepairWeaponWithParts(profile, weaponId);
    if (res.error) {
      showNotice(res.error);
      return;
    }
    onUpdateProfile(res.profile);
    const wName = WEAPONS[weaponId]?.name || '枪械';
    showNotice(
      `已消耗 ${res.partsUsed} 件零件完成 ${wName} 整备维护：耐久 +${res.restoredAmount}%（当前 ${res.newDurability}%）`
    );
  };

  const handleDeployClick = () => {
    soundEngine.playUiClick();
    if (profile.credits < deployCost) {
      showNotice(`哈夫币不足以支付本次战备补给（需 ${deployCost.toLocaleString()}），可前往仓库出售战利品`);
      return;
    }
    stopDance();
    onDeploy();
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#090C11] text-slate-100 overflow-hidden">
      {/* Delta Force Top 3-Zone Navigation Bar */}
      <header className="h-16 px-6 border-b border-slate-800/90 bg-[#0D121B] flex items-center justify-between gap-8 shrink-0 z-20">
        {/* Zone 1: Brand Title */}
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <polygon points="12,2 22,20 2,20" stroke="#00E59B" strokeWidth="2.2" fill="rgba(0,229,155,0.14)" />
            <line x1="12" y1="8" x2="12" y2="17" stroke="#F8FAFC" strokeWidth="1.8" />
          </svg>
          <span className="font-display text-xl font-bold tracking-wider text-white">
            八宝粥行动 · 烽火地带
          </span>
        </div>

        {/* Zone 2: Clean Single-Line Navigation Tabs */}
        <nav className="flex items-center gap-2">
          <button
            onClick={() => {
              soundEngine.playUiClick();
              setActiveTab('operators');
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'operators'
                ? 'border-[#00E59B] text-white bg-[#131B28]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4 text-[#00E59B]" />
            <span>特战干员大厅</span>
          </button>
          <button
            onClick={() => {
              soundEngine.playUiClick();
              setActiveTab('gunsmith');
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'gunsmith'
                ? 'border-[#00E59B] text-white bg-[#131B28]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            <span>3D 改枪台</span>
          </button>
          <button
            onClick={() => {
              soundEngine.playUiClick();
              setActiveTab('repair');
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'repair'
                ? 'border-[#00E59B] text-white bg-[#131B28]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hammer
              className={`w-4 h-4 ${
                equippedWeaponDurability < 80 ? 'text-rose-400' : 'text-[#00E59B]'
              }`}
            />
            <span>
              武器修复
              {equippedWeaponDurability < 80 ? ` · ${Math.round(equippedWeaponDurability)}%` : ''}
            </span>
          </button>
          <button
            onClick={() => {
              soundEngine.playUiClick();
              setActiveTab('stash');
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'stash'
                ? 'border-[#00E59B] text-white bg-[#131B28]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-4 h-4 text-sky-400" />
            <span>特勤处仓库</span>
          </button>
          <button
            onClick={() => {
              soundEngine.playUiClick();
              setActiveTab('missions');
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'missions'
                ? 'border-[#00E59B] text-white bg-[#131B28]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>
              行动任务
              {missionSummary.claimableCount > 0 ? ` · ${missionSummary.claimableCount}待领` : ''}
            </span>
          </button>
        </nav>

        {/* Zone 3: Assets (10000亿 哈夫币 & 战术勋章) & Primary Launch Action */}
        <div className="flex items-center gap-4 shrink-0">
          <div
            className="hidden md:flex items-center gap-3 text-xs text-slate-400 font-mono-tabular whitespace-nowrap"
            title={`精确资产：${profile.credits.toLocaleString()} 哈夫币`}
          >
            <span>
              勋章 <strong className="text-amber-300">{missionSummary.totalMedals}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              撤离率 <strong className="text-slate-200">{extractRate}%</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              哈夫币{' '}
              <strong className="text-amber-400 text-sm">
                {formatCreditsDisplay(profile.credits)}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playUiClick();
              setShowSettings(true);
            }}
            aria-label="战术操控与视角设置"
            className="flex items-center gap-1.5 px-3 py-2 rounded border border-slate-800 bg-[#121925] text-slate-200 hover:border-[#00E59B]/70 hover:text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-[#00E59B]" />
            <span>设置</span>
          </button>

          <button
            onClick={() => {
              soundEngine.unlock();
              onToggleMute();
            }}
            aria-label={muted ? '取消静音' : '静音'}
            className="p-2 rounded border border-slate-800 bg-[#121925] text-slate-300 hover:border-slate-600 hover:text-white transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-[#00E59B]" />}
          </button>

          <button
            onClick={handleDeployClick}
            className="df-chamfer-sm px-5 py-2 bg-[#00E59B] hover:bg-[#34F5B5] text-slate-950 font-bold text-sm tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            开始行动
          </button>
        </div>
      </header>

      {notice && (
        <div className="bg-amber-950/90 border-b border-amber-500/50 px-6 py-2 text-xs text-amber-200 text-center font-medium shrink-0 z-20">
          {notice}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {/* TAB 1: 1:1 DELTA FORCE FULL-BODY 3D OPERATOR LOBBY */}
        {activeTab === 'operators' && (
          <div className="relative w-full h-full">
            {/* Full-Bleed 3D Full-Body Character Stage */}
            <div className="absolute inset-0">
              <CharacterShowcase3D
                operatorId={profile.loadout.operatorId}
                weaponId={profile.loadout.weaponId}
                attachments={profile.loadout.attachments}
                armorTier={profile.loadout.armorTier}
                mode="operator"
                cameraPreset={cameraPreset}
                weaponSkin={equippedSkinId}
                activeDanceId={activeDanceId}
                danceTriggerKey={danceTriggerKey}
              />
            </div>

            {/* Top-Center Operator Nameplate */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center">
              <div className="text-[11px] font-mono-tabular tracking-[0.2em] text-[#00E59B]">
                {selectedOp.division}
              </div>
              <div className="font-display text-3xl font-extrabold text-white tracking-wide">
                {selectedOp.name}
              </div>
              <div className="text-xs text-slate-400 font-mono-tabular mt-0.5">
                {selectedOp.role} · 生命 {selectedOp.maxHp} · 机动 {selectedOp.baseSpeed}
              </div>
            </div>

            {/* Left Flank: Delta Force 4-Operator Roster & Skill Kit */}
            <div className="absolute top-4 left-4 bottom-4 w-84 pointer-events-none flex flex-col gap-3 z-10">
              <div className="bg-[#0E141F]/92 border border-slate-700/80 df-chamfer p-3.5 pointer-events-auto flex flex-col gap-3 max-h-full overflow-y-auto">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200 tracking-wide">G.T.I. 特战干员编制</span>
                  <span className="font-mono-tabular text-[#00E59B]">{Object.keys(OPERATORS).length} 名干员就绪</span>
                </div>

                {/* 4 Operator Selection Portraits */}
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(OPERATORS).map((op) => {
                    const isSelected = profile.loadout.operatorId === op.id;
                    return (
                      <button
                        key={op.id}
                        onClick={() => handleSelectOperator(op.id)}
                        className={`p-2 rounded border text-left transition-colors flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[#162436] border-[#00E59B] text-white'
                            : 'bg-[#0A0E16] border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <img
                          src={op.portrait}
                          alt={op.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-sm object-cover border border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{op.name.split(' · ')[0]}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {op.division.split(' · ')[0]}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Operator Passive + Customizable Non-Lethal Tactical Gear Slots (Q / E / X) */}
                <div className="pt-2.5 border-t border-slate-800 space-y-2.5">
                  <div className="p-2.5 rounded-sm bg-[#090D15] border border-slate-800">
                    <div className="text-[11px] font-bold text-amber-400">
                      干员专精 · {selectedOp.passiveTitle}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                      {selectedOp.passiveDesc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-slate-200">非致命战术装备槽位</span>
                    <button
                      onClick={handleApplyRecommendedGear}
                      className="text-[11px] text-[#00E59B] hover:underline cursor-pointer"
                    >
                      装配干员推荐配装
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {(
                      [
                        { key: 'Q', label: '观测与标定' },
                        { key: 'E', label: '烟幕与遮蔽' },
                        { key: 'X', label: '干扰与非致命压制' },
                      ] as Array<{ key: TacticalSlotKey; label: string }>
                    ).map((slotMeta) => {
                      const equippedId = profile.loadout.tacticalGear?.[slotMeta.key];
                      const gear = TACTICAL_GEAR[equippedId];
                      const isExpanded = activeGearSlot === slotMeta.key;
                      return (
                        <div key={slotMeta.key} className="space-y-1.5">
                          <button
                            onClick={() => {
                              soundEngine.playUiClick();
                              setActiveGearSlot(isExpanded ? null : slotMeta.key);
                            }}
                            className={`w-full p-2.5 rounded-sm border text-left transition-colors cursor-pointer ${
                              isExpanded
                                ? 'bg-[#162436] border-[#00E59B] text-white'
                                : 'bg-[#090D15] border-slate-800 text-slate-200 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="truncate">
                                [{slotMeta.key}] {gear?.name || '未装备'}
                              </span>
                              <span className="font-mono-tabular text-[11px] text-[#00E59B] shrink-0 ml-2">
                                {isExpanded ? '收起 ▲' : '更换 ▼'}
                              </span>
                            </div>
                            {gear && (
                              <div className="text-[10px] text-slate-400 font-mono-tabular mt-1 flex items-center gap-1.5">
                                <span>{slotMeta.label}</span>
                                <span aria-hidden="true">·</span>
                                <span>{gear.maxCharges !== null ? `${gear.maxCharges} 发` : `可复用 ${gear.cooldown}s`}</span>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-400">补给 {gear.deployCost.toLocaleString()}</span>
                              </div>
                            )}
                          </button>

                          {isExpanded && (
                            <div className="pl-2 space-y-1">
                              {TACTICAL_GEAR_BY_SLOT[slotMeta.key].map((opt) => {
                                const isEquipped = equippedId === opt.id;
                                const isOwned =
                                  opt.price === 0 || (profile.unlockedGear || []).includes(opt.id);
                                return (
                                  <button
                                    key={opt.id}
                                    onClick={() => handleEquipOrBuyGear(slotMeta.key, opt.id)}
                                    className={`w-full p-2 rounded-sm border text-left transition-colors cursor-pointer ${
                                      isEquipped
                                        ? 'bg-[#112430] border-[#00E59B]/80 text-white'
                                        : 'bg-[#080B12] border-slate-800/90 text-slate-300 hover:border-slate-600'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[11px] font-bold">
                                      <span className="truncate">{opt.name}</span>
                                      <span
                                        className={`font-mono-tabular shrink-0 ml-2 ${
                                          isEquipped
                                            ? 'text-[#00E59B]'
                                            : isOwned
                                              ? 'text-slate-400'
                                              : 'text-amber-400'
                                        }`}
                                      >
                                        {isEquipped ? '已装配' : isOwned ? '已解锁' : `${opt.price.toLocaleString()} 解锁`}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                                      {opt.description}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom-Center 3D Stage Controls + 20-Dance Tactical Emote Dock */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center gap-2 max-w-[calc(100vw-44rem)] min-w-[360px]">
              {/* Expandable 20-Dance Selector Drawer */}
              {danceDrawerOpen && (
                <div className="w-[620px] max-w-[calc(100vw-44rem)] bg-[#0C121E]/95 border border-slate-700/85 df-chamfer p-3 shadow-2xl space-y-2.5">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="w-4 h-4 text-[#00E59B] shrink-0" />
                      <span className="text-xs font-bold text-white whitespace-nowrap">
                        干员炫酷舞蹈库
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono-tabular truncate">
                        20套独立舞步 · 专属电音乐曲 · 5-15秒特效舞台
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={triggerRandomDance}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-[#132234] hover:bg-[#1B314A] border border-sky-500/50 text-sky-200 cursor-pointer whitespace-nowrap"
                      >
                        <Shuffle className="w-3 h-3" />
                        <span>随机一首</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDanceDrawerOpen(false)}
                        aria-label="收起舞蹈面板"
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-300 hover:text-white bg-[#090D15] border border-slate-700 cursor-pointer whitespace-nowrap"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>收起</span>
                      </button>
                    </div>
                  </div>

                  {/* Category Filters */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    {(['all', 'street', 'cyber', 'tactical', 'party'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setDanceCategory(cat);
                        }}
                        className={`px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          danceCategory === cat
                            ? 'bg-[#00E59B] text-slate-950 font-bold'
                            : 'bg-[#090D15] text-slate-300 hover:text-white border border-slate-800'
                        }`}
                      >
                        {DANCE_CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>

                  {/* 20-Dance Compact Scrollable Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {filteredDances.map((d) => {
                      const isPlaying = activeDanceId === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => startDance(d.id)}
                          title={`${d.name} · ${d.musicStyle} (${d.bpm} BPM) · ${d.description}`}
                          className={`group relative p-2 text-left border transition-colors cursor-pointer overflow-hidden ${
                            isPlaying
                              ? 'bg-[#132234] text-white'
                              : 'bg-[#090D15] border-slate-800/90 text-slate-200 hover:border-slate-500 hover:bg-[#101826]'
                          }`}
                          style={isPlaying ? { borderColor: d.accentHex } : undefined}
                        >
                          <div
                            className="absolute left-0 top-0 bottom-0 w-[3px]"
                            style={{ backgroundColor: d.accentHex }}
                          />
                          <div className="pl-1.5">
                            <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                              <span className="truncate">{d.name}</span>
                              <span
                                className="font-mono-tabular text-[10px] shrink-0"
                                style={{ color: d.accentHex }}
                              >
                                {d.durationSec}s
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-1 text-[10px] font-mono-tabular text-slate-400 mt-0.5">
                              <span className="truncate">{d.musicStyle}</span>
                              <span className="shrink-0 text-slate-500">
                                #{String(d.index).padStart(2, '0')}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active Dance Now-Playing Progress Strip */}
              {activeDanceDef && (
                <div
                  className="w-full max-w-[560px] bg-[#0B111C]/94 border df-chamfer-sm px-3.5 py-2 space-y-1.5"
                  style={{ borderColor: `${activeDanceDef.accentHex}99` }}
                >
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Music
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: activeDanceDef.accentHex }}
                      />
                      <span className="font-bold text-white truncate">{activeDanceDef.name}</span>
                      <span className="text-[11px] font-mono-tabular text-slate-400 truncate">
                        {activeDanceDef.musicStyle} · {activeDanceDef.bpm} BPM
                        {muted ? ' · 已静音' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-[11px] font-mono-tabular font-bold"
                        style={{ color: activeDanceDef.accentHex }}
                      >
                        {danceRemainingSec.toFixed(1)}s / {activeDanceDef.durationSec}s
                      </span>
                      <button
                        type="button"
                        onClick={triggerRandomDance}
                        title="切换下一首随机舞蹈"
                        className="px-1.5 py-0.5 text-[11px] bg-[#131C2B] hover:bg-[#1D2B42] text-slate-200 border border-slate-700 cursor-pointer whitespace-nowrap"
                      >
                        换舞
                      </button>
                      <button
                        type="button"
                        onClick={stopDance}
                        className="flex items-center gap-1 px-2 py-0.5 text-[11px] bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 cursor-pointer whitespace-nowrap"
                      >
                        <Square className="w-2.5 h-2.5 fill-current" />
                        <span>停止</span>
                      </button>
                    </div>
                  </div>
                  <div className="h-1 w-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full transition-all duration-75"
                      style={{
                        width: `${Math.min(100, Math.max(0, ((activeDanceDef.durationSec - danceRemainingSec) / activeDanceDef.durationSec) * 100))}%`,
                        backgroundColor: activeDanceDef.accentHex,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Primary Bottom Bar: Camera Presets + Dance Emote Triggers */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0E141F]/92 border border-slate-700/80 df-chamfer-sm flex-wrap justify-center">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.unlock();
                    soundEngine.playUiClick();
                    setDanceDrawerOpen((prev) => !prev);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    danceDrawerOpen || activeDanceId
                      ? 'bg-[#00E59B] text-slate-950'
                      : 'bg-[#142336] text-[#00E59B] border border-[#00E59B]/50 hover:bg-[#1B3049]'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>炫酷舞蹈 (20)</span>
                </button>
                <button
                  type="button"
                  onClick={triggerRandomDance}
                  title="随机播放20款炫酷舞蹈与专属配乐"
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#131C2B] hover:bg-[#1D2B42] text-amber-300 border border-amber-500/40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Shuffle className="w-3 h-3" />
                  <span>随机热舞</span>
                </button>

                <span className="h-4 w-px bg-slate-700/80 mx-1" aria-hidden="true" />

                <Camera className="w-3.5 h-3.5 text-slate-400 mr-0.5 shrink-0" />
                {(
                  [
                    { id: 'fullbody', label: '全身检视' },
                    { id: 'upper', label: '面部与装备' },
                    { id: 'weapon', label: '枪械细节' },
                    { id: 'cinematic', label: '过场电影镜头' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      soundEngine.playUiClick();
                      setCameraPreset(p.id);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      cameraPreset === p.id
                        ? 'bg-[#00E59B] text-slate-950 font-bold'
                        : 'bg-[#090D15] text-slate-300 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Flank: Delta Force Mission & Gear Readiness Panel */}
            <div className="absolute top-4 right-4 bottom-4 w-84 pointer-events-none flex flex-col justify-between gap-3 z-10">
              <div className="bg-[#0E141F]/92 border border-slate-700/80 df-chamfer p-4 pointer-events-auto space-y-3.5 overflow-y-auto">
                {/* 4-Map 3D Battlefield Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">战区行动地图选择</span>
                    <span className="font-mono-tabular text-[11px] text-[#00E59B]">
                      {selectedMap.dangerLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.values(MAPS)).map((m) => {
                      const active = selectedMap.id === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            soundEngine.playUiClick();
                            onUpdateProfile(selectMap(profile, m.id as MapId));
                          }}
                          className={`p-2 rounded-sm border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#162436] border-[#00E59B] text-white'
                              : 'bg-[#090D15] border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span>{m.name}</span>
                            <span
                              className="text-[10px] font-mono-tabular"
                              style={{ color: m.theme.accentHex }}
                            >
                              ×{m.lootMultiplier.toFixed(2).replace(/\.00$/, '')}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">{m.bossZone}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-2.5 rounded-sm bg-[#090D15] border border-slate-800 flex items-center gap-2.5">
                    <img
                      src={BOSS_SAEED_PORTRAIT}
                      alt={selectedMap.bossName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-sm object-cover border border-rose-500/60 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-rose-300 truncate">
                        首领：{selectedMap.bossName}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-snug line-clamp-2 mt-0.5">
                        {selectedMap.description}
                      </div>
                      <div className="text-[10px] font-mono-tabular text-amber-400 mt-0.5">
                        安全箱 {profile.loadout.safeBoxCapacity} 格 · 背包 {profile.loadout.backpackCapacity} 格
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Weapon Readiness Slot (opens 3D Gunsmith) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-200">主武器战备</span>
                    <button
                      onClick={() => {
                        soundEngine.playUiClick();
                        setActiveTab('gunsmith');
                      }}
                      className="text-[11px] text-[#00E59B] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>进入3D改枪台 →</span>
                    </button>
                  </div>
                  <div className="p-2.5 rounded-sm bg-[#090D15] border border-slate-800 space-y-2">
                    <button
                      onClick={() => {
                        soundEngine.playUiClick();
                        setActiveTab('gunsmith');
                      }}
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white truncate">{selectedWeapon.name}</span>
                        <span className="font-mono-tabular text-amber-400 shrink-0">{equippedSlotCount}/6 配件</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-tabular mt-1 flex items-center justify-between gap-2">
                        <span>
                          伤害 {computedStats.damage}
                          {computedStats.pellets > 1 ? `×${computedStats.pellets}` : ''} · 人机 {computedStats.ergonomics}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-slate-300 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-xs border border-white/25 shrink-0"
                            style={{ backgroundColor: equippedSkinDef.accentHex }}
                          />
                          <span className="truncate">{equippedSkinDef.name}</span>
                        </span>
                      </div>
                    </button>

                    <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                        <span className="text-slate-400">
                          耐久 <strong style={{ color: equippedWeaponRisk.color }}>{equippedWeaponDurability.toFixed(0)}%</strong> · {equippedWeaponRisk.shortStatus}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setActiveTab('repair');
                          }}
                          className={`hover:underline cursor-pointer ${
                            equippedWeaponDurability < 80 ? 'text-rose-400 font-bold' : 'text-[#00E59B]'
                          }`}
                        >
                          {equippedWeaponDurability < 80 ? '有卡壳风险 · 前往维修 →' : '维修工作台 →'}
                        </button>
                      </div>
                      <div className="h-1 w-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full transition-all duration-150"
                          style={{
                            width: `${equippedWeaponDurability}%`,
                            backgroundColor: equippedWeaponRisk.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Armor Tiers (Live updates 3D Plate Carrier) */}
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-1.5">防弹插板护甲（3D实时穿戴）</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ARMOR_TIERS.map((a) => {
                      const active = profile.loadout.armorTier === a.tier;
                      return (
                        <button
                          key={a.tier}
                          onClick={() => {
                            soundEngine.playUiClick();
                            onUpdateProfile(updateTacticalSupplies(profile, { armorTier: a.tier }));
                          }}
                          className={`p-2 rounded-sm border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#162436] border-[#00E59B] text-white'
                              : 'bg-[#090D15] border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="text-[11px] font-semibold truncate">{a.name}</div>
                          <div className="text-[10px] font-mono-tabular text-amber-400 mt-0.5">
                            {a.maxArmor}耐久 · {a.price.toLocaleString()}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ammo & Tactical Meds */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => onUpdateProfile(updateTacticalSupplies(profile, { ammoTier: 'standard' }))}
                      className={`p-2 rounded-sm border text-left text-[11px] cursor-pointer ${
                        profile.loadout.ammoTier === 'standard'
                          ? 'bg-[#162436] border-[#00E59B] text-white'
                          : 'bg-[#090D15] border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-semibold">制式标准弹</div>
                      <div className="font-mono-tabular">1,200</div>
                    </button>
                    <button
                      onClick={() => onUpdateProfile(updateTacticalSupplies(profile, { ammoTier: 'ap' }))}
                      className={`p-2 rounded-sm border text-left text-[11px] cursor-pointer ${
                        profile.loadout.ammoTier === 'ap'
                          ? 'bg-[#162436] border-amber-500 text-amber-200'
                          : 'bg-[#090D15] border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-semibold">钨芯穿甲弹 AP</div>
                      <div className="font-mono-tabular">+22%穿透 · 6,500</div>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div className="p-2 rounded-sm bg-[#090D15] border border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-300">[1] 医疗 ×{profile.loadout.medkits}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            onUpdateProfile(
                              updateTacticalSupplies(profile, { medkits: Math.max(0, profile.loadout.medkits - 1) })
                            )
                          }
                          className="w-5 h-5 rounded-sm bg-slate-800 text-white cursor-pointer"
                        >
                          -
                        </button>
                        <button
                          onClick={() =>
                            onUpdateProfile(
                              updateTacticalSupplies(profile, { medkits: Math.min(4, profile.loadout.medkits + 1) })
                            )
                          }
                          className="w-5 h-5 rounded-sm bg-slate-800 text-white cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="p-2 rounded-sm bg-[#090D15] border border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-300">[2] 护甲 ×{profile.loadout.armorPlates}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            onUpdateProfile(
                              updateTacticalSupplies(profile, {
                                armorPlates: Math.max(0, profile.loadout.armorPlates - 1),
                              })
                            )
                          }
                          className="w-5 h-5 rounded-sm bg-slate-800 text-white cursor-pointer"
                        >
                          -
                        </button>
                        <button
                          onClick={() =>
                            onUpdateProfile(
                              updateTacticalSupplies(profile, {
                                armorPlates: Math.min(4, profile.loadout.armorPlates + 1),
                              })
                            )
                          }
                          className="w-5 h-5 rounded-sm bg-slate-800 text-white cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Equipped Non-Lethal Tactical Gear Readiness Strip */}
                  <div className="p-2 rounded-sm bg-[#090D15] border border-slate-800">
                    <div className="text-[10px] text-slate-400 mb-1">已配置非致命战术器材（左侧栏可更换）</div>
                    <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono-tabular">
                      {(['Q', 'E', 'X'] as TacticalSlotKey[]).map((slot) => {
                        const g = TACTICAL_GEAR[profile.loadout.tacticalGear?.[slot]];
                        return (
                          <button
                            key={slot}
                            onClick={() => {
                              soundEngine.playUiClick();
                              setActiveGearSlot(slot);
                            }}
                            className="px-1.5 py-1 rounded-xs bg-[#0E1522] border border-slate-800 hover:border-slate-600 text-left cursor-pointer"
                          >
                            <div className="text-[#00E59B] font-bold">[{slot}]</div>
                            <div className="text-slate-200 truncate">{g?.shortName || '未配'}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Live Extraction Mission & Medal Progress Widget */}
                  <div className="p-2.5 rounded-sm bg-[#090D15] border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        <span>撤离任务进度</span>
                      </span>
                      <span className="font-mono-tabular text-slate-300">
                        完成 <strong className="text-[#00E59B]">{missionSummary.completedCount}</strong>/
                        {missionSummary.totalMissions} · 勋章{' '}
                        <strong className="text-amber-400">{missionSummary.totalMedals}</strong>
                      </span>
                    </div>

                    {featuredMission && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-slate-300 truncate">{featuredMission.mission.title}</span>
                          <span className="font-mono-tabular text-amber-300 shrink-0">
                            {featuredMission.current.toLocaleString()}/
                            {featuredMission.target.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full transition-all duration-150"
                            style={{
                              width: `${featuredMission.pct}%`,
                              backgroundColor: featuredMission.completed ? '#00E59B' : '#F59E0B',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setActiveTab('missions');
                        }}
                        className="text-[11px] text-[#00E59B] hover:underline cursor-pointer"
                      >
                        打开任务系统面板 →
                      </button>
                      {missionSummary.claimableCount > 0 && (
                        <button
                          type="button"
                          onClick={handleClaimAllMissions}
                          className="px-2 py-0.5 bg-[#00E59B] hover:bg-[#34F5B5] text-slate-950 text-[10px] font-bold cursor-pointer"
                        >
                          领奖 ({missionSummary.claimableCount})
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delta Force Prominent Launch CTA */}
                <button
                  onClick={handleDeployClick}
                  className="df-chamfer w-full py-3.5 bg-[#00E59B] hover:bg-[#34F5B5] text-slate-950 font-extrabold text-sm tracking-wider transition-colors cursor-pointer flex items-center justify-between px-5"
                >
                  <span>开始行动 · 空降{selectedMap.name}</span>
                  <span className="font-mono-tabular text-xs font-bold">
                    -{deployCost.toLocaleString()}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DEDICATED 3D GUNSMITH */}
        {activeTab === 'gunsmith' && (
          <Gunsmith
            profile={profile}
            onSelectOrBuyWeapon={handleWeaponClick}
            onEquipOrBuyAttachment={handleAttachmentClick}
            onResetAttachments={handleResetAttachments}
            onChangeAmmoTier={(ammoTier) =>
              onUpdateProfile(updateTacticalSupplies(profile, { ammoTier }))
            }
            onEquipOrBuySkin={handleEquipOrBuySkin}
            onApplySkinToAll={handleApplySkinToAll}
          />
        )}

        {/* TAB 2B: WEAPON REPAIR WORKBENCH */}
        {activeTab === 'repair' && (
          <WeaponRepairWorkbench
            profile={profile}
            onRepairWithPart={handleRepairWeaponWithPart}
            onAutoRepairWeapon={handleAutoRepairWeapon}
            onGoToDeploy={() => setActiveTab('operators')}
          />
        )}

        {/* TAB 3: STASH & BLACK MARKET */}
        {activeTab === 'stash' && (
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-[#101622] border border-slate-800 df-chamfer p-5">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-white">特勤处仓库与战利品变现</h2>
                    <div className="text-xs text-slate-400 mt-0.5 font-mono-tabular">
                      可用哈夫币：
                      <strong className="text-amber-400 ml-1">
                        {profile.credits.toLocaleString()} ({formatCreditsDisplay(profile.credits)})
                      </strong>
                      <span className="mx-2" aria-hidden="true">·</span>
                      库存 {profile.stash.length} 件 · 估值 {stashValue.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        soundEngine.playUiClick();
                        onUpdateProfile(sellAllStashItems(profile, 'rare'));
                      }}
                      disabled={profile.stash.length === 0}
                      className="px-3.5 py-2 rounded-sm bg-[#0A0E16] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 disabled:opacity-40 cursor-pointer"
                    >
                      变现蓝装及以下
                    </button>
                    <button
                      onClick={() => {
                        soundEngine.playUiClick();
                        onUpdateProfile(sellAllStashItems(profile));
                      }}
                      disabled={profile.stash.length === 0}
                      className="px-4 py-2 rounded-sm bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-40 cursor-pointer"
                    >
                      一键全部变现
                    </button>
                  </div>
                </div>

                {profile.stash.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-500 border border-dashed border-slate-800 rounded-sm">
                    仓库暂无战利品，立即前往特战大厅选择战区搜刮高价值藏品吧！
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[460px] overflow-y-auto pr-1">
                    {profile.stash.map((item) => {
                      const cfg = RARITY_CONFIG[item.rarity];
                      const repairPart = WEAPON_REPAIR_PARTS[item.templateId];
                      const itemWeight = getItemWeight(item.templateId, item.weight);
                      return (
                        <div
                          key={item.uid}
                          style={{ borderColor: cfg.border, backgroundColor: cfg.bg }}
                          className="p-3 rounded-sm border flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 text-[11px] font-semibold">
                              <span style={{ color: cfg.color }}>{cfg.label}</span>
                              <span className="font-mono-tabular text-slate-300">
                                {repairPart
                                  ? `维修 +${repairPart.restoreDurability}%`
                                  : formatWeightKg(itemWeight)}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-white mt-0.5 truncate">{item.name}</div>
                            <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
                              重量 {formatWeightKg(itemWeight)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-white/10">
                            <span className="text-xs font-mono-tabular text-amber-300">
                              {item.value.toLocaleString()}
                            </span>
                            <button
                              onClick={() => {
                                soundEngine.playUiClick();
                                onUpdateProfile(sellStashItem(profile, item.uid));
                              }}
                              className="px-2 py-1 rounded-sm bg-slate-900/80 hover:bg-slate-800 text-[11px] text-slate-200 cursor-pointer"
                            >
                              出售
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="lg:col-span-4 space-y-5">
                <div className="bg-[#101622] border border-slate-800 df-chamfer p-5 space-y-3">
                  <h3 className="text-base font-bold text-white">特勤处扩容设施</h3>

                  <div className="p-3.5 rounded-sm bg-[#0A0E16] border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">扩容安全箱 (2 → 4 格)</div>
                      <div className="text-xs text-slate-400 mt-0.5">阵亡也能稳保更多传说红货</div>
                    </div>
                    <button
                      disabled={profile.safeBoxUpgraded}
                      onClick={() => {
                        soundEngine.playUiClick();
                        const res = upgradeContainer(profile, 'safebox');
                        if (res.error) showNotice(res.error);
                        else onUpdateProfile(res.profile);
                      }}
                      className="px-3 py-1.5 rounded-sm bg-[#00E59B] hover:bg-[#34F5B5] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {profile.safeBoxUpgraded ? '已升级' : '65,000 升级'}
                    </button>
                  </div>

                  <div className="p-3.5 rounded-sm bg-[#0A0E16] border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">大型战术背包 (8 → 12 格)</div>
                      <div className="text-xs text-slate-400 mt-0.5">大幅提升单局摸金上限</div>
                    </div>
                    <button
                      disabled={profile.backpackUpgraded}
                      onClick={() => {
                        soundEngine.playUiClick();
                        const res = upgradeContainer(profile, 'backpack');
                        if (res.error) showNotice(res.error);
                        else onUpdateProfile(res.profile);
                      }}
                      className="px-3 py-1.5 rounded-sm bg-[#00E59B] hover:bg-[#34F5B5] disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {profile.backpackUpgraded ? '已升级' : '42,000 升级'}
                    </button>
                  </div>
                </div>

                <div className="bg-[#101622] border border-slate-800 df-chamfer p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-white">近期出击记录</h3>
                    {!confirmReset ? (
                      <button
                        onClick={() => setConfirmReset(true)}
                        className="text-xs text-slate-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>重置存档</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          onClick={() => {
                            setConfirmReset(false);
                            onResetProfile();
                          }}
                          className="text-rose-400 font-semibold cursor-pointer"
                        >
                          确认清空
                        </button>
                        <button onClick={() => setConfirmReset(false)} className="text-slate-400 cursor-pointer">
                          取消
                        </button>
                      </div>
                    )}
                  </div>

                  {profile.history.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4 text-center">暂无行动记录</div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {profile.history.map((h) => (
                        <div
                          key={h.id}
                          className="p-2.5 rounded-sm bg-[#0A0E16] border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className={h.extracted ? 'text-[#00E59B] font-semibold' : 'text-rose-400 font-semibold'}>
                              {h.extracted ? '撤离成功' : '行动阵亡'}
                            </span>
                            <span className="text-slate-500 ml-2">{h.timestamp}</span>
                            {h.highlightItem && <div className="text-slate-300 mt-0.5">高光：{h.highlightItem}</div>}
                          </div>
                          <div className="text-right font-mono-tabular">
                            <div className="text-amber-400">+{h.lootValue.toLocaleString()}</div>
                            <div className="text-slate-500">{h.kills} 击杀</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: EXTRACTION MISSIONS & TACTICAL MEDALS */}
        {activeTab === 'missions' && (
          <MissionsPanel
            profile={profile}
            onClaimMission={handleClaimMission}
            onClaimAllMissions={handleClaimAllMissions}
            onFocusMissionMap={handleFocusMissionMap}
          />
        )}
      </main>

      {showSettings && (
        <TacticalSettingsModal
          inRaid={false}
          settings={controlSettings}
          onChange={handleUpdateSettings}
          onClose={() => setShowSettings(false)}
          muted={muted}
          onToggleMute={onToggleMute}
        />
      )}
    </div>
  );
}
