import { useMemo, useState } from 'react';
import { Layers, Palette, RotateCcw, Sparkles, Wrench } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import {
  ATTACHMENTS,
  RARITY_CONFIG,
  WEAPON_SKINS,
  WEAPONS,
  computeWeaponStats,
} from '../data/gameData';
import {
  AmmoTier,
  AttachmentDef,
  AttachmentSlot,
  PlayerProfile,
  WeaponCategoryFilter,
  WeaponId,
  WeaponSkinDef,
  WeaponSkinId,
} from '../types/game';
import { CharacterShowcase3D } from './CharacterShowcase3D';

interface GunsmithProps {
  profile: PlayerProfile;
  onSelectOrBuyWeapon: (weaponId: WeaponId) => void;
  onEquipOrBuyAttachment: (slot: AttachmentSlot, attachmentId: string | null) => void;
  onResetAttachments: () => void;
  onChangeAmmoTier: (ammoTier: AmmoTier) => void;
  onEquipOrBuySkin: (skinId: WeaponSkinId) => void;
  onApplySkinToAll: (skinId: WeaponSkinId) => void;
}

const SLOT_CONFIG: Array<{ id: AttachmentSlot; label: string; sub: string }> = [
  { id: 'optic', label: '瞄具系统', sub: 'Sights' },
  { id: 'barrel', label: '枪管组件', sub: 'Barrel' },
  { id: 'muzzle', label: '枪口装置', sub: 'Muzzle' },
  { id: 'grip', label: '下挂握把', sub: 'Grip' },
  { id: 'stock', label: '枪托组件', sub: 'Stock' },
  { id: 'mag', label: '弹匣供弹', sub: 'Magazine' },
];

const WEAPON_CATEGORY_TABS: Array<{ id: WeaponCategoryFilter; label: string }> = [
  { id: 'all', label: '全部 20' },
  { id: 'ar', label: '步枪' },
  { id: 'smg', label: '冲锋枪' },
  { id: 'marksman', label: '精射/狙' },
  { id: 'heavy', label: '机枪/霰' },
];

const EMPTY_ATTACHMENTS: Record<AttachmentSlot, string | null> = {
  optic: null,
  barrel: null,
  muzzle: null,
  grip: null,
  stock: null,
  mag: null,
};

function formatDeltaList(att: AttachmentDef): Array<{ text: string; positive: boolean }> {
  const out: Array<{ text: string; positive: boolean }> = [];
  const d = att.statDeltas;
  if (d.damage) out.push({ text: `伤害 ${d.damage > 0 ? '+' : ''}${d.damage}`, positive: d.damage > 0 });
  if (d.recoil) {
    const ctrlDelta = Math.round(-d.recoil * 28);
    out.push({ text: `后坐控制 ${ctrlDelta > 0 ? '+' : ''}${ctrlDelta}`, positive: ctrlDelta > 0 });
  }
  if (d.ergonomics) out.push({ text: `人机工效 ${d.ergonomics > 0 ? '+' : ''}${d.ergonomics}`, positive: d.ergonomics > 0 });
  if (d.range) out.push({ text: `射程 ${d.range > 0 ? '+' : ''}${d.range}m`, positive: d.range > 0 });
  if (d.fireRate) out.push({ text: `射速 ${d.fireRate > 0 ? '+' : ''}${d.fireRate}`, positive: d.fireRate > 0 });
  if (d.spread) out.push({ text: `精准 ${d.spread < 0 ? '+' : ''}${Math.round(-d.spread * 16)}`, positive: d.spread < 0 });
  if (d.magSize) out.push({ text: `弹容 ${d.magSize > 0 ? '+' : ''}${d.magSize}`, positive: d.magSize > 0 });
  if (d.noiseRadius) out.push({ text: `枪声 ${d.noiseRadius > 0 ? '+' : ''}${d.noiseRadius}`, positive: d.noiseRadius < 0 });
  return out;
}

