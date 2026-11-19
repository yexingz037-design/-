import {
  ARMOR_TIERS,
  ATTACHMENTS,
  OPERATORS,
  TACTICAL_GEAR,
  TACTICAL_MISSIONS,
  WEAPON_REPAIR_PARTS,
  WEAPON_SKINS,
  WEAPONS,
  getItemWeight,
} from '../data/gameData';
import {
  AmmoTier,
  AttachmentSlot,
  LootInstance,
  MapId,
  OperatorId,
  PlayerProfile,
  RaidHistoryRecord,
  RaidOutcome,
  StashItem,
  TacticalGearId,
  TacticalMedalId,
  TacticalMissionDef,
  TacticalSlotKey,
  WeaponId,
  WeaponSkinId,
} from '../types/game';

const STORAGE_KEY = 'project_zero_delta_profile_v1';
const GRANT_KEY = 'project_zero_delta_grant_10000yi_v1';
export const TARGET_INITIAL_CREDITS = 1_000_000_000_000; // 10000亿 哈夫币

const DEFAULT_UNLOCKED_SKINS: WeaponSkinId[] = [
  'factory_standard',
  'desert_digital',
  'forest_multicam',
  'gti_emerald',
  'crimson_obsidian',
];

const DEFAULT_UNLOCKED_GEAR: TacticalGearId[] = [
  'recon_drone',
  'laser_designator',
  'm18_smoke',
  'radio_recon',
  'signal_jammer',
  'm84_flashbang',
];

const DEFAULT_TACTICAL_GEAR: Record<TacticalSlotKey, TacticalGearId> = {
  Q: 'recon_drone',
  E: 'm18_smoke',
  X: 'radio_recon',
};

const FACTORY_SKIN_MIGRATION_KEY = 'project_zero_delta_factory_skins_v1';

function buildDefaultWeaponSkins(): Partial<Record<WeaponId, WeaponSkinId>> {
  const map: Partial<Record<WeaponId, WeaponSkinId>> = {};
  (Object.values(WEAPONS)).forEach((w) => {
    map[w.id] = 'factory_standard';
  });
  return map;
}

