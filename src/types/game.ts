export type GameScreen = 'TITLE_MENU' | 'HIDEOUT_LOADOUT' | 'PLAYING' | 'RAID_SUMMARY';

export type MapId = 'zero_dam' | 'layali_grove' | 'brakkesh' | 'space_city';

export type OperatorId =
  | 'luna'
  | 'stinger'
  | 'dwolf'
  | 'shepherd'
  | 'hackclaw'
  | 'vyron'
  | 'uluru'
  | 'toxik';

export type WeaponId =
  | 'm4a1'
  | 'k416'
  | 'ci19'
  | 'akm'
  | 'ak12'
  | 'aug'
  | 'vector'
  | 'mp5'
  | 'p90'
  | 'sr3m'
  | 'scarh'
  | 'ash12'
  | 'sr25'
  | 'vss'
  | 'awm'
  | 'r93'
  | 'm249'
  | 'pkm'
  | 's12k'
  | 'm870';

export type WeaponCategoryFilter = 'all' | 'ar' | 'smg' | 'marksman' | 'heavy';

export type WeaponSkinId =
  | 'factory_standard'
  | 'desert_digital'
  | 'forest_multicam'
  | 'arctic_frost'
  | 'gti_emerald'
  | 'crimson_obsidian'
  | 'neon_cyber'
  | 'gold_dragon'
  | 'havoc_tiger'
  | 'titanium_prism';

export interface WeaponSkinDef {
  id: WeaponSkinId;
  name: string;
  subtitle: string;
  rarity: LootRarity;
  price: number;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  pattern: 'solid' | 'digital' | 'camo' | 'topo' | 'hex' | 'carbon_gold' | 'tiger' | 'prism';
  metalness: number;
  roughness: number;
  clearcoat: number;
  description: string;
}

export type AttachmentSlot = 'optic' | 'barrel' | 'muzzle' | 'grip' | 'stock' | 'mag';

export type LootRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type LootCategory = 'collectible' | 'electronics' | 'medical' | 'tactical' | 'weapon_part';

export interface WeaponRepairPartDef {
  templateId: string;
  name: string;
  rarity: LootRarity;
  weight: number;
  restoreDurability: number;
  subsystemLabel: string;
  dropHint: string;
  description: string;
}

export type AmmoTier = 'standard' | 'ap';

export type TacticalSlotKey = 'Q' | 'E' | 'X';

export type TacticalGearId =
  | 'laser_designator'
  | 'tactical_binoculars'
  | 'ir_monocular'
  | 'recon_drone'
  | 'm18_smoke'
  | 'wide_smoke_screen'
  | 'cs_irritant_smoke'
  | 'signal_jammer'
  | 'radio_recon'
  | 'm84_flashbang'
  | 'acoustic_decoy'
  | 'deployable_cover';

export interface GearCooldownRecord {
  lastUsedAt: number;
  readyAt: number;
  lastRaidUses: number;
  totalUses: number;
  cooldownDurationSec: number;
}

export interface TacticalGearDef {
  id: TacticalGearId;
  slot: TacticalSlotKey;
  name: string;
  shortName: string;
  categoryLabel: string;
  price: number;
  deployCost: number;
  cooldown: number;
  maxCharges: number | null;
  durationSec: number;
  description: string;
}

export interface OperatorDef {
  id: OperatorId;
  name: string;
  codename: string;
  role: string;
  division: string;
  portrait: string;
  accentColor: string;
  maxHp: number;
  baseSpeed: number;
  passiveTitle: string;
  passiveDesc: string;
  recommendedGear: Record<TacticalSlotKey, TacticalGearId>;
}

