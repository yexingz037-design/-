import * as THREE from 'three';
import { WEAPON_SKINS } from '../data/gameData';
import { AttachmentSlot, EnemyKind, OperatorId, WeaponId, WeaponSkinId } from '../types/game';
import {
  createIrisTexture,
  createTacticalFabricTextures,
  createWeaponSkinTextures,
  getSkinPoreMaps,
  getWeaponMetalMaps,
  getWeatheredArmorMaps,
} from './textures';

export interface HumanoidRig {
  root: THREE.Group;
  pelvis: THREE.Group;
  upperBody: THREE.Group;
  head: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  weaponMount: THREE.Group;
  muzzleTip: THREE.Object3D;
  exoGlowMeshes: THREE.Mesh[];
  companionMesh?: THREE.Object3D;
  shieldMesh?: THREE.Mesh;
}

interface OperatorPalette {
  suit: number;
  armor: number;
  accent: number;
  hair: number;
  hairTip: number;
  skin: number;
  boot: number;
  pattern: 'ripstop' | 'hex' | 'multicam';
  female: boolean;
}

const OP_COLORS: Record<OperatorId, OperatorPalette> = {
  luna: {
    suit: 0x1e252e,
    armor: 0x2d3540,
    accent: 0xc28327,
    hair: 0xc5bfb3,
    hairTip: 0x8c877d,
    skin: 0xd1a78f,
    boot: 0x101318,
    pattern: 'hex',
    female: true,
  },
  stinger: {
    suit: 0x182622,
    armor: 0x233630,
    accent: 0x198765,
    hair: 0x1c2120,
    hairTip: 0x2d3835,
    skin: 0xc99c84,
    boot: 0x0e1412,
    pattern: 'ripstop',
    female: false,
  },
  dwolf: {
    suit: 0x181a20,
    armor: 0x292d38,
    accent: 0xb93434,
    hair: 0x1a1a1d,
    hairTip: 0x3b2323,
    skin: 0xc49780,
    boot: 0x101116,
    pattern: 'hex',
    female: false,
  },
  shepherd: {
    suit: 0x1c232d,
    armor: 0x343d4a,
    accent: 0x3386b0,
    hair: 0x232326,
    hairTip: 0x3a3a40,
    skin: 0xb88970,
    boot: 0x10141c,
    pattern: 'ripstop',
    female: false,
  },
  hackclaw: {
    suit: 0x191722,
    armor: 0x2a2638,
    accent: 0x7e42b8,
    hair: 0x1a1820,
    hairTip: 0x453559,
    skin: 0xd4ac98,
    boot: 0x110f17,
    pattern: 'hex',
    female: true,
  },
  vyron: {
    suit: 0x1c2026,
    armor: 0x303640,
    accent: 0xc9621c,
    hair: 0x18181b,
    hairTip: 0x36363c,
    skin: 0xc89a82,
    boot: 0x101217,
    pattern: 'ripstop',
    female: false,
  },
  uluru: {
    suit: 0x453d2e,
    armor: 0x695943,
    accent: 0xba8d14,
    hair: 0x463b30,
    hairTip: 0x6b655e,
    skin: 0xbf9177,
    boot: 0x211d17,
    pattern: 'multicam',
    female: false,
  },
  toxik: {
    suit: 0x142226,
    armor: 0x21353b,
    accent: 0x1c8b9e,
    hair: 0xbabec4,
    hairTip: 0x62747d,
    skin: 0xd1a995,
    boot: 0x0d1517,
    pattern: 'hex',
    female: true,
  },
};

function createChamferPlateGeo(w: number, h: number, depth: number, bevel: number = 0.014): THREE.ExtrudeGeometry {
  const hw = w / 2 - bevel;
  const hh = h / 2 - bevel;
  const cutX = w * 0.16;
  const cutY = h * 0.16;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + cutX, hh);
  shape.lineTo(hw - cutX, hh);
  shape.lineTo(hw, hh - cutY);
  shape.lineTo(hw, -hh + cutY * 0.45);
  shape.lineTo(hw - cutX * 0.6, -hh);
  shape.lineTo(-hw + cutX * 0.6, -hh);
  shape.lineTo(-hw, -hh + cutY * 0.45);
  shape.lineTo(-hw, hh - cutY);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - bevel * 2),
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  geo.center();
  return geo;
}

type WeaponArch =
  | 'ar_m4'
  | 'ar_k416'
  | 'ar_ci19'
  | 'ak_classic'
  | 'ak_modern'
  | 'bullpup_aug'
  | 'bullpup_p90'
  | 'bullpup_ash12'
  | 'smg_vector'
  | 'smg_mp5'
  | 'smg_sr3m'
  | 'scar'
  | 'dmr_sr25'
  | 'vss'
  | 'sniper_awm'
  | 'sniper_r93'
  | 'lmg_m249'
  | 'lmg_pkm'
  | 'shotgun_s12k'
  | 'shotgun_m870';

interface WeaponBlueprint {
  arch: WeaponArch;
  // Real-world relative dimensions (1 unit ≈ 1m)
  upperLen: number;
  upperHeight: number;
  upperWidth: number;
  lowerLen: number;
  handguardLen: number;
  barrelLen: number;
  barrelRadius: number;
  barrelY: number;
  handguardStartZ: number;
  receiverStartZ: number;
  stockLen: number;
  // Authentic Delta Force factory color palette
  upperColor: number;
  lowerColor: number;
  handguardColor: number;
  stockColor: number;
  magColor: number;
  gripColor: number;
  railColor: number;
  barrelTone: 'blued' | 'stainless' | 'matte_black' | 'carbon';
  woodFurniture?: boolean;
  curvedMag?: boolean;
  magAngle?: number;
  magSize: [number, number, number]; // width, height, depth
  hasBipod?: boolean;
  hasCarryHandle?: boolean;
  integralSuppressor?: boolean;
}