export function createDefaultProfile(): PlayerProfile {
  return {
    credits: TARGET_INITIAL_CREDITS,
    tacticalMedals: 0,
    medalInventory: {},
    missionProgress: {},
    claimedMissionIds: [],
    totalMissionCreditsEarned: 0,
    unlockedWeapons: ['m4a1'],
    unlockedAttachments: ['optic_red_dot', 'mag_fast'],
    unlockedSkins: [...DEFAULT_UNLOCKED_SKINS],
    unlockedGear: [...DEFAULT_UNLOCKED_GEAR],
    gearCooldowns: {},
    weaponDurability: { m4a1: 74 },
    stash: [
      {
        uid: 'starter_part_oil_1',
        templateId: 'gun_oil_kit',
        name: '军用枪械清洁养护油组',
        rarity: 'uncommon',
        category: 'weapon_part',
        value: 5200,
        weight: 0.7,
        acquiredAt: new Date().toISOString(),
      },
      {
        uid: 'starter_part_pin_1',
        templateId: 'precision_firing_pin',
        name: '钛合金精密击针组件',
        rarity: 'rare',
        category: 'weapon_part',
        value: 14200,
        weight: 0.45,
        acquiredAt: new Date().toISOString(),
      },
      {
        uid: 'starter_item_1',
        templateId: 'ssd',
        name: '固态数据硬盘',
        rarity: 'uncommon',
        category: 'electronics',
        value: 6500,
        weight: 0.5,
        acquiredAt: new Date().toISOString(),
      },
      {
        uid: 'starter_item_2',
        templateId: 'gold_watch',
        name: '军官镀金怀表',
        rarity: 'rare',
        category: 'collectible',
        value: 21000,
        weight: 0.35,
        acquiredAt: new Date().toISOString(),
      },
    ],
    loadout: {
      mapId: 'zero_dam',
      operatorId: 'luna',
      weaponId: 'm4a1',
      weaponSkins: buildDefaultWeaponSkins(),
      attachments: {
        optic: 'optic_red_dot',
        barrel: null,
        muzzle: null,
        grip: null,
        stock: null,
        mag: 'mag_fast',
      },
      armorTier: 2,
      ammoTier: 'standard',
      medkits: 2,
      armorPlates: 2,
      tacticalGear: { ...DEFAULT_TACTICAL_GEAR },
      backpackCapacity: 8,
      safeBoxCapacity: 2,
    },
    safeBoxUpgraded: false,
    backpackUpgraded: false,
    stats: {
      raidsPlayed: 0,
      raidsExtracted: 0,
      totalKills: 0,
      bossKills: 0,
      totalExtractedValue: 0,
      bestRaidValue: 0,
    },
    history: [],
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw) as PlayerProfile;
    if (!parsed || typeof parsed.credits !== 'number' || !parsed.loadout) {
      return createDefaultProfile();
    }
    parsed.loadout.mapId = parsed.loadout.mapId ?? 'zero_dam';
    parsed.unlockedSkins = parsed.unlockedSkins?.length
      ? Array.from(new Set([...DEFAULT_UNLOCKED_SKINS, ...parsed.unlockedSkins]))
      : [...DEFAULT_UNLOCKED_SKINS];
    parsed.unlockedGear = parsed.unlockedGear?.length
      ? Array.from(new Set([...DEFAULT_UNLOCKED_GEAR, ...parsed.unlockedGear]))
      : [...DEFAULT_UNLOCKED_GEAR];
    parsed.gearCooldowns = parsed.gearCooldowns || {};
    parsed.weaponDurability = parsed.weaponDurability || {};
    parsed.stash = (parsed.stash || []).map((item) => ({
      ...item,
      weight: getItemWeight(item.templateId, item.weight),
    }));
    parsed.tacticalMedals = parsed.tacticalMedals ?? 0;
    parsed.medalInventory = parsed.medalInventory || {};
    parsed.claimedMissionIds = parsed.claimedMissionIds || [];
    parsed.totalMissionCreditsEarned = parsed.totalMissionCreditsEarned ?? 0;
    if (!parsed.missionProgress) {
      const seeded: Record<string, number> = {};
      const stats = parsed.stats || {
        raidsPlayed: 0,
        raidsExtracted: 0,
        totalKills: 0,
        bossKills: 0,
        totalExtractedValue: 0,
        bestRaidValue: 0,
      };
      const gearTotalUses = Object.values(parsed.gearCooldowns).reduce(
        (acc, r) => acc + (r?.totalUses || 0),
        0
      );
      for (const m of TACTICAL_MISSIONS) {
        if (m.conditionType === 'extract_count' && !m.mapId) {
          seeded[m.id] = stats.raidsExtracted || 0;
        } else if (m.conditionType === 'extract_count' && m.mapId) {
          seeded[m.id] = (parsed.history || []).filter(
            (h) => h.extracted && h.mapId === m.mapId
          ).length;
        } else if (m.conditionType === 'kills_total') {
          seeded[m.id] = stats.totalKills || 0;
        } else if (m.conditionType === 'boss_kills') {
          seeded[m.id] = stats.bossKills || 0;
        } else if (m.conditionType === 'extract_value_total') {
          seeded[m.id] = stats.totalExtractedValue || 0;
        } else if (m.conditionType === 'single_raid_extract_value') {
          seeded[m.id] = stats.bestRaidValue || 0;
        } else if (m.conditionType === 'tactical_gear_uses') {
          seeded[m.id] = gearTotalUses;
        }
      }
      parsed.missionProgress = seeded;
    }
    const tg = parsed.loadout.tacticalGear;
    parsed.loadout.tacticalGear = {
      Q: tg?.Q && TACTICAL_GEAR[tg.Q]?.slot === 'Q' ? tg.Q : DEFAULT_TACTICAL_GEAR.Q,
      E: tg?.E && TACTICAL_GEAR[tg.E]?.slot === 'E' ? tg.E : DEFAULT_TACTICAL_GEAR.E,
      X: tg?.X && TACTICAL_GEAR[tg.X]?.slot === 'X' ? tg.X : DEFAULT_TACTICAL_GEAR.X,
    };
    const defaultSkins = buildDefaultWeaponSkins();
    if (!localStorage.getItem(FACTORY_SKIN_MIGRATION_KEY)) {
      parsed.loadout.weaponSkins = { ...defaultSkins };
      localStorage.setItem(FACTORY_SKIN_MIGRATION_KEY, '1');
      saveProfile(parsed);
    } else {
      parsed.loadout.weaponSkins = {
        ...defaultSkins,
        ...(parsed.loadout.weaponSkins || {}),
      };
    }
    if (!WEAPONS[parsed.loadout.weaponId]) {
      parsed.loadout.weaponId = 'm4a1';
    }
    parsed.loadout.attachments = {
      optic: parsed.loadout.attachments?.optic ?? null,
      barrel: parsed.loadout.attachments?.barrel ?? null,
      muzzle: parsed.loadout.attachments?.muzzle ?? null,
      grip: parsed.loadout.attachments?.grip ?? null,
      stock: parsed.loadout.attachments?.stock ?? null,
      mag: parsed.loadout.attachments?.mag ?? null,
    };
    if (!localStorage.getItem(GRANT_KEY)) {
      if (parsed.credits < TARGET_INITIAL_CREDITS) {
        parsed.credits = TARGET_INITIAL_CREDITS;
      }
      localStorage.setItem(GRANT_KEY, '1');
      saveProfile(parsed);
    }
    return parsed;
  } catch {
    return createDefaultProfile();
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore quota issues
  }
}