export interface AttachmentDef {
  id: string;
  name: string;
  slot: AttachmentSlot;
  price: number;
  description: string;
  statDeltas: {
    damage?: number;
    fireRate?: number;
    spread?: number;
    recoil?: number;
    ergonomics?: number;
    range?: number;
    magSize?: number;
    noiseRadius?: number;
    moveSpeedMod?: number;
    visionBonus?: number;
  };
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  category: string;
  categoryGroup: Exclude<WeaponCategoryFilter, 'all'>;
  price: number;
  description: string;
  caliber: string;
  recommendedSkin: WeaponSkinId;
  baseStats: {
    damage: number;
    armorPen: number;
    fireRate: number;
    spread: number;
    recoil: number;
    ergonomics: number;
    range: number;
    magSize: number;
    reloadTime: number;
    projectileSpeed: number;
    noiseRadius: number;
    moveSpeedMod: number;
    isAuto: boolean;
    pellets?: number;
  };
}

export interface ComputedWeaponStats {
  damage: number;
  armorPen: number;
  fireRate: number;
  spread: number;
  recoil: number;
  ergonomics: number;
  range: number;
  magSize: number;
  reloadTime: number;
  projectileSpeed: number;
  noiseRadius: number;
  moveSpeedMod: number;
  visionBonus: number;
  isAuto: boolean;
  isSuppressed: boolean;
  pellets: number;
}

export interface LootTemplate {
  templateId: string;
  name: string;
  rarity: LootRarity;
  category: LootCategory;
  value: number;
  weight: number;
  description: string;
}

export interface LootInstance {
  uid: string;
  templateId: string;
  name: string;
  rarity: LootRarity;
  category: LootCategory;
  value: number;
  weight: number;
  revealed: boolean;
}

export interface ArmorTierDef {
  tier: number;
  name: string;
  maxArmor: number;
  damageReduction: number;
  price: number;
  movePenalty: number;
}

export interface LoadoutConfig {
  mapId: MapId;
  operatorId: OperatorId;
  weaponId: WeaponId;
  weaponSkins?: Partial<Record<WeaponId, WeaponSkinId>>;
  attachments: Record<AttachmentSlot, string | null>;
  armorTier: number;
  ammoTier: AmmoTier;
  medkits: number;
  armorPlates: number;
  tacticalGear: Record<TacticalSlotKey, TacticalGearId>;
  backpackCapacity: number;
  safeBoxCapacity: number;
}

export interface StashItem {
  uid: string;
  templateId: string;
  name: string;
  rarity: LootRarity;
  category: LootCategory;
  value: number;
  weight?: number;
  acquiredAt: string;
}

export type TacticalMedalId =
  | 'medal_combat_veteran'
  | 'medal_dam_vanguard'
  | 'medal_forest_ghost'
  | 'medal_desert_breacher'
  | 'medal_orbital_ace'
  | 'medal_gear_specialist'
  | 'medal_boss_slayer'
  | 'medal_high_roller';

export interface TacticalMedalDef {
  id: TacticalMedalId;
  name: string;
  rankLabel: string;
  color: string;
  accentBg: string;
  description: string;
}

export type MissionCategory = 'extraction' | 'combat' | 'recon_gear' | 'boss';

export type MissionConditionType =
  | 'extract_count'
  | 'kills_total'
  | 'boss_kills'
  | 'extract_value_total'
  | 'single_raid_extract_value'
  | 'tactical_gear_uses';

export interface TacticalMissionDef {
  id: string;
  title: string;
  issuer: string;
  category: MissionCategory;
  mapId?: MapId;
  description: string;
  conditionType: MissionConditionType;
  targetCount: number;
  unitLabel: string;
  rewardCredits: number;
  rewardMedalId: TacticalMedalId;
  rewardMedalCount: number;
}

export interface RaidHistoryRecord {
  id: string;
  mapId?: MapId;
  extracted: boolean;
  operatorId: OperatorId;
  kills: number;
  lootValue: number;
  durationSec: number;
  highlightItem?: string;
  timestamp: string;
}