function getSkinSwatchBackground(skin: WeaponSkinDef): string {
  switch (skin.pattern) {
    case 'digital':
      return `repeating-linear-gradient(90deg, ${skin.primaryHex} 0 12px, ${skin.secondaryHex} 12px 24px, ${skin.accentHex} 24px 28px)`;
    case 'camo':
      return `radial-gradient(circle at 22% 35%, ${skin.accentHex} 0%, transparent 45%), radial-gradient(circle at 75% 65%, ${skin.secondaryHex} 0%, transparent 55%), ${skin.primaryHex}`;
    case 'topo':
      return `linear-gradient(125deg, ${skin.primaryHex} 0%, ${skin.secondaryHex} 52%, ${skin.accentHex} 54%, ${skin.primaryHex} 58%)`;
    case 'hex':
      return `linear-gradient(135deg, ${skin.secondaryHex} 0%, ${skin.primaryHex} 60%, ${skin.accentHex} 100%)`;
    case 'carbon_gold':
      return `linear-gradient(115deg, ${skin.secondaryHex} 0%, ${skin.primaryHex} 45%, ${skin.accentHex} 55%, ${skin.secondaryHex} 100%)`;
    case 'tiger':
      return `repeating-linear-gradient(120deg, ${skin.primaryHex} 0 14px, ${skin.secondaryHex} 14px 24px, ${skin.accentHex} 24px 27px)`;
    case 'prism':
      return `linear-gradient(125deg, ${skin.primaryHex} 0%, ${skin.secondaryHex} 50%, ${skin.accentHex} 100%)`;
    default:
      return `linear-gradient(135deg, ${skin.primaryHex} 0%, ${skin.secondaryHex} 100%)`;
  }
}