export function resetProfile(): PlayerProfile {
  const def = createDefaultProfile();
  saveProfile(def);
  return def;
}

export function getDeploymentCost(profile: PlayerProfile): number {
  const armor = ARMOR_TIERS.find((a) => a.tier === profile.loadout.armorTier) || ARMOR_TIERS[0];
  const medCost = profile.loadout.medkits * 1500;
  const plateCost = profile.loadout.armorPlates * 2000;
  const ammoCost = profile.loadout.ammoTier === 'ap' ? 6500 : 1200;
  const tg = profile.loadout.tacticalGear || DEFAULT_TACTICAL_GEAR;
  const gearCost =
    (TACTICAL_GEAR[tg.Q]?.deployCost || 0) +
    (TACTICAL_GEAR[tg.E]?.deployCost || 0) +
    (TACTICAL_GEAR[tg.X]?.deployCost || 0);
  return armor.price + medCost + plateCost + ammoCost + gearCost;
}

export function applyRaidOutcome(profile: PlayerProfile, outcome: RaidOutcome): PlayerProfile {
  const next = structuredClone(profile);
  next.stats.raidsPlayed += 1;
  next.stats.totalKills += outcome.kills;
  if (outcome.bossKilled) next.stats.bossKills += 1;

  const keptItems: LootInstance[] = outcome.extracted
    ? [...outcome.backpackLoot, ...outcome.safeBoxLoot]
    : [...outcome.safeBoxLoot];

  const newStashItems: StashItem[] = keptItems.map((item) => ({
    uid: item.uid,
    templateId: item.templateId,
    name: item.name,
    rarity: item.rarity,
    category: item.category,
    value: item.value,
    weight: getItemWeight(item.templateId, item.weight),
    acquiredAt: new Date().toISOString(),
  }));

  next.stash = [...newStashItems, ...next.stash];

  const keptValue = keptItems.reduce((acc, i) => acc + i.value, 0);
  if (outcome.extracted) {
    next.stats.raidsExtracted += 1;
    next.stats.totalExtractedValue += keptValue;
    if (keptValue > next.stats.bestRaidValue) {
      next.stats.bestRaidValue = keptValue;
    }
  } else {
    // Failing to pull lever & extract or falling in combat causes tangible asset loss
    const penalty = Math.max(0, Math.round(outcome.assetLossPenalty ?? outcome.lostLoadoutValue ?? 0));
    if (penalty > 0) {
      next.credits = Math.max(0, next.credits - penalty);
    }
  }

  const bestHighlight = [...keptItems].sort((a, b) => b.value - a.value)[0]?.name;

  const record: RaidHistoryRecord = {
    id: `raid_${Date.now()}`,
    mapId: outcome.mapId,
    extracted: outcome.extracted,
    operatorId: outcome.operatorId,
    kills: outcome.kills,
    lootValue: keptValue,
    durationSec: Math.round(outcome.durationSec),
    highlightItem: bestHighlight,
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
  };

  next.history = [record, ...next.history].slice(0, 12);

  // Update usage-based post-raid maintenance/recharge cooldowns for tactical gear
  const now = Date.now();
  const nextCooldowns = { ...(next.gearCooldowns || {}) };
  const equippedIds = Object.values(next.loadout.tacticalGear || DEFAULT_TACTICAL_GEAR);
  for (const gId of equippedIds) {
    const prevRec = nextCooldowns[gId];
    if (prevRec && !outcome.gearUsed?.[gId]) {
      nextCooldowns[gId] = {
        ...prevRec,
        lastRaidUses: 0,
      };
    }
  }
  if (outcome.gearUsed) {
    (Object.entries(outcome.gearUsed) as Array<[TacticalGearId, number | undefined]>).forEach(
      ([gearId, uses]) => {
        if (!uses || uses <= 0) return;
        const def = TACTICAL_GEAR[gearId];
        if (!def) return;
        const baseSec = Math.max(8, Math.round(def.cooldown * 1.1));
        const cooldownDurationSec = Math.min(60, Math.round(baseSec + (uses - 1) * 7));
        const prev = nextCooldowns[gearId];
        nextCooldowns[gearId] = {
          lastUsedAt: now,
          readyAt: now + cooldownDurationSec * 1000,
          lastRaidUses: uses,
          totalUses: (prev?.totalUses || 0) + uses,
          cooldownDurationSec,
        };
      }
    );
  }
  next.gearCooldowns = nextCooldowns;

  // Persist post-raid weapon wear / durability (KIA/unextracted suffers extra salvage wear)
  if (outcome.weaponId && typeof outcome.endingWeaponDurability === 'number') {
    const kiaWear = outcome.extracted ? 0 : 12;
    next.weaponDurability = {
      ...(next.weaponDurability || {}),
      [outcome.weaponId]: Math.max(
        5,
        Math.min(100, Number((outcome.endingWeaponDurability - kiaWear).toFixed(1)))
      ),
    };
  }

  // Update real-time extraction mission progress from raid outcome
  const nextProgress = { ...(next.missionProgress || {}) };
  const raidGearUses = outcome.gearUsed
    ? Object.values(outcome.gearUsed).reduce((acc, v) => acc + (v || 0), 0)
    : 0;

  for (const m of TACTICAL_MISSIONS) {
    const prevVal = nextProgress[m.id] || 0;
    if (m.conditionType === 'extract_count') {
      if (outcome.extracted && (!m.mapId || m.mapId === outcome.mapId)) {
        nextProgress[m.id] = prevVal + 1;
      }
    } else if (m.conditionType === 'kills_total') {
      if (!m.mapId || m.mapId === outcome.mapId) {
        nextProgress[m.id] = prevVal + outcome.kills;
      }
    } else if (m.conditionType === 'boss_kills') {
      if (outcome.bossKilled) {
        nextProgress[m.id] = prevVal + 1;
      }
    } else if (m.conditionType === 'extract_value_total') {
      if (outcome.extracted) {
        nextProgress[m.id] = prevVal + keptValue;
      }
    } else if (m.conditionType === 'single_raid_extract_value') {
      if (outcome.extracted) {
        nextProgress[m.id] = Math.max(prevVal, keptValue);
      }
    } else if (m.conditionType === 'tactical_gear_uses') {
      nextProgress[m.id] = prevVal + raidGearUses;
    }
  }
  next.missionProgress = nextProgress;

  saveProfile(next);
  return next;
}