const WEAPON_BLUEPRINTS: Record<WeaponId, WeaponBlueprint> = {
  // 1. M4A1 (~0.83m): Matte gunmetal receiver, KAC quad-rail + dark rail panels, A-frame FSP, SOPMOD crane stock, grey STANAG mag
  m4a1: {
    arch: 'ar_m4',
    upperLen: 0.23,
    upperHeight: 0.062,
    upperWidth: 0.048,
    lowerLen: 0.21,
    handguardLen: 0.21,
    barrelLen: 0.36,
    barrelRadius: 0.013,
    barrelY: 0.022,
    handguardStartZ: 0.145,
    receiverStartZ: 0.025,
    stockLen: 0.23,
    upperColor: 0x202731,
    lowerColor: 0x1b2129,
    handguardColor: 0x1e2530,
    stockColor: 0x171b22,
    magColor: 0x3b4452,
    gripColor: 0x161a20,
    railColor: 0x333c48,
    barrelTone: 'matte_black',
    magAngle: 0.11,
    magSize: [0.026, 0.165, 0.064],
  },
  // 2. K416 (~0.79m): Taller HK416 piston upper, bronze-tan DDC Geissele M-LOK handguard, HK E1 stock, windowed black PMAG
  k416: {
    arch: 'ar_k416',
    upperLen: 0.22,
    upperHeight: 0.072,
    upperWidth: 0.05,
    lowerLen: 0.21,
    handguardLen: 0.22,
    barrelLen: 0.30,
    barrelRadius: 0.014,
    barrelY: 0.024,
    handguardStartZ: 0.14,
    receiverStartZ: 0.025,
    stockLen: 0.22,
    upperColor: 0x191e26,
    lowerColor: 0x161a22,
    handguardColor: 0x9b7a4f,
    stockColor: 0x232830,
    magColor: 0x171a20,
    gripColor: 0x1a1e24,
    railColor: 0x856842,
    barrelTone: 'matte_black',
    magAngle: 0.11,
    magSize: [0.027, 0.165, 0.065],
  },
  // 3. CI-19 / QBZ-191 (~0.86m): Sleek dark titanium-slate monolithic top rail, octagonal vented handguard, telescoping stock
  ci19: {
    arch: 'ar_ci19',
    upperLen: 0.27,
    upperHeight: 0.066,
    upperWidth: 0.048,
    lowerLen: 0.24,
    handguardLen: 0.23,
    barrelLen: 0.36,
    barrelRadius: 0.014,
    barrelY: 0.022,
    handguardStartZ: 0.155,
    receiverStartZ: 0.02,
    stockLen: 0.24,
    upperColor: 0x262e39,
    lowerColor: 0x1f252e,
    handguardColor: 0x232a35,
    stockColor: 0x202630,
    magColor: 0x1a1f26,
    gripColor: 0x181c22,
    railColor: 0x3b4554,
    barrelTone: 'matte_black',
    curvedMag: true,
    magSize: [0.028, 0.17, 0.064],
  },
  // 4. AKM (~0.89m): Blued-steel stamped receiver, warm reddish-amber birch wood handguard & fixed wood stock, bakelite grip & curved mag, 45° slant brake
  akm: {
    arch: 'ak_classic',
    upperLen: 0.26,
    upperHeight: 0.068,
    upperWidth: 0.046,
    lowerLen: 0.25,
    handguardLen: 0.175,
    barrelLen: 0.38,
    barrelRadius: 0.014,
    barrelY: 0.02,
    handguardStartZ: 0.14,
    receiverStartZ: 0.01,
    stockLen: 0.24,
    upperColor: 0x1c2128,
    lowerColor: 0x181c22,
    handguardColor: 0x824423,
    stockColor: 0x7c3f20,
    magColor: 0x994a22,
    gripColor: 0x72371c,
    railColor: 0x323942,
    barrelTone: 'blued',
    woodFurniture: true,
    curvedMag: true,
    magSize: [0.028, 0.195, 0.066],
  },
  // 5. AK-12 (~0.88m): Matte tactical black polymer & steel, full Picatinny ribbed dust cover, angled ventilated handguard, EVO folding stock, slotted brake
  ak12: {
    arch: 'ak_modern',
    upperLen: 0.27,
    upperHeight: 0.072,
    upperWidth: 0.048,
    lowerLen: 0.25,
    handguardLen: 0.20,
    barrelLen: 0.37,
    barrelRadius: 0.014,
    barrelY: 0.022,
    handguardStartZ: 0.145,
    receiverStartZ: 0.01,
    stockLen: 0.23,
    upperColor: 0x161a21,
    lowerColor: 0x13171d,
    handguardColor: 0x1b2028,
    stockColor: 0x171b22,
    magColor: 0x191d24,
    gripColor: 0x14181e,
    railColor: 0x2f3640,
    barrelTone: 'matte_black',
    curvedMag: true,
    magSize: [0.027, 0.185, 0.064],
  },
  // 6. AUG A3 (~0.80m): Iconic Steyr Olive Drab (#495b3d) continuous bullpup chassis, thumbhole guard, folding vertical grip, amber translucent waffle mag
  aug: {
    arch: 'bullpup_aug',
    upperLen: 0.44,
    upperHeight: 0.086,
    upperWidth: 0.054,
    lowerLen: 0.42,
    handguardLen: 0.14,
    barrelLen: 0.28,
    barrelRadius: 0.013,
    barrelY: 0.026,
    handguardStartZ: 0.21,
    receiverStartZ: -0.02,
    stockLen: 0.08,
    upperColor: 0x485a3c,
    lowerColor: 0x485a3c,
    handguardColor: 0x485a3c,
    stockColor: 0x3b4a31,
    magColor: 0x7d5d2b,
    gripColor: 0x485a3c,
    railColor: 0x262c34,
    barrelTone: 'matte_black',
    magAngle: 0.06,
    magSize: [0.028, 0.165, 0.066],
  },
  // 7. KRISS Vector (~0.59m): Compact Super-V SMG, high monolithic rail, huge vertical downward housing, LOW barrel axis, tilted Glock mag, slim wire stock
  vector: {
    arch: 'smg_vector',
    upperLen: 0.26,
    upperHeight: 0.056,
    upperWidth: 0.048,
    lowerLen: 0.22,
    handguardLen: 0.11,
    barrelLen: 0.135,
    barrelRadius: 0.013,
    barrelY: -0.008,
    handguardStartZ: 0.145,
    receiverStartZ: 0.03,
    stockLen: 0.19,
    upperColor: 0x3a424d,
    lowerColor: 0x161a21,
    handguardColor: 0x1a1f27,
    stockColor: 0x171b22,
    magColor: 0x222730,
    gripColor: 0x14171d,
    railColor: 0x4b5563,
    barrelTone: 'matte_black',
    magAngle: -0.26,
    magSize: [0.024, 0.185, 0.038],
  },
  // 8. MP5 (~0.68m): HK satin black, upper cylindrical cocking tube above barrel, tapered wide tropical handguard, curved 9mm mag, A3 sliding wire stock
  mp5: {
    arch: 'smg_mp5',
    upperLen: 0.25,
    upperHeight: 0.058,
    upperWidth: 0.042,
    lowerLen: 0.17,
    handguardLen: 0.155,
    barrelLen: 0.185,
    barrelRadius: 0.012,
    barrelY: 0.014,
    handguardStartZ: 0.135,
    receiverStartZ: 0.02,
    stockLen: 0.21,
    upperColor: 0x1b2028,
    lowerColor: 0x14181f,
    handguardColor: 0x161a22,
    stockColor: 0x242b35,
    magColor: 0x1f252f,
    gripColor: 0x14171e,
    railColor: 0x323a46,
    barrelTone: 'blued',
    curvedMag: true,
    magSize: [0.022, 0.165, 0.042],
  },
  // 9. P90 (~0.50m): Shortest weapon! Closed-loop thumbhole charcoal polymer PDW, top horizontal amber 50rd translucent magazine, no long protruding barrel
  p90: {
    arch: 'bullpup_p90',
    upperLen: 0.36,
    upperHeight: 0.072,
    upperWidth: 0.052,
    lowerLen: 0.38,
    handguardLen: 0.08,
    barrelLen: 0.05,
    barrelRadius: 0.013,
    barrelY: 0.015,
    handguardStartZ: 0.19,
    receiverStartZ: -0.02,
    stockLen: 0.06,
    upperColor: 0x1e222b,
    lowerColor: 0x1b1f27,
    handguardColor: 0x1b1f27,
    stockColor: 0x181c24,
    magColor: 0x805a26,
    gripColor: 0x1b1f27,
    railColor: 0x343c48,
    barrelTone: 'matte_black',
    magSize: [0.046, 0.028, 0.26],
  },
  // 10. SR-3M (~0.65m): Compact Russian 9x39 Vikhr in dark plum/charcoal, stubby vented handguard with folding foregrip, side-folding wire stock
  sr3m: {
    arch: 'smg_sr3m',
    upperLen: 0.23,
    upperHeight: 0.062,
    upperWidth: 0.044,
    lowerLen: 0.22,
    handguardLen: 0.145,
    barrelLen: 0.185,
    barrelRadius: 0.014,
    barrelY: 0.018,
    handguardStartZ: 0.125,
    receiverStartZ: 0.01,
    stockLen: 0.21,
    upperColor: 0x27202c,
    lowerColor: 0x1c1821,
    handguardColor: 0x1e1a24,
    stockColor: 0x2b313b,
    magColor: 0x2d2233,
    gripColor: 0x1b1720,
    railColor: 0x3a3644,
    barrelTone: 'blued',
    curvedMag: true,
    magSize: [0.025, 0.175, 0.054],
  },
  // 11. SCAR-H (~0.94m): Signature FN Flat Dark Earth (FDE Sand-Tan) two-tone upper/lower, UGG-boot folding stock, exposed FSP + straight 20rd FDE mag
  scarh: {
    arch: 'scar',
    upperLen: 0.36,
    upperHeight: 0.076,
    upperWidth: 0.056,
    lowerLen: 0.24,
    handguardLen: 0.19,
    barrelLen: 0.38,
    barrelRadius: 0.016,
    barrelY: 0.024,
    handguardStartZ: 0.17,
    receiverStartZ: 0.02,
    stockLen: 0.25,
    upperColor: 0xb79a6b,
    lowerColor: 0x997d52,
    handguardColor: 0xb79a6b,
    stockColor: 0xb09264,
    magColor: 0xa6895b,
    gripColor: 0x22262e,
    railColor: 0x272b33,
    barrelTone: 'matte_black',
    magAngle: 0.06,
    magSize: [0.032, 0.155, 0.072],
  },
  // 12. ASh-12 (~0.72m): Massive chunky 12.7mm slab bullpup, towering carry handle, giant rectangular twin-baffle muzzle brake, wide straight 20rd rear mag
  ash12: {
    arch: 'bullpup_ash12',
    upperLen: 0.44,
    upperHeight: 0.104,
    upperWidth: 0.066,
    lowerLen: 0.44,
    handguardLen: 0.12,
    barrelLen: 0.19,
    barrelRadius: 0.022,
    barrelY: 0.012,
    handguardStartZ: 0.21,
    receiverStartZ: -0.02,
    stockLen: 0.06,
    upperColor: 0x252930,
    lowerColor: 0x1c2026,
    handguardColor: 0x1f232a,
    stockColor: 0x16191f,
    magColor: 0x20242c,
    gripColor: 0x16191f,
    railColor: 0x3b424e,
    barrelTone: 'matte_black',
    hasCarryHandle: true,
    magAngle: 0.04,
    magSize: [0.04, 0.185, 0.084],
  },
  // 13. SR-25 (~1.07m): Long precision 7.62 DMR, tungsten-black AR-10 billet receiver, 15" free-float M-LOK handguard, Magpul PRS sniper stock, straight 20rd mag, bipod
  sr25: {
    arch: 'dmr_sr25',
    upperLen: 0.27,
    upperHeight: 0.066,
    upperWidth: 0.052,
    lowerLen: 0.25,
    handguardLen: 0.34,
    barrelLen: 0.51,
    barrelRadius: 0.016,
    barrelY: 0.022,
    handguardStartZ: 0.16,
    receiverStartZ: 0.02,
    stockLen: 0.26,
    upperColor: 0x2a313c,
    lowerColor: 0x222832,
    handguardColor: 0x272e38,
    stockColor: 0x1a1f27,
    magColor: 0x20252e,
    gripColor: 0x171b22,
    railColor: 0x414b59,
    barrelTone: 'stainless',
    hasBipod: true,
    magAngle: 0.05,
    magSize: [0.031, 0.15, 0.072],
  },
  // 14. VSS Vintorez (~0.89m): Plum-black AK receiver, massive matte charcoal integral cylindrical suppressor, warm walnut skeleton stock, short 20rd mag
  vss: {
    arch: 'vss',
    upperLen: 0.24,
    upperHeight: 0.064,
    upperWidth: 0.044,
    lowerLen: 0.22,
    handguardLen: 0.12,
    barrelLen: 0.38,
    barrelRadius: 0.025,
    barrelY: 0.018,
    handguardStartZ: 0.12,
    receiverStartZ: 0.01,
    stockLen: 0.25,
    upperColor: 0x241f29,
    lowerColor: 0x1b1820,
    handguardColor: 0x1c1e24,
    stockColor: 0x6c3e23,
    magColor: 0x28212e,
    gripColor: 0x6c3e23,
    railColor: 0x353944,
    barrelTone: 'carbon',
    woodFurniture: true,
    integralSuppressor: true,
    magAngle: 0.08,
    magSize: [0.025, 0.145, 0.056],
  },
  // 15. AWM (~1.24m): Longest weapon! Accuracy International British Sage/Olive Green (#4b6143) thumbhole chassis, long stainless/dark heavy barrel, AI 2-port brake, bipod
  awm: {
    arch: 'sniper_awm',
    upperLen: 0.28,
    upperHeight: 0.058,
    upperWidth: 0.054,
    lowerLen: 0.44,
    handguardLen: 0.24,
    barrelLen: 0.65,
    barrelRadius: 0.018,
    barrelY: 0.024,
    handguardStartZ: 0.15,
    receiverStartZ: 0.01,
    stockLen: 0.27,
    upperColor: 0x1a1f26,
    lowerColor: 0x4b6143,
    handguardColor: 0x4b6143,
    stockColor: 0x4b6143,
    magColor: 0x242a33,
    gripColor: 0x4b6143,
    railColor: 0x2f3640,
    barrelTone: 'stainless',
    hasBipod: true,
    magAngle: 0.04,
    magSize: [0.032, 0.092, 0.074],
  },
  // 16. R93 Tactical 2 (~1.14m): German titanium-slate & matte black precision chassis, open skeleton thumbhole stock, deeply fluted heavy barrel, straight-pull bolt, bipod
  r93: {
    arch: 'sniper_r93',
    upperLen: 0.24,
    upperHeight: 0.056,
    upperWidth: 0.05,
    lowerLen: 0.36,
    handguardLen: 0.22,
    barrelLen: 0.59,
    barrelRadius: 0.017,
    barrelY: 0.022,
    handguardStartZ: 0.14,
    receiverStartZ: 0.01,
    stockLen: 0.26,
    upperColor: 0x3b4656,
    lowerColor: 0x222832,
    handguardColor: 0x364150,
    stockColor: 0x252c36,
    magColor: 0x1b2028,
    gripColor: 0x1a1e25,
    railColor: 0x526072,
    barrelTone: 'stainless',
    hasBipod: true,
    magAngle: 0.02,
    magSize: [0.03, 0.075, 0.068],
  },
  // 17. M249 SAW (~1.04m): Boxy dark parkerized steel receiver, perforated heat-shield barrel shroud, carry handle, OD green 100rd ammo box + brass belt, Para strut stock, bipod
  m249: {
    arch: 'lmg_m249',
    upperLen: 0.34,
    upperHeight: 0.088,
    upperWidth: 0.068,
    lowerLen: 0.32,
    handguardLen: 0.26,
    barrelLen: 0.45,
    barrelRadius: 0.017,
    barrelY: 0.02,
    handguardStartZ: 0.19,
    receiverStartZ: 0.02,
    stockLen: 0.24,
    upperColor: 0x242b35,
    lowerColor: 0x1e242d,
    handguardColor: 0x1b2028,
    stockColor: 0x222830,
    magColor: 0x45533b,
    gripColor: 0x161a20,
    railColor: 0x3a4352,
    barrelTone: 'matte_black',
    hasBipod: true,
    hasCarryHandle: true,
    magSize: [0.102, 0.135, 0.132],
  },
  // 18. PKM (~1.18m): Long Soviet riveted blued-steel receiver, ribbed feed cover, wood cutout skeleton stock, angled carry handle, right-side olive ammo can + brass belt, bipod
  pkm: {
    arch: 'lmg_pkm',
    upperLen: 0.38,
    upperHeight: 0.086,
    upperWidth: 0.066,
    lowerLen: 0.36,
    handguardLen: 0.22,
    barrelLen: 0.54,
    barrelRadius: 0.018,
    barrelY: 0.022,
    handguardStartZ: 0.20,
    receiverStartZ: 0.01,
    stockLen: 0.26,
    upperColor: 0x23272e,
    lowerColor: 0x1c2026,
    handguardColor: 0x262b32,
    stockColor: 0x714023,
    magColor: 0x4c573c,
    gripColor: 0x5c341d,
    railColor: 0x383e47,
    barrelTone: 'blued',
    woodFurniture: true,
    hasBipod: true,
    hasCarryHandle: true,
    magSize: [0.118, 0.145, 0.148],
  },
  // 19. S12K (~0.96m): Enlarged AK-pattern 12-gauge combat shotgun, wide boxy polymer handguard, massive chunky 12G box mag, oversized slotted GK-01 breacher brake
  s12k: {
    arch: 'shotgun_s12k',
    upperLen: 0.30,
    upperHeight: 0.076,
    upperWidth: 0.056,
    lowerLen: 0.29,
    handguardLen: 0.24,
    barrelLen: 0.41,
    barrelRadius: 0.02,
    barrelY: 0.022,
    handguardStartZ: 0.17,
    receiverStartZ: 0.015,
    stockLen: 0.23,
    upperColor: 0x1a1e25,
    lowerColor: 0x15181e,
    handguardColor: 0x1b2028,
    stockColor: 0x171b21,
    magColor: 0x1f242d,
    gripColor: 0x14171d,
    railColor: 0x323944,
    barrelTone: 'matte_black',
    magAngle: 0.14,
    magSize: [0.044, 0.215, 0.092],
  },
  // 20. M870 (~1.02m): Rounded satin blued-steel receiver, swept oiled walnut stock, long 12G barrel + full-length tube mag, deeply grooved walnut pump forend
  m870: {
    arch: 'shotgun_m870',
    upperLen: 0.22,
    upperHeight: 0.068,
    upperWidth: 0.048,
    lowerLen: 0.21,
    handguardLen: 0.19,
    barrelLen: 0.51,
    barrelRadius: 0.017,
    barrelY: 0.022,
    handguardStartZ: 0.20,
    receiverStartZ: 0.03,
    stockLen: 0.26,
    upperColor: 0x1c222c,
    lowerColor: 0x1c222c,
    handguardColor: 0x6f3e21,
    stockColor: 0x6f3e21,
    magColor: 0x1c222c,
    gripColor: 0x6f3e21,
    railColor: 0x323944,
    barrelTone: 'blued',
    woodFurniture: true,
    magSize: [0.02, 0.02, 0.44],
  },
};