export function Gunsmith({
  profile,
  onSelectOrBuyWeapon,
  onEquipOrBuyAttachment,
  onResetAttachments,
  onChangeAmmoTier,
  onEquipOrBuySkin,
  onApplySkinToAll,
}: GunsmithProps) {
  const [activeSlot, setActiveSlot] = useState<AttachmentSlot>('optic');
  const [workbenchMode, setWorkbenchMode] = useState<'attachments' | 'skins'>('attachments');
  const [weaponCategory, setWeaponCategory] = useState<WeaponCategoryFilter>('all');
  const [skinFilter, setSkinFilter] = useState<'all' | 'tactical' | 'rare_plus'>('all');
  const [previewSkinId, setPreviewSkinId] = useState<WeaponSkinId | null>(null);
  const [previewWeaponId, setPreviewWeaponId] = useState<WeaponId | null>(null);

  const activeWeaponId = previewWeaponId || profile.loadout.weaponId;
  const selectedWeapon = WEAPONS[activeWeaponId] || WEAPONS.m4a1;
  const isHoveringWeapon = Boolean(previewWeaponId && previewWeaponId !== profile.loadout.weaponId);

  const equippedWeapon = WEAPONS[profile.loadout.weaponId] || WEAPONS.m4a1;
  const equippedSkinId: WeaponSkinId =
    profile.loadout.weaponSkins?.[activeWeaponId] || 'factory_standard';
  const activePreviewSkinId: WeaponSkinId = previewSkinId || equippedSkinId;
  const isHoveringSkin = Boolean(previewSkinId && previewSkinId !== equippedSkinId);

  const activeSkinDef =
    WEAPON_SKINS.find((s) => s.id === activePreviewSkinId) || WEAPON_SKINS[0];
  const unlockedSkins = profile.unlockedSkins ?? ['factory_standard'];

  const filteredWeapons = useMemo(() => {
    const all = Object.values(WEAPONS);
    if (weaponCategory === 'all') return all;
    return all.filter((w) => w.categoryGroup === weaponCategory);
  }, [weaponCategory]);

  const filteredSkins = useMemo(() => {
    if (skinFilter === 'tactical') {
      return WEAPON_SKINS.filter((s) => s.rarity === 'common' || s.rarity === 'uncommon');
    }
    if (skinFilter === 'rare_plus') {
      return WEAPON_SKINS.filter(
        (s) => s.rarity === 'rare' || s.rarity === 'epic' || s.rarity === 'legendary'
      );
    }
    return WEAPON_SKINS;
  }, [skinFilter]);

  const baseStats = useMemo(
    () => computeWeaponStats(activeWeaponId, EMPTY_ATTACHMENTS),
    [activeWeaponId]
  );

  const computedStats = useMemo(
    () => computeWeaponStats(activeWeaponId, profile.loadout.attachments),
    [activeWeaponId, profile.loadout.attachments]
  );

  const hasAnyAttachment = useMemo(
    () => Object.values(profile.loadout.attachments).some((v) => v !== null),
    [profile.loadout.attachments]
  );

  const recoilScore = Math.round(Math.max(15, Math.min(100, 100 - computedStats.recoil * 28)));
  const baseRecoilScore = Math.round(Math.max(15, Math.min(100, 100 - baseStats.recoil * 28)));

  const accuracyScore = Math.round(Math.max(10, Math.min(100, 100 - computedStats.spread * 16)));
  const baseAccuracyScore = Math.round(Math.max(10, Math.min(100, 100 - baseStats.spread * 16)));

  const armorPenPct = Math.round(
    (computedStats.armorPen + (profile.loadout.ammoTier === 'ap' ? 0.22 : 0)) * 100
  );
  const baseArmorPenPct = Math.round(baseStats.armorPen * 100);

  const statRows = [
    {
      label: computedStats.pellets > 1 ? `单发弹丸伤害 (×${computedStats.pellets})` : '单发基础伤害',
      val: computedStats.damage,
      base: baseStats.damage,
      max: 115,
      unit: '',
      highlight: true,
    },
    {
      label: '后坐力控制',
      val: recoilScore,
      base: baseRecoilScore,
      max: 100,
      unit: '',
      highlight: true,
    },
    {
      label: '人机工效',
      val: computedStats.ergonomics,
      base: baseStats.ergonomics,
      max: 100,
      unit: '',
      highlight: true,
    },
    {
      label: '穿甲能力',
      val: armorPenPct,
      base: baseArmorPenPct,
      max: 100,
      unit: '%',
      highlight: false,
    },
    {
      label: '武器射速',
      val: Number(computedStats.fireRate.toFixed(1)),
      base: Number(baseStats.fireRate.toFixed(1)),
      max: 16,
      unit: ' 发/秒',
      highlight: false,
    },
    {
      label: '有效射程',
      val: computedStats.range,
      base: baseStats.range,
      max: 1350,
      unit: ' m',
      highlight: false,
    },
    {
      label: '弹道精准度',
      val: accuracyScore,
      base: baseAccuracyScore,
      max: 100,
      unit: '',
      highlight: false,
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 20 Delta Force Weapon Models Arsenal (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">制式主武器库</h2>
            <span className="text-xs font-mono-tabular text-slate-400">
              {profile.unlockedWeapons.length}/{Object.keys(WEAPONS).length} 已解锁
            </span>
          </div>

          {/* Category Filter Tabs */}
          <div className="grid grid-cols-5 gap-1 p-1 bg-[#0B1018] border border-slate-800 rounded-md">
            {WEAPON_CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  soundEngine.playUiClick();
                  setWeaponCategory(tab.id);
                }}
                className={`py-1.5 px-1 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap truncate ${
                  weaponCategory === tab.id
                    ? 'bg-[#1A263A] text-[#00E59B] font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
            {filteredWeapons.map((w) => {
              const unlocked = profile.unlockedWeapons.includes(w.id);
              const equipped = profile.loadout.weaponId === w.id;
              const wSkinId = profile.loadout.weaponSkins?.[w.id] || 'factory_standard';
              const wSkin = WEAPON_SKINS.find((s) => s.id === wSkinId) || WEAPON_SKINS[0];

              return (
                <button
                  key={w.id}
                  onMouseEnter={() => setPreviewWeaponId(w.id)}
                  onMouseLeave={() => setPreviewWeaponId(null)}
                  onClick={() => onSelectOrBuyWeapon(w.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    equipped
                      ? 'bg-[#172133] border-[#00E59B]'
                      : 'bg-[#131A26] border-slate-800 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white truncate">{w.name}</span>
                    <span
                      className={`text-[11px] font-mono-tabular whitespace-nowrap shrink-0 ${
                        equipped ? 'text-[#00E59B]' : unlocked ? 'text-slate-400' : 'text-amber-400'
                      }`}
                    >
                      {equipped ? '装备中' : unlocked ? '已解锁' : `${w.price.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center justify-between gap-2">
                    <span className="truncate">
                      {w.category} · <span className="font-mono-tabular">{w.caliber}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-300 shrink-0">
                      <span
                        className="w-2.5 h-2.5 rounded-xs border border-white/20"
                        style={{ backgroundColor: wSkin.accentHex }}
                      />
                      <span className="truncate max-w-[78px]">{wSkin.name.split(' · ').pop()}</span>
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-tabular text-slate-400 mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span>
                      伤害 {w.baseStats.damage}
                      {w.baseStats.pellets ? `×${w.baseStats.pellets}` : ''}
                    </span>
                    <span>人机 {w.baseStats.ergonomics}</span>
                    <span>射程 {w.baseStats.range}m</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Column: 3D Weapon Workbench & Attachments / Skins (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-[#131A26] border border-slate-800 rounded-lg p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="text-xs text-[#00E59B] font-mono-tabular truncate">
                  {selectedWeapon.category} · {selectedWeapon.caliber}
                  {isHoveringWeapon ? ' · 悬停实时预览' : ''}
                </div>
                <h3 className="text-xl font-bold text-white mt-0.5 truncate">{selectedWeapon.name}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    soundEngine.playUiClick();
                    onResetAttachments();
                  }}
                  disabled={!hasAnyAttachment}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#0F1520] border border-slate-800 hover:border-slate-600 text-xs text-slate-300 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>恢复原厂</span>
                </button>
              </div>
            </div>

            {/* Live 3D Weapon Preview */}
            <div className="h-64 w-full rounded-md overflow-hidden border border-slate-800 mb-4 relative bg-[#0B1019]">
              <CharacterShowcase3D
                operatorId={profile.loadout.operatorId}
                weaponId={activeWeaponId}
                attachments={profile.loadout.attachments}
                armorTier={profile.loadout.armorTier}
                mode="weapon_only"
                cameraPreset="weapon"
                weaponSkin={activePreviewSkinId}
              />

              {/* Top-left crisp solid surface tag (no backdrop-filter over WebGL, no pulsing dots) */}
              <div className="absolute top-2.5 left-3 pointer-events-none px-2.5 py-1 rounded bg-[#0B1018]/92 border border-slate-700/80 flex items-center gap-2 text-[11px]">
                <span
                  className="w-2.5 h-2.5 rounded-xs border border-white/30 shrink-0"
                  style={{ backgroundColor: activeSkinDef.accentHex }}
                />
                <span className="text-slate-300 font-medium">
                  {isHoveringSkin ? '实时预览涂装：' : '当前涂装：'}
                </span>
                <span className="text-white font-bold">{activeSkinDef.name}</span>
              </div>

              <div className="absolute bottom-2 right-3 text-[11px] font-mono-tabular text-slate-400 pointer-events-none">
                拖拽旋转 3D 枪身 · 滚轮缩放检视细节
              </div>
            </div>

            {/* Workbench Segmented Switch: 6-Slot Attachments vs Weapon Skins */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0B1018] border border-slate-800 rounded-md mb-4">
              <button
                onClick={() => {
                  soundEngine.playUiClick();
                  setWorkbenchMode('attachments');
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  workbenchMode === 'attachments'
                    ? 'bg-[#172133] text-white border border-[#00E59B]/70'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-[#00E59B]" />
                <span>配件改装 (6 槽位)</span>
              </button>
              <button
                onClick={() => {
                  soundEngine.playUiClick();
                  setWorkbenchMode('skins');
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  workbenchMode === 'skins'
                    ? 'bg-[#172133] text-white border border-amber-400/80'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                <span>枪械涂装 ({WEAPON_SKINS.length} 款皮肤)</span>
              </button>
            </div>

            {workbenchMode === 'attachments' ? (
              <>
                {/* 6 Modular Attachment Slot Tabs */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {SLOT_CONFIG.map((slot) => {
                    const eqId = profile.loadout.attachments[slot.id];
                    const eqDef = ATTACHMENTS.find((a) => a.id === eqId);
                    const isSel = activeSlot === slot.id;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          setActiveSlot(slot.id);
                        }}
                        className={`p-2.5 rounded border text-left transition-colors cursor-pointer ${
                          isSel
                            ? 'bg-[#1B283C] border-amber-500 text-white'
                            : 'bg-[#0F1520] border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>{slot.label}</span>
                          <span className="font-mono-tabular">{slot.sub}</span>
                        </div>
                        <div
                          className={`text-xs font-semibold truncate mt-1 ${
                            eqDef ? 'text-[#00E59B]' : 'text-slate-400'
                          }`}
                        >
                          {eqDef ? eqDef.name : '原厂空槽'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Parts Selector for Active Slot */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  <button
                    onClick={() => onEquipOrBuyAttachment(activeSlot, null)}
                    className={`w-full p-3 rounded border text-left text-xs transition-colors cursor-pointer flex items-center justify-between ${
                      profile.loadout.attachments[activeSlot] === null
                        ? 'bg-slate-800/80 border-[#00E59B] text-white'
                        : 'bg-[#0F1520] border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span>卸下当前{SLOT_CONFIG.find((s) => s.id === activeSlot)?.label}（使用原厂部件）</span>
                    <span className="font-mono-tabular text-slate-400">
                      {profile.loadout.attachments[activeSlot] === null ? '当前配置' : '还原'}
                    </span>
                  </button>

                  {ATTACHMENTS.filter((a) => a.slot === activeSlot).map((att) => {
                    const owned = profile.unlockedAttachments.includes(att.id);
                    const equipped = profile.loadout.attachments[activeSlot] === att.id;
                    const deltas = formatDeltaList(att);

                    return (
                      <button
                        key={att.id}
                        onClick={() => onEquipOrBuyAttachment(activeSlot, att.id)}
                        className={`w-full p-3 rounded border text-left transition-colors cursor-pointer ${
                          equipped
                            ? 'bg-[#172133] border-[#00E59B]'
                            : 'bg-[#0F1520] border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white truncate">{att.name}</span>
                          <span
                            className={`text-xs font-mono-tabular whitespace-nowrap shrink-0 ${
                              equipped ? 'text-[#00E59B]' : owned ? 'text-slate-400' : 'text-amber-400'
                            }`}
                          >
                            {equipped ? '已装配' : owned ? '仓库已拥有' : `购买 ${att.price.toLocaleString()}`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{att.description}</p>
                        {deltas.length > 0 && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-2 border-t border-slate-800/70 text-[11px] font-mono-tabular">
                            {deltas.map((d, idx) => (
                              <span
                                key={idx}
                                className={d.positive ? 'text-[#00E59B]' : 'text-rose-400'}
                              >
                                {d.text}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              /* WEAPON SKIN STUDIO (REAL-TIME 3D HOVER & CLICK PREVIEW) */
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 p-1 bg-[#0B1018] border border-slate-800 rounded">
                    {(
                      [
                        { id: 'all', label: '全部涂装' },
                        { id: 'tactical', label: '战术迷彩' },
                        { id: 'rare_plus', label: '典藏镀层' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          soundEngine.playUiClick();
                          setSkinFilter(f.id);
                        }}
                        className={`px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer whitespace-nowrap ${
                          skinFilter === f.id
                            ? 'bg-[#172133] text-amber-300 font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onMouseEnter={() => setPreviewSkinId(equippedWeapon.recommendedSkin)}
                      onMouseLeave={() => setPreviewSkinId(null)}
                      onClick={() => onEquipOrBuySkin(equippedWeapon.recommendedSkin)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0F1520] border border-slate-700 hover:border-amber-400 text-[11px] text-amber-300 cursor-pointer whitespace-nowrap"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>搭配推荐</span>
                    </button>
                    <button
                      onClick={() =>
                        onApplySkinToAll(
                          profile.loadout.weaponSkins?.[profile.loadout.weaponId] || 'factory_standard'
                        )
                      }
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0F1520] border border-slate-700 hover:border-[#00E59B] text-[11px] text-[#00E59B] cursor-pointer whitespace-nowrap"
                    >
                      <Layers className="w-3 h-3" />
                      <span>同步至全部枪械</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                  {filteredSkins.map((skin) => {
                    const owned = unlockedSkins.includes(skin.id);
                    const equippedOnCurrent =
                      (profile.loadout.weaponSkins?.[profile.loadout.weaponId] || 'factory_standard') ===
                      skin.id;
                    const rarityCfg = RARITY_CONFIG[skin.rarity];

                    return (
                      <button
                        key={skin.id}
                        onMouseEnter={() => setPreviewSkinId(skin.id)}
                        onMouseLeave={() => setPreviewSkinId(null)}
                        onClick={() => onEquipOrBuySkin(skin.id)}
                        className={`p-2.5 rounded border text-left transition-colors cursor-pointer flex flex-col gap-2 ${
                          equippedOnCurrent
                            ? 'bg-[#172133] border-[#00E59B]'
                            : 'bg-[#0F1520] border-slate-800 hover:border-amber-400/70'
                        }`}
                      >
                        {/* Procedural Pattern Swatch Bar */}
                        <div
                          className="h-9 w-full rounded-sm border border-white/15 relative overflow-hidden"
                          style={{ background: getSkinSwatchBackground(skin) }}
                        >
                          <div
                            className="absolute bottom-0 inset-x-0 h-1"
                            style={{ backgroundColor: skin.accentHex }}
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{skin.name}</span>
                            <span
                              className="text-[10px] font-semibold whitespace-nowrap shrink-0"
                              style={{ color: rarityCfg.color }}
                            >
                              {rarityCfg.label}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-mono-tabular mt-0.5">
                            <span className="text-slate-400 truncate">{skin.subtitle}</span>
                            <span
                              className={
                                equippedOnCurrent
                                  ? 'text-[#00E59B] font-bold'
                                  : owned
                                    ? 'text-slate-300'
                                    : 'text-amber-400 font-semibold'
                              }
                            >
                              {equippedOnCurrent
                                ? '已装配'
                                : owned
                                  ? '点击装配'
                                  : `${skin.price.toLocaleString()} 解锁`}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Weapon Ballistics & Handling Panel (4 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-[#131A26] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">枪械实时性能面板</h3>
              <span className="text-xs font-mono-tabular text-slate-400">
                已装 {Object.values(profile.loadout.attachments).filter(Boolean).length}/6 配件
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{selectedWeapon.description}</p>

            {/* Primary Stats with Base vs Modified Comparison */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              {statRows.map((stat) => {
                const diff = Number((stat.val - stat.base).toFixed(1));
                const basePct = Math.min(100, (stat.base / stat.max) * 100);
                const valPct = Math.min(100, (stat.val / stat.max) * 100);

                return (
                  <div key={stat.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={stat.highlight ? 'text-white font-semibold' : 'text-slate-300'}>
                        {stat.label}
                      </span>
                      <div className="flex items-center gap-2 font-mono-tabular">
                        {diff !== 0 && (
                          <span className={diff > 0 ? 'text-[#00E59B]' : 'text-rose-400'}>
                            {diff > 0 ? `+${diff}` : diff}
                            {stat.unit}
                          </span>
                        )}
                        <span className="font-bold text-white">
                          {stat.val}
                          {stat.unit}
                        </span>
                      </div>
                    </div>

                    <div className="h-2 w-full bg-[#090D16] border border-slate-800/80 rounded-sm overflow-hidden relative">
                      {diff >= 0 ? (
                        <>
                          <div
                            className="absolute inset-y-0 left-0 bg-emerald-500/85 transition-all duration-150"
                            style={{ width: `${basePct}%` }}
                          />
                          {diff > 0 && (
                            <div
                              className="absolute inset-y-0 bg-amber-400 transition-all duration-150"
                              style={{ left: `${basePct}%`, width: `${Math.max(0, valPct - basePct)}%` }}
                            />
                          )}
                        </>
                      ) : (
                        <>
                          <div
                            className="absolute inset-y-0 left-0 bg-emerald-500/85 transition-all duration-150"
                            style={{ width: `${valPct}%` }}
                          />
                          <div
                            className="absolute inset-y-0 bg-rose-500/70 transition-all duration-150"
                            style={{ left: `${valPct}%`, width: `${Math.max(0, basePct - valPct)}%` }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tactical Ammo Selection inside Gunsmith */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="text-xs font-medium text-slate-400">配弹方案</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    soundEngine.playUiClick();
                    onChangeAmmoTier('standard');
                  }}
                  className={`p-2.5 rounded border text-left text-xs transition-colors cursor-pointer ${
                    profile.loadout.ammoTier === 'standard'
                      ? 'bg-[#172336] border-[#00E59B] text-white'
                      : 'bg-[#0F1520] border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="font-semibold">制式标准弹</div>
                  <div className="text-[11px] font-mono-tabular mt-0.5">基础穿甲 · 1,200</div>
                </button>
                <button
                  onClick={() => {
                    soundEngine.playUiClick();
                    onChangeAmmoTier('ap');
                  }}
                  className={`p-2.5 rounded border text-left text-xs transition-colors cursor-pointer ${
                    profile.loadout.ammoTier === 'ap'
                      ? 'bg-[#172336] border-amber-500 text-amber-200'
                      : 'bg-[#0F1520] border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="font-semibold">钨芯穿甲弹 AP</div>
                  <div className="text-[11px] font-mono-tabular mt-0.5">+22%穿甲 · 6,500</div>
                </button>
              </div>
            </div>

            {/* Handling & Acoustic Readouts */}
            <div className="pt-3 border-t border-slate-800 grid grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded bg-[#0F1520] border border-slate-800">
                <div className="text-slate-400 text-[11px]">单匣容量</div>
                <div className="text-sm font-mono-tabular font-bold text-white mt-0.5">
                  {computedStats.magSize} 发
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#0F1520] border border-slate-800">
                <div className="text-slate-400 text-[11px]">换弹耗时</div>
                <div className="text-sm font-mono-tabular font-bold text-[#00E59B] mt-0.5">
                  {computedStats.reloadTime.toFixed(2)}s
                </div>
              </div>
              <div className="p-2.5 rounded bg-[#0F1520] border border-slate-800">
                <div className="text-slate-400 text-[11px]">枪声半径</div>
                <div className="text-sm font-mono-tabular font-bold text-amber-400 mt-0.5 truncate">
                  {computedStats.noiseRadius}{' '}
                  {computedStats.isSuppressed || activeWeaponId === 'vss' ? '(消音)' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