export function selectMap(profile: PlayerProfile, mapId: MapId): PlayerProfile {
  const next = { ...profile, loadout: { ...profile.loadout, mapId } };
  saveProfile(next);
  return next;
}

export function selectOperator(profile: PlayerProfile, operatorId: OperatorId): PlayerProfile {
  const next = { ...profile, loadout: { ...profile.loadout, operatorId } };
  saveProfile(next);
  return next;
}

export function selectOrBuyWeapon(profile: PlayerProfile, weaponId: WeaponId): { profile: PlayerProfile; error?: string } {
  const next = structuredClone(profile);
  if (!next.unlockedWeapons.includes(weaponId)) {
    const cost = WEAPONS[weaponId].price;
    if (next.credits < cost) {
      return { profile, error: `哈夫币不足，需要 ${cost.toLocaleString()} 哈夫币解锁该枪械` };
    }
    next.credits -= cost;
    next.unlockedWeapons.push(weaponId);
  }
  next.loadout.weaponId = weaponId;
  saveProfile(next);
  return { profile: next };
}

export function equipOrBuyAttachment(
  profile: PlayerProfile,
  slot: AttachmentSlot,
  attachmentId: string | null
): { profile: PlayerProfile; error?: string } {
  const next = structuredClone(profile);
  if (attachmentId && !next.unlockedAttachments.includes(attachmentId)) {
    const def = ATTACHMENTS.find((a) => a.id === attachmentId);
    if (!def) return { profile };
    if (next.credits < def.price) {
      return { profile, error: `哈夫币不足，需要 ${def.price.toLocaleString()} 哈夫币购买该配件` };
    }
    next.credits -= def.price;
    next.unlockedAttachments.push(attachmentId);
  }
  next.loadout.attachments[slot] = attachmentId;
  saveProfile(next);
  return { profile: next };
}