export function buildWeaponModel(
  weaponId: WeaponId,
  attachments: Record<AttachmentSlot, string | null>,
  skinId: WeaponSkinId = 'factory_standard'
): { group: THREE.Group; muzzleTip: THREE.Object3D } {
  const group = new THREE.Group();
  const metalMaps = getWeaponMetalMaps();
  const bp = WEAPON_BLUEPRINTS[weaponId] || WEAPON_BLUEPRINTS.m4a1;
  const skinDef = WEAPON_SKINS.find((s) => s.id === skinId) || WEAPON_SKINS[0];
  const hasCustomSkin = skinDef.id !== 'factory_standard';

  const makeMetalMat = (hex: number, metalness = 0.8, roughness = 0.3, clearcoat = 0.24) =>
    new THREE.MeshPhysicalMaterial({
      color: hex,
      metalness,
      roughness,
      bumpMap: metalMaps.bumpMap,
      bumpScale: 0.004,
      roughnessMap: metalMaps.roughnessMap,
      clearcoat,
      clearcoatRoughness: 0.32,
    });

  const makePolymerMat = (hex: number) =>
    new THREE.MeshPhysicalMaterial({
      color: hex,
      metalness: 0.14,
      roughness: 0.66,
      sheen: 0.24,
    });

  const makeWoodMat = (hex: number) =>
    new THREE.MeshPhysicalMaterial({
      color: hex,
      metalness: 0.06,
      roughness: 0.46,
      clearcoat: 0.34,
      clearcoatRoughness: 0.3,
    });

  const gunMetal = makeMetalMat(0x1b222c, 0.88, 0.28, 0.22);
  const darkPolymer = makePolymerMat(0x13171e);
  const accentSteel = makeMetalMat(0x5b6778, 0.9, 0.22, 0.3);
  const stainlessMat = makeMetalMat(0x94a3b8, 0.94, 0.2, 0.35);
  const bluedSteelMat = makeMetalMat(0x161c26, 0.88, 0.24, 0.38);
  const carbonMat = new THREE.MeshPhysicalMaterial({
    color: 0x22242a,
    map: metalMaps.carbonMap,
    metalness: 0.46,
    roughness: 0.24,
    clearcoat: 0.62,
    clearcoatRoughness: 0.2,
  });
  const tanPolymer = makePolymerMat(0x7c674c);
  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9ad3c,
    metalness: 0.92,
    roughness: 0.2,
  });

  const translucentAmberMat = new THREE.MeshPhysicalMaterial({
    color: 0x9b6b2f,
    metalness: 0.1,
    roughness: 0.18,
    transmission: 0.22,
    transparent: true,
    opacity: 0.78,
    clearcoat: 0.85,
  });

  // Skin-aware primary materials vs authentic Delta Force multi-tone factory materials
  let upperMat: THREE.MeshPhysicalMaterial;
  let lowerMat: THREE.MeshPhysicalMaterial;
  let handguardMat: THREE.MeshPhysicalMaterial;
  let stockMat: THREE.MeshPhysicalMaterial;
  let magBodyMat: THREE.MeshPhysicalMaterial;
  let gripMat: THREE.MeshPhysicalMaterial;
  let skinAccentMat: THREE.MeshPhysicalMaterial;

  if (hasCustomSkin) {
    const skinTex = createWeaponSkinTextures(skinDef);
    const skinBodyMat = new THREE.MeshPhysicalMaterial({
      map: skinTex.map,
      roughnessMap: skinTex.roughnessMap,
      bumpMap: skinTex.bumpMap,
      bumpScale: 0.006,
      metalness: skinDef.metalness,
      roughness: skinDef.roughness,
      clearcoat: skinDef.clearcoat,
      clearcoatRoughness: 0.16,
    });
    const glowStrength =
      skinDef.rarity === 'legendary'
        ? 0.55
        : skinDef.rarity === 'epic'
          ? 0.38
          : skinDef.rarity === 'rare'
            ? 0.22
            : 0.04;
    skinAccentMat = new THREE.MeshPhysicalMaterial({
      color: skinDef.accentHex,
      emissive: skinDef.accentHex,
      emissiveIntensity: glowStrength,
      metalness: 0.74,
      roughness: 0.22,
      clearcoat: 0.8,
    });
    upperMat = skinBodyMat;
    lowerMat = skinBodyMat;
    handguardMat = skinBodyMat;
    stockMat = skinBodyMat;
    magBodyMat = bp.arch === 'bullpup_p90' || bp.arch === 'bullpup_aug' ? translucentAmberMat : skinBodyMat;
    gripMat = darkPolymer;
  } else {
    const isBullpup =
      bp.arch === 'bullpup_aug' || bp.arch === 'bullpup_p90' || bp.arch === 'bullpup_ash12';
    upperMat = isBullpup ? makePolymerMat(bp.upperColor) : makeMetalMat(bp.upperColor, 0.78, 0.3, 0.26);
    lowerMat =
      bp.arch === 'sniper_awm' || bp.arch === 'scar' || isBullpup
        ? makePolymerMat(bp.lowerColor)
        : makeMetalMat(bp.lowerColor, 0.74, 0.34, 0.22);
    handguardMat =
      bp.woodFurniture && bp.arch !== 'vss'
        ? makeWoodMat(bp.handguardColor)
        : bp.arch === 'ar_k416' || bp.arch === 'scar' || bp.arch === 'dmr_sr25'
          ? makeMetalMat(bp.handguardColor, 0.72, 0.32, 0.24)
          : makePolymerMat(bp.handguardColor);
    stockMat = bp.woodFurniture
      ? makeWoodMat(bp.stockColor)
      : makePolymerMat(bp.stockColor);
    magBodyMat =
      bp.arch === 'bullpup_p90' || bp.arch === 'bullpup_aug'
        ? translucentAmberMat
        : bp.arch === 'ak_classic'
          ? makePolymerMat(bp.magColor)
          : makeMetalMat(bp.magColor, 0.65, 0.36, 0.2);
    gripMat = bp.woodFurniture ? makeWoodMat(bp.gripColor) : makePolymerMat(bp.gripColor);
    skinAccentMat = makeMetalMat(bp.railColor, 0.78, 0.28, 0.22);
  }

  const isBullpup =
    bp.arch === 'bullpup_aug' || bp.arch === 'bullpup_p90' || bp.arch === 'bullpup_ash12';

  // =========================================================================
  // 1. RECEIVER ARCHITECTURE (Upper + Lower + Iconic Architecture Silhouettes)
  // =========================================================================
  const upperCenterZ = bp.receiverStartZ;
  if (bp.arch === 'shotgun_m870') {
    // M870 smooth rounded-top shotgun receiver
    const m870Body = new THREE.Mesh(
      createChamferPlateGeo(bp.upperWidth, bp.upperHeight, bp.upperLen, 0.012),
      upperMat
    );
    m870Body.rotation.y = Math.PI / 2;
    m870Body.position.set(0, 0.008, upperCenterZ);
    m870Body.castShadow = true;
    group.add(m870Body);
  } else if (bp.arch === 'sniper_awm' || bp.arch === 'sniper_r93') {
    // Cylindrical bolt-action receiver resting inside an elongated chassis bedding
    const chassis = new THREE.Mesh(
      createChamferPlateGeo(bp.upperWidth, 0.048, bp.lowerLen, 0.007),
      lowerMat
    );
    chassis.rotation.y = Math.PI / 2;
    chassis.position.set(0, -0.01, upperCenterZ + 0.07);
    chassis.castShadow = true;
    group.add(chassis);

    const actionTube = new THREE.Mesh(
      new THREE.CylinderGeometry(bp.upperWidth * 0.44, bp.upperWidth * 0.44, bp.upperLen, 16),
      upperMat
    );
    actionTube.rotation.x = Math.PI / 2;
    actionTube.position.set(0, 0.024, upperCenterZ);
    actionTube.castShadow = true;
    group.add(actionTube);
  } else if (bp.arch === 'bullpup_p90') {
    // P90 aerodynamic sloped wedge nose + rear body + closed-loop thumbhole bridge
    const p90Body = new THREE.Mesh(
      createChamferPlateGeo(bp.upperWidth, bp.upperHeight, bp.upperLen, 0.011),
      upperMat
    );
    p90Body.rotation.y = Math.PI / 2;
    p90Body.position.set(0, 0.012, 0.0);
    p90Body.castShadow = true;
    group.add(p90Body);

    const p90Nose = new THREE.Mesh(
      createChamferPlateGeo(bp.upperWidth * 0.92, 0.088, 0.13, 0.01),
      lowerMat
    );
    p90Nose.rotation.y = Math.PI / 2;
    p90Nose.position.set(0, -0.012, 0.175);
    group.add(p90Nose);

    // Thumbhole closed-loop lower strut connecting front grip to rear buttpad
    const p90LowerStrut = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.028, 0.25), lowerMat);
    p90LowerStrut.position.set(0, -0.082, -0.02);
    p90LowerStrut.rotation.x = -0.14;
    group.add(p90LowerStrut);
  } else if (bp.arch === 'bullpup_aug') {
    // AUG sculpted continuous OD polymer bullpup chassis
    const augShell = new THREE.Mesh(
      createChamferPlateGeo(bp.upperWidth, bp.upperHeight, bp.upperLen, 0.011),
      upperMat
    );
    augShell.rotation.y = Math.PI / 2;
    augShell.position.set(0, 0.01, -0.01);
    augShell.castShadow = true;
    group.add(augShell);

    // Signature AUG huge knuckle-guard loop in front of trigger
    const augLoopFront = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.095, 0.028), upperMat);
    augLoopFront.position.set(0, -0.056, 0.185);
    augLoopFront.rotation.x = 0.22;
    const augLoopBot = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.12), upperMat);
    augLoopBot.position.set(0, -0.098, 0.125);
    group.add(augLoopFront, augLoopBot);
  } else {
    // Conventional AR / AK / SCAR / Vector / MP5 / LMG / S12K / ASh-12 / VSS Upper & Lower
    const upperReceiver = new THREE.Mesh(
      createChamferPlateGeo(bp.upperWidth, bp.upperHeight, bp.upperLen, 0.007),
      upperMat
    );
    upperReceiver.rotation.y = Math.PI / 2;
    upperReceiver.position.set(0, 0.02, upperCenterZ);
    upperReceiver.castShadow = true;
    group.add(upperReceiver);

    const lowerReceiver = new THREE.Mesh(
      new THREE.BoxGeometry(bp.upperWidth * 0.9, 0.044, bp.lowerLen),
      lowerMat
    );
    lowerReceiver.position.set(0, -0.02, upperCenterZ - 0.005);
    lowerReceiver.castShadow = true;
    group.add(lowerReceiver);
  }

  // Vector Super-V Vertical Downward Recoil Housing right in front of trigger
  if (bp.arch === 'smg_vector') {
    const superV = new THREE.Mesh(
      createChamferPlateGeo(bp.upperWidth * 0.96, 0.128, 0.115, 0.008),
      lowerMat
    );
    superV.rotation.y = Math.PI / 2;
    superV.position.set(0, -0.068, 0.105);
    superV.castShadow = true;
    group.add(superV);

    const upperStep = new THREE.Mesh(new THREE.BoxGeometry(bp.upperWidth * 0.88, 0.022, 0.14), upperMat);
    upperStep.position.set(0, 0.048, 0.08);
    group.add(upperStep);
  }

  // Flank laser-etched trim accent on receiver
  const trimLen = bp.upperLen * 0.62;
  const trimStripL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.009, trimLen), skinAccentMat);
  trimStripL.position.set(-bp.upperWidth * 0.5 - 0.001, 0.016, upperCenterZ);
  const trimStripR = trimStripL.clone();
  trimStripR.position.x = bp.upperWidth * 0.5 + 0.001;
  group.add(trimStripL, trimStripR);

  // Ejection port & Bolt Carrier / Bolt Handle
  const boltCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.085), accentSteel);
  boltCarrier.position.set(bp.upperWidth * 0.48, 0.024, isBullpup ? -0.08 : upperCenterZ + 0.02);
  group.add(boltCarrier);

  if (bp.arch === 'sniper_awm' || bp.arch === 'sniper_r93') {
    const boltHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.056, 8), accentSteel);
    boltHandle.rotation.z = Math.PI / 2 - 0.35;
    boltHandle.position.set(bp.upperWidth * 0.5 + 0.022, 0.018, upperCenterZ - 0.02);
    const boltKnob = new THREE.Mesh(
      bp.arch === 'sniper_r93' ? new THREE.CylinderGeometry(0.011, 0.011, 0.024, 10) : new THREE.SphereGeometry(0.013, 10, 10),
      gunMetal
    );
    boltKnob.position.set(bp.upperWidth * 0.5 + 0.048, 0.008, upperCenterZ - 0.02);
    group.add(boltHandle, boltKnob);
  }

  // =========================================================================
  // 2. TOP RAILS, CARRY HANDLES, P90 TOP MAGAZINE & IRON SIGHTS
  // =========================================================================
  const railTopY = 0.02 + bp.upperHeight * 0.5 + 0.006;

  if (bp.arch === 'bullpup_p90') {
    // Iconic horizontal translucent 50rd top magazine + visible brass 5.7mm rounds inside
    const p90Mag = new THREE.Mesh(
      createChamferPlateGeo(bp.magSize[0], bp.magSize[1], bp.magSize[2], 0.004),
      magBodyMat
    );
    p90Mag.rotation.y = Math.PI / 2;
    p90Mag.position.set(0, 0.062, 0.03);
    group.add(p90Mag);

    for (let r = -0.08; r <= 0.1; r += 0.016) {
      const round = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.034, 6), brassMat);
      round.rotation.z = Math.PI / 2;
      round.position.set(0, 0.062, r);
      group.add(round);
    }

    // High P90 sight bridge over magazine nose
    const bridgeF = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.044, 0.026), gunMetal);
    bridgeF.position.set(0, 0.072, 0.155);
    const bridgeR = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.044, 0.026), gunMetal);
    bridgeR.position.set(0, 0.072, 0.035);
    const bridgeTop = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.014, 0.145), accentSteel);
    bridgeTop.position.set(0, 0.095, 0.095);
    group.add(bridgeF, bridgeR, bridgeTop);
  } else if (bp.arch === 'shotgun_m870' && !attachments.optic) {
    // Clean rounded M870 receiver (no Picatinny rail when running iron/bead sights!)
  } else if (bp.arch === 'ak_classic' || bp.arch === 'vss') {
    // AKM / VSS classic ribbed stamped dust cover without full rail unless optic mounted
    const dustRib = new THREE.Mesh(new THREE.BoxGeometry(bp.upperWidth * 0.72, 0.008, bp.upperLen * 0.85), upperMat);
    dustRib.position.set(0, railTopY - 0.003, upperCenterZ);
    group.add(dustRib);
  } else {
    // Full tactical Picatinny top rail spanning upper (and monolithic handguard on AR/SCAR/CI19/SR25)
    const monolithic =
      bp.arch === 'ar_m4' ||
      bp.arch === 'ar_k416' ||
      bp.arch === 'ar_ci19' ||
      bp.arch === 'scar' ||
      bp.arch === 'dmr_sr25' ||
      bp.arch === 'smg_vector';
    const railLen = monolithic ? bp.upperLen + bp.handguardLen * 0.85 : bp.upperLen * 0.92;
    const railZ = monolithic ? upperCenterZ + bp.handguardLen * 0.42 : upperCenterZ;
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.011, railLen), skinAccentMat);
    topRail.position.set(0, railTopY, railZ);
    group.add(topRail);
    for (let rz = railZ - railLen * 0.46; rz <= railZ + railLen * 0.46; rz += 0.034) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.005, 0.013), gunMetal);
      tooth.position.set(0, railTopY + 0.006, rz);
      group.add(tooth);
    }
  }

  // ASh-12 towering carry handle vs LMG barrel-change carry handle
  if (bp.arch === 'bullpup_ash12') {
    const postF = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.048, 0.034), upperMat);
    postF.position.set(0, railTopY + 0.024, 0.14);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.048, 0.034), upperMat);
    postR.position.set(0, railTopY + 0.024, -0.1);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 0.28), upperMat);
    bar.position.set(0, railTopY + 0.048, 0.02);
    group.add(postF, postR, bar);
  } else if (bp.hasCarryHandle) {
    // Offset barrel-change / squad LMG carry handle
    const handleStem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 8), accentSteel);
    handleStem.position.set(0.024, 0.068, bp.handguardStartZ + 0.08);
    handleStem.rotation.z = -0.45;
    const handleGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.095, 10), darkPolymer);
    handleGrip.rotation.x = Math.PI / 2;
    handleGrip.position.set(0.042, 0.095, bp.handguardStartZ + 0.08);
    group.add(handleStem, handleGrip);
  }

  // =========================================================================
  // 3. TRIGGER GUARD & PISTOL GRIP (Shifted forward on Bullpups, swept on M870)
  // =========================================================================
  const triggerZ = isBullpup ? 0.105 : -0.01;
  if (bp.arch !== 'shotgun_m870') {
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.032, 0.062), darkPolymer);
    guard.position.set(0, -0.056, triggerZ);
    group.add(guard);
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.024, 0.009), accentSteel);
    trigger.position.set(0, -0.05, triggerZ);
    trigger.rotation.x = 0.25;
    group.add(trigger);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.024, 0.118, 10), gripMat);
    grip.position.set(0, -0.084, triggerZ - 0.046);
    grip.rotation.x = 0.3;
    group.add(grip);
  }

  // =========================================================================
  // 4. BESPOKE REALISTIC BUTTSTOCKS (All 20 Guns + Aftermarket Stock Overrides)
  // =========================================================================
  const stockAnchorZ = bp.receiverStartZ - bp.upperLen * 0.5;
  const stockEndZ = stockAnchorZ - bp.stockLen;

  if (isBullpup) {
    // Integrated rubberized rear bullpup buttpad
    const pad = new THREE.Mesh(
      createChamferPlateGeo(bp.upperWidth * 0.94, 0.132, 0.055, 0.008),
      darkPolymer
    );
    pad.rotation.y = Math.PI / 2;
    pad.position.set(0, -0.018, -0.22);
    group.add(pad);
  } else if (attachments.stock === 'stock_skeleton') {
    const topStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 10), accentSteel);
    topStrut.rotation.x = Math.PI / 2;
    topStrut.position.set(0, 0.016, stockAnchorZ - 0.11);
    const lowerStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.205, 10), accentSteel);
    lowerStrut.rotation.x = Math.PI / 2 - 0.22;
    lowerStrut.position.set(0, -0.026, stockAnchorZ - 0.11);
    const buttpad = new THREE.Mesh(createChamferPlateGeo(0.04, 0.12, 0.028, 0.005), stockMat);
    buttpad.rotation.y = Math.PI / 2;
    buttpad.position.set(0, -0.018, stockAnchorZ - 0.215);
    group.add(topStrut, lowerStrut, buttpad);
  } else if (attachments.stock === 'stock_tactical') {
    const bufferTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.22, 12), gunMetal);
    bufferTube.rotation.x = Math.PI / 2;
    bufferTube.position.set(0, 0.01, stockAnchorZ - 0.105);
    const ctrBody = new THREE.Mesh(createChamferPlateGeo(0.048, 0.112, 0.17, 0.007), hasCustomSkin ? stockMat : tanPolymer);
    ctrBody.rotation.y = Math.PI / 2;
    ctrBody.position.set(0, -0.018, stockAnchorZ - 0.15);
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.024, 0.11), darkPolymer);
    cheek.position.set(0, 0.042, stockAnchorZ - 0.14);
    group.add(bufferTube, ctrBody, cheek);
  } else if (attachments.stock === 'stock_heavy') {
    const heavyFrame = new THREE.Mesh(createChamferPlateGeo(0.052, 0.128, 0.24, 0.008), stockMat);
    heavyFrame.rotation.y = Math.PI / 2;
    heavyFrame.position.set(0, -0.018, stockAnchorZ - 0.12);
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.03, 0.13), accentSteel);
    cheek.position.set(0, 0.048, stockAnchorZ - 0.11);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.136, 0.028), darkPolymer);
    pad.position.set(0, -0.022, stockAnchorZ - 0.245);
    group.add(heavyFrame, cheek, pad);
  } else {
    // BESPOKE FACTORY STOCK FOR EACH GUN
    switch (bp.arch) {
      case 'shotgun_m870': {
        // Traditional swept walnut shotgun wrist + buttstock
        const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.048, 0.095), stockMat);
        wrist.position.set(0, -0.022, stockAnchorZ - 0.035);
        wrist.rotation.x = 0.28;
        const butt = new THREE.Mesh(createChamferPlateGeo(0.042, 0.112, 0.21, 0.01), stockMat);
        butt.rotation.y = Math.PI / 2;
        butt.position.set(0, -0.055, stockAnchorZ - 0.155);
        butt.rotation.x = 0.12;
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.118, 0.024), darkPolymer);
        pad.position.set(0, -0.068, stockEndZ - 0.01);
        group.add(wrist, butt, pad);
        break;
      }
      case 'ak_classic': {
        // Classic downward-angled laminated birch AKM stock + steel buttplate
        const woodStock = new THREE.Mesh(createChamferPlateGeo(0.04, 0.098, bp.stockLen, 0.007), stockMat);
        woodStock.rotation.y = Math.PI / 2;
        woodStock.position.set(0, -0.028, stockAnchorZ - bp.stockLen * 0.5);
        woodStock.rotation.x = 0.16;
        const steelPlate = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.105, 0.014), gunMetal);
        steelPlate.position.set(0, -0.046, stockEndZ);
        group.add(woodStock, steelPlate);
        break;
      }
      case 'vss':
      case 'lmg_pkm': {
        // Iconic Russian skeleton cut-out walnut stock (VSS Vintorez / PKM)
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.024, bp.stockLen), stockMat);
        topRail.position.set(0, 0.012, stockAnchorZ - bp.stockLen * 0.5);
        const botRail = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.022, bp.stockLen * 0.96), stockMat);
        botRail.position.set(0, -0.048, stockAnchorZ - bp.stockLen * 0.48);
        botRail.rotation.x = 0.24;
        const rearBridge = new THREE.Mesh(createChamferPlateGeo(0.038, 0.122, 0.055, 0.006), stockMat);
        rearBridge.rotation.y = Math.PI / 2;
        rearBridge.position.set(0, -0.028, stockEndZ + 0.02);
        const rubberPad = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.128, 0.022), darkPolymer);
        rubberPad.position.set(0, -0.028, stockEndZ - 0.01);
        group.add(topRail, botRail, rearBridge, rubberPad);
        break;
      }
      case 'smg_mp5': {
        // HK A3 collapsible twin-rail sliding wire stock + concave buttpad
        [-0.023, 0.023].forEach((sx) => {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.014, bp.stockLen), accentSteel);
          rail.position.set(sx, 0.012, stockAnchorZ - bp.stockLen * 0.5);
          group.add(rail);
        });
        const pad = new THREE.Mesh(createChamferPlateGeo(0.048, 0.115, 0.028, 0.005), darkPolymer);
        pad.rotation.y = Math.PI / 2;
        pad.position.set(0, -0.016, stockEndZ);
        group.add(pad);
        break;
      }
      case 'smg_vector':
      case 'smg_sr3m': {
        // Slim side-folding tubular skeleton stock
        const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.045, 8), gunMetal);
        hinge.position.set(0, 0.01, stockAnchorZ - 0.01);
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.018, bp.stockLen), stockMat);
        strut.position.set(0, 0.01, stockAnchorZ - bp.stockLen * 0.5);
        const strutBot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, bp.stockLen * 0.92), stockMat);
        strutBot.position.set(0, -0.03, stockAnchorZ - bp.stockLen * 0.48);
        strutBot.rotation.x = 0.22;
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.105, 0.024), darkPolymer);
        pad.position.set(0, -0.018, stockEndZ);
        group.add(hinge, strut, strutBot, pad);
        break;
      }
      case 'scar': {
        // Iconic FN SCAR-H "UGG-boot" FDE folding telescoping stock with raised cheekpiece
        const bootBody = new THREE.Mesh(createChamferPlateGeo(0.048, 0.095, bp.stockLen * 0.88, 0.008), stockMat);
        bootBody.rotation.y = Math.PI / 2;
        bootBody.position.set(0, -0.016, stockAnchorZ - bp.stockLen * 0.48);
        const cheekRiser = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.028, 0.13), stockMat);
        cheekRiser.position.set(0, 0.036, stockAnchorZ - 0.11);
        const bootToe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.038), darkPolymer);
        bootToe.position.set(0, -0.03, stockEndZ + 0.01);
        group.add(bootBody, cheekRiser, bootToe);
        break;
      }
      case 'sniper_awm': {
        // Accuracy International AWM green thumbhole sniper stock + cheek riser + rear hook
        const thumbBridge = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.032, bp.stockLen), stockMat);
        thumbBridge.position.set(0, 0.006, stockAnchorZ - bp.stockLen * 0.5);
        const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.026, bp.stockLen * 0.85), stockMat);
        bottomBar.position.set(0, -0.068, stockAnchorZ - bp.stockLen * 0.55);
        const rearBlock = new THREE.Mesh(createChamferPlateGeo(0.046, 0.118, 0.09, 0.007), stockMat);
        rearBlock.rotation.y = Math.PI / 2;
        rearBlock.position.set(0, -0.028, stockEndZ + 0.045);
        const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.028, 0.12), darkPolymer);
        cheek.position.set(0, 0.036, stockAnchorZ - 0.14);
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.126, 0.024), darkPolymer);
        pad.position.set(0, -0.028, stockEndZ);
        group.add(thumbBridge, bottomBar, rearBlock, cheek, pad);
        break;
      }
      case 'sniper_r93': {
        // Blaser R93 sleek skeletonized thumbhole sniper chassis stock
        const upperSpine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, bp.stockLen), stockMat);
        upperSpine.position.set(0, 0.01, stockAnchorZ - bp.stockLen * 0.5);
        const lowerSpine = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.02, bp.stockLen * 0.88), stockMat);
        lowerSpine.position.set(0, -0.056, stockAnchorZ - bp.stockLen * 0.52);
        lowerSpine.rotation.x = 0.14;
        const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.024, 0.115), darkPolymer);
        cheek.position.set(0, 0.034, stockAnchorZ - 0.13);
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.122, 0.028), darkPolymer);
        pad.position.set(0, -0.024, stockEndZ);
        group.add(upperSpine, lowerSpine, cheek, pad);
        break;
      }
      case 'dmr_sr25': {
        // Magpul PRS precision DMR stock with lower monopod bar & adjustable cheekpiece
        const prsBody = new THREE.Mesh(createChamferPlateGeo(0.048, 0.118, bp.stockLen, 0.007), stockMat);
        prsBody.rotation.y = Math.PI / 2;
        prsBody.position.set(0, -0.018, stockAnchorZ - bp.stockLen * 0.5);
        const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.026, 0.12), darkPolymer);
        cheek.position.set(0, 0.042, stockAnchorZ - 0.12);
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.024), gunMetal);
        pad.position.set(0, -0.022, stockEndZ);
        group.add(prsBody, cheek, pad);
        break;
      }
      case 'lmg_m249': {
        // M249 Para / SAW twin-tube sliding strut + heavy shoulder brace
        const topTube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, bp.stockLen, 10), gunMetal);
        topTube.rotation.x = Math.PI / 2;
        topTube.position.set(0, 0.014, stockAnchorZ - bp.stockLen * 0.5);
        const botTube = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, bp.stockLen * 0.9, 8), accentSteel);
        botTube.rotation.x = Math.PI / 2 - 0.18;
        botTube.position.set(0, -0.036, stockAnchorZ - bp.stockLen * 0.48);
        const brace = new THREE.Mesh(createChamferPlateGeo(0.05, 0.136, 0.042, 0.007), stockMat);
        brace.rotation.y = Math.PI / 2;
        brace.position.set(0, -0.022, stockEndZ);
        group.add(topTube, botTube, brace);
        break;
      }
      default: {
        // Modular AR / K416 / CI-19 / AK-12 / S12K stocks on buffer tube
        const bufferTube = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, bp.stockLen * 0.9, 12), gunMetal);
        bufferTube.rotation.x = Math.PI / 2;
        bufferTube.position.set(0, 0.012, stockAnchorZ - bp.stockLen * 0.45);
        group.add(bufferTube);

        const body = new THREE.Mesh(
          createChamferPlateGeo(
            bp.arch === 'ar_m4' ? 0.052 : 0.044,
            0.108,
            bp.stockLen * 0.78,
            0.007
          ),
          stockMat
        );
        body.rotation.y = Math.PI / 2;
        body.position.set(0, -0.018, stockAnchorZ - bp.stockLen * 0.56);
        group.add(body);
      }
    }
  }

  // =========================================================================
  // 5. HANDGUARDS, GAS TUBES, BARRELS & TUBULAR MAGAZINES
  // =========================================================================
  const barrelDelta =
    attachments.barrel === 'barrel_cqb'
      ? -0.08
      : attachments.barrel === 'barrel_long'
        ? 0.16
        : attachments.barrel === 'barrel_carbon'
          ? 0.06
          : 0;
  const barrelLen = Math.max(0.045, bp.barrelLen + barrelDelta);
  const handguardLen =
    bp.arch === 'bullpup_p90' || bp.arch === 'bullpup_aug' || bp.arch === 'bullpup_ash12'
      ? bp.handguardLen
      : Math.min(
          barrelLen * 0.85,
          Math.max(0.11, bp.handguardLen + (attachments.barrel === 'barrel_cqb' ? -0.05 : attachments.barrel === 'barrel_long' ? 0.08 : 0))
        );
  const hgCenterZ = bp.handguardStartZ + handguardLen * 0.5;
  const effectiveHgMat = attachments.barrel === 'barrel_carbon' ? carbonMat : handguardMat;
  const barrelMat =
    attachments.barrel === 'barrel_carbon' || bp.integralSuppressor
      ? carbonMat
      : bp.barrelTone === 'stainless'
        ? stainlessMat
        : bp.barrelTone === 'blued'
          ? bluedSteelMat
          : gunMetal;

  if (bp.arch === 'shotgun_m870') {
    // M870 full-length under-barrel tubular magazine + ribbed pump forend + barrel clamp
    const tubeLen = barrelLen * 0.9;
    const tubeMag = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, tubeLen, 12), barrelMat);
    tubeMag.rotation.x = Math.PI / 2;
    tubeMag.position.set(0, -0.008, bp.handguardStartZ - 0.06 + tubeLen * 0.5);
    group.add(tubeMag);

    const pumpSlide = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, handguardLen, 12), effectiveHgMat);
    pumpSlide.rotation.x = Math.PI / 2;
    pumpSlide.position.set(0, -0.008, hgCenterZ + 0.03);
    group.add(pumpSlide);

    // Grooved pump rings
    for (let pz = hgCenterZ - 0.04; pz <= hgCenterZ + 0.09; pz += 0.024) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.0025, 6, 14), darkPolymer);
      ring.position.set(0, -0.008, pz);
      group.add(ring);
    }

    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.048, 0.016), gunMetal);
    clamp.position.set(0, 0.008, bp.handguardStartZ - 0.06 + tubeLen * 0.92);
    group.add(clamp);
  } else if (bp.arch === 'smg_mp5') {
    // MP5 iconic wide triangular polymer handguard + upper cylindrical cocking tube
    const triHg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.034, handguardLen, 6), effectiveHgMat);
    triHg.rotation.x = Math.PI / 2;
    triHg.position.set(0, 0.004, hgCenterZ);
    group.add(triHg);

    const cockingTube = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, handguardLen + 0.03, 12), barrelMat);
    cockingTube.rotation.x = Math.PI / 2;
    cockingTube.position.set(0, 0.042, hgCenterZ + 0.01);
    group.add(cockingTube);

    const cockingKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.024, 8), darkPolymer);
    cockingKnob.rotation.z = Math.PI / 2;
    cockingKnob.position.set(-0.018, 0.042, hgCenterZ + handguardLen * 0.4);
    group.add(cockingKnob);
  } else if (bp.arch === 'lmg_m249') {
    // M249 perforated steel heat shield + thick ribbed lower handguard
    const lowerHg = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.048, handguardLen), effectiveHgMat);
    lowerHg.position.set(0, -0.004, hgCenterZ);
    const heatShield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, handguardLen * 0.92, 10, 1, false, -Math.PI * 0.5, Math.PI),
      accentSteel
    );
    heatShield.rotation.x = Math.PI / 2;
    heatShield.rotation.z = -Math.PI / 2;
    heatShield.position.set(0, 0.034, hgCenterZ);
    group.add(lowerHg, heatShield);
  } else if (bp.arch === 'sniper_awm' || bp.arch === 'sniper_r93') {
    // Sniper free-floating chassis forend leaving upper barrel completely exposed
    const forend = new THREE.Mesh(
      createChamferPlateGeo(bp.upperWidth * 0.92, 0.036, handguardLen, 0.006),
      effectiveHgMat
    );
    forend.rotation.y = Math.PI / 2;
    forend.position.set(0, -0.006, hgCenterZ);
    forend.castShadow = true;
    group.add(forend);
  } else if (bp.arch !== 'bullpup_p90') {
    // Slim faceted tactical handguards (M4, K416, CI19, AK, SCAR, SR25, Vector, S12K, etc.)
    const hgW = bp.arch === 'shotgun_s12k' || bp.arch === 'bullpup_ash12' ? 0.054 : 0.042;
    const hgH = bp.arch === 'shotgun_s12k' ? 0.056 : 0.046;
    const handguard = new THREE.Mesh(
      createChamferPlateGeo(hgW, hgH, handguardLen, 0.006),
      effectiveHgMat
    );
    handguard.rotation.y = Math.PI / 2;
    handguard.position.set(0, bp.barrelY - 0.004, hgCenterZ);
    handguard.castShadow = true;
    group.add(handguard);

    // K416 / M4 side rail covers / cooling vents
    if (bp.arch === 'ar_m4' || bp.arch === 'ar_k416' || bp.arch === 'dmr_sr25') {
      [-1, 1].forEach((side) => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.018, handguardLen * 0.72), darkPolymer);
        panel.position.set(side * (hgW * 0.5 + 0.001), bp.barrelY - 0.004, hgCenterZ);
        group.add(panel);
      });
    }
  }

  // AK / S12K / PKM gas cylinder tube
  if (bp.arch === 'ak_classic' || bp.arch === 'ak_modern' || bp.arch === 'shotgun_s12k') {
    const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, handguardLen * 0.95, 10), gunMetal);
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, bp.barrelY + 0.022, hgCenterZ);
    group.add(gasTube);
  } else if (bp.arch === 'lmg_pkm') {
    const underGasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, barrelLen * 0.62, 10), gunMetal);
    underGasTube.rotation.x = Math.PI / 2;
    underGasTube.position.set(0, -0.006, bp.handguardStartZ + barrelLen * 0.31);
    group.add(underGasTube);
  }

  // Main Barrel (+ Integral Thick Ported Suppressor for VSS)
  const barrelStartZ = bp.handguardStartZ - 0.03;
  const barrelZ = barrelStartZ + barrelLen * 0.5;
  const bRadius =
    attachments.barrel === 'barrel_long'
      ? bp.barrelRadius * 1.15
      : attachments.barrel === 'barrel_cqb'
        ? bp.barrelRadius * 0.92
        : bp.barrelRadius;

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(bRadius * 0.93, bRadius, barrelLen, 14),
    barrelMat
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, bp.barrelY, barrelZ);
  barrel.castShadow = true;
  group.add(barrel);

  const muzzleZ = barrelStartZ + barrelLen;

  // Classic Iron Sight Gas Blocks (A-Frame M4A1, Hooded MP5, AKM Front Sight, SCAR-H Gas Block)
  if (bp.arch === 'ar_m4') {
    const fspBase = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.044, 0.034), gunMetal);
    fspBase.position.set(0, bp.barrelY + 0.022, bp.handguardStartZ + handguardLen + 0.025);
    group.add(fspBase);
  } else if (bp.arch === 'ak_classic' || bp.arch === 'ak_modern') {
    const akFsp = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.04, 0.022), gunMetal);
    akFsp.position.set(0, bp.barrelY + 0.022, muzzleZ - 0.028);
    group.add(akFsp);
  } else if (bp.arch === 'scar') {
    const scarGas = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.038, 0.03), accentSteel);
    scarGas.position.set(0, bp.barrelY + 0.02, bp.handguardStartZ + handguardLen + 0.02);
    group.add(scarGas);
  } else if (bp.arch === 'smg_mp5') {
    const mp5Hood = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.003, 6, 12), gunMetal);
    mp5Hood.position.set(0, bp.barrelY + 0.036, muzzleZ - 0.025);
    group.add(mp5Hood);
  }

  // Deployed Heavy Bipod for Snipers & LMGs
  if (bp.hasBipod) {
    const bipodZ = bp.handguardStartZ + handguardLen - 0.02;
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.022, 0.035), gunMetal);
    mount.position.set(0, -0.026, bipodZ);
    group.add(mount);
    [-1, 1].forEach((side) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.175, 8), accentSteel);
      leg.position.set(side * 0.038, -0.095, bipodZ + 0.035);
      leg.rotation.x = -0.36;
      leg.rotation.z = side * 0.24;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.016, 8), darkPolymer);
      foot.position.set(side * 0.058, -0.17, bipodZ + 0.068);
      group.add(leg, foot);
    });
  }

  // =========================================================================
  // 6. OPTICS & IRON SIGHTS
  // =========================================================================
  const coatedLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.72,
    roughness: 0.06,
    metalness: 0.35,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    ior: 1.52,
  });

  const opticBaseY =
    bp.arch === 'bullpup_p90'
      ? 0.125
      : bp.arch === 'bullpup_ash12'
        ? railTopY + 0.082
        : railTopY + 0.032;
  const opticZ = isBullpup ? 0.06 : upperCenterZ;

  if (attachments.optic === 'optic_acog') {
    const scopeLen = bp.arch === 'sniper_awm' || bp.arch === 'sniper_r93' || bp.arch === 'dmr_sr25' ? 0.25 : 0.175;
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, scopeLen, 16), gunMetal);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, opticBaseY, opticZ + 0.01);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.048, 16), gunMetal);
    bell.rotation.x = Math.PI / 2;
    bell.position.set(0, opticBaseY, opticZ + scopeLen * 0.5 + 0.01);
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.016, 10), accentSteel);
    turret.position.set(0, opticBaseY + 0.024, opticZ);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 16), coatedLensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, opticBaseY, opticZ + scopeLen * 0.5 + 0.035);
    group.add(scope, bell, turret, lens);
  } else if (attachments.optic === 'optic_red_dot') {
    const housing = new THREE.Mesh(createChamferPlateGeo(0.042, 0.042, 0.068, 0.005), darkPolymer);
    housing.rotation.y = Math.PI / 2;
    housing.position.set(0, opticBaseY - 0.006, opticZ + 0.01);
    group.add(housing);
    const holoGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.028, 0.024),
      new THREE.MeshPhysicalMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.55,
        clearcoat: 1.0,
        roughness: 0.05,
        side: THREE.DoubleSide,
      })
    );
    holoGlass.position.set(0, opticBaseY - 0.005, opticZ + 0.03);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2a55 }));
    dot.position.set(0, opticBaseY - 0.005, opticZ + 0.01);
    group.add(holoGlass, dot);
  } else if (bp.arch !== 'shotgun_m870' && bp.arch !== 'bullpup_p90') {
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.018, 0.022), accentSteel);
    rearSight.position.set(0, opticBaseY - 0.018, upperCenterZ - bp.upperLen * 0.34);
    group.add(rearSight);
  }

  // =========================================================================
  // 7. MUZZLE DEVICES (Bespoke Factory Brakes + Suppressor / Comp)
  // =========================================================================
  let finalMuzzleZ = muzzleZ;
  if (bp.integralSuppressor) {
    finalMuzzleZ = muzzleZ + 0.015;
  } else if (attachments.muzzle === 'muzzle_suppressor') {
    const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.19, 16), carbonMat);
    sup.rotation.x = Math.PI / 2;
    sup.position.set(0, bp.barrelY, muzzleZ + 0.085);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.022, 16), accentSteel);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, bp.barrelY, muzzleZ + 0.008);
    group.add(sup, collar);
    finalMuzzleZ = muzzleZ + 0.185;
  } else if (attachments.muzzle === 'muzzle_comp') {
    const comp = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.028, 0.068), accentSteel);
    comp.position.set(0, bp.barrelY, muzzleZ + 0.03);
    group.add(comp);
    finalMuzzleZ = muzzleZ + 0.068;
  } else {
    // Authentic factory muzzle device per weapon
    if (bp.arch === 'bullpup_ash12' || bp.arch === 'shotgun_s12k') {
      // Giant rectangular dual-port 12.7mm / GK-01 breacher brake
      const bigBrake = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.038, 0.088), gunMetal);
      bigBrake.position.set(0, bp.barrelY, muzzleZ + 0.04);
      group.add(bigBrake);
      finalMuzzleZ = muzzleZ + 0.084;
    } else if (bp.arch === 'sniper_awm' || bp.arch === 'sniper_r93') {
      // Heavy 2/3-port rectangular sniper muzzle brake
      const sniperBrake = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.026, 0.075), accentSteel);
      sniperBrake.position.set(0, bp.barrelY, muzzleZ + 0.035);
      group.add(sniperBrake);
      finalMuzzleZ = muzzleZ + 0.075;
    } else if (bp.arch === 'lmg_pkm') {
      // Iconic flared conical PKM flash hider
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.015, 0.065, 12), gunMetal);
      cone.rotation.x = Math.PI / 2;
      cone.position.set(0, bp.barrelY, muzzleZ + 0.03);
      group.add(cone);
      finalMuzzleZ = muzzleZ + 0.064;
    } else if (bp.arch === 'ak_classic') {
      // Classic 45-degree slant AKM compensator
      const slant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.038, 10), gunMetal);
      slant.rotation.x = Math.PI / 2;
      slant.position.set(0, bp.barrelY, muzzleZ + 0.018);
      group.add(slant);
      finalMuzzleZ = muzzleZ + 0.038;
    } else if (bp.arch !== 'shotgun_m870') {
      const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.042, 10), gunMetal);
      flashHider.rotation.x = Math.PI / 2;
      flashHider.position.set(0, bp.barrelY, muzzleZ + 0.018);
      group.add(flashHider);
      finalMuzzleZ = muzzleZ + 0.04;
    }
  }

  // =========================================================================
  // 8. FOREGRIPS
  // =========================================================================
  const gripZ = bp.handguardStartZ + handguardLen * 0.55;
  if (
    bp.arch !== 'shotgun_m870' &&
    bp.arch !== 'bullpup_p90' &&
    (attachments.grip === 'grip_vertical' || bp.arch === 'bullpup_aug')
  ) {
    const vGrip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.013, 0.1, 10),
      bp.arch === 'bullpup_aug' ? upperMat : darkPolymer
    );
    vGrip.position.set(0, -0.072, gripZ);
    group.add(vGrip);
  } else if (bp.arch !== 'shotgun_m870' && bp.arch !== 'bullpup_p90' && attachments.grip === 'grip_angled') {
    const aGrip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.042, 0.092), darkPolymer);
    aGrip.position.set(0, -0.052, gripZ);
    aGrip.rotation.x = -0.35;
    group.add(aGrip);
  }

  // =========================================================================
  // 9. MAGAZINES & LMG AMMO BOXES + BRASS BELT LINKS
  // =========================================================================
  if (bp.arch === 'bullpup_p90' || bp.arch === 'shotgun_m870') {
    // Magazine already mounted on top of P90 or under-barrel on M870
  } else if (bp.arch === 'lmg_m249' || bp.arch === 'lmg_pkm') {
    const [bw, bh, bd] = bp.magSize;
    const boxMat = hasCustomSkin ? upperMat : makePolymerMat(bp.magColor);
    const ammoBox = new THREE.Mesh(createChamferPlateGeo(bw, bh, bd, 0.008), boxMat);
    ammoBox.rotation.y = Math.PI / 2;
    ammoBox.position.set(bp.arch === 'lmg_pkm' ? 0.052 : 0, -0.095, upperCenterZ + 0.03);
    ammoBox.castShadow = true;
    group.add(ammoBox);

    // Gleaming exposed brass ammo belt feeding into receiver
    for (let b = 0; b < 5; b++) {
      const round = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.044, 8), brassMat);
      round.rotation.z = Math.PI / 2;
      round.position.set(bp.arch === 'lmg_pkm' ? 0.044 : 0.038, -0.005 - b * 0.012, upperCenterZ + 0.025 + (b % 2) * 0.003);
      group.add(round);
    }
  } else if (attachments.mag === 'mag_drum') {
    const drumZ = isBullpup ? -0.125 : upperCenterZ + bp.upperLen * 0.34;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.076, 0.058, 18), darkPolymer);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0, -0.092, drumZ);
    const drumHub = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.064, 12), skinAccentMat);
    drumHub.rotation.x = Math.PI / 2;
    drumHub.position.set(0, -0.092, drumZ);
    group.add(drum, drumHub);
  } else {
    const magZ = isBullpup ? -0.125 : bp.arch === 'smg_vector' ? 0.115 : upperCenterZ + bp.upperLen * 0.34;
    const [mw, baseMh, md] = bp.magSize;
    const mh = attachments.mag === 'mag_fast' ? baseMh + 0.032 : baseMh;

    if (bp.curvedMag) {
      const upperMag = new THREE.Mesh(new THREE.BoxGeometry(mw, mh * 0.56, md), magBodyMat);
      upperMag.position.set(0, -0.062 - mh * 0.12, magZ);
      upperMag.rotation.x = 0.12;
      const lowerMag = new THREE.Mesh(new THREE.BoxGeometry(mw * 0.96, mh * 0.54, md * 0.94), magBodyMat);
      lowerMag.position.set(0, -0.092 - mh * 0.42, magZ + 0.028);
      lowerMag.rotation.x = 0.42;
      group.add(upperMag, lowerMag);
    } else {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, md), magBodyMat);
      mag.position.set(0, -0.044 - mh * 0.44, magZ);
      mag.rotation.x = bp.magAngle ?? 0.08;
      group.add(mag);
    }

    if (attachments.mag === 'mag_fast') {
      const pullLoop = new THREE.Mesh(
        new THREE.TorusGeometry(0.018, 0.0045, 6, 12),
        hasCustomSkin ? skinAccentMat : tanPolymer
      );
      pullLoop.position.set(0, -0.065 - mh * 0.85, magZ + (bp.curvedMag ? 0.034 : 0.01));
      group.add(pullLoop);
    }
  }

  const muzzleTip = new THREE.Object3D();
  muzzleTip.position.set(0, bp.barrelY, finalMuzzleZ);
  group.add(muzzleTip);

  return { group, muzzleTip };
}

