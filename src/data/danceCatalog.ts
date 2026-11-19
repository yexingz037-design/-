export type DanceId =
  | 'cyber_shuffle'
  | 'moonwalk_glide'
  | 'robot_popping'
  | 'tactical_hardbass'
  | 'neon_floss'
  | 'victory_salute_spin'
  | 'breakdance_windmill'
  | 'synthwave_groove'
  | 'cyber_phonk_walk'
  | 'disco_fever'
  | 'dubstep_glitch'
  | 'kpop_sharp_wave'
  | 'gun_kata_drill'
  | 'samba_carnival'
  | 'shadow_boxing_rap'
  | 'zero_g_levitate'
  | 'pixel_8bit_hop'
  | 'eurobeat_drift'
  | 'heavy_metal_headbang'
  | 'trance_rave_laser';

export type DanceCategory = 'street' | 'cyber' | 'tactical' | 'party';

export type DanceVfxMode =
  | 'laser_sweep'
  | 'pulse_rings'
  | 'strobe_spot'
  | 'cyber_vortex'
  | 'ember_burst'
  | 'holo_wave';

export interface DanceDef {
  id: DanceId;
  index: number;
  name: string;
  category: DanceCategory;
  durationSec: number; // Strictly 5 - 15 seconds
  bpm: number;
  musicStyle: string;
  accentHex: string;
  secondaryHex: string;
  vfxMode: DanceVfxMode;
  weaponMode: 'sling_back' | 'rifle_show';
  description: string;
}

export const DANCE_CATEGORY_LABELS: Record<'all' | DanceCategory, string> = {
  all: '全部 (20)',
  street: '街舞律动',
  cyber: '赛博电音',
  tactical: '战术整活',
  party: '狂欢热舞',
};