export function resetWeaponAttachments(profile: PlayerProfile): PlayerProfile {
  const next = structuredClone(profile);
  next.loadout.attachments = {
    optic: null,
    barrel: null,
    muzzle: null,
    grip: null,
    stock: null,
    mag: null,
  };
  saveProfile(next);
  return next;
}

export function equipOrBuyWeaponSkin(
  profile: PlayerProfile,
  weaponId: WeaponId,
  skinId: WeaponSkinId
): { profile: PlayerProfile; error?: string } {
  const next = structuredClone(profile);
  const owned = next.unlockedSkins ?? ['factory_standard'];
  if (!owned.includes(skinId)) {
    const def = WEAPON_SKINS.find((s) => s.id === skinId);
    if (!def) return { profile };
    if (next.credits < def.price) {
      return { profile, error: `哈夫币不足，需要 ${def.price.toLocaleString()} 哈夫币解锁涂装「${def.name}」` };
    }
    next.credits -= def.price;
    owned.push(skinId);
  }
  next.unlockedSkins = owned;
  next.loadout.weaponSkins = {
    ...(next.loadout.weaponSkins || {}),
    [weaponId]: skinId,
  };
  saveProfile(next);
  return { profile: next };
}

export function applySkinToAllWeapons(profile: PlayerProfile, skinId: WeaponSkinId): PlayerProfile {
  const next = structuredClone(profile);
  const owned = next.unlockedSkins ?? [...DEFAULT_UNLOCKED_SKINS];
  if (!owned.includes(skinId)) {
    const def = WEAPON_SKINS.find((s) => s.id === skinId);
    if (def && next.credits >= def.price) {
      next.credits -= def.price;
      owned.push(skinId);
      next.unlockedSkins = owned;
    } else if (def) {
      return profile;
    }
  }
  const allSkins: Partial<Record<WeaponId, WeaponSkinId>> = {};
  (Object.keys(WEAPONS) as WeaponId[]).forEach((id) => {
    allSkins[id] = skinId;
  });
  next.loadout.weaponSkins = allSkins;
  saveProfile(next);
  return next;
}

export function updateTacticalSupplies(
  profile: PlayerProfile,
  patch: Partial<{ armorTier: number; ammoTier: AmmoTier; medkits: number; armorPlates: number }>
): PlayerProfile {
  const next = {
    ...profile,
    loadout: {
      ...profile.loadout,
      ...patch,
    },
  };
  saveProfile(next);
  return next;
}