export function buildOperatorModel(
  operatorId: OperatorId,
  weaponId: WeaponId,
  attachments: Record<AttachmentSlot, string | null>,
  armorTier: number = 2,
  weaponSkinId: WeaponSkinId = 'factory_standard'
): HumanoidRig {
  const pal = OP_COLORS[operatorId];
  const root = new THREE.Group();
  const exoGlowMeshes: THREE.Mesh[] = [];
  let companionMesh: THREE.Object3D | undefined;

  // Photorealistic Physical PBR Materials with Cordura ripstop weave, weathered ceramic armor & skin pore maps
  const fabricTex = createTacticalFabricTextures(pal.suit, pal.pattern);
  const armorTex = createTacticalFabricTextures(pal.armor, 'ripstop');
  const armorWear = getWeatheredArmorMaps();
  const skinMaps = getSkinPoreMaps();
  const hairTex = createTacticalFabricTextures(pal.hair, 'ripstop');

  const suitMat = new THREE.MeshPhysicalMaterial({
    map: fabricTex.map,
    bumpMap: fabricTex.bumpMap,
    bumpScale: 0.015,
    roughnessMap: fabricTex.roughnessMap,
    roughness: 0.86,
    metalness: 0.04,
    sheen: 0.42,
    sheenRoughness: 0.68,
    sheenColor: new THREE.Color(pal.suit).lerp(new THREE.Color(0x94a3b8), 0.2),
  });

  const armorMat = new THREE.MeshPhysicalMaterial({
    map: armorTex.map,
    bumpMap: armorWear.bumpMap,
    bumpScale: 0.01,
    roughnessMap: armorWear.roughnessMap,
    roughness: 0.46,
    metalness: 0.56,
    clearcoat: 0.14,
    clearcoatRoughness: 0.52,
  });

  const bootMat = new THREE.MeshPhysicalMaterial({
    color: pal.boot,
    bumpMap: armorWear.bumpMap,
    bumpScale: 0.008,
    roughnessMap: armorWear.roughnessMap,
    roughness: 0.62,
    metalness: 0.18,
    clearcoat: 0.08,
  });

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: pal.skin,
    bumpMap: skinMaps.bumpMap,
    bumpScale: 0.004,
    roughnessMap: skinMaps.roughnessMap,
    roughness: 0.68,
    metalness: 0.0,
    sheen: 0.12,
    sheenColor: new THREE.Color(0xd99b84),
    sheenRoughness: 0.72,
  });

  const hairMat = new THREE.MeshPhysicalMaterial({
    color: pal.hair,
    bumpMap: hairTex.bumpMap,
    bumpScale: 0.012,
    roughness: 0.54,
    metalness: 0.08,
    sheen: 0.28,
    sheenColor: new THREE.Color(pal.hairTip),
    sheenRoughness: 0.55,
  });

  const hairHighlightMat = new THREE.MeshPhysicalMaterial({
    color: pal.hairTip,
    bumpMap: hairTex.bumpMap,
    bumpScale: 0.01,
    roughness: 0.5,
    metalness: 0.1,
    sheen: 0.3,
  });

  const accentMat = new THREE.MeshPhysicalMaterial({
    color: pal.accent,
    emissive: pal.accent,
    emissiveIntensity: 0.36,
    roughness: 0.34,
    metalness: 0.55,
    clearcoat: 0.4,
  });

  const visorGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f1722,
    emissive: pal.accent,
    emissiveIntensity: 0.16,
    roughness: 0.08,
    metalness: 0.35,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    ior: 1.52,
    transparent: true,
    opacity: 0.84,
  });

  const shoulderScale = pal.female ? 0.9 : 1.04;
  const waistScale = pal.female ? 0.86 : 1.0;

  // Pelvis at waist height (y = 0.88m) -> combat boot soles rest flush at y = 0
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.88, 0);
  root.add(pelvis);

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175 * waistScale, 0.185 * waistScale, 0.12, 16),
    armorMat
  );
  belt.scale.z = 0.74;
  belt.castShadow = true;
  pelvis.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.055, 0.03), accentMat);
  buckle.position.set(0, 0.01, 0.135);
  pelvis.add(buckle);

  // Sculpted Legs with Thigh Drop-Rig, Armored Kneecaps & Lugged Combat Boots
  const buildLeg = (side: -1 | 1) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * (pal.female ? 0.098 : 0.112), -0.04, 0);

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088 * (pal.female ? 0.94 : 1.0), 0.072, 0.34, 14),
      suitMat
    );
    thigh.position.set(0, -0.2, 0);
    thigh.castShadow = true;
    legGroup.add(thigh);

    // Thigh strap + cargo/holster rig
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.086, 0.036, 14), bootMat);
    strap.position.set(0, -0.19, 0);
    legGroup.add(strap);

    // Contoured Armored Knee Pad + Side Rivets
    const kneeShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      armorMat
    );
    kneeShell.rotation.x = Math.PI / 2;
    kneeShell.position.set(0, -0.39, 0.035);
    kneeShell.scale.set(0.95, 1.15, 0.85);
    legGroup.add(kneeShell);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.056, 0.34, 14), suitMat);
    shin.position.set(0, -0.57, 0);
    shin.castShadow = true;
    legGroup.add(shin);

    const shinGuard = new THREE.Mesh(createChamferPlateGeo(0.085, 0.22, 0.03, 0.006), armorMat);
    shinGuard.position.set(0, -0.56, 0.056);
    legGroup.add(shinGuard);

    // Multi-Part Tactical Boot (ankle cuff, vamp, lugged rubber sole touching y = 0)
    const bootUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.068, 0.13, 12), bootMat);
    bootUpper.position.set(0, -0.73, 0.005);
    legGroup.add(bootUpper);

    const bootToe = new THREE.Mesh(createChamferPlateGeo(0.115, 0.082, 0.21, 0.015), bootMat);
    bootToe.rotation.x = Math.PI / 2;
    bootToe.position.set(0, -0.785, 0.048);
    bootToe.castShadow = true;
    legGroup.add(bootToe);

    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.124, 0.028, 0.235), armorMat);
    bootSole.position.set(0, -0.826, 0.045);
    legGroup.add(bootSole);

    if (side === 1) {
      const holster = new THREE.Mesh(createChamferPlateGeo(0.062, 0.15, 0.095, 0.008), bootMat);
      holster.position.set(0.088, -0.19, 0.015);
      legGroup.add(holster);
    } else {
      const magLegPouch = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.085), armorMat);
      magLegPouch.position.set(-0.085, -0.2, 0.01);
      legGroup.add(magLegPouch);
    }

    return legGroup;
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  pelvis.add(leftLeg, rightLeg);

  // Sculpted Upper Body Rig
  const upperBody = new THREE.Group();
  upperBody.position.set(0, 0.05, 0);
  pelvis.add(upperBody);

  // Tapered athletic torso core (waist -> broad chest)
  const lowerTorso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.165 * shoulderScale, 0.145 * waistScale, 0.23, 16),
    suitMat
  );
  lowerTorso.scale.z = 0.68;
  lowerTorso.position.set(0, 0.14, 0);
  lowerTorso.castShadow = true;
  upperBody.add(lowerTorso);

  const upperTorso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.192 * shoulderScale, 0.165 * shoulderScale, 0.26, 16),
    suitMat
  );
  upperTorso.scale.z = 0.72;
  upperTorso.position.set(0, 0.35, 0);
  upperTorso.castShadow = true;
  upperBody.add(upperTorso);

  // Chamfered Ballistic Plate Carrier (front & rear sculpted plates scaling with armorTier)
  const plateBulk = 0.012 + armorTier * 0.008;
  const frontPlate = new THREE.Mesh(
    createChamferPlateGeo(0.3 * shoulderScale + plateBulk, 0.32, 0.055 + plateBulk * 0.4, 0.014),
    armorMat
  );
  frontPlate.position.set(0, 0.29, 0.12 + plateBulk * 0.4);
  frontPlate.castShadow = true;
  upperBody.add(frontPlate);

  const backPlate = new THREE.Mesh(
    createChamferPlateGeo(0.28 * shoulderScale + plateBulk, 0.31, 0.05 + plateBulk * 0.3, 0.014),
    armorMat
  );
  backPlate.position.set(0, 0.3, -0.115 - plateBulk * 0.3);
  backPlate.castShadow = true;
  upperBody.add(backPlate);

  // Side cummerbund straps + shoulder rig straps
  [-1, 1].forEach((s) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.028, 0.26), bootMat);
    strap.position.set(s * 0.11 * shoulderScale, 0.46, 0);
    upperBody.add(strap);
  });

  // Chest triple mag pouches + protruding rifle mags + tactical radio & glowing PTT
  for (let p = -1; p <= 1; p++) {
    const pouch = new THREE.Mesh(createChamferPlateGeo(0.074, 0.105, 0.044, 0.006), bootMat);
    pouch.position.set(p * 0.084, 0.21, 0.162 + plateBulk * 0.5);
    upperBody.add(pouch);

    const magTop = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.038, 0.026), armorMat);
    magTop.position.set(p * 0.084, 0.275, 0.162 + plateBulk * 0.5);
    upperBody.add(magTop);
  }

  const radioUnit = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.092, 0.036), bootMat);
  radioUnit.position.set(-0.125 * shoulderScale, 0.37, 0.158 + plateBulk * 0.5);
  upperBody.add(radioUnit);
  const radioLed = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.04), accentMat);
  radioLed.position.set(-0.125 * shoulderScale, 0.402, 0.158 + plateBulk * 0.5);
  upperBody.add(radioLed);

  const chestBadge = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.026, 0.016), accentMat);
  chestBadge.position.set(0.072 * shoulderScale, 0.38, 0.154 + plateBulk * 0.5);
  upperBody.add(chestBadge);

  // Bespoke 3D Backpacks, Coats & Signature Equipment for All 8 Operators
  if (operatorId === 'luna') {
    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.042, 0.54, 10), bootMat);
    quiver.position.set(-0.13, 0.32, -0.19);
    quiver.rotation.z = -0.34;
    upperBody.add(quiver);
    for (let a = -1; a <= 1; a++) {
      const fletch = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.065, 5), accentMat);
      fletch.position.set(-0.2 + a * 0.02, 0.57, -0.19);
      fletch.rotation.z = -0.34;
      upperBody.add(fletch);
    }
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.44, 8), accentMat);
    antenna.position.set(0.14, 0.58, -0.15);
    upperBody.add(antenna);
    exoGlowMeshes.push(antenna);

    const capelet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.16, 14, 1, true, 0.4, Math.PI * 1.4), armorMat);
    capelet.position.set(-0.02, 0.44, -0.02);
    capelet.rotation.y = Math.PI * 0.85;
    upperBody.add(capelet);
  } else if (operatorId === 'stinger') {
    const medPack = new THREE.Mesh(createChamferPlateGeo(0.28, 0.34, 0.14, 0.016), armorMat);
    medPack.position.set(0, 0.29, -0.19);
    upperBody.add(medPack);
    const canisterL = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.28, 14), accentMat);
    canisterL.position.set(-0.08, 0.34, -0.265);
    const canisterR = canisterL.clone();
    canisterR.position.x = 0.08;
    upperBody.add(canisterL, canisterR);
    exoGlowMeshes.push(canisterL, canisterR);
  } else if (operatorId === 'dwolf') {
    const redScarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.145, 0.052, 10, 20),
      new THREE.MeshPhysicalMaterial({ color: 0xb91c1c, roughness: 0.78, sheen: 0.5 })
    );
    redScarf.rotation.x = Math.PI / 2;
    redScarf.position.set(0, 0.49, 0.01);
    upperBody.add(redScarf);
    const thrusterPack = new THREE.Mesh(createChamferPlateGeo(0.32, 0.32, 0.15, 0.015), bootMat);
    thrusterPack.position.set(0, 0.3, -0.19);
    upperBody.add(thrusterPack);
    const nozzleL = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.06, 0.15, 12), accentMat);
    nozzleL.position.set(-0.11, 0.17, -0.26);
    nozzleL.rotation.x = 0.34;
    const nozzleR = nozzleL.clone();
    nozzleR.position.x = 0.11;
    upperBody.add(nozzleL, nozzleR);
    exoGlowMeshes.push(nozzleL, nozzleR);
  } else if (operatorId === 'shepherd') {
    const blastCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.13, 18, 1, true), armorMat);
    blastCollar.position.set(0, 0.5, 0);
    upperBody.add(blastCollar);
    const droneDock = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 10), armorMat);
    droneDock.rotation.x = Math.PI / 2;
    droneDock.position.set(0, 0.32, -0.21);
    upperBody.add(droneDock);
    const droneCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.072, 1), accentMat);
    droneCore.position.set(0, 0.32, -0.27);
    upperBody.add(droneCore);
    exoGlowMeshes.push(droneCore);
  } else if (operatorId === 'hackclaw') {
    // Sleek cyber-hood collar + violet fiber seams + holstered chest/back data-blades + tail coat
    const hoodCollar = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.045, 10, 20), armorMat);
    hoodCollar.rotation.x = Math.PI / 2;
    hoodCollar.position.set(0, 0.49, -0.01);
    upperBody.add(hoodCollar);

    const coatTailL = new THREE.Mesh(createChamferPlateGeo(0.14, 0.38, 0.025, 0.006), suitMat);
    coatTailL.position.set(-0.09, -0.04, -0.14);
    coatTailL.rotation.x = 0.16;
    const coatTailR = coatTailL.clone();
    coatTailR.position.x = 0.09;
    upperBody.add(coatTailL, coatTailR);

    const cyberPack = new THREE.Mesh(createChamferPlateGeo(0.22, 0.28, 0.11, 0.012), bootMat);
    cyberPack.position.set(0, 0.31, -0.18);
    upperBody.add(cyberPack);

    [-0.075, 0.075].forEach((bx, idx) => {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.22, 4), accentMat);
      blade.position.set(bx, 0.44, -0.22);
      blade.rotation.z = idx === 0 ? 0.28 : -0.28;
      upperBody.add(blade);
      exoGlowMeshes.push(blade);
    });
  } else if (operatorId === 'vyron') {
    // Kinetic orange powered exo-harness + dual jet wings & shoulder exhausts
    const exoHarness = new THREE.Mesh(createChamferPlateGeo(0.32, 0.33, 0.14, 0.014), armorMat);
    exoHarness.position.set(0, 0.31, -0.185);
    upperBody.add(exoHarness);

    [-1, 1].forEach((side) => {
      const fin = new THREE.Mesh(createChamferPlateGeo(0.14, 0.26, 0.024, 0.006), bootMat);
      fin.position.set(side * 0.2, 0.34, -0.22);
      fin.rotation.y = side * 0.45;
      fin.rotation.z = -side * 0.25;
      upperBody.add(fin);

      const jetCone = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.056, 0.13, 12), accentMat);
      jetCone.position.set(side * 0.12, 0.18, -0.26);
      jetCone.rotation.x = 0.4;
      upperBody.add(jetCone);
      exoGlowMeshes.push(jetCone);
    });
  } else if (operatorId === 'uluru') {
    // Heavy coyote-tan EOD shoulder pads + bandolier + shoulder-mounted Loitering Missile Tube
    const eodPack = new THREE.Mesh(createChamferPlateGeo(0.34, 0.38, 0.18, 0.016), armorMat);
    eodPack.position.set(0, 0.3, -0.2);
    upperBody.add(eodPack);

    const missileTube = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.62, 12), bootMat);
    missileTube.position.set(-0.15, 0.42, -0.22);
    missileTube.rotation.x = -0.35;
    missileTube.rotation.z = 0.18;
    upperBody.add(missileTube);

    const warheadTip = new THREE.Mesh(new THREE.ConeGeometry(0.054, 0.1, 10), accentMat);
    warheadTip.position.set(-0.2, 0.68, -0.32);
    warheadTip.rotation.x = -0.35;
    warheadTip.rotation.z = 0.18;
    upperBody.add(warheadTip);
    exoGlowMeshes.push(warheadTip);
  } else if (operatorId === 'toxik') {
    // High-collar bio trench coat + glowing cyan bio-vials on chest + hovering bio-drone companion
    const highCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.185, 0.14, 16, 1, true, 0.4, Math.PI * 1.65),
      armorMat
    );
    highCollar.rotation.y = Math.PI * 0.68;
    highCollar.position.set(0, 0.51, -0.01);
    upperBody.add(highCollar);

    for (let v = -1.5; v <= 1.5; v += 1) {
      const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8), accentMat);
      vial.position.set(v * 0.036, 0.33, 0.17);
      upperBody.add(vial);
      exoGlowMeshes.push(vial);
    }

    const coatSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.24, 0.36, 14, 1, true, 0.5, Math.PI * 1.45),
      suitMat
    );
    coatSkirt.position.set(0, -0.04, -0.02);
    coatSkirt.rotation.y = Math.PI * 0.8;
    upperBody.add(coatSkirt);

    // Floating Bio-Drone hovering behind right shoulder
    const drone = new THREE.Group();
    drone.position.set(0.32, 0.72, -0.18);
    const droneBody = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 1), armorMat);
    const droneEye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), accentMat);
    droneEye.position.z = 0.06;
    const droneRing = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.01, 6, 18), accentMat);
    droneRing.rotation.x = Math.PI / 2;
    drone.add(droneBody, droneEye, droneRing);
    upperBody.add(drone);
    companionMesh = drone;
    exoGlowMeshes.push(droneEye);
  }

  // =====================================================================
  // PHOTOREALISTIC MILITARY CG HEAD, ANATOMICAL FACE & TACTICAL HEADGEAR
  // =====================================================================
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.072, 0.125, 14), skinMat);
  neck.position.set(0, 0.52, 0.008);
  upperBody.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.635, 0.014);
  upperBody.add(head);

  // Realistic Anatomical Cranium + Brow Ridge + Defined Jawline/Chin
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.122, 24, 20), skinMat);
  skull.scale.set(0.92, 1.06, 1.02);
  skull.castShadow = true;
  head.add(skull);

  const browRidge = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.02, 0.044), skinMat);
  browRidge.position.set(0, 0.028, 0.106);
  head.add(browRidge);

  const jaw = new THREE.Mesh(
    new THREE.CylinderGeometry(0.092, pal.female ? 0.056 : 0.068, 0.094, 16),
    skinMat
  );
  jaw.position.set(0, -0.064, 0.026);
  jaw.scale.set(0.92, 1.0, 0.96);
  head.add(jaw);

  // Sculpted Nose Bridge & Tip
  const noseBridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.044, 0.028), skinMat);
  noseBridge.position.set(0, -0.006, 0.122);
  noseBridge.rotation.x = -0.22;
  head.add(noseBridge);

  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), skinMat);
  noseTip.position.set(0, -0.025, 0.128);
  head.add(noseTip);

  // Subtle Mouth / Lip Crease
  const lipCrease = new THREE.Mesh(
    new THREE.BoxGeometry(0.036, 0.006, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x6e473b, roughness: 0.78 })
  );
  lipCrease.position.set(0, -0.054, 0.115);
  head.add(lipCrease);

  // Realistic Almond Human Eyes (recessed beneath brow ridge, natural iris + shadowed eyelid crease)
  const irisTex = createIrisTexture(pal.accent);
  const eyeMat = new THREE.MeshStandardMaterial({ map: irisTex, roughness: 0.16, metalness: 0.05 });
  const eyelidMat = new THREE.MeshStandardMaterial({ color: 0x4b3328, roughness: 0.78 });

  [-1, 1].forEach((side) => {
    const eyePlane = new THREE.Mesh(new THREE.CircleGeometry(0.0145, 16), eyeMat);
    eyePlane.scale.set(1.12, 0.56, 1.0);
    eyePlane.position.set(side * 0.038, 0.008, 0.117);
    eyePlane.rotation.y = side * 0.2;
    head.add(eyePlane);

    const upperLid = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.0045, 0.01), eyelidMat);
    upperLid.position.set(side * 0.038, 0.016, 0.118);
    upperLid.rotation.y = side * 0.2;
    upperLid.rotation.z = -side * 0.06;
    head.add(upperLid);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.007, 0.012), hairMat);
    brow.position.set(side * 0.039, 0.031, 0.119);
    brow.rotation.y = side * 0.2;
    brow.rotation.z = -side * 0.08;
    head.add(brow);
  });

  // Realistic Military Groomed Hair (NO spiky anime cones)
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.127, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat
  );
  hairCap.scale.set(0.94, 1.04, 1.02);
  hairCap.rotation.x = -0.22;
  head.add(hairCap);

  if (pal.female) {
    // Sleek parted forehead sweep + low tactical combat bun
    [-1, 1].forEach((side) => {
      const partSweep = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.034, 0.055), hairHighlightMat);
      partSweep.position.set(side * 0.048, 0.072, 0.088);
      partSweep.rotation.z = -side * 0.28;
      partSweep.rotation.y = side * 0.22;
      head.add(partSweep);
    });
    const combatBun = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 12), hairMat);
    combatBun.scale.set(1.0, 0.9, 1.15);
    combatBun.position.set(0, -0.005, -0.132);
    head.add(combatBun);
  } else {
    // Short military buzz / crew cut crown
    const crewTop = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.032, 0.165), hairHighlightMat);
    crewTop.position.set(0, 0.108, 0.008);
    head.add(crewTop);
  }

  // Peltor ComTac Ballistic Ear-Pro Comms Headset + Boom Mic + Chinstrap
  const earCupL = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.04, 0.032, 14), bootMat);
  earCupL.rotation.z = Math.PI / 2;
  earCupL.position.set(-0.128, 0.005, 0);
  const earCupR = earCupL.clone();
  earCupR.position.x = 0.128;
  head.add(earCupL, earCupR);

  const boomMic = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.105, 6), bootMat);
  boomMic.rotation.z = Math.PI / 2 - 0.32;
  boomMic.rotation.y = 0.58;
  boomMic.position.set(-0.095, -0.042, 0.078);
  head.add(boomMic);

  // Operator-Specific Authentic Military Headgear, FAST Helmets, Ballistic Eyewear & Respirators
  if (operatorId === 'luna') {
    const commsBand = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.011, 8, 20, Math.PI), bootMat);
    head.add(commsBand);
    const shootingGlasses = new THREE.Mesh(new THREE.BoxGeometry(0.126, 0.028, 0.012), visorGlassMat);
    shootingGlasses.position.set(0, 0.011, 0.129);
    head.add(shootingGlasses);
  } else if (operatorId === 'stinger') {
    // OPS-CORE FAST high-cut tactical helmet + dual-cartridge M50 ballistic respirator
    const fastHelmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.142, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.48),
      armorMat
    );
    fastHelmet.position.y = 0.022;
    fastHelmet.castShadow = true;
    head.add(fastHelmet);
    const mask = new THREE.Mesh(createChamferPlateGeo(0.135, 0.078, 0.082, 0.012), bootMat);
    mask.position.set(0, -0.056, 0.09);
    head.add(mask);
    const filterL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.032, 12), armorMat);
    filterL.rotation.x = Math.PI / 2;
    filterL.position.set(-0.048, -0.058, 0.128);
    const filterR = filterL.clone();
    filterR.position.x = 0.048;
    head.add(filterL, filterR);
  } else if (operatorId === 'dwolf') {
    // Heavy FAST ballistic helmet + NVG Wilco shroud + ARC side rails + tactical balaclava
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.148, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
      armorMat
    );
    helmet.position.y = 0.024;
    helmet.castShadow = true;
    head.add(helmet);
    const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.04, 0.032), bootMat);
    nvgMount.position.set(0, 0.086, 0.136);
    head.add(nvgMount);
    const visorBand = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.022, 0.02), visorGlassMat);
    visorBand.position.set(0, 0.048, 0.135);
    head.add(visorBand);
    const gaiter = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.096, 0.075, 16), bootMat);
    gaiter.position.set(0, -0.075, 0.018);
    head.add(gaiter);
  } else if (operatorId === 'shepherd') {
    // Ballistic Kevlar hood + smoked polycarbonate tactical goggles
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.148, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
      armorMat
    );
    hood.rotation.x = -0.26;
    head.add(hood);
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.154, 0.038, 0.032), visorGlassMat);
    goggles.position.set(0, 0.014, 0.122);
    head.add(goggles);
  } else if (operatorId === 'hackclaw') {
    // Matte charcoal recon hood + sleek smoked tactical eyewear
    const reconHood = new THREE.Mesh(
      new THREE.SphereGeometry(0.142, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
      bootMat
    );
    reconHood.rotation.x = -0.28;
    head.add(reconHood);
    const visorFrame = new THREE.Mesh(
      new THREE.CylinderGeometry(0.126, 0.126, 0.032, 18, 1, true, -0.76, 1.52),
      visorGlassMat
    );
    visorFrame.position.set(0, 0.011, 0.018);
    head.add(visorFrame);
    const bridgeBar = new THREE.Mesh(new THREE.BoxGeometry(0.142, 0.007, 0.012), bootMat);
    bridgeBar.position.set(0, 0.028, 0.13);
    head.add(bridgeBar);
  } else if (operatorId === 'vyron') {
    // Tactical comms headband + smoked ballistic shooting goggles
    const headband = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.011, 8, 20, Math.PI), armorMat);
    head.add(headband);
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.028, 0.012), visorGlassMat);
    goggles.position.set(0, 0.012, 0.129);
    head.add(goggles);
  } else if (operatorId === 'uluru') {
    // Olive-tan knit tactical watch cap + realistic sculpted military beard
    const beanie = new THREE.Mesh(
      new THREE.SphereGeometry(0.136, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      bootMat
    );
    beanie.position.y = 0.022;
    beanie.rotation.x = -0.18;
    head.add(beanie);
    const beanieCuff = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.02, 8, 20), armorMat);
    beanieCuff.rotation.x = Math.PI / 2 - 0.18;
    beanieCuff.position.set(0, 0.046, -0.008);
    head.add(beanieCuff);
    const beard = new THREE.Mesh(
      new THREE.SphereGeometry(0.098, 14, 10, 0, Math.PI, Math.PI * 0.56, Math.PI * 0.42),
      hairMat
    );
    beard.position.set(0, -0.044, 0.032);
    head.add(beard);
  } else if (operatorId === 'toxik') {
    // Tactical half-face chemical respirator mask with subtle status diode
    const mask = new THREE.Mesh(createChamferPlateGeo(0.13, 0.076, 0.078, 0.012), bootMat);
    mask.position.set(0, -0.052, 0.09);
    head.add(mask);
    const ventCap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.02, 12), armorMat);
    ventCap.rotation.x = Math.PI / 2;
    ventCap.position.set(0, -0.056, 0.13);
    head.add(ventCap);
    const ventDiode = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.006, 0.008), accentMat);
    ventDiode.position.set(0.032, -0.048, 0.132);
    head.add(ventDiode);
    exoGlowMeshes.push(ventDiode);
  }

  // Articulated Arms, Contoured Pauldrons, Bracers & Weapon-Gripping Hands
  const armX = 0.23 * shoulderScale;
  const leftArm = new THREE.Group();
  leftArm.position.set(-armX, 0.41, 0);
  const rightArm = new THREE.Group();
  rightArm.position.set(armX, 0.41, 0);

  const buildArmGeometry = (armGrp: THREE.Group, isRight: boolean) => {
    const pauldron = new THREE.Mesh(createChamferPlateGeo(0.125, 0.125, 0.14, 0.014), armorMat);
    pauldron.position.set(0, -0.015, 0);
    pauldron.rotation.z = isRight ? -0.18 : 0.18;
    armGrp.add(pauldron);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.046, 0.24, 12), suitMat);
    upper.position.set(0, -0.17, 0.06);
    upper.rotation.x = -0.45;
    armGrp.add(upper);

    const elbowPad = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), bootMat);
    elbowPad.position.set(0, -0.26, 0.13);
    armGrp.add(elbowPad);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.038, 0.22, 12), armorMat);
    forearm.position.set(isRight ? -0.04 : 0.08, -0.28, 0.24);
    forearm.rotation.x = -1.15;
    forearm.rotation.z = isRight ? 0.15 : -0.35;
    armGrp.add(forearm);

    // Wrist Tactical Watch / Holo-Screen on left arm
    if (!isRight) {
      const wristPad = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.02, 0.052), accentMat);
      wristPad.position.set(0.11, -0.245, 0.31);
      wristPad.rotation.x = -0.4;
      armGrp.add(wristPad);
    }

    // Articulated Glove + Thumb
    const palm = new THREE.Mesh(createChamferPlateGeo(0.058, 0.056, 0.075, 0.008), bootMat);
    palm.position.set(isRight ? -0.06 : 0.14, -0.24, 0.36);
    armGrp.add(palm);

    if (!isRight && operatorId === 'dwolf') {
      const launcher = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.072, 0.16), accentMat);
      launcher.position.set(0.04, -0.24, 0.25);
      launcher.rotation.x = -1.15;
      armGrp.add(launcher);
    }
  };

  buildArmGeometry(leftArm, false);
  buildArmGeometry(rightArm, true);
  upperBody.add(leftArm, rightArm);

  // Weapon Mount
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0.16 * shoulderScale, 0.24, 0.28);
  upperBody.add(weaponMount);

  const { group: weaponMesh, muzzleTip } = buildWeaponModel(weaponId, attachments, weaponSkinId);
  weaponMount.add(weaponMesh);

  return {
    root,
    pelvis,
    upperBody,
    head,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    weaponMount,
    muzzleTip,
    exoGlowMeshes,
    companionMesh,
  };
}