export interface PlayerProfile {
  credits: number;
  tacticalMedals?: number;
  medalInventory?: Partial<Record<TacticalMedalId, number>>;
  missionProgress?: Record<string, number>;
  claimedMissionIds?: string[];
  totalMissionCreditsEarned?: number;
  unlockedWeapons: WeaponId[];
  unlockedAttachments: string[];
  unlockedSkins?: WeaponSkinId[];
  unlockedGear?: TacticalGearId[];
  gearCooldowns?: Partial<Record<TacticalGearId, GearCooldownRecord>>;
  weaponDurability?: Partial<Record<WeaponId, number>>;
  stash: StashItem[];
  loadout: LoadoutConfig;
  safeBoxUpgraded: boolean;
  backpackUpgraded: boolean;
  stats: {
    raidsPlayed: number;
    raidsExtracted: number;
    totalKills: number;
    bossKills: number;
    totalExtractedValue: number;
    bestRaidValue: number;
  };
  history: RaidHistoryRecord[];
}

export type EnemyKind = 'grunt' | 'heavy' | 'sniper' | 'boss';

export interface MapZone {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  danger: 'LOW' | 'MEDIUM' | 'HIGH' | 'BOSS';
  color: string;
}

export interface MapObstacle {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  height?: number;
  kind: 'wall' | 'container' | 'crate' | 'pillar' | 'sandbag' | 'building';
  roofStyle?: 'pitched' | 'flat' | 'dome' | 'industrial';
  color?: string;
  blocksVision: boolean;
}

export interface MapRoadDef {
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  dashed?: boolean;
}

export interface MapWaterDef {
  x: number;
  y: number;
  w: number;
  h: number;
  color?: number;
}

export interface ExtractionPointDef {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  activatesAtSec: number;
  holdDuration: number;
  description: string;
}

export interface LeverCandidateDef {
  name: string;
  zoneName: string;
  x: number;
  y: number;
}

export interface ContainerSpawnDef {
  id: string;
  name: string;
  kind: 'safe' | 'weapon_crate' | 'server' | 'med_bag' | 'supply_box';
  x: number;
  y: number;
  zoneName: string;
  minItems: number;
  maxItems: number;
  highValueBias: number;
}

export interface MapEnemySpawnDef {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  patrol: Array<{ x: number; y: number }>;
  customName?: string;
}

export interface MapThemeDef {
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  outerTerrainColor: number;
  wallColor: number;
  pillarColor: number;
  crateColor: number;
  accentHex: string;
  groundStyle: 'dam_concrete' | 'valley_forest' | 'desert_city' | 'space_tarmac';
}

export interface MapDef {
  id: MapId;
  name: string;
  subtitle: string;
  dangerLabel: string;
  threatLevel?: 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  description: string;
  tacticalIntel?: string[];
  bossName: string;
  bossZone: string;
  lootMultiplier: number;
  spawnPoint: { x: number; y: number };
  theme: MapThemeDef;
  zones: MapZone[];
  roads?: MapRoadDef[];
  waterBodies?: MapWaterDef[];
  obstacles: MapObstacle[];
  containers: ContainerSpawnDef[];
  extractions: ExtractionPointDef[];
  leverCandidates?: LeverCandidateDef[];
  enemies: MapEnemySpawnDef[];
}

export type BodyPartId = 'head' | 'chest' | 'arms' | 'legs';

export interface BodyPartStatus {
  hp: number;
  maxHp: number;
  bleeding: boolean;
}

export type WeatherType = 'clear' | 'rain' | 'snow' | 'smog';
export type TimeOfDayPhase = 'dawn' | 'day' | 'dusk' | 'night';
export type CameraViewMode = 'first' | 'third';
export type ControlTriggerMode = 'hold' | 'toggle';
export type ScopeTier = 'iron' | '1x' | '4x' | '8x';

export interface TacticalControlSettings {
  leanEnabled: boolean;
  leanMode: ControlTriggerMode;
  leanIntensity: number; // 0.6 - 1.4
  adsMode: ControlTriggerMode;
  baseSensitivity: number; // 0.30 - 2.50
  ironSensitivity: number; // 0.30 - 2.00
  scope1xSensitivity: number; // 0.25 - 2.00
  scope4xSensitivity: number; // 0.20 - 1.80
  scope8xSensitivity: number; // 0.15 - 1.60
  fpFov: number; // 60 - 110 degrees
  tpZoom: number; // 0.70 - 1.45
}