export function equipOrBuyTacticalGear(
  profile: PlayerProfile,
  slot: TacticalSlotKey,
  gearId: TacticalGearId
): { profile: PlayerProfile; error?: string } {
  const def = TACTICAL_GEAR[gearId];
  if (!def || def.slot !== slot) return { profile };
  const next = structuredClone(profile);
  const owned = next.unlockedGear ?? [...DEFAULT_UNLOCKED_GEAR];
  if (!owned.includes(gearId) && def.price > 0) {
    if (next.credits < def.price) {
      return { profile, error: `哈夫币不足，需要 ${def.price.toLocaleString()} 哈夫币解锁「${def.name}」` };
    }
    next.credits -= def.price;
    owned.push(gearId);
  }
  next.unlockedGear = owned;
  next.loadout.tacticalGear = {
    ...(next.loadout.tacticalGear || DEFAULT_TACTICAL_GEAR),
    [slot]: gearId,
  };
  saveProfile(next);
  return { profile: next };
}

export function applyOperatorRecommendedGear(
  profile: PlayerProfile,
  operatorId: OperatorId
): { profile: PlayerProfile; unlockedNames: string[]; error?: string } {
  const op = OPERATORS[operatorId];
  if (!op) return { profile, unlockedNames: [] };
  const next = structuredClone(profile);
  const owned = new Set<TacticalGearId>(next.unlockedGear ?? DEFAULT_UNLOCKED_GEAR);
  const unlockedNames: string[] = [];

  for (const slot of ['Q', 'E', 'X'] as TacticalSlotKey[]) {
    const gId = op.recommendedGear[slot];
    const def = TACTICAL_GEAR[gId];
    if (!owned.has(gId) && def.price > 0) {
      if (next.credits < def.price) {
        return {
          profile,
          unlockedNames: [],
          error: `哈夫币不足，需要 ${def.price.toLocaleString()} 解锁推荐装备「${def.name}」`,
        };
      }
      next.credits -= def.price;
      owned.add(gId);
      unlockedNames.push(def.shortName);
    }
  }

  next.unlockedGear = Array.from(owned);
  next.loadout.tacticalGear = { ...op.recommendedGear };
  saveProfile(next);
  return { profile: next, unlockedNames };
}

export function sellStashItem(profile: PlayerProfile, uid: string): PlayerProfile {
  const next = structuredClone(profile);
  const idx = next.stash.findIndex((i) => i.uid === uid);
  if (idx === -1) return profile;
  const [removed] = next.stash.splice(idx, 1);
  next.credits += removed.value;
  saveProfile(next);
  return next;
}

export function sellAllStashItems(profile: PlayerProfile, maxRarity?: 'common' | 'uncommon' | 'rare'): PlayerProfile {
  const next = structuredClone(profile);
  const rarityRank = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
  const threshold = maxRarity ? rarityRank[maxRarity] : 5;

  let earned = 0;
  next.stash = next.stash.filter((item) => {
    // Preserve dedicated weapon repair parts during bulk loot liquidation
    if (item.category === 'weapon_part') return true;
    if (rarityRank[item.rarity] <= threshold) {
      earned += item.value;
      return false;
    }
    return true;
  });
  next.credits += earned;
  saveProfile(next);
  return next;
}

export function getWeaponDurability(profile: PlayerProfile, weaponId: WeaponId): number {
  const val = profile.weaponDurability?.[weaponId];
  return typeof val === 'number' ? Math.max(0, Math.min(100, val)) : 100;
}

export function getRepairPartCounts(profile: PlayerProfile): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of profile.stash) {
    if (WEAPON_REPAIR_PARTS[item.templateId]) {
      counts[item.templateId] = (counts[item.templateId] || 0) + 1;
    }
  }
  return counts;
}