export const DANCE_CATALOG: DanceDef[] = [
  {
    id: 'cyber_shuffle',
    index: 1,
    name: '赛博曳步舞',
    category: 'cyber',
    durationSec: 9,
    bpm: 128,
    musicStyle: 'Cyber House',
    accentHex: '#00E59B',
    secondaryHex: '#22D3EE',
    vfxMode: 'pulse_rings',
    weaponMode: 'sling_back',
    description: '疾速交叉鬼步滑踏配全息脉冲地板波纹',
  },
  {
    id: 'moonwalk_glide',
    index: 2,
    name: '零重力太空步',
    category: 'street',
    durationSec: 10,
    bpm: 116,
    musicStyle: 'Electro Funk',
    accentHex: '#38BDF8',
    secondaryHex: '#A855F7',
    vfxMode: 'holo_wave',
    weaponMode: 'sling_back',
    description: '丝滑后撤太空滑步与冷蓝霓虹波浪光束',
  },
  {
    id: 'robot_popping',
    index: 3,
    name: '机械战警震感舞',
    category: 'cyber',
    durationSec: 8,
    bpm: 108,
    musicStyle: 'Electro Boogie',
    accentHex: '#22D3EE',
    secondaryHex: '#F59E0B',
    vfxMode: 'laser_sweep',
    weaponMode: 'sling_back',
    description: '卡点关节定格与机械伺服扫射激光',
  },
  {
    id: 'tactical_hardbass',
    index: 4,
    name: '硬核斯拉夫蹲踢',
    category: 'party',
    durationSec: 11,
    bpm: 146,
    musicStyle: 'Slavic Hardbass',
    accentHex: '#F97316',
    secondaryHex: '#FACC15',
    vfxMode: 'ember_burst',
    weaponMode: 'sling_back',
    description: '狂暴低音交替深蹲高踢与战地火星迸发',
  },
  {
    id: 'neon_floss',
    index: 5,
    name: '霓虹极速甩手舞',
    category: 'party',
    durationSec: 6,
    bpm: 136,
    musicStyle: 'Hyper Pop',
    accentHex: '#EC4899',
    secondaryHex: '#22D3EE',
    vfxMode: 'strobe_spot',
    weaponMode: 'sling_back',
    description: '高节奏双臂前后反胯摆荡配霓虹频闪聚光',
  },
  {
    id: 'victory_salute_spin',
    index: 6,
    name: '凯旋枪花炫技',
    category: 'tactical',
    durationSec: 7,
    bpm: 122,
    musicStyle: 'Tactical Drumstep',
    accentHex: '#00E59B',
    secondaryHex: '#F59E0B',
    vfxMode: 'laser_sweep',
    weaponMode: 'rifle_show',
    description: '单手持枪360°转身炫技与胜利光束巡扫',
  },
  {
    id: 'breakdance_windmill',
    index: 7,
    name: '废土街舞旋风',
    category: 'street',
    durationSec: 12,
    bpm: 132,
    musicStyle: 'Breakbeat',
    accentHex: '#F43F5E',
    secondaryHex: '#F59E0B',
    vfxMode: 'cyber_vortex',
    weaponMode: 'sling_back',
    description: '顶步晃肩切入腾空旋风回转与赤红光涡',
  },
  {
    id: 'synthwave_groove',
    index: 8,
    name: '落日合成波摇摆',
    category: 'cyber',
    durationSec: 13,
    bpm: 104,
    musicStyle: '80s Synthwave',
    accentHex: '#A855F7',
    secondaryHex: '#F43F5E',
    vfxMode: 'holo_wave',
    weaponMode: 'sling_back',
    description: '复古紫红霓虹律动与慵懒侧滑双指摇摆',
  },
  {
    id: 'cyber_phonk_walk',
    index: 9,
    name: '暗夜Phonk霸王步',
    category: 'street',
    durationSec: 9,
    bpm: 134,
    musicStyle: 'Drift Phonk',
    accentHex: '#EF4444',
    secondaryHex: '#A855F7',
    vfxMode: 'strobe_spot',
    weaponMode: 'sling_back',
    description: '牛铃重低音压迫迈步与暗红赛博暴闪',
  },
  {
    id: 'disco_fever',
    index: 10,
    name: '战术迪斯科指天',
    category: 'party',
    durationSec: 11,
    bpm: 124,
    musicStyle: 'Nu-Disco Funk',
    accentHex: '#FACC15',
    secondaryHex: '#EC4899',
    vfxMode: 'pulse_rings',
    weaponMode: 'sling_back',
    description: '经典对角指天摆胯舞步与金色律动光环',
  },
  {
    id: 'dubstep_glitch',
    index: 11,
    name: '故障电音电流舞',
    category: 'cyber',
    durationSec: 10,
    bpm: 140,
    musicStyle: 'Cyber Dubstep',
    accentHex: '#06B6D4',
    secondaryHex: '#8B5CF6',
    vfxMode: 'cyber_vortex',
    weaponMode: 'sling_back',
    description: '全身电流波纹传导配重低音故障漩涡',
  },
  {
    id: 'kpop_sharp_wave',
    index: 12,
    name: '脉冲刀群节奏舞',
    category: 'street',
    durationSec: 14,
    bpm: 126,
    musicStyle: 'K-Electro Pop',
    accentHex: '#F472B6',
    secondaryHex: '#38BDF8',
    vfxMode: 'strobe_spot',
    weaponMode: 'sling_back',
    description: '利落几何定格折手、灵动扭胯与双色追光',
  },
  {
    id: 'gun_kata_drill',
    index: 13,
    name: '枪斗术战术节奏操',
    category: 'tactical',
    durationSec: 8,
    bpm: 118,
    musicStyle: 'Industrial Techno',
    accentHex: '#10B981',
    secondaryHex: '#38BDF8',
    vfxMode: 'laser_sweep',
    weaponMode: 'rifle_show',
    description: '卡鼓点多向切角瞄准与战术压枪转身操',
  },
  {
    id: 'samba_carnival',
    index: 14,
    name: '热带桑巴狂欢步',
    category: 'party',
    durationSec: 12,
    bpm: 130,
    musicStyle: 'Latin Samba',
    accentHex: '#22C55E',
    secondaryHex: '#FACC15',
    vfxMode: 'ember_burst',
    weaponMode: 'sling_back',
    description: '轻快拉丁高频碎步抖肩与翠金庆典烟火',
  },
  {
    id: 'shadow_boxing_rap',
    index: 15,
    name: '说唱拳击律动',
    category: 'tactical',
    durationSec: 7,
    bpm: 96,
    musicStyle: 'Boom-Bap Rap',
    accentHex: '#F59E0B',
    secondaryHex: '#EF4444',
    vfxMode: 'pulse_rings',
    weaponMode: 'sling_back',
    description: '拳击摇闪连击配重拍嘻哈冲击波环',
  },
  {
    id: 'zero_g_levitate',
    index: 16,
    name: '赛博零重力悬浮舞',
    category: 'cyber',
    durationSec: 15,
    bpm: 112,
    musicStyle: 'Future Bass',
    accentHex: '#38BDF8',
    secondaryHex: '#00E59B',
    vfxMode: 'cyber_vortex',
    weaponMode: 'sling_back',
    description: '反重力浮空360°缓旋与升腾量子粒子涡流',
  },
  {
    id: 'pixel_8bit_hop',
    index: 17,
    name: '像素8-Bit欢乐跳',
    category: 'party',
    durationSec: 5,
    bpm: 148,
    musicStyle: 'Chiptune 8-Bit',
    accentHex: '#34D399',
    secondaryHex: '#FACC15',
    vfxMode: 'pulse_rings',
    weaponMode: 'sling_back',
    description: '欢快街机连跳招手配复古红白机芯片乐',
  },
  {
    id: 'eurobeat_drift',
    index: 18,
    name: '极速漂移Para舞',
    category: 'street',
    durationSec: 13,
    bpm: 154,
    musicStyle: 'Eurobeat Racing',
    accentHex: '#FB7185',
    secondaryHex: '#38BDF8',
    vfxMode: 'laser_sweep',
    weaponMode: 'sling_back',
    description: '超高速双臂齐挥漂移倾身与极光对扫',
  },
  {
    id: 'heavy_metal_headbang',
    index: 19,
    name: '战地重金属吉他魂',
    category: 'tactical',
    durationSec: 9,
    bpm: 138,
    musicStyle: 'Cyber Metal',
    accentHex: '#DC2626',
    secondaryHex: '#F97316',
    vfxMode: 'ember_burst',
    weaponMode: 'rifle_show',
    description: '端起主武器狂飙失真电吉他并猛烈甩头',
  },
  {
    id: 'trance_rave_laser',
    index: 20,
    name: '末日锐舞激光秀',
    category: 'cyber',
    durationSec: 15,
    bpm: 142,
    musicStyle: 'Euphoric Trance',
    accentHex: '#818CF8',
    secondaryHex: '#00E59B',
    vfxMode: 'cyber_vortex',
    weaponMode: 'sling_back',
    description: '举手锐舞轰炸连跳与全屏交错激光盛典',
  },
];

export const DANCE_MAP: Record<DanceId, DanceDef> = DANCE_CATALOG.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<DanceId, DanceDef>
);