export function buildEnemyModel(kind: EnemyKind): HumanoidRig {
  const root = new THREE.Group();
  const exoGlowMeshes: THREE.Mesh[] = [];

  const isBoss = kind === 'boss';
  const isHeavy = kind === 'heavy';
  const isSniper = kind === 'sniper';

  const scale = isBoss ? 1.2 : isHeavy ? 1.12 : 1.0;
  root.scale.setScalar(scale);

  const suitColor = isBoss ? 0x181615 : isHeavy ? 0x262d36 : isSniper ? 0x1b2b23 : 0x222933;
  const accentColor = isBoss ? 0xb93434 : isHeavy ? 0xc28327 : isSniper ? 0x168074 : 0x993838;

  const fabricTex = createTacticalFabricTextures(suitColor, isBoss ? 'hex' : 'ripstop');
  const armorWear = getWeatheredArmorMaps();
  const suitMat = new THREE.MeshPhysicalMaterial({
    map: fabricTex.map,
    bumpMap: fabricTex.bumpMap,
    bumpScale: 0.014,
    roughnessMap: fabricTex.roughnessMap,
    roughness: 0.85,
    metalness: 0.06,
    sheen: 0.35,
  });
  const armorMat = new THREE.MeshPhysicalMaterial({
    color: 0x1b222c,
    bumpMap: armorWear.bumpMap,
    bumpScale: 0.01,
    roughnessMap: armorWear.roughnessMap,
    roughness: 0.46,
    metalness: 0.62,
    clearcoat: 0.12,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.42,
    roughness: 0.35,
  });

  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.88, 0);
  root.add(pelvis);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.13, 14), armorMat);
  belt.scale.z = 0.75;
  pelvis.add(belt);

  const makeLeg = (side: -1 | 1) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.11, -0.05, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.072, 0.34, 12), suitMat);
    thigh.position.y = -0.2;
    thigh.castShadow = true;
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.058, 0.34, 12), suitMat);
    shin.position.y = -0.56;
    shin.castShadow = true;
    const boot = new THREE.Mesh(createChamferPlateGeo(0.12, 0.1, 0.22, 0.012), armorMat);
    boot.rotation.x = Math.PI / 2;
    boot.position.set(0, -0.78, 0.04);
    leg.add(thigh, shin, boot);
    return leg;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  pelvis.add(leftLeg, rightLeg);

  const upperBody = new THREE.Group();
  upperBody.position.set(0, 0.06, 0);
  pelvis.add(upperBody);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.16, 0.48, 14), suitMat);
  torso.scale.z = 0.72;
  torso.position.y = 0.25;
  torso.castShadow = true;
  upperBody.add(torso);

  const plate = new THREE.Mesh(createChamferPlateGeo(0.32, 0.33, 0.07, 0.012), armorMat);
  plate.position.set(0, 0.28, 0.125);
  upperBody.add(plate);

  if (isBoss) {
    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 0.98, 9, 1, true),
      new THREE.MeshPhysicalMaterial({ color: 0x7f1d1d, roughness: 0.8, sheen: 0.4, side: THREE.DoubleSide })
    );
    cloak.position.set(0, 0.08, -0.1);
    cloak.rotation.x = 0.16;
    upperBody.add(cloak);
  }

  const head = new THREE.Group();
  head.position.set(0, 0.62, 0);
  upperBody.add(head);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12), armorMat);
  helmet.castShadow = true;
  head.add(helmet);

  const eyeVisor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), accentMat);
  eyeVisor.position.set(0, 0.01, 0.13);
  head.add(eyeVisor);

  if (isBoss) {
    for (let g = -1.5; g <= 1.5; g += 1) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.085, 8), accentMat);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(g * 0.045, 0.1, 0.132);
      head.add(tube);
    }
  }

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.25, 0.42, 0);
  const rightArm = new THREE.Group();
  rightArm.position.set(0.25, 0.42, 0);
  const armGeo = new THREE.CylinderGeometry(0.054, 0.044, 0.36, 10);
  const lArmMesh = new THREE.Mesh(armGeo, suitMat);
  lArmMesh.position.set(0, -0.18, 0.12);
  lArmMesh.rotation.x = -0.9;
  const rArmMesh = lArmMesh.clone();
  leftArm.add(lArmMesh);
  rightArm.add(rArmMesh);
  upperBody.add(leftArm, rightArm);

  let shieldMesh: THREE.Mesh | undefined;
  if (isHeavy) {
    shieldMesh = new THREE.Mesh(
      createChamferPlateGeo(0.68, 1.15, 0.08, 0.016),
      new THREE.MeshPhysicalMaterial({ color: 0x475569, metalness: 0.82, roughness: 0.3, clearcoat: 0.3 })
    );
    shieldMesh.position.set(-0.22, 0.1, 0.42);
    shieldMesh.castShadow = true;
    upperBody.add(shieldMesh);

    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.095), accentMat);
    slit.position.set(0, 0.34, 0);
    shieldMesh.add(slit);
  }

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0.18, 0.24, 0.28);
  upperBody.add(weaponMount);

  const wId: WeaponId = isSniper ? 'awm' : isBoss ? 'scarh' : 'm4a1';
  const { group: wMesh, muzzleTip } = buildWeaponModel(wId, {
    optic: isSniper ? 'optic_acog' : null,
    barrel: isSniper ? 'barrel_long' : null,
    muzzle: null,
    grip: null,
    stock: isBoss ? 'stock_heavy' : null,
    mag: isBoss ? 'mag_drum' : null,
  });
  weaponMount.add(wMesh);

  return {
    root,
    pelvis,
    upperBody,
    head,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    weaponMount,
    muzzleTip,
    exoGlowMeshes,
    shieldMesh,
  };
}