export function repairWeaponWithPart(
  profile: PlayerProfile,
  weaponId: WeaponId,
  partTemplateId: string
): { profile: PlayerProfile; restoredAmount: number; newDurability: number; error?: string } {
  const partDef = WEAPON_REPAIR_PARTS[partTemplateId];
  if (!partDef) {
    return { profile, restoredAmount: 0, newDurability: getWeaponDurability(profile, weaponId), error: '未识别的维修零件型号' };
  }

  const currentDur = getWeaponDurability(profile, weaponId);
  if (currentDur >= 100) {
    return {
      profile,
      restoredAmount: 0,
      newDurability: 100,
      error: '该武器当前处于 100% 满耐久状态，无需消耗零件',
    };
  }

  const next = structuredClone(profile);
  const idx = next.stash.findIndex((i) => i.templateId === partTemplateId);
  if (idx === -1) {
    return {
      profile,
      restoredAmount: 0,
      newDurability: currentDur,
      error: `仓库中暂无「${partDef.name}」，请前往战区搜刮武器箱或补给箱`,
    };
  }

  next.stash.splice(idx, 1);
  const newDurability = Math.min(100, Number((currentDur + partDef.restoreDurability).toFixed(1)));
  const restoredAmount = Number((newDurability - currentDur).toFixed(1));
  next.weaponDurability = {
    ...(next.weaponDurability || {}),
    [weaponId]: newDurability,
  };
  saveProfile(next);
  return { profile: next, restoredAmount, newDurability };
}

export function autoRepairWeaponWithParts(
  profile: PlayerProfile,
  weaponId: WeaponId
): { profile: PlayerProfile; partsUsed: number; restoredAmount: number; newDurability: number; error?: string } {
  const currentDur = getWeaponDurability(profile, weaponId);
  if (currentDur >= 100) {
    return {
      profile,
      partsUsed: 0,
      restoredAmount: 0,
      newDurability: 100,
      error: '该武器已达 100% 最佳工况，无需维护',
    };
  }

  const next = structuredClone(profile);
  let dur = currentDur;
  let partsUsed = 0;

  while (dur < 100) {
    const missing = 100 - dur;
    // Collect available part indices in stash with restore values
    const candidates = next.stash
      .map((item, idx) => ({ idx, def: WEAPON_REPAIR_PARTS[item.templateId] }))
      .filter((x): x is { idx: number; def: NonNullable<typeof x.def> } => Boolean(x.def));

    if (candidates.length === 0) break;

    // Pick smallest part that reaches 100, otherwise largest available part
    const exactOrOver = candidates
      .filter((c) => c.def.restoreDurability >= missing)
      .sort((a, b) => a.def.restoreDurability - b.def.restoreDurability);
    const chosen =
      exactOrOver[0] || candidates.sort((a, b) => b.def.restoreDurability - a.def.restoreDurability)[0];

    next.stash.splice(chosen.idx, 1);
    dur = Math.min(100, Number((dur + chosen.def.restoreDurability).toFixed(1)));
    partsUsed += 1;
  }

  if (partsUsed === 0) {
    return {
      profile,
      partsUsed: 0,
      restoredAmount: 0,
      newDurability: currentDur,
      error: '仓库内暂无可用维修零件，请前往战区搜刮武器箱或补给箱',
    };
  }

  next.weaponDurability = {
    ...(next.weaponDurability || {}),
    [weaponId]: dur,
  };
  saveProfile(next);
  return {
    profile: next,
    partsUsed,
    restoredAmount: Number((dur - currentDur).toFixed(1)),
    newDurability: dur,
  };
}

export function upgradeContainer(
  profile: PlayerProfile,
  type: 'safebox' | 'backpack'
): { profile: PlayerProfile; error?: string } {
  const next = structuredClone(profile);
  if (type === 'safebox') {
    if (next.safeBoxUpgraded) return { profile };
    const cost = 65000;
    if (next.credits < cost) return { profile, error: '需要 65,000 哈夫币升级 4 格安全箱' };
    next.credits -= cost;
    next.safeBoxUpgraded = true;
    next.loadout.safeBoxCapacity = 4;
  } else {
    if (next.backpackUpgraded) return { profile };
    const cost = 42000;
    if (next.credits < cost) return { profile, error: '需要 42,000 哈夫币升级大型战术背包' };
    next.credits -= cost;
    next.backpackUpgraded = true;
    next.loadout.backpackCapacity = 12;
  }
  saveProfile(next);
  return { profile: next };
}

export interface MissionStatusItem {
  mission: TacticalMissionDef;
  current: number;
  target: number;
  pct: number;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
}

export interface MissionSystemSummary {
  items: MissionStatusItem[];
  completedCount: number;
  claimedCount: number;
  claimableCount: number;
  totalMissions: number;
  totalMedals: number;
  totalMissionCreditsEarned: number;
}