export interface HudSnapshot {
  mapId: MapId;
  mapName: string;
  bossDisplayName: string;
  cameraMode: CameraViewMode;
  pointerLocked: boolean;
  leanState: -1 | 0 | 1;
  activeScopeTier: ScopeTier;
  activeScopeLabel: string;
  weather: WeatherType;
  weatherLabel: string;
  weatherEffectSummary: string;
  timeOfDayHours: number;
  timeOfDayPhase: TimeOfDayPhase;
  timeOfDayLabel: string;
  enemyVisionMult: number;
  playerNoiseMult: number;
  flashlightOn: boolean;
  damageFlash: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  stamina: number;
  maxStamina: number;
  isSprinting: boolean;
  isStaminaExhausted: boolean;
  staminaRegenRatePct: number;
  ammoInMag: number;
  magSize: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
  weaponDurability: number;
  isJammed: boolean;
  jamClearing: boolean;
  jamClearProgress: number;
  medkits: number;
  armorPlates: number;
  qCooldown: number;
  qMaxCooldown: number;
  eCooldown: number;
  eMaxCooldown: number;
  xCooldown: number;
  xMaxCooldown: number;
  qCharges: number | null;
  eCharges: number | null;
  xCharges: number | null;
  laserActiveRemaining: number;
  binocularsActiveRemaining: number;
  irActiveRemaining: number;
  droneActiveRemaining: number;
  radioReconActiveRemaining: number;
  jammerActiveCount: number;
  raidTimeRemaining: number;
  raidElapsed: number;
  kills: number;
  bossAlive: boolean;
  bossHpRatio: number | null;
  bossEngaged: boolean;
  introActive: boolean;
  isAds: boolean;
  bleeding: boolean;
  bleedingCount: number;
  bodyParts: Record<BodyPartId, BodyPartStatus>;
  traumaEffects: {
    headConcussed: boolean;
    armTremor: boolean;
    legFractured: boolean;
  };
  backpack: LootInstance[];
  backpackCapacity: number;
  safeBox: LootInstance[];
  safeBoxCapacity: number;
  carriedWeightKg: number;
  encumbrancePenaltyPct: number;
  nearbyContainer: {
    id: string;
    name: string;
    kind: string;
    searching: boolean;
    searched: boolean;
    progress: number;
    items: LootInstance[];
  } | null;
  extractionLever: {
    x: number;
    y: number;
    name: string;
    zoneName: string;
    pulled: boolean;
    distanceMeters: number;
    canPull: boolean;
  };
  nearbyExtract: {
    name: string;
    active: boolean;
    leverPulled: boolean;
    activatesIn: number;
    progress: number;
    holdDuration: number;
    remainingSec: number;
  } | null;
  activeExtraction: {
    name: string;
    progress: number;
    holdDuration: number;
    remainingSec: number;
    isInside: boolean;
  } | null;
  playerX: number;
  playerY: number;
  playerAngle: number;
  minimapEnemies: Array<{ x: number; y: number; kind: EnemyKind }>;
  minimapExtracts: Array<{ x: number; y: number; name: string; active: boolean }>;
  minimapContainers: Array<{ x: number; y: number; searched: boolean; kind: string }>;
  statusBanner: string | null;
}

export interface RaidOutcome {
  mapId: MapId;
  extracted: boolean;
  reason: string;
  operatorId: OperatorId;
  durationSec: number;
  kills: number;
  bossKilled: boolean;
  leverPulled?: boolean;
  backpackLoot: LootInstance[];
  safeBoxLoot: LootInstance[];
  totalExtractedValue: number;
  lostLoadoutValue: number;
  lostBackpackValue?: number;
  lostBackpackCount?: number;
  assetLossPenalty?: number;
  gearUsed?: Partial<Record<TacticalGearId, number>>;
  weaponId?: WeaponId;
  endingWeaponDurability?: number;
  jamsExperienced?: number;
}