export function animateHumanoid(
  rig: HumanoidRig,
  time: number,
  speedRatio: number,
  recoilAmount: number,
  isReloading: boolean
) {
  if (speedRatio > 0.05) {
    const freq = 9.5 + speedRatio * 4.5;
    const swing = Math.sin(time * freq) * Math.min(0.75, 0.45 * speedRatio + 0.18);
    rig.leftLeg.rotation.x = swing;
    rig.rightLeg.rotation.x = -swing;
    rig.pelvis.position.y = 0.88 + Math.abs(Math.cos(time * freq)) * 0.045;
  } else {
    rig.leftLeg.rotation.x *= 0.82;
    rig.rightLeg.rotation.x *= 0.82;
    rig.pelvis.position.y = 0.88 + Math.sin(time * 2.2) * 0.014;
    rig.head.rotation.y = Math.sin(time * 0.9) * 0.06;
  }

  if (rig.companionMesh) {
    rig.companionMesh.position.y = 0.72 + Math.sin(time * 3.2) * 0.06;
    rig.companionMesh.rotation.y = time * 1.4;
  }

  rig.weaponMount.position.z = 0.28 - recoilAmount * 0.09;
  rig.weaponMount.rotation.x = isReloading ? 0.55 : -recoilAmount * 0.22;
  rig.weaponMount.rotation.z = isReloading ? 0.35 : 0;
}