export function getMissionProgressSummary(profile: PlayerProfile): MissionSystemSummary {
  const progressMap = profile.missionProgress || {};
  const claimedSet = new Set(profile.claimedMissionIds || []);

  const items: MissionStatusItem[] = TACTICAL_MISSIONS.map((mission) => {
    const rawCurrent = progressMap[mission.id] || 0;
    const current = Math.min(mission.targetCount, rawCurrent);
    const completed = rawCurrent >= mission.targetCount;
    const claimed = claimedSet.has(mission.id);
    const claimable = completed && !claimed;
    const pct = Math.min(100, Math.round((current / Math.max(1, mission.targetCount)) * 100));
    return {
      mission,
      current,
      target: mission.targetCount,
      pct,
      completed,
      claimed,
      claimable,
    };
  });

  const completedCount = items.filter((i) => i.completed).length;
  const claimedCount = items.filter((i) => i.claimed).length;
  const claimableCount = items.filter((i) => i.claimable).length;

  return {
    items,
    completedCount,
    claimedCount,
    claimableCount,
    totalMissions: items.length,
    totalMedals: profile.tacticalMedals || 0,
    totalMissionCreditsEarned: profile.totalMissionCreditsEarned || 0,
  };
}

export function claimMissionReward(
  profile: PlayerProfile,
  missionId: string
): { profile: PlayerProfile; mission?: TacticalMissionDef; error?: string } {
  const mission = TACTICAL_MISSIONS.find((m) => m.id === missionId);
  if (!mission) return { profile, error: '未找到指定任务' };

  const progress = profile.missionProgress?.[missionId] || 0;
  const claimed = new Set(profile.claimedMissionIds || []);
  if (claimed.has(missionId)) {
    return { profile, error: '该任务奖励已领取' };
  }
  if (progress < mission.targetCount) {
    return { profile, error: '任务尚未达成完成条件' };
  }

  const next = structuredClone(profile);
  next.credits += mission.rewardCredits;
  next.totalMissionCreditsEarned = (next.totalMissionCreditsEarned || 0) + mission.rewardCredits;
  next.tacticalMedals = (next.tacticalMedals || 0) + mission.rewardMedalCount;

  const inv: Partial<Record<TacticalMedalId, number>> = { ...(next.medalInventory || {}) };
  inv[mission.rewardMedalId] = (inv[mission.rewardMedalId] || 0) + mission.rewardMedalCount;
  next.medalInventory = inv;

  next.claimedMissionIds = [...(next.claimedMissionIds || []), missionId];
  saveProfile(next);
  return { profile: next, mission };
}

export function claimAllCompletedMissions(profile: PlayerProfile): {
  profile: PlayerProfile;
  claimedCount: number;
  creditsAwarded: number;
  medalsAwarded: number;
} {
  const summary = getMissionProgressSummary(profile);
  const claimableItems = summary.items.filter((i) => i.claimable);
  if (claimableItems.length === 0) {
    return { profile, claimedCount: 0, creditsAwarded: 0, medalsAwarded: 0 };
  }

  const next = structuredClone(profile);
  const claimedSet = new Set(next.claimedMissionIds || []);
  const inv: Partial<Record<TacticalMedalId, number>> = { ...(next.medalInventory || {}) };
  let creditsAwarded = 0;
  let medalsAwarded = 0;

  for (const item of claimableItems) {
    const m = item.mission;
    claimedSet.add(m.id);
    creditsAwarded += m.rewardCredits;
    medalsAwarded += m.rewardMedalCount;
    inv[m.rewardMedalId] = (inv[m.rewardMedalId] || 0) + m.rewardMedalCount;
  }

  next.credits += creditsAwarded;
  next.totalMissionCreditsEarned = (next.totalMissionCreditsEarned || 0) + creditsAwarded;
  next.tacticalMedals = (next.tacticalMedals || 0) + medalsAwarded;
  next.medalInventory = inv;
  next.claimedMissionIds = Array.from(claimedSet);

  saveProfile(next);
  return {
    profile: next,
    claimedCount: claimableItems.length,
    creditsAwarded,
    medalsAwarded,
  };
}
