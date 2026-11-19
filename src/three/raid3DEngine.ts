import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../audio/soundEngine';
import {
  ARMOR_TIERS,
  LOOT_TEMPLATES,
  MAPS,
  OPERATORS,
  RAID_DURATION_SEC,
  TACTICAL_GEAR,
  WEAPONS,
  WORLD_HEIGHT,
  WORLD_SCALE,
  WORLD_WIDTH,
  computeEncumbrancePenalty,
  computeWeaponStats,
  getItemWeight,
  rollLootItem,
} from '../data/gameData';
import {
  animateHumanoid,
  buildEnemyModel,
  buildOperatorModel,
  buildWeaponModel,
  HumanoidRig,
} from './characterBuilder';
import { AnimatedMapProp, buildMapScene3D, ExtractBeaconRef, WeatherSurfaceRef } from './mapSceneBuilder';
import {
  BulletHoleSurface,
  createContactShadowTexture,
  detectSoftwareWebGL,
  getBulletHolePBRTextures,
  getDustPuffSpriteTexture,
  getSoftGlowSpriteTexture,
} from './textures';
import {
  DEFAULT_CONTROL_SETTINGS,
  sanitizeControlSettings,
} from '../storage/settingsStore';
import {
  BodyPartId,
  BodyPartStatus,
  CameraViewMode,
  ComputedWeaponStats,
  EnemyKind,
  HudSnapshot,
  LoadoutConfig,
  LootInstance,
  MapDef,
  MapObstacle,
  RaidOutcome,
  ScopeTier,
  TacticalControlSettings,
  TacticalGearId,
  TacticalSlotKey,
  TimeOfDayPhase,
  WeaponSkinId,
  WeatherType,
} from '../types/game';

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _colA = new THREE.Color();
const _colB = new THREE.Color();
const _colC = new THREE.Color();
const _colSnowFrost = new THREE.Color(0xdbeafe);
const _colWetTint = new THREE.Color(0x64748b);
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1);

const WEATHER_ORDER: WeatherType[] = ['clear', 'rain', 'smog', 'snow'];

const WEATHER_META: Record<
  WeatherType,
  { label: string; effectSummary: string; visionMult: number; noiseMult: number; moveMult: number; staminaMult: number }
> = {
  clear: {
    label: '晴朗',
    effectSummary: '视野良好 · 声学传播正常',
    visionMult: 1.0,
    noiseMult: 1.0,
    moveMult: 1.0,
    staminaMult: 1.0,
  },
  rain: {
    label: '暴雨',
    effectSummary: '移动声传播 +25% · 湿滑反光 · 敌视 -8%',
    visionMult: 0.92,
    noiseMult: 1.25,
    moveMult: 0.98,
    staminaMult: 1.04,
  },
  snow: {
    label: '降雪',
    effectSummary: '积雪移速 -6% · 脚步声 -12% · 敌视 -16%',
    visionMult: 0.84,
    noiseMult: 0.88,
    moveMult: 0.94,
    staminaMult: 1.1,
  },
  smog: {
    label: '重度雾霾',
    effectSummary: '敌军侦测视野 -44% · 能见度大幅受限',
    visionMult: 0.56,
    noiseMult: 0.96,
    moveMult: 1.0,
    staminaMult: 1.05,
  },
};

function to3DX(x2d: number): number {
  return x2d * WORLD_SCALE;
}
function to3DZ(y2d: number): number {
  return y2d * WORLD_SCALE;
}

export interface BallisticShotPayload {
  wx: number;
  wy: number;
  wz: number;
  ex: number;
  ey: number;
  ez: number;
  speed3d: number;
  caliberWeight: number;
  firingCadence: number;
  fromPlayer: boolean;
  color: string;
}

export interface BallisticImpactPayload {
  wx: number;
  wy: number;
  wz: number;
  nx: number;
  ny: number;
  nz: number;
  surface: BulletHoleSurface;
  caliberWeight: number;
  firingCadence: number;
}

interface Bullet3D {
  active: boolean;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  vx: number;
  vy: number;
  traveled: number;
  maxRange: number;
  damage: number;
  armorPen: number;
  fromPlayer: boolean;
  isExplosive: boolean;
  explosionRadius?: number;
  caliberWeight: number;
}

interface ShellCasing3D {
  active: boolean;
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinZ: number;
  life: number;
}

interface Particle3D {
  active: boolean;
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  gravity: number;
}

interface DustPuff3D {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  baseOpacity: number;
}

interface SmokeCloud3D {
  group: THREE.Group;
  x: number;
  y: number;
  radius: number;
  life: number;
  isIrritant?: boolean;
  tickAccum?: number;
}

interface DeployableWall3D {
  obstacle: MapObstacle;
  mesh: THREE.Group;
  life: number;
}

interface SignalJammer3D {
  group: THREE.Group;
  ring: THREE.Mesh;
  led: THREE.Mesh;
  x: number;
  y: number;
  radius: number;
  life: number;
}

interface AcousticDecoy3D {
  group: THREE.Group;
  led: THREE.Mesh;
  x: number;
  y: number;
  life: number;
  pulseAccum: number;
}

interface ReconDrone3D {
  group: THREE.Group;
  rotors: THREE.Mesh[];
  led: THREE.Mesh;
  ring: THREE.Mesh;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  life: number;
  scanAccum: number;
}

interface ReconPulse3D {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  maxRadius: number;
  life: number;
}

interface Grenade3D {
  mesh: THREE.Mesh;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  elapsed: number;
  flightTime: number;
  fuseTime: number;
  radius: number;
  kind: 'smoke' | 'cs_smoke' | 'flash' | 'decoy';
}

interface WorldContainer3D {
  id: string;
  name: string;
  kind: 'safe' | 'weapon_crate' | 'server' | 'med_bag' | 'supply_box';
  x: number;
  y: number;
  searching: boolean;
  searched: boolean;
  revealTimer: number;
  items: LootInstance[];
  mesh: THREE.Group;
  beaconRing: THREE.Mesh;
}

interface Enemy3D {
  id: string;
  kind: EnemyKind;
  name: string;
  rig: HumanoidRig;
  beaconMesh: THREE.Mesh;
  laserLine?: THREE.Line;
  x: number;
  y: number;
  radius: number;
  angle: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  speed: number;
  visionRange: number;
  visionFov: number;
  alertness: number;
  state: 'patrol' | 'investigate' | 'combat';
  targetX: number;
  targetY: number;
  patrolPoints: Array<{ x: number; y: number }>;
  patrolIdx: number;
  fireCooldown: number;
  windupTimer: number;
  maxWindup: number;
  hitFlash: number;
  markedTimer: number;
  stunTimer: number;
  slowTimer: number;
  strafeDir: number;
  strafeTimer: number;
  roamX: number;
  roamY: number;
  roamTimer: number;
  roamWaitTimer: number;
  roamScanDir: number;
}

export class Raid3DEngine {
  private mountEl: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;

  private loadout: LoadoutConfig;
  private mapDef: MapDef;
  private weaponStats: ComputedWeaponStats;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onRaidEnd: (outcome: RaidOutcome) => void;
  private onToggleBackpack: () => void;
  private onTogglePause: () => void;
  private onBallisticShot?: (ev: BallisticShotPayload) => void;
  private onBallisticImpact?: (ev: BallisticImpactPayload) => void;
  private radarDishMesh: THREE.Object3D | null = null;
  private animatedProps: AnimatedMapProp[] = [];
  private weatherSurfaces: WeatherSurfaceRef[] = [];
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private playerFlashlight!: THREE.SpotLight;
  private flashlightManualOverride: boolean | null = null;
  private flashlightOn = false;

  private disposed = false;
  private frameId = 0;
  private clock = new THREE.Clock();
  private paused = false;
  private inputBlocked = false;
  private ended = false;
  private hitstopTimer = 0;

  // Dynamic Weather & Day-to-Night Cycle State
  private weather: WeatherType = 'clear';
  private weatherTimer = 34;
  private rainBlend = 0;
  private snowBlend = 0;
  private smogBlend = 0;
  private lightningFlash = 0;
  private thunderTimer = 12;
  private timeOfDayHours = 15.2; // Starts mid-afternoon -> dusk -> night -> dawn -> day (~185s full 24h cycle)
  private currentEnemyVisionMult = 1.0;
  private currentPlayerNoiseMult = 1.0;
  private footstepTimer = 0;

  // Weather 3D Particle Systems
  private rainLines: THREE.LineSegments | null = null;
  private rainPositions: Float32Array | null = null;
  private snowPoints: THREE.Points | null = null;
  private snowVelocities: Float32Array | null = null;
  private smogPoints: THREE.Points | null = null;
  private smogVelocities: Float32Array | null = null;

  // First-Person / Third-Person Switchable Camera & Tactical Control Settings State
  private controlSettings: TacticalControlSettings = { ...DEFAULT_CONTROL_SETTINGS };
  private activeScopeTier: ScopeTier = 'iron';
  private activeScopeLabel = '机械瞄具';
  private cameraMode: CameraViewMode = 'first';
  private pointerLocked = false;
  private fpPitch = -0.04;
  private leanTarget: -1 | 0 | 1 = 0;
  private leanAmount = 0;
  private fpWeaponMount: THREE.Group | null = null;
  private fpMuzzleTip: THREE.Object3D | null = null;
  private lastMouseClientX: number | null = null;
  private fpWalkPhase = 0;

  // Player state (logical 2D coords 0..2800 x 0..2000 mapped to 3D meters via WORLD_SCALE)
  private px = 220;
  private py = 1520;
  private pAngle = 0;
  private pRadius = 16;
  private playerSpeedRatio = 0;
  private playerRig: HumanoidRig;
  private playerAimMarker: THREE.Mesh;
  private laserBeamLine: THREE.Line;
  private laserDotMesh: THREE.Mesh;
  private muzzleLight: THREE.PointLight;
  private muzzleFlashMesh: THREE.Group;
  private muzzleFlashTimer = 0;

  private hp = 100;
  private maxHp = 100;
  private armor = 50;
  private maxArmor = 50;
  private armorReduction = 0.35;
  private stamina = 100;
  private maxStamina = 100;
  private isStaminaExhausted = false;
  private isCurrentlySprinting = false;
  private staminaRegenRatePct = 100;
  private medkits = 2;
  private armorPlates = 2;

  private ammoInMag = 30;
  private reserveAmmo = 180;
  private fireTimer = 0;
  private reloadTimer = 0;
  private isReloading = false;
  private weaponDurability = 100;
  private isWeaponJammed = false;
  private jamClearing = false;
  private jamClearTimer = 0;
  private readonly jamClearDuration = 1.25;
  private jamsExperienced = 0;
  private recoilBloom = 0;
  private recoilVisual = 0;
  private playerHitFlash = 0;
  private bodyParts: Record<BodyPartId, BodyPartStatus> = {
    head: { hp: 35, maxHp: 35, bleeding: false },
    chest: { hp: 85, maxHp: 85, bleeding: false },
    arms: { hp: 65, maxHp: 65, bleeding: false },
    legs: { hp: 65, maxHp: 65, bleeding: false },
  };

  // Non-Lethal Tactical Gear Loadout Slots (Q / E / X)
  private gearSlots: Record<TacticalSlotKey, TacticalGearId>;
  private gearUseCounts: Partial<Record<TacticalGearId, number>> = {};
  private qCooldown = 0;
  private eCooldown = 0;
  private xCooldown = 0;
  private qCharges: number | null = null;
  private eCharges: number | null = 3;
  private xCharges: number | null = 2;
  private laserActiveTimer = 0;
  private binocularsActiveTimer = 0;
  private irActiveTimer = 0;
  private droneActiveTimer = 0;
  private radioReconActiveTimer = 0;
  private radioReconAccum = 0;

  // Raid state
  private raidTimeRemaining = RAID_DURATION_SEC;
  private raidElapsed = 0;
  private kills = 0;
  private bossKilled = false;
  private bossEngaged = false;
  private statusBanner: string | null = null;
  private statusBannerTimer = 0;

  // Inventory & Extract (Random Power Lever + 3-Minute Corner Extraction Hold)
  private backpack: LootInstance[] = [];
  private safeBox: LootInstance[] = [];
  private activeContainerId: string | null = null;
  private leverPos = { x: 2200, y: 1600, name: '撤离电源总闸', zoneName: '战区中控点' };
  private leverPulled = false;
  private leverGroup: THREE.Group | null = null;
  private leverHandlePivot: THREE.Group | null = null;
  private leverBeaconMesh: THREE.Mesh | null = null;
  private leverBeamMesh: THREE.Mesh | null = null;
  private leverRingMesh: THREE.Mesh | null = null;
  private activeExtractId: string | null = null;
  private extractProgress = 0;
  private extractPingAccum = 0;
  private extractNoiseAccum = 0;

  // Input & Camera
  private heldKeys = new Set<string>();
  private mouseDown = false;
  private rightMouseDown = false;
  private mouseNdcX = 0;
  private mouseNdcY = 0;
  private camZoom = 1.0; // 0.65 .. 1.45
  private shakeMag = 0;
  private introTimer = 2.1; // 2.1s dramatic low-angle military cutscene insertion dolly shot

  // World Pools & Entities
  private containers: WorldContainer3D[] = [];
  private enemies: Enemy3D[] = [];
  private bullets: Bullet3D[] = [];
  private shellCasings: ShellCasing3D[] = [];
  private particles: Particle3D[] = [];
  private smokes: SmokeCloud3D[] = [];
  private deployableWalls: DeployableWall3D[] = [];
  private signalJammers: SignalJammer3D[] = [];
  private reconDrones: ReconDrone3D[] = [];
  private acousticDecoys: AcousticDecoy3D[] = [];
  private grenades: Grenade3D[] = [];
  private reconPulses: ReconPulse3D[] = [];
  private scorchDecals: THREE.Mesh[] = [];
  private bulletHoleGeo: THREE.PlaneGeometry | null = null;
  private bulletHoleMats = new Map<string, THREE.MeshStandardMaterial>();
  private bulletHoleDecals: THREE.Mesh[] = [];
  private bulletHoleCursor = 0;
  private dustPuffGeo: THREE.PlaneGeometry | null = null;
  private dustPuffs: DustPuff3D[] = [];
  private recentPlayerShotTimes: number[] = [];
  private firingCadence = 0;
  private extractRings: THREE.Mesh[] = [];
  private extractBeacons: ExtractBeaconRef[] = [];
  private ambientWeatherPoints: THREE.Points | null = null;
  private ambientWeatherVelocities: Float32Array | null = null;
  private weatherSmokeAccum = 0;
  private hudSyncAccum = 0;

  // Spatial Audio & Acoustic Enclosure State
  private smoothedEnclosure = 0;
  private distantAlarmTimer = 5.5;
  private announcedExtracts = new Set<string>();

  constructor(params: {
    mountEl: HTMLElement;
    loadout: LoadoutConfig;
    initialWeaponDurability?: number;
    initialControlSettings?: TacticalControlSettings;
    onHudUpdate: (snapshot: HudSnapshot) => void;
    onRaidEnd: (outcome: RaidOutcome) => void;
    onToggleBackpack: () => void;
    onTogglePause: () => void;
    onBallisticShot?: (ev: BallisticShotPayload) => void;
    onBallisticImpact?: (ev: BallisticImpactPayload) => void;
  }) {
    this.mountEl = params.mountEl;
    this.loadout = params.loadout;
    this.controlSettings = params.initialControlSettings
      ? sanitizeControlSettings(params.initialControlSettings)
      : { ...DEFAULT_CONTROL_SETTINGS };
    this.camZoom = this.controlSettings.tpZoom;
    const scopeProfile = this.resolveScopeProfile(params.loadout);
    this.activeScopeTier = scopeProfile.tier;
    this.activeScopeLabel = scopeProfile.label;
    this.weaponDurability =
      typeof params.initialWeaponDurability === 'number'
        ? Math.max(0, Math.min(100, params.initialWeaponDurability))
        : 100;
    this.mapDef = MAPS[params.loadout.mapId || 'zero_dam'] || MAPS.zero_dam;
    this.px = this.mapDef.spawnPoint.x;
    this.py = this.mapDef.spawnPoint.y;
    this.onHudUpdate = params.onHudUpdate;
    this.onRaidEnd = params.onRaidEnd;
    this.onToggleBackpack = params.onToggleBackpack;
    this.onTogglePause = params.onTogglePause;
    this.onBallisticShot = params.onBallisticShot;
    this.onBallisticImpact = params.onBallisticImpact;

    this.weaponStats = computeWeaponStats(params.loadout.weaponId, params.loadout.attachments);
    const op = OPERATORS[params.loadout.operatorId];
    const armorDef = ARMOR_TIERS.find((a) => a.tier === params.loadout.armorTier) || ARMOR_TIERS[0];

    this.maxHp = op.maxHp;
    this.hp = op.maxHp;
    const hpScale = op.maxHp / 105;
    this.bodyParts = {
      head: { hp: Math.round(35 * hpScale), maxHp: Math.round(35 * hpScale), bleeding: false },
      chest: { hp: Math.round(85 * hpScale), maxHp: Math.round(85 * hpScale), bleeding: false },
      arms: { hp: Math.round(65 * hpScale), maxHp: Math.round(65 * hpScale), bleeding: false },
      legs: { hp: Math.round(65 * hpScale), maxHp: Math.round(65 * hpScale), bleeding: false },
    };
    this.maxArmor = armorDef.maxArmor;
    this.armor = armorDef.maxArmor;
    this.armorReduction = armorDef.damageReduction;
    this.medkits = params.loadout.medkits;
    this.armorPlates = params.loadout.armorPlates;
    this.gearSlots = {
      Q: params.loadout.tacticalGear?.Q || 'laser_designator',
      E: params.loadout.tacticalGear?.E || 'm18_smoke',
      X: params.loadout.tacticalGear?.X || 'signal_jammer',
    };
    this.qCharges = TACTICAL_GEAR[this.gearSlots.Q].maxCharges;
    this.eCharges = TACTICAL_GEAR[this.gearSlots.E].maxCharges;
    this.xCharges = TACTICAL_GEAR[this.gearSlots.X].maxCharges;
    this.ammoInMag = this.weaponStats.magSize;
    this.reserveAmmo = this.weaponStats.magSize * 5;

    // 1. Renderer setup with Software-WebGL guard
    this.isSoftwareGl = detectSoftwareWebGL();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.mountEl.clientWidth, Math.max(1, this.mountEl.clientHeight));
    this.mountEl.appendChild(this.renderer.domElement);

    // 2. Scene, Environment & Atmospheric Fog per Map Theme
    const theme = this.mapDef.theme;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(theme.skyColor);
    this.scene.fog = new THREE.FogExp2(theme.fogColor, theme.fogDensity);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      44,
      this.mountEl.clientWidth / Math.max(1, this.mountEl.clientHeight),
      0.08,
      280
    );
    this.scene.add(this.camera);

    // 3. Dynamic Day/Night & Weather-Driven Tactical Lighting Rig
    const hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, 0.72);
    this.scene.add(hemi);
    this.hemiLight = hemi;

    const sun = new THREE.DirectionalLight(theme.sunColor, theme.sunIntensity * 1.05);
    const initPx3 = to3DX(this.px);
    const initPz3 = to3DZ(this.py);
    sun.position.set(initPx3 + 42, 56, initPz3 + 46);
    sun.target.position.set(initPx3, 0, initPz3);
    sun.castShadow = !this.isSoftwareGl;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -42;
    sun.shadow.camera.right = 42;
    sun.shadow.camera.top = 42;
    sun.shadow.camera.bottom = -42;
    sun.shadow.camera.near = 8;
    sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sunLight = sun;

    const rim = new THREE.DirectionalLight(new THREE.Color(theme.accentHex), 0.85);
    rim.position.set(-45, 28, -45);
    this.scene.add(rim);
    this.rimLight = rim;

    // Weapon-mounted tactical flashlight (auto-activates at dusk/night/smog or toggle with [L])
    const flashlight = new THREE.SpotLight(0xeef6ff, 0, 34, Math.PI * 0.24, 0.52, 1.35);
    flashlight.position.set(initPx3, 1.45, initPz3);
    flashlight.target.position.set(initPx3 + 12, 0.9, initPz3);
    this.scene.add(flashlight);
    this.scene.add(flashlight.target);
    this.playerFlashlight = flashlight;

    // 4. Build Ultra-Realistic 3D Map, Multi-Part Houses, Instanced Grass & Landmarks
    const mapBuilt = buildMapScene3D(
      this.scene,
      this.mapDef,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    this.radarDishMesh = mapBuilt.radarDishMesh;
    this.extractRings = mapBuilt.extractRings;
    this.extractBeacons = mapBuilt.extractBeacons;
    this.animatedProps = mapBuilt.animatedProps;
    this.weatherSurfaces = mapBuilt.weatherSurfaces;

    // 4b. Spawn Randomized Extraction Power Switch (拉闸装置) in a random tactical location
    this.initExtractionLever3D();

    // 5. Build Full-Body 3D Player Operator with Equipped Weapon & Skin
    const equippedSkin =
      params.loadout.weaponSkins?.[params.loadout.weaponId] || 'factory_standard';
    this.playerRig = buildOperatorModel(
      params.loadout.operatorId,
      params.loadout.weaponId,
      params.loadout.attachments,
      params.loadout.armorTier,
      equippedSkin
    );
    this.playerRig.root.position.set(to3DX(this.px), 0, to3DZ(this.py));
    this.scene.add(this.playerRig.root);

    // Build Dedicated First-Person Tactical Weapon & Gloved Hands Viewmodel attached to Camera
    this.initFirstPersonViewmodel(params.loadout.weaponId, params.loadout.attachments, equippedSkin);

    const shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({
        map: createContactShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.52,
      })
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.02;
    this.playerRig.root.add(shadowMesh);

    // 3D Tactical Laser Designator Beam & Target Dot
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 1.25, 0),
      new THREE.Vector3(0, 1.25, 1),
    ]);
    this.laserBeamLine = new THREE.Line(
      laserGeo,
      new THREE.LineBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.85,
      })
    );
    this.laserBeamLine.visible = false;
    this.laserBeamLine.frustumCulled = false;
    this.scene.add(this.laserBeamLine);

    this.laserDotMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x6ee7b7 })
    );
    this.laserDotMesh.visible = false;
    this.scene.add(this.laserDotMesh);

    this.muzzleLight = new THREE.PointLight(0xfbbf24, 0, 9);
    this.muzzleLight.position.set(0, 1.3, 0);
    this.scene.add(this.muzzleLight);

    // 3D Volumetric Muzzle Flash Star
    this.muzzleFlashMesh = new THREE.Group();
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      map: getSoftGlowSpriteTexture(),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const flashPlaneA = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.24), flashMat);
    const flashPlaneB = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.24), flashMat);
    flashPlaneB.rotation.x = Math.PI / 2;
    const flashCore = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 8), flashMat);
    flashCore.rotation.x = Math.PI / 2;
    this.muzzleFlashMesh.add(flashPlaneA, flashPlaneB, flashCore);
    this.muzzleFlashMesh.visible = false;
    this.scene.add(this.muzzleFlashMesh);

    // 3D Ground Aim Cursor Ring
    this.playerAimMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.44, 24),
      new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    this.playerAimMarker.rotation.x = -Math.PI / 2;
    this.playerAimMarker.position.y = 0.06;
    this.scene.add(this.playerAimMarker);

    // 6. Init Object Pools, Biome Weather & Enemies
    this.initPools();
    this.initAmbientWeather();
    this.initContainersAndEnemies();

    // Pre-warm shaders
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    soundEngine.startRaidAmbience(this.mapDef.theme.groundStyle);
    this.showBanner(`已空降「${this.mapDef.name}」3D 超真实战区 · WASD移动 · Q/E/X 启用非致命战术装备`);
  }



  private initPools() {
    const bulletGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.35, 6);
    bulletGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 140; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
      const mesh = new THREE.Mesh(bulletGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.bullets.push({
        active: false,
        mesh,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        traveled: 0,
        maxRange: 30,
        damage: 20,
        armorPen: 0.4,
        fromPlayer: true,
        isExplosive: false,
        caliberWeight: 1,
      });
    }

    const casingGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.072, 6);
    const casingMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.9, roughness: 0.25 });
    for (let i = 0; i < 64; i++) {
      const mesh = new THREE.Mesh(casingGeo, casingMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shellCasings.push({
        active: false,
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        spinX: 0,
        spinZ: 0,
        life: 0,
      });
    }

    const pGeo = new THREE.BoxGeometry(0.13, 0.13, 0.13);
    for (let i = 0; i < 240; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      const mesh = new THREE.Mesh(pGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        active: false,
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        gravity: 9.8,
      });
    }

    // PBR Bullet-Hole Decal Ring Pool (140 decals sharing 12 cached PBR materials across 4 surfaces x 3 variants)
    this.bulletHoleGeo = new THREE.PlaneGeometry(1, 1);
    const surfaces: BulletHoleSurface[] = ['concrete', 'metal', 'wood', 'kevlar'];
    for (const surface of surfaces) {
      for (let v = 0; v < 3; v++) {
        const bundle = getBulletHolePBRTextures(surface, v);
        const mat = new THREE.MeshStandardMaterial({
          map: bundle.map,
          bumpMap: bundle.bumpMap,
          bumpScale: surface === 'metal' ? 0.048 : 0.04,
          roughnessMap: bundle.roughnessMap,
          roughness: 1.0,
          metalness: surface === 'metal' ? 0.68 : 0.08,
          transparent: true,
          alphaTest: 0.04,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4,
        });
        this.bulletHoleMats.set(`${surface}_${v}`, mat);
      }
    }
    const defaultDecalMat = this.bulletHoleMats.get('concrete_0')!;
    for (let i = 0; i < 140; i++) {
      const decal = new THREE.Mesh(this.bulletHoleGeo, defaultDecalMat);
      decal.visible = false;
      decal.renderOrder = 3;
      this.scene.add(decal);
      this.bulletHoleDecals.push(decal);
    }

    // 3D Matte Volumetric Impact/Muzzle Dust Puff Pool
    this.dustPuffGeo = new THREE.PlaneGeometry(1, 1);
    const dustSprite = getDustPuffSpriteTexture();
    for (let i = 0; i < 84; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: dustSprite,
        color: 0xcbd5e1,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.dustPuffGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 4;
      this.scene.add(mesh);
      this.dustPuffs.push({
        active: false,
        mesh,
        mat,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        startScale: 0.5,
        endScale: 1.8,
        baseOpacity: 0.45,
      });
    }
  }

  private initAmbientWeather() {
    const count = 260;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const style = this.mapDef.theme.groundStyle;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = to3DX(this.px) + (Math.random() - 0.5) * 44;
      positions[i * 3 + 1] = Math.random() * 14 + 0.5;
      positions[i * 3 + 2] = to3DZ(this.py) + (Math.random() - 0.5) * 44;

      if (style === 'dam_concrete') {
        // Rain & hydro mist
        velocities[i * 3] = -1.8;
        velocities[i * 3 + 1] = -13.5 - Math.random() * 4;
        velocities[i * 3 + 2] = 1.4;
      } else if (style === 'valley_forest') {
        // Floating forest fireflies & golden pollen
        velocities[i * 3] = (Math.random() - 0.5) * 1.4;
        velocities[i * 3 + 1] = 0.25 + (Math.random() - 0.5) * 0.6;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
      } else if (style === 'desert_city') {
        // Drifting desert sand & warm embers
        velocities[i * 3] = 4.2 + Math.random() * 2.5;
        velocities[i * 3 + 1] = (Math.random() - 0.4) * 1.2;
        velocities[i * 3 + 2] = 1.6 + Math.random() * 1.2;
      } else {
        // Cryogenic vapor & orbital sparks
        velocities[i * 3] = (Math.random() - 0.5) * 1.2;
        velocities[i * 3 + 1] = 1.2 + Math.random() * 1.4;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pColor =
      style === 'dam_concrete'
        ? 0x93c5fd
        : style === 'valley_forest'
          ? 0xfef08a
          : style === 'desert_city'
            ? 0xfdba74
            : 0x38bdf8;
    const pSize = style === 'dam_concrete' ? 0.32 : style === 'valley_forest' ? 0.42 : 0.36;

    const mat = new THREE.PointsMaterial({
      color: pColor,
      size: pSize,
      map: getSoftGlowSpriteTexture(),
      transparent: true,
      opacity: style === 'dam_concrete' ? 0.52 : 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.ambientWeatherPoints = pts;
    this.ambientWeatherVelocities = velocities;

    // Initialize Dynamic Weather Particle Systems (Rain Streaks, Falling Snow, Swirling Smog)
    const cx = to3DX(this.px);
    const cz = to3DZ(this.py);

    // 1. Slanted Falling Rain Streaks (LineSegments)
    const rainCount = 420;
    const rainPos = new Float32Array(rainCount * 6);
    for (let i = 0; i < rainCount; i++) {
      const rx = cx + (Math.random() - 0.5) * 38;
      const ry = Math.random() * 16 + 0.5;
      const rz = cz + (Math.random() - 0.5) * 38;
      rainPos[i * 6] = rx;
      rainPos[i * 6 + 1] = ry;
      rainPos[i * 6 + 2] = rz;
      rainPos[i * 6 + 3] = rx - 0.14;
      rainPos[i * 6 + 4] = ry - 0.88;
      rainPos[i * 6 + 5] = rz + 0.1;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainLines.frustumCulled = false;
    rainLines.visible = false;
    this.scene.add(rainLines);
    this.rainLines = rainLines;
    this.rainPositions = rainPos;

    // 2. Swirling Snowflakes (Points)
    const snowCount = 360;
    const snowPos = new Float32Array(snowCount * 3);
    const snowVel = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = cx + (Math.random() - 0.5) * 40;
      snowPos[i * 3 + 1] = Math.random() * 15 + 0.2;
      snowPos[i * 3 + 2] = cz + (Math.random() - 0.5) * 40;
      snowVel[i * 3] = (Math.random() - 0.35) * 1.8;
      snowVel[i * 3 + 1] = -(1.4 + Math.random() * 1.4);
      snowVel[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xf1f5f9,
      size: 0.28,
      map: getSoftGlowSpriteTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const snowPts = new THREE.Points(snowGeo, snowMat);
    snowPts.frustumCulled = false;
    snowPts.visible = false;
    this.scene.add(snowPts);
    this.snowPoints = snowPts;
    this.snowVelocities = snowVel;

    // 3. Dense Low-Altitude Industrial Smog / Haze Plumes (Points)
    const smogCount = 160;
    const smogPos = new Float32Array(smogCount * 3);
    const smogVel = new Float32Array(smogCount * 3);
    for (let i = 0; i < smogCount; i++) {
      smogPos[i * 3] = cx + (Math.random() - 0.5) * 44;
      smogPos[i * 3 + 1] = 0.6 + Math.random() * 5.2;
      smogPos[i * 3 + 2] = cz + (Math.random() - 0.5) * 44;
      smogVel[i * 3] = 0.6 + Math.random() * 0.9;
      smogVel[i * 3 + 1] = (Math.random() - 0.5) * 0.14;
      smogVel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    const smogGeo = new THREE.BufferGeometry();
    smogGeo.setAttribute('position', new THREE.BufferAttribute(smogPos, 3));
    const smogMat = new THREE.PointsMaterial({
      color: 0xa3a188,
      size: 4.8,
      map: getDustPuffSpriteTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const smogPts = new THREE.Points(smogGeo, smogMat);
    smogPts.frustumCulled = false;
    smogPts.visible = false;
    this.scene.add(smogPts);
    this.smogPoints = smogPts;
    this.smogVelocities = smogVel;

    // Pick initial biome-flavored weather (dam/space lean rain/smog, valley clear/rain, desert clear/smog)
    const initPool: WeatherType[] =
      style === 'dam_concrete'
        ? ['rain', 'clear', 'smog']
        : style === 'desert_city'
          ? ['smog', 'clear', 'rain']
          : style === 'space_tarmac'
            ? ['clear', 'snow', 'smog']
            : ['clear', 'rain', 'snow'];
    this.weather = initPool[Math.floor(Math.random() * initPool.length)];
    this.rainBlend = this.weather === 'rain' ? 1 : 0;
    this.snowBlend = this.weather === 'snow' ? 1 : 0;
    this.smogBlend = this.weather === 'smog' ? 1 : 0;
    this.weatherTimer = 38 + Math.random() * 14;
    soundEngine.setWeatherAmbience(this.weather);
  }

  private initFirstPersonViewmodel(
    weaponId: LoadoutConfig['weaponId'],
    attachments: LoadoutConfig['attachments'],
    weaponSkin: WeaponSkinId
  ) {
    const mount = new THREE.Group();
    const { group: wGroup, muzzleTip } = buildWeaponModel(weaponId, attachments, weaponSkin);
    // Align weapon barrel forward along camera -Z (buildWeaponModel points barrel along +Z)
    wGroup.rotation.y = Math.PI;
    wGroup.scale.setScalar(0.58);
    mount.add(wGroup);

    // Tactical gloved support & trigger hands / forearms
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1e2530, roughness: 0.82, metalness: 0.12 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x11161e, roughness: 0.7, metalness: 0.18 });
    const knuckleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.55 });

    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.26, 8), sleeveMat);
    rightForearm.position.set(0.035, -0.11, 0.18);
    rightForearm.rotation.x = 1.15;
    rightForearm.rotation.z = -0.18;

    const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.068, 0.072), gloveMat);
    rightGlove.position.set(0.008, -0.055, 0.05);

    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 0.28, 8), sleeveMat);
    leftForearm.position.set(-0.085, -0.085, -0.04);
    leftForearm.rotation.x = 1.28;
    leftForearm.rotation.z = 0.48;

    const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.056, 0.078), gloveMat);
    leftGlove.position.set(-0.015, -0.025, -0.15);

    const leftKnuckles = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.016, 0.032), knuckleMat);
    leftKnuckles.position.set(-0.015, -0.042, -0.16);

    mount.add(rightForearm, rightGlove, leftForearm, leftGlove, leftKnuckles);
    mount.position.set(0.22, -0.21, -0.44);
    mount.visible = false;
    this.camera.add(mount);
    this.fpWeaponMount = mount;
    this.fpMuzzleTip = muzzleTip;
  }

  private createContainer3D(
    id: string,
    name: string,
    kind: WorldContainer3D['kind'],
    x: number,
    y: number,
    items: LootInstance[]
  ): WorldContainer3D {
    const grp = new THREE.Group();
    grp.position.set(to3DX(x), 0, to3DZ(y));

    const color =
      kind === 'safe'
        ? 0x78350f
        : kind === 'med_bag'
          ? 0x065f46
          : kind === 'server'
            ? 0x1e293b
            : 0x1e3a5f;
    const trim =
      kind === 'safe'
        ? 0xf59e0b
        : kind === 'med_bag'
          ? 0x34d399
          : kind === 'server'
            ? 0x38bdf8
            : 0x60a5fa;

    const h = kind === 'server' ? 2.1 : kind === 'safe' ? 1.25 : 0.85;
    const w = kind === 'safe' ? 1.2 : 1.3;
    const d = kind === 'safe' ? 1.1 : 0.9;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.55 })
    );
    body.position.y = h / 2;
    body.castShadow = true;
    grp.add(body);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.04, 0.12, d + 0.04),
      new THREE.MeshStandardMaterial({ color: trim, emissive: trim, emissiveIntensity: 0.45 })
    );
    stripe.position.y = h - 0.14;
    grp.add(stripe);

    const beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.28, 24),
      new THREE.MeshBasicMaterial({ color: trim, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
    );
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.y = 0.04;
    grp.add(beaconRing);

    this.scene.add(grp);

    return {
      id,
      name,
      kind,
      x,
      y,
      searching: false,
      searched: false,
      revealTimer: 0,
      items,
      mesh: grp,
      beaconRing,
    };
  }

  private initContainersAndEnemies() {
    this.containers = this.mapDef.containers.map((def) => {
      const count = def.minItems + Math.floor(Math.random() * (def.maxItems - def.minItems + 1));
      const items: LootInstance[] = [];
      const adjustedBias = Math.min(0.99, def.highValueBias * this.mapDef.lootMultiplier);
      for (let i = 0; i < count; i++) items.push(rollLootItem(adjustedBias, def.kind));
      return this.createContainer3D(def.id, def.name, def.kind, def.x, def.y, items);
    });

    const spawnEnemy = (
      id: string,
      kind: EnemyKind,
      x: number,
      y: number,
      patrol: Array<{ x: number; y: number }>,
      customName?: string
    ): Enemy3D => {
      const specs: Record<
        EnemyKind,
        { name: string; hp: number; armor: number; speed: number; radius: number; range: number; fov: number }
      > = {
        grunt: { name: '哈夫克巡逻兵', hp: 75, armor: 20, speed: 125, radius: 15, range: 430, fov: Math.PI * 0.65 },
        heavy: { name: '重装防爆盾卫', hp: 135, armor: 85, speed: 92, radius: 19, range: 360, fov: Math.PI * 0.55 },
        sniper: { name: '高塔狙击手', hp: 68, armor: 15, speed: 105, radius: 15, range: 680, fov: Math.PI * 0.48 },
        boss: { name: this.mapDef.bossName, hp: 380, armor: 160, speed: 162, radius: 22, range: 540, fov: Math.PI * 0.9 },
      };
      const s = specs[kind];
      const rig = buildEnemyModel(kind);
      rig.root.position.set(to3DX(x), 0, to3DZ(y));
      this.scene.add(rig.root);

      // Wall-penetrating Recon Highlight Beacon (shown when marked!)
      const beaconMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.9 })
      );
      beaconMesh.position.y = 2.4;
      beaconMesh.renderOrder = 10;
      beaconMesh.visible = false;
      rig.root.add(beaconMesh);

      let laserLine: THREE.Line | undefined;
      if (kind === 'sniper' || kind === 'boss') {
        const lGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 1.3, 0.5),
          new THREE.Vector3(0, 1.3, 28),
        ]);
        laserLine = new THREE.Line(
          lGeo,
          new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.75 })
        );
        laserLine.visible = false;
        rig.root.add(laserLine);
      }

      return {
        id,
        kind,
        name: customName || s.name,
        rig,
        beaconMesh,
        laserLine,
        x,
        y,
        radius: s.radius,
        angle: Math.random() * Math.PI * 2,
        hp: s.hp,
        maxHp: s.hp,
        armor: s.armor,
        maxArmor: s.armor,
        speed: s.speed,
        visionRange: s.range,
        visionFov: s.fov,
        alertness: 0,
        state: 'patrol',
        targetX: x,
        targetY: y,
        patrolPoints: patrol,
        patrolIdx: 0,
        fireCooldown: 0.5 + Math.random() * 0.4,
        windupTimer: 0,
        maxWindup: kind === 'sniper' ? 1.05 : kind === 'heavy' ? 0.55 : kind === 'boss' ? 0.35 : 0.42,
        hitFlash: 0,
        markedTimer: 0,
        stunTimer: 0,
        slowTimer: 0,
        strafeDir: Math.random() < 0.5 ? 1 : -1,
        strafeTimer: 1.5,
        roamX: patrol[0]?.x ?? x,
        roamY: patrol[0]?.y ?? y,
        roamTimer: 1.5 + Math.random() * 3.5,
        roamWaitTimer: Math.random() * 0.9,
        roamScanDir: Math.random() < 0.5 ? 1 : -1,
      };
    };

    this.enemies = this.mapDef.enemies.map((e) =>
      spawnEnemy(e.id, e.kind, e.x, e.y, e.patrol, e.customName)
    );
  }

  // ==========================================
  // INPUT HANDLERS
  // ==========================================
  private handlePointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (!this.pointerLocked) {
      this.lastMouseClientX = null;
    }
    this.syncHudNow();
  };

  private resolveScopeProfile(loadout: LoadoutConfig): { tier: ScopeTier; label: string } {
    const optic = loadout.attachments?.optic;
    const isSniper = loadout.weaponId === 'awm' || loadout.weaponId === 'r93';
    if (isSniper) {
      if (optic === 'optic_acog') return { tier: '8x', label: '8x 高倍狙击镜' };
      if (optic === 'optic_red_dot') return { tier: '1x', label: '1x 红点镜' };
      return { tier: '4x', label: '4x 狙击倍镜' };
    }
    if (optic === 'optic_acog') return { tier: '4x', label: '4x ACOG倍镜' };
    if (optic === 'optic_red_dot') return { tier: '1x', label: '1x 红点镜' };
    return { tier: 'iron', label: '机械瞄具' };
  }

  private getActiveMouseSensitivity(): number {
    const cfg = this.controlSettings;
    let scopeMult = 1.0;
    if (this.rightMouseDown) {
      if (this.activeScopeTier === '8x') scopeMult = cfg.scope8xSensitivity * 0.42;
      else if (this.activeScopeTier === '4x') scopeMult = cfg.scope4xSensitivity * 0.62;
      else if (this.activeScopeTier === '1x') scopeMult = cfg.scope1xSensitivity * 0.84;
      else scopeMult = cfg.ironSensitivity * 0.88;
    } else {
      scopeMult = cfg.ironSensitivity;
    }
    return 0.00235 * cfg.baseSensitivity * scopeMult;
  }

  public updateControlSettings(next: TacticalControlSettings) {
    this.controlSettings = sanitizeControlSettings(next);
    this.camZoom = this.controlSettings.tpZoom;
    if (!this.controlSettings.leanEnabled) {
      this.leanTarget = 0;
    }
    if (this.controlSettings.adsMode === 'hold' && !this.mouseDown) {
      // Keep current ADS clean if switched back to hold while not actively holding
      this.rightMouseDown = false;
    }
    this.syncHudNow();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    soundEngine.unlock();
    const code = e.code;
    if (code === 'Escape') {
      e.preventDefault();
      this.onTogglePause();
      return;
    }
    if (code === 'Tab') {
      e.preventDefault();
      this.onToggleBackpack();
      return;
    }
    if (this.paused || this.ended || this.inputBlocked) return;

    if (!this.heldKeys.has(code)) {
      if (code === 'KeyV') this.toggleCameraMode();
      else if (code === 'KeyL') this.toggleFlashlight();
      else if (code === 'KeyZ' || code === 'KeyC') {
        if (this.controlSettings.leanEnabled) {
          const dir: -1 | 1 = code === 'KeyZ' ? -1 : 1;
          if (this.controlSettings.leanMode === 'hold') {
            this.leanTarget = dir;
          } else {
            this.leanTarget = this.leanTarget === dir ? 0 : dir;
          }
          this.syncHudNow();
        }
      } else if (code === 'KeyR') {
        if (this.isWeaponJammed) this.clearWeaponJam();
        else this.startReload();
      } else if (code === 'KeyF') this.interactNearby();
      else if (code === 'KeyQ') this.triggerGearSlot('Q');
      else if (code === 'KeyE') this.triggerGearSlot('E');
      else if (code === 'KeyX') this.triggerGearSlot('X');
      else if (code === 'Digit1') this.useMedkit();
      else if (code === 'Digit2') this.useArmorPlate();
    }
    this.heldKeys.add(code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
    if (this.controlSettings.leanMode === 'hold' && (e.code === 'KeyZ' || e.code === 'KeyC')) {
      if (this.heldKeys.has('KeyZ')) this.leanTarget = -1;
      else if (this.heldKeys.has('KeyC')) this.leanTarget = 1;
      else this.leanTarget = 0;
      this.syncHudNow();
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouseNdcX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    this.mouseNdcY = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;

    if (this.cameraMode === 'first' && !this.paused && !this.ended && !this.inputBlocked && this.introTimer <= 0) {
      const sens = this.getActiveMouseSensitivity();
      if (this.pointerLocked) {
        this.pAngle = this.normalizeAngle(this.pAngle + e.movementX * sens);
        this.fpPitch = THREE.MathUtils.clamp(this.fpPitch - e.movementY * sens * 0.82, -0.38, 0.34);
      } else {
        // Unlocked fallback steering: smooth horizontal mouse turn + subtle pitch
        if (this.lastMouseClientX !== null) {
          const dx = e.clientX - this.lastMouseClientX;
          this.pAngle = this.normalizeAngle(this.pAngle + dx * sens * 1.45);
        }
        this.lastMouseClientX = e.clientX;
        this.fpPitch = THREE.MathUtils.clamp(this.mouseNdcY * 0.24, -0.32, 0.28);
      }
    }
  };

  private handleMouseDown = (e: MouseEvent) => {
    soundEngine.unlock();
    if (this.paused || this.ended || this.inputBlocked) return;

    if (this.cameraMode === 'first' && !this.pointerLocked && this.introTimer <= 0) {
      try {
        this.renderer.domElement.requestPointerLock?.();
      } catch {
        // Fallback steering remains active if iframe restricts pointer lock
      }
    }

    if (e.button === 0) {
      this.mouseDown = true;
      if (!this.weaponStats.isAuto) this.tryFire();
    } else if (e.button === 2) {
      if (this.controlSettings.adsMode === 'toggle') {
        this.rightMouseDown = !this.rightMouseDown;
      } else {
        this.rightMouseDown = true;
      }
      this.syncHudNow();
    } else if ((e.button === 3 || e.button === 4) && this.controlSettings.leanEnabled) {
      e.preventDefault();
      const dir: -1 | 1 = e.button === 3 ? -1 : 1;
      if (this.controlSettings.leanMode === 'hold') {
        this.leanTarget = dir;
      } else {
        this.leanTarget = this.leanTarget === dir ? 0 : dir;
      }
      this.syncHudNow();
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
    else if (e.button === 2 && this.controlSettings.adsMode === 'hold') {
      this.rightMouseDown = false;
      this.syncHudNow();
    } else if ((e.button === 3 || e.button === 4) && this.controlSettings.leanMode === 'hold') {
      this.leanTarget = 0;
      this.syncHudNow();
    }
  };

  private handleWheel = (e: WheelEvent) => {
    if (this.cameraMode === 'third') {
      this.camZoom = THREE.MathUtils.clamp(this.camZoom + e.deltaY * 0.0008, 0.65, 1.45);
    }
  };

  private handleContextMenu = (e: MouseEvent) => e.preventDefault();

  private handleBlur = () => {
    this.heldKeys.clear();
    this.mouseDown = false;
    this.rightMouseDown = false;
    this.leanTarget = 0;
    this.lastMouseClientX = null;
  };

  private handleResize = () => {
    const w = this.mountEl.clientWidth;
    const h = Math.max(1, this.mountEl.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
  };

  private handleContextRestored = () => {
    if (!this.disposed) this.start();
  };

  private bindEvents() {
    const dom = this.renderer.domElement;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    dom.addEventListener('mousemove', this.handleMouseMove);
    dom.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    dom.addEventListener('wheel', this.handleWheel, { passive: true });
    dom.addEventListener('contextmenu', this.handleContextMenu);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  public start() {
    this.clock.start();
    const tick = () => {
      if (this.disposed) return;
      const dt = Math.min(this.clock.getDelta(), 0.05);

      if (!this.paused && !this.ended) {
        if (this.hitstopTimer > 0) this.hitstopTimer -= dt;
        else this.update(dt);
      }

      this.renderer.render(this.scene, this.camera);
      if (this.isSoftwareGl) this.afterDraw(tick);
      else this.frameId = requestAnimationFrame(tick);
    };
    tick();
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (st === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public setPaused(p: boolean) {
    this.paused = p;
    soundEngine.setRaidAudioPaused(p);
    if (p) {
      this.heldKeys.clear();
      this.mouseDown = false;
      this.rightMouseDown = false;
      this.lastMouseClientX = null;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    } else {
      this.clock.getDelta();
    }
  }

  public setInputBlocked(blocked: boolean) {
    this.inputBlocked = blocked;
    if (blocked) {
      this.heldKeys.clear();
      this.mouseDown = false;
      this.rightMouseDown = false;
      this.leanTarget = 0;
      this.lastMouseClientX = null;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    }
  }

  public toggleCameraMode(nextMode?: CameraViewMode) {
    const target: CameraViewMode = nextMode ?? (this.cameraMode === 'first' ? 'third' : 'first');
    if (target === this.cameraMode) return;
    this.cameraMode = target;
    this.lastMouseClientX = null;
    if (target === 'third' && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    soundEngine.playUiClick();
    this.showBanner(
      target === 'first'
        ? '已切换至第一人称战术视角（点击画面锁定准星 · [V] 切回第三人称）'
        : '已切换至第三人称战术俯视角（滚轮缩放视角 · [V] 切回第一人称）'
    );
    this.syncHudNow();
  }

  public toggleFlashlight() {
    this.flashlightManualOverride = !this.flashlightOn;
    soundEngine.playUiClick();
    this.showBanner(this.flashlightManualOverride ? '战术枪灯已开启 [L]' : '战术枪灯已关闭 [L]');
    this.syncHudNow();
  }

  public cycleWeatherManual() {
    const idx = WEATHER_ORDER.indexOf(this.weather);
    const next = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
    this.transitionToWeather(next);
    this.syncHudNow();
  }

  private transitionToWeather(next: WeatherType) {
    if (this.weather === next) return;
    this.weather = next;
    this.weatherTimer = 42 + Math.random() * 18;
    soundEngine.setWeatherAmbience(next);
    const meta = WEATHER_META[next];
    this.showBanner(`战区气象变化：${meta.label} · ${meta.effectSummary}`);
  }

  public destroy() {
    this.disposed = true;
    soundEngine.stopRaidAmbience();
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    const dom = this.renderer.domElement;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    dom.removeEventListener('mousemove', this.handleMouseMove);
    dom.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    dom.removeEventListener('wheel', this.handleWheel);
    dom.removeEventListener('contextmenu', this.handleContextMenu);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints || (obj as THREE.LineSegments).isLineSegments) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material?.dispose();
      }
    });
    this.bulletHoleGeo?.dispose();
    this.dustPuffGeo?.dispose();
    this.bulletHoleMats.forEach((mat) => mat.dispose());
    this.bulletHoleMats.clear();
    this.bulletHoleDecals = [];
    this.dustPuffs = [];
    this.renderer.dispose();
    if (dom.parentNode === this.mountEl) this.mountEl.removeChild(dom);
  }

  public getFiringCadence(): number {
    return this.firingCadence;
  }

  public projectWorldToScreen(
    wx: number,
    wy: number,
    wz: number,
    out: { x: number; y: number; scale: number }
  ): boolean {
    _vec3B.set(wx, wy, wz);
    const camDist = this.camera.position.distanceTo(_vec3B);
    _vec3B.project(this.camera);
    if (_vec3B.z < -1 || _vec3B.z > 1) return false;
    const w = this.mountEl.clientWidth || 1;
    const h = this.mountEl.clientHeight || 1;
    out.x = (_vec3B.x * 0.5 + 0.5) * w;
    out.y = (-_vec3B.y * 0.5 + 0.5) * h;
    out.scale = 18 / Math.max(4, camDist);
    return true;
  }

  public getMuzzleTelemetry(out: {
    wx: number;
    wy: number;
    wz: number;
    dirX: number;
    dirZ: number;
  }): boolean {
    if (this.disposed) return false;
    if (this.cameraMode === 'first' && this.introTimer <= 0 && this.fpMuzzleTip) {
      this.fpMuzzleTip.getWorldPosition(_vec3B);
      out.wx = _vec3B.x;
      out.wy = _vec3B.y;
      out.wz = _vec3B.z;
    } else {
      this.playerRig.muzzleTip.getWorldPosition(_vec3B);
      out.wx = _vec3B.x;
      out.wy = Math.max(1.05, _vec3B.y);
      out.wz = _vec3B.z;
    }
    out.dirX = Math.cos(this.pAngle);
    out.dirZ = Math.sin(this.pAngle);
    return true;
  }

  private showBanner(msg: string) {
    this.statusBanner = msg;
    this.statusBannerTimer = 3.4;
  }

  // ==========================================
  // NON-LETHAL TACTICAL GEAR LOADOUT (Q / E / X)
  // ==========================================
  public applyBriefingCooldowns(cooldowns: Partial<Record<TacticalSlotKey, number>>) {
    let anyResidual = false;
    (['Q', 'E', 'X'] as TacticalSlotKey[]).forEach((slot) => {
      const val = cooldowns[slot];
      if (!val || val <= 0) return;
      const def = TACTICAL_GEAR[this.gearSlots[slot]];
      const capped = Math.min(def ? def.cooldown : val, val);
      if (capped > 0.25) anyResidual = true;
      if (slot === 'Q') this.qCooldown = Math.max(this.qCooldown, capped);
      else if (slot === 'E') this.eCooldown = Math.max(this.eCooldown, capped);
      else this.xCooldown = Math.max(this.xCooldown, capped);
    });
    if (anyResidual) {
      this.showBanner('部分战术器材尚在整备充能中 · 战区初期冷却已同步');
    }
    this.syncHudNow();
  }

  public triggerGearSlot(slot: TacticalSlotKey) {
    const gearId = this.gearSlots[slot];
    const def = TACTICAL_GEAR[gearId];
    if (!def) return;

    const currentCd = slot === 'Q' ? this.qCooldown : slot === 'E' ? this.eCooldown : this.xCooldown;
    const currentCharges = slot === 'Q' ? this.qCharges : slot === 'E' ? this.eCharges : this.xCharges;
    if (currentCd > 0) return;
    if (currentCharges !== null && currentCharges <= 0) {
      this.showBanner(`${def.shortName} 已耗尽`);
      return;
    }

    if (slot === 'Q') {
      this.qCooldown = def.cooldown;
      if (this.qCharges !== null) this.qCharges -= 1;
    } else if (slot === 'E') {
      this.eCooldown = def.cooldown;
      if (this.eCharges !== null) this.eCharges -= 1;
    } else {
      this.xCooldown = def.cooldown;
      if (this.xCharges !== null) this.xCharges -= 1;
    }

    this.gearUseCounts[gearId] = (this.gearUseCounts[gearId] || 0) + 1;

    const aimPt = this.getAimPoint2D();
    const ang = Math.atan2(aimPt.y - this.py, aimPt.x - this.px);
    const dist = Math.min(360, Math.hypot(aimPt.x - this.px, aimPt.y - this.py));

    switch (gearId) {
      case 'laser_designator': {
        this.laserActiveTimer = def.durationSec;
        soundEngine.playSkill('recon');
        this.showBanner('AN/PEQ 激光指示器已开启 · 沿枪口照射标定敌军方位');
        break;
      }
      case 'tactical_binoculars': {
        this.binocularsActiveTimer = def.durationSec;
        soundEngine.playSkill('recon');
        this.spawnReconRing3D(this.px, this.py, 560, 0x38bdf8);
        this.showBanner('Vector 21 测距望远镜开启 · 正在扫描前方直瞄扇区');
        break;
      }
      case 'ir_monocular': {
        this.irActiveTimer = def.durationSec;
        soundEngine.playSkill('recon');
        this.spawnReconRing3D(this.px, this.py, 460, 0xf59e0b);
        this.showBanner('AN/PVS 热像单筒启动 · 穿烟侦测周边 460m 热源');
        break;
      }
      case 'recon_drone': {
        const targetDist = Math.max(180, Math.min(480, Math.hypot(aimPt.x - this.px, aimPt.y - this.py)));
        const tx = THREE.MathUtils.clamp(this.px + Math.cos(ang) * targetDist, 90, WORLD_WIDTH - 90);
        const ty = THREE.MathUtils.clamp(this.py + Math.sin(ang) * targetDist, 90, WORLD_HEIGHT - 90);
        this.deployReconDrone3D(tx, ty, def.durationSec);
        this.droneActiveTimer = Math.max(this.droneActiveTimer, def.durationSec);
        soundEngine.playSkill('recon');
        this.showBanner('Black Hornet 便携侦察无人机升空 · 正在低空前出扫描敌情');
        break;
      }
      case 'm18_smoke': {
        const sx = this.px + Math.cos(ang) * Math.min(280, dist);
        const sy = this.py + Math.sin(ang) * Math.min(280, dist);
        this.spawnGrenade3D('smoke', sx, sy, 145, 0.34, 0.42);
        soundEngine.playUiClick();
        this.showBanner('M18 战术烟幕弹投出 · 正在释放遮蔽烟幕');
        break;
      }
      case 'wide_smoke_screen': {
        [-95, 0, 95].forEach((perp) => {
          const sx = this.px + Math.cos(ang) * Math.min(240, Math.max(130, dist)) + Math.cos(ang + Math.PI / 2) * perp;
          const sy = this.py + Math.sin(ang) * Math.min(240, Math.max(130, dist)) + Math.sin(ang + Math.PI / 2) * perp;
          this.spawnGrenade3D('smoke', sx, sy, 118, 0.36, 0.45);
        });
        soundEngine.playUiClick();
        this.showBanner('M83 联排宽幅发烟罐投射 · 铺设横跨烟幕遮蔽墙');
        break;
      }
      case 'cs_irritant_smoke': {
        const sx = this.px + Math.cos(ang) * Math.min(290, dist);
        const sy = this.py + Math.sin(ang) * Math.min(290, dist);
        this.spawnGrenade3D('cs_smoke', sx, sy, 145, 0.36, 0.45);
        soundEngine.playUiClick();
        this.showBanner('M7A3 CS 催泪烟幕弹投出 · 驱离掩体敌军并打断瞄准');
        break;
      }
      case 'signal_jammer': {
        this.deploySignalJammer(this.px + Math.cos(ang) * 42, this.py + Math.sin(ang) * 42, def.durationSec);
        soundEngine.playSkill('recon');
        this.showBanner('便携无线电信号干扰器已部署 · 压制敌军通联与狙击激光');
        break;
      }
      case 'radio_recon': {
        this.radioReconActiveTimer = def.durationSec;
        this.radioReconAccum = 0;
        this.spawnReconRing3D(this.px, this.py, 900, 0x10b981);
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - this.px, e.y - this.py);
          if (d <= 900 && (e.state !== 'patrol' || d <= 680)) {
            e.markedTimer = Math.max(e.markedTimer, 4.5);
          }
        }
        soundEngine.playSkill('recon');
        this.showBanner('AN/PRC 无线电侦察呼叫已接通 · 正在三角定位敌军无线电信号');
        break;
      }
      case 'm84_flashbang': {
        const fx = this.px + Math.cos(ang) * dist;
        const fy = this.py + Math.sin(ang) * dist;
        this.spawnGrenade3D('flash', fx, fy, 240, 0.38, 0.72);
        soundEngine.playUiClick();
        this.showBanner('M84 非致命震撼闪光弹投出！');
        break;
      }
      case 'acoustic_decoy': {
        const dx = this.px + Math.cos(ang) * Math.min(340, dist);
        const dy = this.py + Math.sin(ang) * Math.min(340, dist);
        this.spawnGrenade3D('decoy', dx, dy, 620, 0.38, 0.48);
        soundEngine.playUiClick();
        this.showBanner('战术枪声诱饵信标投出 · 即将模拟交火声诱敌转移');
        break;
      }
      case 'deployable_cover': {
        this.deployCoverWall(ang, def.durationSec);
        soundEngine.playReload();
        this.showBanner('便携折叠凯夫拉防弹掩体已架设 · 可阻挡直瞄弹道');
        break;
      }
    }
    this.syncHudNow();
  }

  private startReload() {
    if (this.isWeaponJammed || this.jamClearing) {
      this.clearWeaponJam();
      return;
    }
    if (this.isReloading || this.ammoInMag >= this.weaponStats.magSize || this.reserveAmmo <= 0) return;
    if (this.controlSettings.adsMode === 'toggle') this.rightMouseDown = false;
    this.isReloading = true;
    const opMult = this.loadout.operatorId === 'toxik' ? 0.82 : 1.0;
    const armPenalty = this.bodyParts.arms.hp / this.bodyParts.arms.maxHp < 0.55 ? 1.18 : 1.0;
    this.reloadTimer = this.weaponStats.reloadTime * opMult * armPenalty;
    this.cancelActiveSearch();
    soundEngine.playReload();
  }

  public triggerClearJam() {
    if (this.paused || this.ended) return;
    this.clearWeaponJam();
  }

  private clearWeaponJam() {
    if (!this.isWeaponJammed || this.jamClearing) return;
    if (this.controlSettings.adsMode === 'toggle') this.rightMouseDown = false;
    this.jamClearing = true;
    this.isReloading = false;
    const opMult = this.loadout.operatorId === 'toxik' ? 0.82 : 1.0;
    this.jamClearTimer = this.jamClearDuration * opMult;
    this.cancelActiveSearch();
    soundEngine.playReload();
    this.showBanner('正在拉栓退壳排除卡壳故障...');
    this.syncHudNow();
  }

  public triggerUseMedkit() {
    this.useMedkit();
  }

  public triggerUseArmorPlate() {
    this.useArmorPlate();
  }

  private getBleedingCount(): number {
    let count = 0;
    (Object.keys(this.bodyParts) as BodyPartId[]).forEach((part) => {
      if (this.bodyParts[part].bleeding) count += 1;
    });
    return count;
  }

  private useMedkit() {
    const anyBleed = this.getBleedingCount() > 0;
    const anyPartDamaged = (Object.keys(this.bodyParts) as BodyPartId[]).some(
      (p) => this.bodyParts[p].hp < this.bodyParts[p].maxHp
    );
    if (this.medkits <= 0 || (this.hp >= this.maxHp && !anyBleed && !anyPartDamaged)) return;

    this.medkits -= 1;
    const healAmt = this.loadout.operatorId === 'stinger' ? 75 : 55;
    this.hp = Math.min(this.maxHp, this.hp + healAmt);

    // Manual bandage hemostasis: clears ALL active bleeding wounds & repairs injured limbs
    (Object.keys(this.bodyParts) as BodyPartId[]).forEach((part) => {
      const st = this.bodyParts[part];
      st.bleeding = false;
      st.hp = Math.min(st.maxHp, st.hp + Math.round(st.maxHp * 0.45));
    });

    soundEngine.playSkill('heal');
    this.spawnBurst3D(to3DX(this.px), 1.0, to3DZ(this.py), 0x10b981, 12);
    this.showBanner(anyBleed ? '急救包止血包扎完成 · 创口已止血并修复伤势' : '战地急救包使用完成 · 生命与部位伤势已恢复');
    this.syncHudNow();
  }

  private useArmorPlate() {
    if (this.armorPlates <= 0 || this.armor >= this.maxArmor) return;
    this.armorPlates -= 1;
    this.armor = Math.min(this.maxArmor, this.armor + 50);
    soundEngine.playReload();
    this.spawnBurst3D(to3DX(this.px), 1.0, to3DZ(this.py), 0x38bdf8, 10);
    this.syncHudNow();
  }

  private initExtractionLever3D() {
    const candidates = this.mapDef.leverCandidates || [];
    const safeCandidates = candidates.filter((c) => !this.isPointBlocked(c.x, c.y, 24));
    const pool = safeCandidates.length > 0 ? safeCandidates : candidates;

    if (pool.length > 0) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      this.leverPos = { x: pick.x, y: pick.y, name: pick.name, zoneName: pick.zoneName };
    } else {
      // Fallback: pick random open spot in mid-map
      for (let attempt = 0; attempt < 30; attempt++) {
        const rx = 800 + Math.random() * (WORLD_WIDTH - 1600);
        const ry = 600 + Math.random() * (WORLD_HEIGHT - 1200);
        if (!this.isPointBlocked(rx, ry, 28)) {
          this.leverPos = { x: rx, y: ry, name: '随机高压撤离总闸', zoneName: '战区配电点' };
          break;
        }
      }
    }

    const lx = to3DX(this.leverPos.x);
    const lz = to3DZ(this.leverPos.y);
    const group = new THREE.Group();
    group.position.set(lx, 0, lz);

    // Concrete plinth + Armored industrial power switch cabinet
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.72, metalness: 0.35 });
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.72 });
    const hazardMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.5,
    });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.24, 1.0), baseMat);
    plinth.position.y = 0.12;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.52, 0.58), cabinetMat);
    cabinet.position.y = 0.98;
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    group.add(cabinet);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.16, 0.62), hazardMat);
    stripe.position.y = 1.62;
    group.add(stripe);

    // Pivoting heavy throw lever arm (starts upright at +0.68 rad, flips down to -0.78 rad when pulled)
    const pivot = new THREE.Group();
    pivot.position.set(0, 1.18, 0.32);
    pivot.rotation.x = 0.68;
    const armMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.55,
      roughness: 0.32,
    });
    const leftBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.54, 8), armMat);
    leftBar.position.set(-0.18, 0.26, 0);
    const rightBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.54, 8), armMat);
    rightBar.position.set(0.18, 0.26, 0);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.46, 10), gripMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 0.52, 0);
    pivot.add(leftBar, rightBar, handle);
    group.add(pivot);
    this.leverHandlePivot = pivot;

    // Overhead status beacon dome
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), beaconMat);
    beacon.position.y = 1.92;
    group.add(beacon);
    this.leverBeaconMesh = beacon;

    // Tall vertical amber locator beam so player can spot the random lever across the battlefield
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.36, 14, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.y = 7.2;
    group.add(beam);
    this.leverBeamMesh = beam;

    // Spinning floor interaction ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.35, 1.62, 28),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);
    this.leverRingMesh = ring;

    this.scene.add(group);
    this.leverGroup = group;
  }

  public triggerPullLever() {
    if (this.paused || this.ended || this.leverPulled) return;
    if (Math.hypot(this.leverPos.x - this.px, this.leverPos.y - this.py) <= 110) {
      this.pullExtractionLever();
    }
  }

  private pullExtractionLever() {
    if (this.leverPulled) return;
    this.leverPulled = true;
    this.cancelActiveSearch();

    // Flip lever visual beacons to emerald green
    if (this.leverBeaconMesh) {
      const mat = this.leverBeaconMesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(0x00e59b);
      mat.emissive.setHex(0x00e59b);
    }
    if (this.leverBeamMesh) {
      const mat = this.leverBeamMesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(0x00e59b);
      mat.opacity = 0.08;
    }
    if (this.leverRingMesh) {
      const mat = this.leverRingMesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(0x00e59b);
      mat.opacity = 0.45;
    }

    // Power ON all fixed corner extraction zones across the map!
    for (const eb of this.extractBeacons) {
      (eb.ring.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
      (eb.ring.material as THREE.MeshBasicMaterial).opacity = 0.82;
      (eb.beam.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
      (eb.beam.material as THREE.MeshBasicMaterial).opacity = 0.24;
    }

    // Mechanical switch sound + facility alarm + enemy alert wave
    soundEngine.playReload();
    soundEngine.playDistantAlarm(to3DX(this.leverPos.x), 4.2, to3DZ(this.leverPos.y), 'extract');
    this.spawnBurst3D(to3DX(this.leverPos.x), 1.6, to3DZ(this.leverPos.y), 0x00e59b, 16);
    this.emitNoise(this.leverPos.x, this.leverPos.y, 680, 0.85);
    this.showBanner(
      `⚡ ${this.leverPos.name}已拉下！全图 ${this.mapDef.extractions.length} 处角落撤离点已通电，抵达后坚守 03:00 即可撤离！`
    );
    this.syncHudNow();
  }

  private interactNearby() {
    // Priority 1: Pull the random extraction power lever if standing nearby
    if (!this.leverPulled && Math.hypot(this.leverPos.x - this.px, this.leverPos.y - this.py) <= 110) {
      this.pullExtractionLever();
      return;
    }

    // Priority 2: Loot nearby container
    const nearest = this.findNearestContainer();
    if (!nearest) return;
    if (nearest.searched) {
      this.activeContainerId = nearest.id;
      this.onToggleBackpack();
      return;
    }
    if (!nearest.searching) {
      this.cancelActiveSearch();
      nearest.searching = true;
      this.activeContainerId = nearest.id;
      soundEngine.playSearchTick();
      this.syncHudNow();
    }
  }

  private cancelActiveSearch() {
    this.containers.forEach((c) => {
      c.searching = false;
    });
  }

  private findNearestContainer(): WorldContainer3D | null {
    let best: WorldContainer3D | null = null;
    let bestDist = 80;
    for (const c of this.containers) {
      const d = Math.hypot(c.x - this.px, c.y - this.py);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  private getCarriedWeightKg(): number {
    let total = 0;
    for (const item of this.backpack) total += getItemWeight(item.templateId, item.weight);
    for (const item of this.safeBox) total += getItemWeight(item.templateId, item.weight);
    return Number(total.toFixed(2));
  }

  // Loot modal API
  public takeLootItem(containerId: string, itemUid: string, toSafeBox: boolean) {
    const container = this.containers.find((c) => c.id === containerId);
    if (!container) return;
    const idx = container.items.findIndex((i) => i.uid === itemUid && i.revealed);
    if (idx === -1) return;
    const item = container.items[idx];
    if (toSafeBox) {
      if (this.safeBox.length >= this.loadout.safeBoxCapacity) {
        this.showBanner('安全箱已满！');
        return;
      }
      container.items.splice(idx, 1);
      this.safeBox.push(item);
      soundEngine.playLootReveal(item.rarity);
    } else {
      if (this.backpack.length >= this.loadout.backpackCapacity) {
        this.showBanner('战术背包已满！');
        return;
      }
      container.items.splice(idx, 1);
      this.backpack.push(item);
      soundEngine.playUiClick();
    }
    this.syncHudNow();
  }

  public moveBetweenBackpackAndSafeBox(itemUid: string, from: 'backpack' | 'safebox') {
    if (from === 'backpack') {
      if (this.safeBox.length >= this.loadout.safeBoxCapacity) return;
      const idx = this.backpack.findIndex((i) => i.uid === itemUid);
      if (idx === -1) return;
      const [item] = this.backpack.splice(idx, 1);
      this.safeBox.push(item);
    } else {
      if (this.backpack.length >= this.loadout.backpackCapacity) return;
      const idx = this.safeBox.findIndex((i) => i.uid === itemUid);
      if (idx === -1) return;
      const [item] = this.safeBox.splice(idx, 1);
      this.backpack.push(item);
    }
    soundEngine.playUiClick();
    this.syncHudNow();
  }

  public dropFromBackpack(itemUid: string) {
    const idx = this.backpack.findIndex((i) => i.uid === itemUid);
    if (idx !== -1) {
      this.backpack.splice(idx, 1);
      soundEngine.playUiClick();
      this.syncHudNow();
    }
  }

  public forceAbandonRaid() {
    if (!this.ended) this.finishRaid(false, '主动放弃行动撤离');
  }

  // ==========================================
  // 3D SIMULATION LOOP
  // ==========================================
  private getAimPoint2D(): { x: number; y: number } {
    if (this.cameraMode === 'first' && this.introTimer <= 0) {
      const maxD = 560;
      const ex = this.px + Math.cos(this.pAngle) * maxD;
      const ey = this.py + Math.sin(this.pAngle) * maxD;
      const hit = this.findObstacleHit(this.px, this.py, ex, ey, false);
      if (hit) return { x: hit.hitX, y: hit.hitY };
      return { x: ex, y: ey };
    }
    _ndc.set(this.mouseNdcX, this.mouseNdcY);
    _raycaster.setFromCamera(_ndc, this.camera);
    if (_raycaster.ray.intersectPlane(_aimPlane, _vec3A)) {
      return { x: _vec3A.x / WORLD_SCALE, y: _vec3A.z / WORLD_SCALE };
    }
    return { x: this.px + Math.cos(this.pAngle) * 200, y: this.py + Math.sin(this.pAngle) * 200 };
  }

  private update(dt: number) {
    this.raidElapsed += dt;
    this.raidTimeRemaining = Math.max(0, this.raidTimeRemaining - dt);
    if (this.raidTimeRemaining <= 0) {
      this.finishRaid(
        false,
        this.leverPulled
          ? '20分钟行动时限耗尽 · 未能在倒计时结束前完成撤离，随身资产已丢失'
          : '20分钟行动时限耗尽 · 未拉闸启动撤离点，随身资产已丢失'
      );
      return;
    }

    if (this.introTimer > 0) this.introTimer = Math.max(0, this.introTimer - dt);
    if (this.statusBannerTimer > 0) {
      this.statusBannerTimer -= dt;
      if (this.statusBannerTimer <= 0) this.statusBanner = null;
    }

    if (this.qCooldown > 0) this.qCooldown = Math.max(0, this.qCooldown - dt);
    if (this.eCooldown > 0) this.eCooldown = Math.max(0, this.eCooldown - dt);
    if (this.xCooldown > 0) this.xCooldown = Math.max(0, this.xCooldown - dt);
    if (this.laserActiveTimer > 0) this.laserActiveTimer = Math.max(0, this.laserActiveTimer - dt);
    if (this.binocularsActiveTimer > 0) this.binocularsActiveTimer = Math.max(0, this.binocularsActiveTimer - dt);
    if (this.irActiveTimer > 0) this.irActiveTimer = Math.max(0, this.irActiveTimer - dt);
    if (this.droneActiveTimer > 0) this.droneActiveTimer = Math.max(0, this.droneActiveTimer - dt);
    if (this.radioReconActiveTimer > 0) {
      this.radioReconActiveTimer = Math.max(0, this.radioReconActiveTimer - dt);
      this.radioReconAccum += dt;
      if (this.radioReconAccum >= 1.15) {
        this.radioReconAccum = 0;
        this.spawnReconRing3D(this.px, this.py, 900, 0x10b981);
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - this.px, e.y - this.py);
          if (d <= 900 && (e.state !== 'patrol' || d <= 680)) {
            e.markedTimer = Math.max(e.markedTimer, 3.2);
          }
        }
      }
    }
    if (this.playerHitFlash > 0) this.playerHitFlash = Math.max(0, this.playerHitFlash - dt * 5);

    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 36);
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) this.muzzleFlashMesh.visible = false;
    }
    this.recoilVisual = Math.max(0, this.recoilVisual - dt * 8);
    this.recoilBloom = Math.max(0, this.recoilBloom - dt * 6.5);
    this.shakeMag = Math.max(0, this.shakeMag - dt * 2.8);

    // Update rolling firing frequency cadence (drives dynamic dust turbulence)
    while (
      this.recentPlayerShotTimes.length > 0 &&
      this.raidElapsed - this.recentPlayerShotTimes[0] > 1.25
    ) {
      this.recentPlayerShotTimes.shift();
    }
    const cadenceDecay = this.recentPlayerShotTimes.length === 0 ? 0.92 : 0.36;
    this.firingCadence = Math.max(0, this.firingCadence - dt * cadenceDecay);

    // Persistent Bleeding Trauma Tick (only stops with manual Medkit!)
    const bleedCount = this.getBleedingCount();
    if (bleedCount > 0) {
      const bleedPerWound = this.loadout.operatorId === 'stinger' ? 1.3 : 2.4;
      this.hp = Math.max(0, this.hp - bleedPerWound * bleedCount * dt);
      if (this.hp <= 0) {
        this.finishRaid(false, '创口失血过多 · 未能及时使用急救包止血');
        return;
      }
    }

    // Jam Clearing & Reloading
    if (this.jamClearing) {
      this.jamClearTimer -= dt;
      if (this.jamClearTimer <= 0) {
        this.jamClearing = false;
        this.isWeaponJammed = false;
        soundEngine.playReload();
        this.showBanner('卡壳故障已排除，枪械恢复击发！');
      }
    } else if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const needed = this.weaponStats.magSize - this.ammoInMag;
        const load = Math.min(needed, this.reserveAmmo);
        this.ammoInMag += load;
        this.reserveAmmo -= load;
        this.isReloading = false;
      }
    }
    if (this.fireTimer > 0) this.fireTimer -= dt;

    // Movement (penalized when legs suffer trauma, heavy weight, exhaustion, or deep snow)
    const weatherMeta = WEATHER_META[this.weather];
    let rawForward = 0;
    let rawRight = 0;
    if (!this.inputBlocked) {
      if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) rawForward += 1;
      if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) rawForward -= 1;
      if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) rawRight += 1;
      if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) rawRight -= 1;
    }

    // In unlocked first-person mode, gently steer when cursor approaches left/right screen edges for effortless 360° turning
    if (
      this.cameraMode === 'first' &&
      !this.pointerLocked &&
      !this.inputBlocked &&
      this.introTimer <= 0 &&
      Math.abs(this.mouseNdcX) > 0.72
    ) {
      const edgeNorm = (Math.abs(this.mouseNdcX) - 0.72) / 0.28;
      const turnDir = Math.sign(this.mouseNdcX);
      this.pAngle = this.normalizeAngle(this.pAngle + turnDir * edgeNorm * 1.9 * dt);
    }

    let mx = 0;
    let my = 0;
    if (this.cameraMode === 'first' && this.introTimer <= 0) {
      // Relative FPS movement along facing vector (cos(pAngle), sin(pAngle)) and right vector (-sin(pAngle), cos(pAngle))
      const fwdX = Math.cos(this.pAngle);
      const fwdY = Math.sin(this.pAngle);
      const rightX = -Math.sin(this.pAngle);
      const rightY = Math.cos(this.pAngle);
      mx = fwdX * rawForward + rightX * rawRight;
      my = fwdY * rawForward + rightY * rawRight;
    } else {
      // Classic world-space top-down movement
      mx = rawRight;
      my = -rawForward;
    }

    const carriedWeightKg = this.getCarriedWeightKg();
    const encumbrancePenalty = computeEncumbrancePenalty(carriedWeightKg);
    const encumbranceMoveScale = 1 - encumbrancePenalty;
    const staminaRegenMult = this.loadout.operatorId === 'toxik' ? 1.25 : 1.0;
    const weightRegenMult = Math.max(0.28, 1 - carriedWeightKg * 0.036);
    this.staminaRegenRatePct = Math.round(staminaRegenMult * weightRegenMult * 100);

    const legRatio = this.bodyParts.legs.hp / this.bodyParts.legs.maxHp;
    const legFractured = legRatio < 0.55;
    const canSprint = legRatio >= 0.25 && !this.isStaminaExhausted && this.stamina > 0;

    const moving = Math.hypot(mx, my) > 0.01;
    const wantsSprint = !this.inputBlocked && (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight'));
    if (wantsSprint && moving && canSprint && !this.mouseDown && this.controlSettings.adsMode === 'toggle' && this.rightMouseDown) {
      this.rightMouseDown = false;
    }
    const isSprinting = moving && wantsSprint && canSprint && !this.mouseDown && !this.rightMouseDown;
    this.isCurrentlySprinting = isSprinting;
    if (isSprinting && this.controlSettings.leanMode === 'toggle' && this.leanTarget !== 0) {
      this.leanTarget = 0;
    }

    if (isSprinting) {
      this.stamina = Math.max(
        0,
        this.stamina - 28 * (1 + encumbrancePenalty * 0.75) * weatherMeta.staminaMult * dt
      );
      if (this.stamina <= 0.4) {
        this.stamina = 0;
        this.isStaminaExhausted = true;
        this.isCurrentlySprinting = false;
        this.showBanner('体力耗尽！进入强制慢走状态，停止奔跑即可恢复体力');
      }
    } else {
      // As long as the player is not sprinting, stamina recovers (slower as carried weight increases)
      const baseRegen = moving ? 13 : 24;
      this.stamina = Math.min(
        this.maxStamina,
        this.stamina + baseRegen * staminaRegenMult * weightRegenMult * dt
      );
      if (this.isStaminaExhausted && this.stamina >= 25) {
        this.isStaminaExhausted = false;
        this.showBanner('体力已初步恢复 · 强制慢走状态解除');
      }
    }

    if (moving) {
      this.cancelActiveSearch();
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      const op = OPERATORS[this.loadout.operatorId];
      const armorDef = ARMOR_TIERS.find((a) => a.tier === this.loadout.armorTier) || ARMOR_TIERS[0];
      const ergoBonus = (this.weaponStats.ergonomics - 50) * 0.0022;
      const adsMoveScale = this.rightMouseDown ? Math.min(0.92, 0.78 + ergoBonus) : 1.0;
      const legPenaltyMult = legRatio < 0.25 ? 0.66 : legFractured ? 0.78 : 1.0;
      const exhaustedMoveScale = this.isStaminaExhausted ? 0.56 : 1.0;
      const speed =
        op.baseSpeed *
        this.weaponStats.moveSpeedMod *
        (1 - armorDef.movePenalty) *
        encumbranceMoveScale *
        exhaustedMoveScale *
        legPenaltyMult *
        weatherMeta.moveMult *
        (isSprinting ? 1.34 : 1.0) *
        adsMoveScale;

      this.moveCircleWithCollisions(mx * speed * dt, my * speed * dt);
      this.playerSpeedRatio = (isSprinting ? 1.34 : 1.0) * encumbranceMoveScale * exhaustedMoveScale * weatherMeta.moveMult;
      this.fpWalkPhase += dt * (isSprinting ? 10.5 : 7.2) * Math.max(0.5, this.playerSpeedRatio);

      // Movement footstep foley & weather-scaled acoustic sound propagation (Rain +25% range, Snow -12%)
      this.footstepTimer -= dt * (isSprinting ? 1.48 : 1.0);
      if (this.footstepTimer <= 0) {
        this.footstepTimer = this.isStaminaExhausted ? 0.64 : 0.44;
        soundEngine.playFootstep(this.weather, isSprinting);
        const opStealth = this.loadout.operatorId === 'hackclaw' ? 0.72 : 1.0;
        const baseStepRadius = isSprinting ? 260 : this.rightMouseDown || this.isStaminaExhausted ? 82 : 138;
        const effectiveStepNoise = baseStepRadius * opStealth * this.currentPlayerNoiseMult;
        this.emitNoise(this.px, this.py, effectiveStepNoise, isSprinting ? 0.42 : 0.24);
      }
    } else {
      this.playerSpeedRatio = 0;
      this.footstepTimer = Math.min(this.footstepTimer, 0.14);
    }

    // Aiming: third-person raycasts ground cursor; first-person uses direct mouse yaw/pitch
    const aimPt = this.getAimPoint2D();
    const inFirstPerson = this.cameraMode === 'first' && this.introTimer <= 0;
    if (!inFirstPerson) {
      this.pAngle = Math.atan2(aimPt.y - this.py, aimPt.x - this.px);
    }
    this.playerAimMarker.visible = !inFirstPerson;
    this.playerAimMarker.position.set(to3DX(aimPt.x), 0.06, to3DZ(aimPt.y));

    // Toggle third-person body vs first-person weapon viewmodel cleanly
    this.playerRig.root.visible = !inFirstPerson;
    if (this.fpWeaponMount) {
      this.fpWeaponMount.visible = inFirstPerson;
    }

    // Smoothly damp tactical lean/peek angle
    const desiredLean = this.controlSettings.leanEnabled ? this.leanTarget : 0;
    this.leanAmount = THREE.MathUtils.damp(this.leanAmount, desiredLean, 13, dt);

    // Position & Animate 3D Full-Body Operator
    this.playerRig.root.position.set(to3DX(this.px), 0, to3DZ(this.py));
    this.playerRig.root.rotation.y = Math.PI / 2 - this.pAngle;
    animateHumanoid(this.playerRig, this.raidElapsed, this.playerSpeedRatio, this.recoilVisual, this.isReloading);
    // Apply lateral upper-body lean tilt in third-person view
    this.playerRig.upperBody.rotation.z = -this.leanAmount * 0.28 * this.controlSettings.leanIntensity;

    this.playerRig.exoGlowMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.35;
    });

    // Update active optics & laser designator beam
    this.updateOpticsAndLaser();

    // Update 3D Camera (2.1s cinematic intro sweep -> First-Person or Third-Person tactical cam)
    this.updateCamera(dt, aimPt);

    // Update Web Audio 3D spatial listener & acoustic enclosure/tunnel resonance
    const rawEnclosure = this.computeEnclosureFactor(this.px, this.py);
    this.smoothedEnclosure = THREE.MathUtils.damp(this.smoothedEnclosure, rawEnclosure, 8, dt);
    if (inFirstPerson) {
      soundEngine.updateSpatialListener(
        to3DX(this.px),
        1.56,
        to3DZ(this.py),
        this.smoothedEnclosure,
        Math.cos(this.pAngle),
        Math.sin(this.fpPitch) * 0.6,
        Math.sin(this.pAngle)
      );
    } else {
      soundEngine.updateSpatialListener(
        to3DX(this.px),
        1.4,
        to3DZ(this.py),
        this.smoothedEnclosure,
        0,
        -0.42,
        -0.91
      );
    }

    // Distant facility klaxon alarms (periodic compound sirens + timed extraction beacons)
    this.distantAlarmTimer -= dt;
    if (this.distantAlarmTimer <= 0) {
      this.distantAlarmTimer = 15 + Math.random() * 10;
      const bossZone =
        this.mapDef.zones.find((z) => z.danger === 'BOSS') || this.mapDef.zones[0];
      const highZones = this.mapDef.zones.filter((z) => z.danger === 'HIGH' || z.danger === 'BOSS');
      const targetZone =
        highZones.length > 0
          ? highZones[Math.floor(Math.random() * highZones.length)]
          : bossZone;
      if (targetZone) {
        soundEngine.playDistantAlarm(
          to3DX(targetZone.x + targetZone.w * 0.5),
          6.5,
          to3DZ(targetZone.y + targetZone.h * 0.5),
          'facility'
        );
      }
    }
    for (const ext of this.mapDef.extractions) {
      if (
        ext.activatesAtSec > 0 &&
        this.raidElapsed >= ext.activatesAtSec &&
        !this.announcedExtracts.has(ext.id)
      ) {
        this.announcedExtracts.add(ext.id);
        soundEngine.playDistantAlarm(to3DX(ext.x), 4.0, to3DZ(ext.y), 'extract');
      }
    }

    if (!this.inputBlocked && this.mouseDown && this.weaponStats.isAuto) {
      this.tryFire();
    }

    this.updateContainers(dt);
    this.updateGrenadesAndFields(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateParticles(dt);
    this.updateAmbientWeather(dt);
    this.updateExtraction(dt);

    // Subtle extraction ring, random power lever animation, radar dish & animated landmark props
    this.extractRings.forEach((r) => {
      r.rotation.z += dt * (this.leverPulled ? 0.85 : 0.25);
    });
    if (this.leverRingMesh) {
      this.leverRingMesh.rotation.z += dt * (this.leverPulled ? 0.45 : 1.45);
    }
    if (this.leverHandlePivot) {
      const targetRot = this.leverPulled ? -0.78 : 0.68;
      this.leverHandlePivot.rotation.x = THREE.MathUtils.damp(this.leverHandlePivot.rotation.x, targetRot, 10, dt);
    }
    if (this.leverBeaconMesh) {
      const mat = this.leverBeaconMesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = this.leverPulled
        ? 1.6
        : 1.4 + Math.sin(this.raidElapsed * 6.5) * 0.9;
    }
    if (this.leverGroup) {
      // Keep reference used cleanly
      this.leverGroup.visible = true;
    }
    if (this.radarDishMesh) {
      this.radarDishMesh.rotation.y += dt * 0.65;
    }
    for (const ap of this.animatedProps) {
      if (ap.speed !== 0) {
        ap.mesh.rotation[ap.axis] += dt * ap.speed;
      }
      if (ap.bobAmp && ap.bobFreq && ap.baseY !== undefined) {
        ap.mesh.position.y = ap.baseY + Math.sin(this.raidElapsed * ap.bobFreq) * ap.bobAmp;
      }
    }

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.065) {
      this.hudSyncAccum = 0;
      this.syncHudNow();
    }
  }

  private updateCamera(dt: number, aimPt: { x: number; y: number }) {
    const px3 = to3DX(this.px);
    const pz3 = to3DZ(this.py);

    if (this.introTimer > 0) {
      // 2.1s Dramatic Military CG Cutscene Insertion Shot -> smoothly glides into chosen view mode
      const t = 1 - this.introTimer / 2.1;
      const smooth = t * t * (3 - 2 * t);
      const orbitAngle = Math.PI * 0.45 + smooth * Math.PI * 1.05;
      const targetDist = this.cameraMode === 'first' ? 0.65 : 12.2 * this.camZoom;
      const targetH = this.cameraMode === 'first' ? 1.56 : 12.2 * this.camZoom;
      const dist = THREE.MathUtils.lerp(3.2, targetDist, smooth);
      const height = THREE.MathUtils.lerp(1.45, targetH, smooth * smooth);

      this.camera.position.set(
        px3 + Math.cos(orbitAngle) * dist,
        height,
        pz3 + Math.sin(orbitAngle) * dist
      );
      this.camera.lookAt(px3, THREE.MathUtils.lerp(1.25, this.cameraMode === 'first' ? 1.52 : 0.95, smooth), pz3);
      return;
    }

    if (this.cameraMode === 'first') {
      const baseFov = this.controlSettings.fpFov;
      const scopeAdsFov =
        this.activeScopeTier === '8x'
          ? Math.max(16, baseFov * 0.25)
          : this.activeScopeTier === '4x'
            ? Math.max(24, baseFov * 0.42)
            : this.activeScopeTier === '1x'
              ? Math.max(40, baseFov * 0.72)
              : Math.max(46, baseFov * 0.8);
      const targetFov =
        this.binocularsActiveTimer > 0
          ? Math.min(34, baseFov * 0.48)
          : this.rightMouseDown
            ? scopeAdsFov
            : baseFov;
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 11, dt);
        this.camera.updateProjectionMatrix();
      }

      const leanOffset = this.getWallSafeLeanOffset2D();
      const leanOx3 = leanOffset.ox * WORLD_SCALE;
      const leanOz3 = leanOffset.oy * WORLD_SCALE;
      const leanDropY = Math.abs(this.leanAmount) * 0.075 * this.controlSettings.leanIntensity;

      const bobAmp = this.playerSpeedRatio > 0.05 ? (this.isCurrentlySprinting ? 0.048 : 0.026) : 0.005;
      const bobY = Math.sin(this.fpWalkPhase * 2) * bobAmp;
      const shakeX = (Math.random() - 0.5) * this.shakeMag * 0.14;
      const shakeY = (Math.random() - 0.5) * this.shakeMag * 0.14;
      const eyeY = 1.58 - leanDropY + bobY + shakeY;

      this.camera.position.set(px3 + leanOx3 + shakeX, eyeY, pz3 + leanOz3);

      const recoilKickPitch = this.recoilVisual * 0.028;
      const pitch = THREE.MathUtils.clamp(this.fpPitch + recoilKickPitch, -0.45, 0.42);
      const cosP = Math.cos(pitch);
      const lookX = px3 + leanOx3 + Math.cos(this.pAngle) * cosP * 24;
      const lookY = eyeY + Math.sin(pitch) * 24;
      const lookZ = pz3 + leanOz3 + Math.sin(this.pAngle) * cosP * 24;
      this.camera.lookAt(lookX, lookY, lookZ);
      if (Math.abs(this.leanAmount) > 0.002) {
        this.camera.rotateZ(-this.leanAmount * 0.165 * this.controlSettings.leanIntensity);
      }

      // Animate First-Person Weapon Viewmodel (Hipfire <-> ADS centering, lean cant, walk sway, recoil, reload & jam clear)
      if (this.fpWeaponMount) {
        const ads = this.rightMouseDown && !this.isReloading && !this.jamClearing;
        const usingHighZoomScope = ads && (this.activeScopeTier === '4x' || this.activeScopeTier === '8x');
        this.fpWeaponMount.visible = !usingHighZoomScope;

        const swayX = Math.cos(this.fpWalkPhase) * (ads ? 0.004 : 0.015) * Math.min(1, this.playerSpeedRatio);
        const swayY = Math.abs(Math.sin(this.fpWalkPhase)) * (ads ? 0.004 : 0.016) * Math.min(1, this.playerSpeedRatio);
        const breathY = Math.sin(this.raidElapsed * 2.1) * (ads ? 0.0015 : 0.0045);

        const targetX = (ads ? 0.0 : 0.21) + swayX + this.leanAmount * (ads ? 0.012 : 0.032);
        const targetY = (ads ? -0.142 : -0.205) - swayY + breathY - (this.isReloading ? 0.09 : 0);
        const targetZ = (ads ? -0.35 : -0.44) + this.recoilVisual * (ads ? 0.045 : 0.075);

        this.fpWeaponMount.position.x = THREE.MathUtils.damp(this.fpWeaponMount.position.x, targetX, 14, dt);
        this.fpWeaponMount.position.y = THREE.MathUtils.damp(this.fpWeaponMount.position.y, targetY, 14, dt);
        this.fpWeaponMount.position.z = THREE.MathUtils.damp(this.fpWeaponMount.position.z, targetZ, 18, dt);

        const leanCant = -this.leanAmount * (ads ? 0.08 : 0.14) * this.controlSettings.leanIntensity;
        const targetRotX = this.recoilVisual * 0.14 - (this.isReloading ? 0.36 : 0) + (this.jamClearing ? 0.12 : 0);
        const targetRotZ =
          (this.jamClearing ? 0.42 : this.isReloading ? 0.25 : this.isCurrentlySprinting ? 0.18 : 0) + leanCant;
        const targetRotY = this.isCurrentlySprinting ? 0.24 : 0;
        this.fpWeaponMount.rotation.x = THREE.MathUtils.damp(this.fpWeaponMount.rotation.x, targetRotX, 14, dt);
        this.fpWeaponMount.rotation.y = THREE.MathUtils.damp(this.fpWeaponMount.rotation.y, targetRotY, 12, dt);
        this.fpWeaponMount.rotation.z = THREE.MathUtils.damp(this.fpWeaponMount.rotation.z, targetRotZ, 12, dt);
      }
      return;
    }

    // Classic Third-Person Tactical Camera
    if (Math.abs(this.camera.fov - 44) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 44, 10, dt);
      this.camera.updateProjectionMatrix();
    }

    const leanOffset = this.getWallSafeLeanOffset2D();
    const leanCamX = leanOffset.ox * WORLD_SCALE * 1.45;
    const leanCamZ = leanOffset.oy * WORLD_SCALE * 1.45;

    const adsBonus = this.binocularsActiveTimer > 0 ? 0.32 : this.rightMouseDown ? 0.24 : 0.1;
    const lookOffsetX = (to3DX(aimPt.x) - px3) * adsBonus + leanCamX;
    const lookOffsetZ = (to3DZ(aimPt.y) - pz3) * adsBonus + leanCamZ;

    const zoomFactor =
      this.camZoom * (this.binocularsActiveTimer > 0 ? 1.12 : this.rightMouseDown ? 0.92 : 1.0);
    const targetCamX = px3 + lookOffsetX + (Math.random() - 0.5) * this.shakeMag;
    const targetCamY = 12.6 * zoomFactor;
    const targetCamZ = pz3 + lookOffsetZ + 11.2 * zoomFactor + (Math.random() - 0.5) * this.shakeMag;

    const camDamp = 6.5 + this.weaponStats.ergonomics * 0.045;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, camDamp, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, camDamp, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, camDamp, dt);

    _vec3B.set(px3 + lookOffsetX * 0.65, 0.9, pz3 + lookOffsetZ * 0.65);
    this.camera.lookAt(_vec3B);
  }

  private tryFire() {
    if (this.isReloading || this.jamClearing || this.fireTimer > 0) return;
    if (this.isWeaponJammed) {
      soundEngine.playEmptyClick();
      this.fireTimer = 0.24;
      this.mouseDown = false;
      this.showBanner('⚠ 枪械供弹卡壳停射！按 [R] 键立即排障清膛');
      return;
    }
    if (this.ammoInMag <= 0) {
      soundEngine.playEmptyClick();
      this.fireTimer = 0.25;
      this.startReload();
      return;
    }

    // Durability-driven weapon malfunction check (weapons >= 80% durability never jam)
    if (this.weaponDurability < 80) {
      let baseJamProb = 0;
      if (this.weaponDurability >= 55) {
        baseJamProb = 0.015 + ((80 - this.weaponDurability) / 25) * 0.03;
      } else if (this.weaponDurability >= 25) {
        baseJamProb = 0.045 + ((55 - this.weaponDurability) / 30) * 0.085;
      } else {
        baseJamProb = 0.13 + ((25 - this.weaponDurability) / 25) * 0.16;
      }
      const heatExtra = Math.max(0, this.firingCadence - 0.5) * 0.028;
      if (Math.random() < Math.min(0.36, baseJamProb + heatExtra)) {
        this.isWeaponJammed = true;
        this.jamsExperienced += 1;
        this.mouseDown = false;
        this.fireTimer = 0.28;
        soundEngine.playEmptyClick();
        this.showBanner('⚠ 枪械磨损导致供弹卡壳！按 [R] 键立即排障清膛');
        this.syncHudNow();
        return;
      }
    }

    this.cancelActiveSearch();
    this.ammoInMag -= 1;

    this.fireTimer = 1 / this.weaponStats.fireRate;

    const adsTighten = this.rightMouseDown ? 0.55 : 1.0;
    const armTremorMult = this.bodyParts.arms.hp / this.bodyParts.arms.maxHp < 0.55 ? 1.35 : 1.0;
    const wearSpreadMult = this.weaponDurability < 50 ? 1 + (50 - this.weaponDurability) * 0.008 : 1.0;
    const spreadDeg = (this.weaponStats.spread + this.recoilBloom) * adsTighten * armTremorMult * wearSpreadMult;
    const pellets = this.weaponStats.pellets || 1;

    const inFirstPerson = this.cameraMode === 'first' && this.introTimer <= 0 && this.fpMuzzleTip;
    if (inFirstPerson && this.fpMuzzleTip) {
      this.fpMuzzleTip.getWorldPosition(_vec3A);
    } else {
      this.playerRig.muzzleTip.getWorldPosition(_vec3A);
    }
    const leanOff = this.getWallSafeLeanOffset2D();
    const muzzleX = inFirstPerson ? this.px + leanOff.ox + Math.cos(this.pAngle) * 16 : _vec3A.x / WORLD_SCALE;
    const muzzleY = inFirstPerson ? this.py + leanOff.oy + Math.sin(this.pAngle) * 16 : _vec3A.z / WORLD_SCALE;

    const apBonus = (this.loadout.ammoTier === 'ap' ? 0.22 : 0) + (this.loadout.operatorId === 'hackclaw' ? 0.08 : 0);
    const bulletColor = this.loadout.ammoTier === 'ap' ? 0xf59e0b : 0xfde047;

    const wId = this.loadout.weaponId;
    const isBigCal = wId === 'awm' || wId === 'r93' || wId === 'ash12' || wId === 'm870';
    const wDef = WEAPONS[wId];
    const caliberWeight =
      wId === 'awm' || wId === 'r93'
        ? 1.55
        : wId === 'ash12' || wId === 'pkm' || wId === 'm870' || wId === 's12k' || wId === 'scarh'
          ? 1.32
          : wDef?.categoryGroup === 'smg'
            ? 0.7
            : 1.0;

    // Track firing frequency cadence for dynamic dust & ballistic pressure feedback
    this.recentPlayerShotTimes.push(this.raidElapsed);
    while (
      this.recentPlayerShotTimes.length > 0 &&
      this.raidElapsed - this.recentPlayerShotTimes[0] > 1.25
    ) {
      this.recentPlayerShotTimes.shift();
    }
    const burstNorm = this.recentPlayerShotTimes.length / 8.5;
    const rpmBoost = Math.min(0.42, this.weaponStats.fireRate * 0.032);
    this.firingCadence = Math.min(
      1.6,
      Math.max(this.firingCadence, burstNorm * 0.85) + (isBigCal ? 0.2 : 0.1) + rpmBoost * 0.25
    );

    let leadShotAngle = this.pAngle;
    for (let p = 0; p < pellets; p++) {
      const spreadRad = ((Math.random() - 0.5) * 2 * spreadDeg * Math.PI) / 180;
      const shotAngle = this.pAngle + spreadRad;
      if (p === 0) leadShotAngle = shotAngle;
      this.spawnBullet3D(
        muzzleX,
        muzzleY,
        shotAngle,
        this.weaponStats.projectileSpeed,
        this.weaponStats.range,
        this.weaponStats.damage,
        Math.min(1, this.weaponStats.armorPen + apBonus),
        true,
        false,
        bulletColor,
        100,
        caliberWeight
      );

      if (this.onBallisticShot && (p === 0 || p % 2 === 0)) {
        const endX = muzzleX + Math.cos(shotAngle) * this.weaponStats.range;
        const endY = muzzleY + Math.sin(shotAngle) * this.weaponStats.range;
        const wallClip = this.findObstacleHit(muzzleX, muzzleY, endX, endY, false);
        const traceEndX = wallClip ? wallClip.hitX : endX;
        const traceEndY = wallClip ? wallClip.hitY : endY;
        this.onBallisticShot({
          wx: _vec3A.x,
          wy: Math.max(1.08, _vec3A.y),
          wz: _vec3A.z,
          ex: to3DX(traceEndX),
          ey: 1.15,
          ez: to3DZ(traceEndY),
          speed3d: this.weaponStats.projectileSpeed * WORLD_SCALE,
          caliberWeight,
          firingCadence: this.firingCadence,
          fromPlayer: true,
          color: this.loadout.ammoTier === 'ap' ? '#fbbf24' : '#fef08a',
        });
      }
    }

    const recoilFactor = this.loadout.operatorId === 'vyron' ? 0.78 : 1.0;
    this.recoilBloom = Math.min(8, this.recoilBloom + this.weaponStats.recoil * recoilFactor);
    this.recoilVisual = 1.0;
    this.shakeMag = Math.max(this.shakeMag, isBigCal ? 0.42 : 0.14);

    // Muzzle Flash Light & 3D Volumetric Star
    this.muzzleLight.position.set(_vec3A.x, 1.35, _vec3A.z);
    this.muzzleLight.intensity = this.weaponStats.isSuppressed ? 1.8 : 5.5;
    if (!this.weaponStats.isSuppressed) {
      this.muzzleFlashMesh.position.set(_vec3A.x, _vec3A.y, _vec3A.z);
      this.muzzleFlashMesh.rotation.set(0, Math.PI / 2 - leadShotAngle, Math.random() * Math.PI);
      this.muzzleFlashMesh.scale.setScalar(0.85 + Math.random() * 0.45);
      this.muzzleFlashMesh.visible = true;
      this.muzzleFlashTimer = 0.048;
    }

    // Eject 3D Spinning Brass Shell Casing
    this.spawnShellCasing(_vec3A.x, _vec3A.y, _vec3A.z, leadShotAngle);

    const cal: 'rifle' | 'smg' | 'sniper' | 'heavy' =
      wDef?.categoryGroup === 'smg'
        ? 'smg'
        : wId === 'awm' || wId === 'r93'
          ? 'sniper'
          : wId === 'scarh' || wId === 'ash12' || wId === 'pkm' || wId === 's12k' || wId === 'm870'
            ? 'heavy'
            : 'rifle';
    const suppressed = this.weaponStats.isSuppressed || wId === 'vss';
    soundEngine.playGunshot(suppressed, cal, {
      wx: _vec3A.x,
      wy: Math.max(1.05, _vec3A.y),
      wz: _vec3A.z,
      enclosure: this.smoothedEnclosure,
      isPlayer: true,
    });

    this.spawnBurst3D(_vec3A.x, _vec3A.y, _vec3A.z, 0xfde047, 5);
    // Muzzle blast & ground dust plume scaling with firing cadence
    const muzzleDustCount = this.firingCadence > 0.55 ? 2 : this.firingCadence > 0.2 ? 1 : 0;
    if (muzzleDustCount > 0) {
      this.spawnImpactDustPlume3D(
        _vec3A.x,
        Math.max(0.95, _vec3A.y - 0.1),
        _vec3A.z,
        Math.cos(leadShotAngle),
        Math.sin(leadShotAngle),
        'concrete',
        caliberWeight * 0.7,
        this.firingCadence,
        muzzleDustCount
      );
    }

    const noiseMult = this.loadout.operatorId === 'hackclaw' ? 0.65 : 1.0;
    this.emitNoise(this.px, this.py, this.weaponStats.noiseRadius * noiseMult);

    // Per-shot firearm wear (affected by caliber, AP ammo pressure, and rapid sustained heat)
    const baseShotWear =
      wDef?.categoryGroup === 'smg'
        ? 0.075
        : wId === 'm249' || wId === 'pkm'
          ? 0.08
          : wId === 'awm' || wId === 'r93' || wId === 'ash12' || wId === 'm870'
            ? 0.22
            : 0.115;
    const apWearBonus = this.loadout.ammoTier === 'ap' ? 0.035 : 0;
    const heatWearMult = 1 + Math.min(0.4, this.firingCadence * 0.24);
    this.weaponDurability = Math.max(
      0,
      this.weaponDurability - (baseShotWear + apWearBonus) * heatWearMult
    );

    if (this.ammoInMag === 0 && this.reserveAmmo > 0) this.startReload();
  }

  private emitNoise(x: number, y: number, radius: number, alertnessGain = 0.65) {
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      const jammed = this.signalJammers.some((jm) => Math.hypot(e.x - jm.x, e.y - jm.y) <= jm.radius);
      const effectiveRadius = jammed ? Math.min(radius, 180) : radius;
      if (d <= effectiveRadius) {
        e.alertness = Math.min(1, e.alertness + (jammed ? alertnessGain * 0.4 : alertnessGain));
        if (e.state === 'patrol') {
          e.state = 'investigate';
          e.targetX = x;
          e.targetY = y;
        }
      }
    }
  }

  private updateContainers(dt: number) {
    for (const c of this.containers) {
      c.beaconRing.rotation.z += dt * (c.searching ? 3.5 : 0.8);
      if (!c.searching) continue;
      if (Math.hypot(c.x - this.px, c.y - this.py) > 85) {
        c.searching = false;
        continue;
      }
      c.revealTimer += dt;
      if (c.revealTimer >= 0.55) {
        c.revealTimer = 0;
        const nextHidden = c.items.find((i) => !i.revealed);
        if (nextHidden) {
          nextHidden.revealed = true;
          soundEngine.playLootReveal(nextHidden.rarity);
          if (nextHidden.rarity === 'legendary') {
            this.showBanner(`高价值红色藏品发现：${nextHidden.name}！请立即存入安全箱`);
          }
          if (c.items.every((i) => i.revealed)) {
            c.searching = false;
            c.searched = true;
            this.activeContainerId = c.id;
            this.onToggleBackpack();
          }
        } else {
          c.searching = false;
          c.searched = true;
        }
        this.syncHudNow();
      }
    }
  }

  private updateOpticsAndLaser() {
    if (this.laserActiveTimer > 0) {
      this.playerRig.muzzleTip.getWorldPosition(_vec3A);
      const startX = _vec3A.x / WORLD_SCALE;
      const startY = _vec3A.z / WORLD_SCALE;
      const maxLen = 850;
      const cos = Math.cos(this.pAngle);
      const sin = Math.sin(this.pAngle);
      let hitDist = maxLen;

      // March ray against wall obstacles and enemies
      const step = 16;
      for (let d = 16; d <= maxLen; d += step) {
        const sx = startX + cos * d;
        const sy = startY + sin * d;
        let blocked = false;
        for (const obs of this.mapDef.obstacles) {
          if (!obs.blocksVision) continue;
          if (sx >= obs.x && sx <= obs.x + obs.w && sy >= obs.y && sy <= obs.y + obs.h) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          for (const dw of this.deployableWalls) {
            const obs = dw.obstacle;
            if (sx >= obs.x && sx <= obs.x + obs.w && sy >= obs.y && sy <= obs.y + obs.h) {
              blocked = true;
              break;
            }
          }
        }
        if (blocked) {
          hitDist = d;
          break;
        }
        for (const e of this.enemies) {
          if (Math.hypot(sx - e.x, sy - e.y) <= e.radius + 14) {
            e.markedTimer = Math.max(e.markedTimer, 5.5);
            if (Math.hypot(sx - e.x, sy - e.y) <= e.radius + 3) {
              hitDist = d;
              blocked = true;
              break;
            }
          }
        }
        if (blocked) break;
      }

      const endX = startX + cos * hitDist;
      const endY = startY + sin * hitDist;
      const posAttr = this.laserBeamLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      posAttr.setXYZ(0, _vec3A.x, Math.max(1.05, _vec3A.y), _vec3A.z);
      posAttr.setXYZ(1, to3DX(endX), 1.15, to3DZ(endY));
      posAttr.needsUpdate = true;
      this.laserBeamLine.visible = true;
      this.laserDotMesh.position.set(to3DX(endX), 1.15, to3DZ(endY));
      this.laserDotMesh.visible = true;
    } else {
      this.laserBeamLine.visible = false;
      this.laserDotMesh.visible = false;
    }

    if (this.binocularsActiveTimer > 0) {
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (d <= 860) {
          const angToE = Math.atan2(e.y - this.py, e.x - this.px);
          if (Math.abs(this.normalizeAngle(angToE - this.pAngle)) <= 0.44 && this.hasLineOfSight(this.px, this.py, e.x, e.y)) {
            e.markedTimer = Math.max(e.markedTimer, 3.5);
          }
        }
      }
    }

    if (this.irActiveTimer > 0) {
      for (const e of this.enemies) {
        if (Math.hypot(e.x - this.px, e.y - this.py) <= 460) {
          e.markedTimer = Math.max(e.markedTimer, 2.5);
        }
      }
    }
  }

  private spawnGrenade3D(
    kind: Grenade3D['kind'],
    targetX: number,
    targetY: number,
    radius: number,
    flightTime: number,
    fuseTime: number
  ) {
    const col =
      kind === 'flash'
        ? 0xe2e8f0
        : kind === 'cs_smoke'
          ? 0xd9f99d
          : kind === 'decoy'
            ? 0xf59e0b
            : 0x475569;
    const mesh = new THREE.Mesh(
      kind === 'decoy' ? new THREE.BoxGeometry(0.28, 0.14, 0.22) : new THREE.CylinderGeometry(0.11, 0.11, 0.26, 10),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.4 })
    );
    mesh.position.set(to3DX(this.px), 1.2, to3DZ(this.py));
    this.scene.add(mesh);

    this.grenades.push({
      mesh,
      startX: this.px,
      startY: this.py,
      targetX,
      targetY,
      elapsed: 0,
      flightTime,
      fuseTime,
      radius,
      kind,
    });
  }

  private deploySignalJammer(x: number, y: number, life: number) {
    const grp = new THREE.Group();
    grp.position.set(to3DX(x), 0, to3DZ(y));

    const caseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.28, 0.46),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.65 })
    );
    caseMesh.position.y = 0.14;
    caseMesh.castShadow = true;

    const antGeo = new THREE.CylinderGeometry(0.018, 0.025, 0.85, 6);
    const antMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 });
    const antL = new THREE.Mesh(antGeo, antMat);
    antL.position.set(-0.22, 0.65, -0.1);
    const antR = new THREE.Mesh(antGeo, antMat);
    antR.position.set(0.22, 0.65, -0.1);

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    led.position.set(0, 0.31, 0.14);

    const radius = 460;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * WORLD_SCALE - 0.18, radius * WORLD_SCALE, 48),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;

    grp.add(caseMesh, antL, antR, led, ring);
    this.scene.add(grp);
    this.signalJammers.push({ group: grp, ring, led, x, y, radius, life });
  }

  private deployReconDrone3D(targetX: number, targetY: number, life: number) {
    const grp = new THREE.Group();
    grp.position.set(to3DX(this.px), 2.1, to3DZ(this.py));

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.14, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.72 })
    );
    body.castShadow = true;

    const camPod = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25, metalness: 0.85 })
    );
    camPod.position.set(0, -0.09, 0.16);

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x00e59b })
    );
    led.position.set(0, 0.1, -0.18);

    const rotors: THREE.Mesh[] = [];
    const armMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.35 });
    const rotorMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
    const armOffsets = [
      [-0.3, -0.3],
      [0.3, -0.3],
      [-0.3, 0.3],
      [0.3, 0.3],
    ];
    for (const [ax, az] of armOffsets) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.04), armMat);
      arm.position.set(ax * 0.65, 0.02, az * 0.65);
      arm.rotation.y = Math.atan2(az, ax);
      const rotor = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.2, 12), rotorMat);
      rotor.rotation.x = -Math.PI / 2;
      rotor.position.set(ax, 0.06, az);
      rotors.push(rotor);
      grp.add(arm, rotor);
    }

    const scanRadius = 380;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(scanRadius * WORLD_SCALE - 0.22, scanRadius * WORLD_SCALE, 48),
      new THREE.MeshBasicMaterial({
        color: 0x00e59b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -3.6;

    grp.add(body, camPod, led, ring);
    this.scene.add(grp);
    this.reconDrones.push({
      group: grp,
      rotors,
      led,
      ring,
      x: this.px,
      y: this.py,
      targetX,
      targetY,
      life,
      scanAccum: 0.35,
    });
  }

  private spawnAcousticDecoy(x: number, y: number, life: number) {
    const grp = new THREE.Group();
    grp.position.set(to3DX(x), 0, to3DZ(y));

    const pod = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.18, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.6, metalness: 0.4 })
    );
    pod.position.y = 0.09;

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    led.position.set(0, 0.2, 0);

    grp.add(pod, led);
    this.scene.add(grp);
    this.acousticDecoys.push({ group: grp, led, x, y, life, pulseAccum: 0.9 });
  }

  private deployCoverWall(ang: number, life: number) {
    const wallDist = 92;
    const wx = this.px + Math.cos(ang) * wallDist;
    const wy = this.py + Math.sin(ang) * wallDist;
    const horizontal = Math.abs(Math.cos(ang)) < Math.abs(Math.sin(ang));
    const w = horizontal ? 120 : 28;
    const h = horizontal ? 28 : 120;

    const obstacle: MapObstacle = {
      id: `cover_wall_${Date.now()}`,
      x: wx - w / 2,
      y: wy - h / 2,
      w,
      h,
      height: 2.3,
      kind: 'wall',
      blocksVision: true,
    };

    const grp = new THREE.Group();
    grp.position.set(to3DX(wx), 0, to3DZ(wy));
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w * WORLD_SCALE, 2.2, h * WORLD_SCALE),
      new THREE.MeshPhysicalMaterial({ color: 0x3f3f46, roughness: 0.72, metalness: 0.28 })
    );
    slab.position.y = 1.1;
    slab.castShadow = true;
    slab.receiveShadow = true;
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(w * WORLD_SCALE + 0.08, 0.16, h * WORLD_SCALE + 0.08),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5, metalness: 0.35 })
    );
    trim.position.y = 2.15;
    grp.add(slab, trim);
    this.scene.add(grp);
    this.spawnBurst3D(to3DX(wx), 0.9, to3DZ(wy), 0x94a3b8, 10);
    this.deployableWalls.push({ obstacle, mesh: grp, life });
  }

  private spawnReconRing3D(x: number, y: number, maxRadius: number, color: number) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.75, 36),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthTest: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(to3DX(x), 0.15, to3DZ(y));
    this.scene.add(mesh);
    this.reconPulses.push({ mesh, x, y, maxRadius: maxRadius * WORLD_SCALE, life: 1.1 });
  }

  private spawnSmokeCloud3D(x: number, y: number, radius: number, life: number, isIrritant: boolean = false) {
    const grp = new THREE.Group();
    grp.position.set(to3DX(x), 0, to3DZ(y));
    const mat = new THREE.MeshStandardMaterial({
      color: isIrritant ? 0xd9e89a : 0xcbd5e1,
      roughness: 1,
      transparent: true,
      opacity: isIrritant ? 0.62 : 0.6,
      depthWrite: false,
    });
    const puffGeo = new THREE.DodecahedronGeometry(radius * WORLD_SCALE * 0.42, 1);
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Mesh(puffGeo, mat);
      const a = (i / 6) * Math.PI * 2;
      puff.position.set(Math.cos(a) * 1.8, 1.1 + (i % 2) * 0.6, Math.sin(a) * 1.8);
      grp.add(puff);
    }
    this.scene.add(grp);
    this.smokes.push({ group: grp, x, y, radius, life, isIrritant, tickAccum: 0 });
  }

  private updateGrenadesAndFields(dt: number) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.elapsed += dt;
      const t = Math.min(1, g.elapsed / g.flightTime);
      const cx = g.startX + (g.targetX - g.startX) * t;
      const cy = g.startY + (g.targetY - g.startY) * t;
      const arcY = t < 1 ? 1.2 * (1 - t) + Math.sin(t * Math.PI) * 2.4 + 0.16 : 0.14;
      g.mesh.position.set(to3DX(cx), arcY, to3DZ(cy));

      if (g.elapsed >= g.fuseTime) {
        const gEnc = this.computeEnclosureFactor(g.targetX, g.targetY);
        const gx3 = to3DX(g.targetX);
        const gz3 = to3DZ(g.targetY);
        if (g.kind === 'smoke') {
          this.spawnSmokeCloud3D(g.targetX, g.targetY, g.radius, 11.0, false);
          soundEngine.playSkill('smoke', { wx: gx3, wy: 0.6, wz: gz3, enclosure: gEnc });
        } else if (g.kind === 'cs_smoke') {
          this.spawnSmokeCloud3D(g.targetX, g.targetY, g.radius, 9.5, true);
          soundEngine.playSkill('smoke', { wx: gx3, wy: 0.6, wz: gz3, enclosure: gEnc });
        } else if (g.kind === 'decoy') {
          this.spawnAcousticDecoy(g.targetX, g.targetY, 10.0);
        } else if (g.kind === 'flash') {
          soundEngine.playSkill('explosion', { wx: gx3, wy: 0.9, wz: gz3, enclosure: gEnc });
          this.spawnReconRing3D(g.targetX, g.targetY, g.radius, 0xf8fafc);
          this.spawnBurst3D(gx3, 1.1, gz3, 0xfef08a, 16);
          for (const e of this.enemies) {
            if (Math.hypot(e.x - g.targetX, e.y - g.targetY) <= g.radius) {
              e.stunTimer = Math.max(e.stunTimer, 3.8);
              e.windupTimer = 0;
            }
          }
        }
        this.scene.remove(g.mesh);
        g.mesh.geometry.dispose();
        (g.mesh.material as THREE.Material).dispose();
        this.grenades.splice(i, 1);
      }
    }

    // Portable Signal Jammers (EW)
    for (let i = this.signalJammers.length - 1; i >= 0; i--) {
      const jm = this.signalJammers[i];
      jm.life -= dt;
      const pulse = Math.sin(this.raidElapsed * 10) > 0;
      (jm.led.material as THREE.MeshBasicMaterial).color.setHex(pulse ? 0x38bdf8 : 0x0f172a);
      jm.ring.rotation.z += dt * 0.45;
      if (jm.life <= 0) {
        this.scene.remove(jm.group);
        this.signalJammers.splice(i, 1);
      }
    }

    // Portable Micro Recon Drones
    for (let i = this.reconDrones.length - 1; i >= 0; i--) {
      const dr = this.reconDrones[i];
      dr.life -= dt;
      dr.x = THREE.MathUtils.damp(dr.x, dr.targetX, 2.4, dt);
      dr.y = THREE.MathUtils.damp(dr.y, dr.targetY, 2.4, dt);
      const hoverY = 3.8 + Math.sin(this.raidElapsed * 4.2 + i) * 0.22;
      dr.group.position.set(to3DX(dr.x), hoverY, to3DZ(dr.y));
      dr.ring.position.y = -hoverY + 0.08;
      dr.ring.rotation.z += dt * 0.9;
      for (const rt of dr.rotors) {
        rt.rotation.z += dt * 28;
      }
      const blink = Math.sin(this.raidElapsed * 12) > 0;
      (dr.led.material as THREE.MeshBasicMaterial).color.setHex(blink ? 0x00e59b : 0x064e3b);

      dr.scanAccum += dt;
      if (dr.scanAccum >= 0.45) {
        dr.scanAccum = 0;
        for (const e of this.enemies) {
          if (Math.hypot(e.x - dr.x, e.y - dr.y) <= 380) {
            e.markedTimer = Math.max(e.markedTimer, 3.0);
          }
        }
      }
      if (dr.life <= 0) {
        this.scene.remove(dr.group);
        this.reconDrones.splice(i, 1);
      }
    }

    // Acoustic Decoy Beacons
    for (let i = this.acousticDecoys.length - 1; i >= 0; i--) {
      const dc = this.acousticDecoys[i];
      dc.life -= dt;
      dc.pulseAccum += dt;
      const blink = Math.sin(this.raidElapsed * 16) > 0;
      (dc.led.material as THREE.MeshBasicMaterial).color.setHex(blink ? 0xf59e0b : 0x1c1917);
      if (dc.pulseAccum >= 1.15) {
        dc.pulseAccum = 0;
        soundEngine.playGunshot(true, 'rifle', {
          wx: to3DX(dc.x),
          wy: 0.4,
          wz: to3DZ(dc.y),
          enclosure: this.computeEnclosureFactor(dc.x, dc.y),
        });
        this.spawnBurst3D(to3DX(dc.x), 0.25, to3DZ(dc.y), 0xfbbf24, 5);
        for (const e of this.enemies) {
          const distToDecoy = Math.hypot(e.x - dc.x, e.y - dc.y);
          if (distToDecoy <= 620) {
            const hasDirectLos = this.hasLineOfSight(e.x, e.y, this.px, this.py) && Math.hypot(e.x - this.px, e.y - this.py) < 220;
            if (!hasDirectLos) {
              e.state = 'investigate';
              e.alertness = 0.85;
              e.targetX = dc.x;
              e.targetY = dc.y;
            }
          }
        }
      }
      if (dc.life <= 0) {
        this.scene.remove(dc.group);
        this.acousticDecoys.splice(i, 1);
      }
    }

    // Deployable Kevlar Covers
    for (let i = this.deployableWalls.length - 1; i >= 0; i--) {
      const dw = this.deployableWalls[i];
      dw.life -= dt;
      if (dw.life <= 0) {
        this.scene.remove(dw.mesh);
        this.deployableWalls.splice(i, 1);
      }
    }

    // Smokes & Non-Lethal CS Irritant Clouds
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.life -= dt;
      s.group.rotation.y += dt * 0.35;
      if (s.isIrritant) {
        s.tickAccum = (s.tickAccum || 0) + dt;
        if (s.tickAccum >= 0.5) {
          s.tickAccum = 0;
          for (const e of this.enemies) {
            if (Math.hypot(e.x - s.x, e.y - s.y) <= s.radius) {
              e.slowTimer = Math.max(e.slowTimer, 1.8);
              e.windupTimer = 0;
              e.stunTimer = Math.max(e.stunTimer, 0.45);
            }
          }
        }
      }
      if (s.life <= 0) {
        this.scene.remove(s.group);
        this.smokes.splice(i, 1);
      }
    }

    // Optical / Flashbang shockwave rings
    for (let i = this.reconPulses.length - 1; i >= 0; i--) {
      const rp = this.reconPulses[i];
      rp.life -= dt;
      const scale = (1 - rp.life / 1.1) * rp.maxRadius;
      rp.mesh.scale.setScalar(Math.max(1, scale));
      (rp.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, rp.life * 0.8);
      if (rp.life <= 0) {
        this.scene.remove(rp.mesh);
        rp.mesh.geometry.dispose();
        (rp.mesh.material as THREE.Material).dispose();
        this.reconPulses.splice(i, 1);
      }
    }
  }

  private triggerExplosion3D(x: number, y: number, radius: number, damage: number) {
    const ex3 = to3DX(x);
    const ez3 = to3DZ(y);
    soundEngine.playSkill('explosion', {
      wx: ex3,
      wy: 0.9,
      wz: ez3,
      enclosure: this.computeEnclosureFactor(x, y),
    });
    this.shakeMag = Math.max(this.shakeMag, 0.85);

    // Multi-layered fireball + dark smoke particles + ground shockwave + scorch decal
    this.spawnBurst3D(ex3, 0.8, ez3, 0xfef08a, 14);
    this.spawnBurst3D(ex3, 0.7, ez3, 0xf97316, 22);
    this.spawnBurst3D(ex3, 1.1, ez3, 0x334155, 16);
    this.spawnReconRing3D(x, y, radius, 0xf97316);

    const scorch = new THREE.Mesh(
      new THREE.CircleGeometry((radius * WORLD_SCALE) * 0.42, 18),
      new THREE.MeshBasicMaterial({
        color: 0x090d14,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    );
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(ex3, 0.04, ez3);
    this.scene.add(scorch);
    this.scorchDecals.push(scorch);
    if (this.scorchDecals.length > 24) {
      const oldest = this.scorchDecals.shift();
      if (oldest) {
        this.scene.remove(oldest);
        oldest.geometry.dispose();
        (oldest.material as THREE.Material).dispose();
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= radius) {
        const falloff = 1 - (d / radius) * 0.45;
        this.damageEnemy(e, damage * falloff, 0.92, Math.atan2(e.y - y, e.x - x));
      }
    }
  }

  private updateEnemies(dt: number) {
    const inSmoke = this.smokes.some((s) => Math.hypot(s.x - this.px, s.y - this.py) <= s.radius * 0.9);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 6);
      if (e.markedTimer > 0) e.markedTimer = Math.max(0, e.markedTimer - dt);
      if (e.stunTimer > 0) e.stunTimer = Math.max(0, e.stunTimer - dt);
      if (e.slowTimer > 0) e.slowTimer = Math.max(0, e.slowTimer - dt);
      if (e.fireCooldown > 0) e.fireCooldown -= dt;

      e.beaconMesh.visible = e.markedTimer > 0;
      if (e.beaconMesh.visible) e.beaconMesh.rotation.y += dt * 3;

      if (e.stunTimer > 0) {
        if (e.laserLine) e.laserLine.visible = false;
        animateHumanoid(e.rig, this.raidElapsed, 0, 0, false);
        continue;
      }

      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.hypot(dx, dy);
      const angToPlayer = Math.atan2(dy, dx);

      const eInSmoke = this.smokes.some((s) => Math.hypot(s.x - e.x, s.y - e.y) <= s.radius * 0.9);
      const effectiveVisionRange = e.visionRange * this.currentEnemyVisionMult;
      const closeAwarenessDist = 130 * Math.max(0.55, this.currentEnemyVisionMult);
      const hasLos = !inSmoke && !eInSmoke && dist <= effectiveVisionRange && this.hasLineOfSight(e.x, e.y, this.px, this.py);

      const angleDiff = Math.abs(this.normalizeAngle(angToPlayer - e.angle));
      const canSee = hasLos && (angleDiff <= e.visionFov / 2 || dist < closeAwarenessDist);

      if (canSee) {
        e.state = 'combat';
        e.alertness = 1;
        e.targetX = this.px;
        e.targetY = this.py;
        if (e.kind === 'boss' && !this.bossEngaged) {
          this.bossEngaged = true;
          soundEngine.playDistantAlarm(to3DX(e.x), 4.5, to3DZ(e.y), 'boss');
          this.showBanner(`警告：已进入战区首领「${e.name}」交战范围！`);
        }
      } else if (e.state === 'combat') {
        e.alertness -= dt * 0.18;
        if (e.alertness <= 0.2) e.state = 'investigate';
      }

      const isJammed = this.signalJammers.some((jm) => Math.hypot(e.x - jm.x, e.y - jm.y) <= jm.radius);
      const slowMult = (e.slowTimer > 0 ? 0.45 : 1.0) * (isJammed ? 0.86 : 1.0);
      let moveRatio = 0;

      if (e.state === 'patrol') {
        e.windupTimer = 0;
        if (e.roamWaitTimer > 0) {
          e.roamWaitTimer -= dt;
          e.angle = this.normalizeAngle(e.angle + e.roamScanDir * dt * 1.05);
          moveRatio = 0;
        } else {
          e.roamTimer -= dt;
          const pdx = e.roamX - e.x;
          const pdy = e.roamY - e.y;
          const pdist = Math.hypot(pdx, pdy);
          if (pdist < 22 || e.roamTimer <= 0) {
            e.roamWaitTimer = 0.45 + Math.random() * 1.35;
            e.roamScanDir = Math.random() < 0.5 ? 1 : -1;
            const nextRoam = this.pickRandomRoamPoint(e);
            e.roamX = nextRoam.x;
            e.roamY = nextRoam.y;
            e.roamTimer = 4.2 + Math.random() * 4.5;
          } else {
            e.angle = this.lerpAngle(e.angle, Math.atan2(pdy, pdx), dt * 4.2);
            const roamPace = 0.58;
            this.moveEntity(
              e,
              (pdx / pdist) * e.speed * roamPace * slowMult * dt,
              (pdy / pdist) * e.speed * roamPace * slowMult * dt
            );
            moveRatio = roamPace * slowMult;
          }
        }
      } else if (e.state === 'investigate') {
        e.windupTimer = 0;
        const idx = e.targetX - e.x;
        const idy = e.targetY - e.y;
        const idist = Math.hypot(idx, idy);
        if (idist < 28) {
          e.alertness -= dt * (isJammed ? 0.75 : 0.4);
          e.angle += dt * 1.4;
          if (e.alertness <= 0) e.state = 'patrol';
        } else {
          e.angle = this.lerpAngle(e.angle, Math.atan2(idy, idx), dt * 5);
          this.moveEntity(e, (idx / idist) * e.speed * 0.8 * slowMult * dt, (idy / idist) * e.speed * 0.8 * slowMult * dt);
          moveRatio = 0.8 * slowMult;
        }
      } else if (e.state === 'combat') {
        e.angle = this.lerpAngle(e.angle, angToPlayer, dt * (e.kind === 'heavy' ? 3.2 : 6.5));
        const preferredDist = e.kind === 'sniper' ? 460 : e.kind === 'heavy' ? 180 : 250;
        e.strafeTimer -= dt;
        if (e.strafeTimer <= 0) {
          e.strafeTimer = 1.2 + Math.random() * 1.4;
          e.strafeDir *= -1;
        }
        let moveX = 0;
        let moveY = 0;
        if (dist > preferredDist + 40 || !hasLos) {
          moveX = Math.cos(angToPlayer);
          moveY = Math.sin(angToPlayer);
        } else if (dist < preferredDist - 55) {
          moveX = -Math.cos(angToPlayer) * 0.6;
          moveY = -Math.sin(angToPlayer) * 0.6;
        } else {
          moveX = Math.cos(angToPlayer + (Math.PI / 2) * e.strafeDir) * 0.65;
          moveY = Math.sin(angToPlayer + (Math.PI / 2) * e.strafeDir) * 0.65;
        }
        this.moveEntity(e, moveX * e.speed * slowMult * dt, moveY * e.speed * slowMult * dt);
        moveRatio = slowMult;

        if (hasLos && e.fireCooldown <= 0) {
          e.windupTimer += dt * (isJammed ? 0.52 : 1.0);
          if (e.windupTimer >= e.maxWindup) {
            this.enemyFire(e);
            e.windupTimer = 0;
          }
        } else {
          e.windupTimer = Math.max(0, e.windupTimer - dt * 2);
        }
      }

      if (e.laserLine) {
        e.laserLine.visible = !isJammed && !inSmoke && !eInSmoke && e.windupTimer > 0.08;
      }

      e.rig.root.position.set(to3DX(e.x), 0, to3DZ(e.y));
      e.rig.root.rotation.y = Math.PI / 2 - e.angle;
      animateHumanoid(e.rig, this.raidElapsed, moveRatio, e.hitFlash * 0.4, false);
    }
  }

  private enemyFire(e: Enemy3D) {
    const spread = e.kind === 'sniper' ? 0.02 : e.kind === 'boss' ? 0.08 : 0.13;
    const count = e.kind === 'boss' ? 3 : e.kind === 'heavy' ? 2 : 1;
    const dmg = e.kind === 'sniper' ? 34 : e.kind === 'boss' ? 19 : e.kind === 'heavy' ? 15 : 13;
    const speed = e.kind === 'sniper' ? 1450 : 940;

    const muzzleX = e.x + Math.cos(e.angle) * (e.radius + 8);
    const muzzleY = e.y + Math.sin(e.angle) * (e.radius + 8);
    this.spawnBurst3D(to3DX(muzzleX), 1.15, to3DZ(muzzleY), 0xfb923c, 3);
    soundEngine.playGunshot(
      false,
      e.kind === 'sniper' ? 'sniper' : e.kind === 'heavy' || e.kind === 'boss' ? 'heavy' : 'rifle',
      {
        wx: to3DX(muzzleX),
        wy: 1.25,
        wz: to3DZ(muzzleY),
        enclosure: this.computeEnclosureFactor(muzzleX, muzzleY),
        isPlayer: false,
      }
    );

    const calWeight = e.kind === 'sniper' ? 1.45 : e.kind === 'boss' || e.kind === 'heavy' ? 1.25 : 0.9;
    const maxRange = e.visionRange + 80;
    for (let k = 0; k < count; k++) {
      const off = (Math.random() - 0.5) * spread + (k - (count - 1) / 2) * 0.08;
      const shotAng = e.angle + off;
      this.spawnBullet3D(
        muzzleX,
        muzzleY,
        shotAng,
        speed,
        maxRange,
        dmg,
        e.kind === 'sniper' ? 0.72 : 0.4,
        false,
        false,
        e.kind === 'boss' ? 0xfb7185 : 0xf87171,
        100,
        calWeight
      );

      if (this.onBallisticShot && k === 0) {
        const endX = muzzleX + Math.cos(shotAng) * maxRange;
        const endY = muzzleY + Math.sin(shotAng) * maxRange;
        const wallClip = this.findObstacleHit(muzzleX, muzzleY, endX, endY, false);
        this.onBallisticShot({
          wx: to3DX(muzzleX),
          wy: 1.15,
          wz: to3DZ(muzzleY),
          ex: to3DX(wallClip ? wallClip.hitX : endX),
          ey: 1.15,
          ez: to3DZ(wallClip ? wallClip.hitY : endY),
          speed3d: speed * WORLD_SCALE,
          caliberWeight: calWeight,
          firingCadence: 0.35,
          fromPlayer: false,
          color: e.kind === 'boss' ? '#fb7185' : '#f87171',
        });
      }
    }
    e.fireCooldown = e.kind === 'sniper' ? 1.6 : e.kind === 'boss' ? 0.62 : e.kind === 'heavy' ? 0.85 : 0.78;
  }

  private spawnBullet3D(
    x: number,
    y: number,
    angle: number,
    speed: number,
    maxRange: number,
    damage: number,
    armorPen: number,
    fromPlayer: boolean,
    isExplosive: boolean,
    colorHex: number,
    explosionRadius: number = 100,
    caliberWeight: number = 1.0
  ) {
    const b = this.bullets.find((item) => !item.active);
    if (!b) return;
    b.active = true;
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.traveled = 0;
    b.maxRange = maxRange;
    b.damage = damage;
    b.armorPen = armorPen;
    b.fromPlayer = fromPlayer;
    b.isExplosive = isExplosive;
    b.explosionRadius = explosionRadius;
    b.caliberWeight = caliberWeight;

    (b.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
    b.mesh.scale.setScalar(isExplosive ? 2.4 : 1.0);
    b.mesh.position.set(to3DX(x), 1.15, to3DZ(y));
    b.mesh.rotation.y = Math.PI / 2 - angle;
    b.mesh.visible = true;
  }

  private intersectSegmentAABB(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    obs: MapObstacle
  ): { t: number; hitX: number; hitY: number; nx: number; ny: number } | null {
    const minX = obs.x;
    const maxX = obs.x + obs.w;
    const minY = obs.y;
    const maxY = obs.y + obs.h;
    const dx = x1 - x0;
    const dy = y1 - y0;

    let tmin = 0;
    let tmax = 1;
    let nx = 0;
    let ny = 0;

    if (Math.abs(dx) < 1e-6) {
      if (x0 < minX || x0 > maxX) return null;
    } else {
      const invDx = 1 / dx;
      let t1 = (minX - x0) * invDx;
      let t2 = (maxX - x0) * invDx;
      let hitNx = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        hitNx = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        nx = hitNx;
        ny = 0;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }

    if (Math.abs(dy) < 1e-6) {
      if (y0 < minY || y0 > maxY) return null;
    } else {
      const invDy = 1 / dy;
      let t1 = (minY - y0) * invDy;
      let t2 = (maxY - y0) * invDy;
      let hitNy = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        hitNy = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        nx = 0;
        ny = hitNy;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }

    // If bullet started strictly inside the AABB, project to nearest face normal
    if (nx === 0 && ny === 0) {
      const dLeft = Math.abs(x0 - minX);
      const dRight = Math.abs(maxX - x0);
      const dTop = Math.abs(y0 - minY);
      const dBot = Math.abs(maxY - y0);
      const m = Math.min(dLeft, dRight, dTop, dBot);
      if (m === dLeft) nx = -1;
      else if (m === dRight) nx = 1;
      else if (m === dTop) ny = -1;
      else ny = 1;
    }

    return {
      t: tmin,
      hitX: x0 + dx * tmin,
      hitY: y0 + dy * tmin,
      nx,
      ny,
    };
  }

  private getObstacleBulletSurface(obs: MapObstacle, isDeployable: boolean): BulletHoleSurface {
    if (isDeployable) return 'kevlar';
    if (obs.kind === 'container') return 'metal';
    if (obs.kind === 'crate') return 'wood';
    if (obs.kind === 'sandbag') return 'kevlar';
    if (obs.kind === 'pillar' && this.mapDef.theme.groundStyle === 'space_tarmac') return 'metal';
    return 'concrete';
  }

  private findObstacleHit(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    allowSandbagGraze: boolean
  ): {
    t: number;
    hitX: number;
    hitY: number;
    nx: number;
    ny: number;
    height: number;
    surface: BulletHoleSurface;
  } | null {
    let best: {
      t: number;
      hitX: number;
      hitY: number;
      nx: number;
      ny: number;
      height: number;
      surface: BulletHoleSurface;
    } | null = null;

    for (const obs of this.mapDef.obstacles) {
      if (obs.id.startsWith('riv_')) continue;
      if (obs.kind === 'sandbag') {
        if (!allowSandbagGraze) continue;
        // Waist-high sandbags allow shooters to fire over them while occasionally intercepting distant stray shots
        if (Math.random() > 0.3) continue;
      }
      const hit = this.intersectSegmentAABB(x0, y0, x1, y1, obs);
      if (hit && (!best || hit.t < best.t)) {
        best = {
          ...hit,
          height: obs.height || 3.4,
          surface: this.getObstacleBulletSurface(obs, false),
        };
      }
    }

    for (const dw of this.deployableWalls) {
      const obs = dw.obstacle;
      const hit = this.intersectSegmentAABB(x0, y0, x1, y1, obs);
      if (hit && (!best || hit.t < best.t)) {
        best = {
          ...hit,
          height: obs.height || 2.2,
          surface: this.getObstacleBulletSurface(obs, true),
        };
      }
    }

    return best;
  }

  private spawnWallBulletHole(
    hitX: number,
    hitY: number,
    nx: number,
    ny: number,
    wallHeight: number,
    surface: BulletHoleSurface,
    caliberWeight: number
  ) {
    if (this.bulletHoleDecals.length === 0) return;
    const decal = this.bulletHoleDecals[this.bulletHoleCursor];
    this.bulletHoleCursor = (this.bulletHoleCursor + 1) % this.bulletHoleDecals.length;

    const variant = Math.floor(Math.random() * 3);
    const mat = this.bulletHoleMats.get(`${surface}_${variant}`);
    if (mat) decal.material = mat;

    const wx = to3DX(hitX) + nx * 0.024;
    const wz = to3DZ(hitY) + ny * 0.024;
    // Slight natural vertical spread clamped inside struck cover/wall bounds
    const rawY = 1.05 + (Math.random() - 0.45) * 0.46;
    const wy = THREE.MathUtils.clamp(rawY, 0.35, Math.max(0.42, wallHeight - 0.24));

    const size = (0.3 + Math.random() * 0.1) * (0.75 + caliberWeight * 0.28);
    decal.position.set(wx, wy, wz);
    decal.lookAt(wx + nx, wy, wz + ny);
    decal.rotateZ(Math.random() * Math.PI * 2);
    decal.scale.set(size, size, 1);
    decal.visible = true;
  }

  private spawnImpactDustPlume3D(
    wx: number,
    wy: number,
    wz: number,
    nx: number,
    nz: number,
    surface: BulletHoleSurface,
    caliberWeight: number,
    cadence: number,
    explicitCount?: number
  ) {
    const count =
      explicitCount ?? Math.min(7, Math.round((2 + cadence * 3.4) * (0.8 + caliberWeight * 0.25)));
    const dustColor =
      surface === 'metal'
        ? 0x64748b
        : surface === 'wood'
          ? 0xb69164
          : surface === 'kevlar'
            ? 0x949184
            : this.mapDef.theme.groundStyle === 'desert_city'
              ? 0xd6bfa2
              : 0xcbd2d9;

    let spawned = 0;
    for (const puff of this.dustPuffs) {
      if (puff.active) continue;
      puff.active = true;
      const spreadSide = (Math.random() - 0.5) * 0.45;
      puff.mesh.position.set(
        wx + nx * (0.08 + Math.random() * 0.12) - nz * spreadSide * 0.35,
        wy + (Math.random() - 0.5) * 0.18,
        wz + nz * (0.08 + Math.random() * 0.12) + nx * spreadSide * 0.35
      );
      const pushSpeed = (1.1 + Math.random() * 1.9) * (1 + cadence * 0.55);
      puff.vx = nx * pushSpeed - nz * spreadSide * 2.2;
      puff.vy = 0.55 + Math.random() * (1.2 + cadence * 0.9);
      puff.vz = nz * pushSpeed + nx * spreadSide * 2.2;
      puff.life = 0.55 + Math.random() * 0.45 + cadence * 0.42;
      puff.maxLife = puff.life;
      puff.startScale = (0.36 + Math.random() * 0.2) * (0.85 + caliberWeight * 0.2);
      puff.endScale = puff.startScale * (2.6 + cadence * 1.35);
      puff.baseOpacity = Math.min(0.68, 0.3 + cadence * 0.24);
      puff.mat.color.setHex(dustColor);
      puff.mat.opacity = puff.baseOpacity;
      puff.mesh.scale.setScalar(puff.startScale);
      puff.mesh.visible = true;
      spawned++;
      if (spawned >= count) break;
    }
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      if (!b.active) continue;
      const prevX = b.x;
      const prevY = b.y;
      const sx = b.vx * dt;
      const sy = b.vy * dt;
      b.x += sx;
      b.y += sy;
      b.traveled += Math.hypot(sx, sy);
      b.mesh.position.set(to3DX(b.x), 1.15, to3DZ(b.y));

      const wallHit = this.findObstacleHit(prevX, prevY, b.x, b.y, b.traveled > 85);
      if (wallHit) {
        b.active = false;
        b.mesh.visible = false;
        const wx = to3DX(wallHit.hitX);
        const wz = to3DZ(wallHit.hitY);
        this.spawnWallBulletHole(
          wallHit.hitX,
          wallHit.hitY,
          wallHit.nx,
          wallHit.ny,
          wallHit.height,
          wallHit.surface,
          b.caliberWeight
        );
        const cadence = b.fromPlayer ? this.firingCadence : 0.25;
        this.spawnImpactDustPlume3D(
          wx,
          1.15,
          wz,
          wallHit.nx,
          wallHit.ny,
          wallHit.surface,
          b.caliberWeight,
          cadence
        );
        const sparkHex =
          wallHit.surface === 'metal'
            ? 0xfef08a
            : wallHit.surface === 'wood'
              ? 0xd6b07c
              : 0xe2e8f0;
        this.spawnBurst3D(
          wx + wallHit.nx * 0.08,
          1.15,
          wz + wallHit.ny * 0.08,
          sparkHex,
          wallHit.surface === 'metal' ? 7 : 5
        );
        if (this.onBallisticImpact) {
          this.onBallisticImpact({
            wx,
            wy: 1.15,
            wz,
            nx: wallHit.nx,
            ny: 0,
            nz: wallHit.ny,
            surface: wallHit.surface,
            caliberWeight: b.caliberWeight,
            firingCadence: cadence,
          });
        }
        soundEngine.playBallisticImpact(
          wallHit.surface,
          wx,
          1.15,
          wz,
          this.computeEnclosureFactor(wallHit.hitX, wallHit.hitY)
        );
        if (b.isExplosive) {
          this.triggerExplosion3D(wallHit.hitX, wallHit.hitY, b.explosionRadius || 100, b.damage);
        }
        continue;
      }

      if (b.traveled >= b.maxRange) {
        b.active = false;
        b.mesh.visible = false;
        if (b.isExplosive) this.triggerExplosion3D(b.x, b.y, b.explosionRadius || 120, b.damage);
        continue;
      }

      if (b.fromPlayer) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (Math.hypot(b.x - e.x, b.y - e.y) <= e.radius + 5) {
            b.active = false;
            b.mesh.visible = false;
            // Realistic ballistic distance attenuation beyond 60% of effective range
            const falloffRatio = Math.max(0, (b.traveled / Math.max(1, b.maxRange) - 0.6) / 0.4);
            const distDmg = b.damage * (1 - falloffRatio * 0.32);
            if (b.isExplosive) this.triggerExplosion3D(b.x, b.y, b.explosionRadius || 100, b.damage);
            else this.damageEnemy(e, distDmg, b.armorPen, Math.atan2(b.vy, b.vx));
            break;
          }
        }
      } else {
        if (Math.hypot(b.x - this.px, b.y - this.py) <= this.pRadius + 4) {
          b.active = false;
          b.mesh.visible = false;
          this.damagePlayer(b.damage, b.armorPen);
        }
      }
    }
  }

  private damageEnemy(e: Enemy3D, rawDamage: number, armorPen: number, hitAngle: number) {
    let dmg = rawDamage;
    if (e.kind === 'heavy') {
      const hitFromAngle = Math.atan2(this.py - e.y, this.px - e.x);
      if (Math.abs(this.normalizeAngle(hitFromAngle - e.angle)) < 0.75 && armorPen < 0.75) {
        dmg *= 0.45;
      }
    }

    let armorBroken = false;
    if (e.armor > 0) {
      const armorDmg = dmg * (1 - armorPen * 0.45);
      e.armor = Math.max(0, e.armor - armorDmg);
      dmg = dmg * (0.45 + armorPen * 0.55);
      if (e.armor === 0) armorBroken = true;
    }

    e.hp -= dmg;
    e.hitFlash = 1.0;
    if (this.loadout.operatorId === 'luna') e.markedTimer = Math.max(e.markedTimer, 4.0);
    if (e.state === 'patrol') {
      e.state = 'combat';
      e.targetX = this.px;
      e.targetY = this.py;
    }

    this.spawnBurst3D(to3DX(e.x), 1.1, to3DZ(e.y), armorBroken ? 0x38bdf8 : 0xef4444, 6);

    if (e.hp <= 0) {
      this.kills += 1;
      soundEngine.playHitmarker(true, armorBroken);
      this.hitstopTimer = e.kind === 'boss' ? 0.065 : 0.032;
      this.shakeMag = Math.max(this.shakeMag, e.kind === 'boss' ? 0.85 : 0.25);
      this.spawnBurst3D(to3DX(e.x), 1.0, to3DZ(e.y), 0xef4444, 18);

      if (this.loadout.operatorId === 'dwolf') {
        this.stamina = Math.min(this.maxStamina, this.stamina + 40);
      }

      const lootBias = Math.min(0.99, (e.kind === 'boss' ? 0.98 : e.kind === 'heavy' ? 0.45 : 0.22) * this.mapDef.lootMultiplier);
      const items: LootInstance[] = [rollLootItem(lootBias)];
      if (e.kind === 'boss') {
        this.bossKilled = true;
        const saeedTemplate = LOOT_TEMPLATES.find((t) => t.templateId === 'saeed_blade')!;
        items.unshift({
          uid: `loot_boss_${Date.now()}`,
          templateId: saeedTemplate.templateId,
          name: saeedTemplate.name,
          rarity: saeedTemplate.rarity,
          category: saeedTemplate.category,
          value: saeedTemplate.value,
          weight: 1,
          revealed: false,
        });
        items.push(rollLootItem(0.92));
        this.showBanner(`首领「${e.name}」已被击毙！快前往搜刮传说红色战利品`);
      }

      this.containers.push(
        this.createContainer3D(`drop_${e.id}`, `${e.name} 战利品箱`, e.kind === 'boss' ? 'safe' : 'supply_box', e.x, e.y, items)
      );

      this.scene.remove(e.rig.root);
      const idx = this.enemies.indexOf(e);
      if (idx !== -1) this.enemies.splice(idx, 1);
    } else {
      soundEngine.playHitmarker(false, armorBroken);
      this.moveEntity(e, Math.cos(hitAngle) * 4, Math.sin(hitAngle) * 4);
    }
  }

  private damagePlayer(rawDamage: number, armorPen: number) {
    let dmg = rawDamage;
    if (this.loadout.operatorId === 'shepherd') dmg *= 0.85;
    if (this.loadout.operatorId === 'uluru') dmg *= 0.88;

    // Anatomical hit location roll
    const r = Math.random();
    const hitPart: BodyPartId = r < 0.1 ? 'head' : r < 0.54 ? 'chest' : r < 0.78 ? 'arms' : 'legs';
    const partNames: Record<BodyPartId, string> = {
      head: '头部',
      chest: '胸部',
      arms: '手臂',
      legs: '腿部',
    };

    // Ballistic armor protects chest (full) and head (partial); limbs take direct trauma
    let hpDmg = dmg;
    if (this.armor > 0 && (hitPart === 'chest' || hitPart === 'head')) {
      const zoneProtect = hitPart === 'chest' ? 1.0 : 0.65;
      const absorbed = dmg * this.armorReduction * zoneProtect * (1 - armorPen * 0.4);
      this.armor = Math.max(0, this.armor - absorbed * 1.15);
      hpDmg = Math.max(3, dmg - absorbed);
    }

    const part = this.bodyParts[hitPart];
    const partDmg = hitPart === 'head' ? hpDmg * 0.85 : hpDmg * 0.95;
    part.hp = Math.max(0, part.hp - partDmg);

    // Heavy or unarmored penetrating trauma causes persistent bleeding until manually bandaged
    const bleedChance = this.armor <= 0 || hitPart === 'arms' || hitPart === 'legs' ? 0.62 : armorPen >= 0.55 ? 0.48 : 0.22;
    if (!part.bleeding && hpDmg >= 9 && Math.random() < bleedChance) {
      part.bleeding = true;
      this.showBanner(`⚠️ ${partNames[hitPart]}中弹流血！按 [1] 使用急救包手动止血`);
    }

    this.hp = Math.max(0, this.hp - hpDmg);
    this.playerHitFlash = 1.0;
    this.shakeMag = Math.max(this.shakeMag, hitPart === 'head' ? 0.55 : 0.35);
    soundEngine.playDamageTaken();
    this.spawnBurst3D(to3DX(this.px), 1.1, to3DZ(this.py), 0xef4444, 6);

    if (this.hp <= 0 || this.bodyParts.head.hp <= 0 || this.bodyParts.chest.hp <= 0) {
      this.hp = 0;
      const fatalReason =
        this.bodyParts.head.hp <= 0
          ? '头部遭受致命创伤 · 行动失败'
          : this.bodyParts.chest.hp <= 0
            ? '胸腔重要器官重创 · 行动失败'
            : '生命体征归零 · 行动失败';
      this.finishRaid(false, fatalReason);
    }
  }

  private spawnShellCasing(x: number, y: number, z: number, shotAngle: number) {
    const c = this.shellCasings.find((item) => !item.active);
    if (!c) return;
    c.active = true;
    const ejectAng = shotAngle + Math.PI / 2;
    c.mesh.position.set(x - Math.cos(shotAngle) * 0.35, y + 0.05, z - Math.sin(shotAngle) * 0.35);
    c.vx = Math.cos(ejectAng) * (2.6 + Math.random() * 1.4);
    c.vy = 2.8 + Math.random() * 1.3;
    c.vz = Math.sin(ejectAng) * (2.6 + Math.random() * 1.4);
    c.spinX = (Math.random() - 0.5) * 18;
    c.spinZ = (Math.random() - 0.5) * 18;
    c.life = 1.25;
    c.mesh.visible = true;
  }

  private spawnBurst3D(x: number, y: number, z: number, colorHex: number, count: number) {
    let n = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      p.mesh.position.set(x, y, z);
      p.vx = (Math.random() - 0.5) * 8.5;
      p.vy = 2 + Math.random() * 5.2;
      p.vz = (Math.random() - 0.5) * 8.5;
      p.life = 0.32 + Math.random() * 0.28;
      p.maxLife = p.life;
      p.gravity = 12;
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
      p.mesh.visible = true;
      n++;
      if (n >= count) break;
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.setScalar(Math.max(0.1, p.life / p.maxLife));
    }

    for (const c of this.shellCasings) {
      if (!c.active) continue;
      c.life -= dt;
      if (c.life <= 0) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }
      c.vy -= 14 * dt;
      c.mesh.position.x += c.vx * dt;
      c.mesh.position.y += c.vy * dt;
      c.mesh.position.z += c.vz * dt;
      if (c.mesh.position.y <= 0.03) {
        c.mesh.position.y = 0.03;
        c.vy = Math.abs(c.vy) * 0.35;
        c.vx *= 0.65;
        c.vz *= 0.65;
      }
      c.mesh.rotation.x += c.spinX * dt;
      c.mesh.rotation.z += c.spinZ * dt;
    }

    // Update 3D volumetric impact/muzzle dust puffs (billboarded toward camera)
    for (const puff of this.dustPuffs) {
      if (!puff.active) continue;
      puff.life -= dt;
      if (puff.life <= 0) {
        puff.active = false;
        puff.mesh.visible = false;
        continue;
      }
      const progress = 1 - puff.life / puff.maxLife;
      const drag = Math.exp(-dt * 2.2);
      puff.vx *= drag;
      puff.vz *= drag;
      puff.vy = puff.vy * drag + dt * 0.45;
      puff.mesh.position.x += puff.vx * dt;
      puff.mesh.position.y = Math.max(0.18, puff.mesh.position.y + puff.vy * dt);
      puff.mesh.position.z += puff.vz * dt;
      puff.mesh.quaternion.copy(this.camera.quaternion);
      const scale = puff.startScale + (puff.endScale - puff.startScale) * Math.pow(progress, 0.72);
      puff.mesh.scale.setScalar(scale);
      puff.mat.opacity = puff.baseOpacity * (1 - progress) * (progress < 0.14 ? progress / 0.14 : 1);
    }
  }

  private getTimeOfDayMeta(h: number): { phase: TimeOfDayPhase; label: string; visionMult: number; isDark: boolean } {
    if (h >= 5 && h < 8) return { phase: 'dawn', label: '拂晓', visionMult: 0.92, isDark: false };
    if (h >= 8 && h < 16.5) return { phase: 'day', label: '白昼', visionMult: 1.0, isDark: false };
    if (h >= 16.5 && h < 19.5) return { phase: 'dusk', label: '黄昏', visionMult: 0.88, isDark: true };
    return { phase: 'night', label: '深夜', visionMult: 0.78, isDark: true };
  }

  private updateAmbientWeather(dt: number) {
    // 1. Advance Dynamic Day-to-Night Cycle (~178s per full 24h cycle)
    this.timeOfDayHours = (this.timeOfDayHours + dt * 0.135) % 24;
    const todMeta = this.getTimeOfDayMeta(this.timeOfDayHours);

    // 2. Dynamic Weather Transitions (auto-shifts every 42-58s)
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      const candidates = WEATHER_ORDER.filter((w) => w !== this.weather);
      const next = candidates[Math.floor(Math.random() * candidates.length)];
      this.transitionToWeather(next);
    }

    // Smooth weather crossfade weights
    this.rainBlend = THREE.MathUtils.damp(this.rainBlend, this.weather === 'rain' ? 1 : 0, 0.9, dt);
    this.snowBlend = THREE.MathUtils.damp(this.snowBlend, this.weather === 'snow' ? 1 : 0, 0.9, dt);
    this.smogBlend = THREE.MathUtils.damp(this.smogBlend, this.weather === 'smog' ? 1 : 0, 0.9, dt);

    // Combine real-time tactical modifiers (Smog drastically cuts enemy vision; Rain amplifies player movement noise)
    const wMeta = WEATHER_META[this.weather];
    this.currentEnemyVisionMult = Number((wMeta.visionMult * todMeta.visionMult).toFixed(2));
    this.currentPlayerNoiseMult = wMeta.noiseMult;

    // 3. Occasional distant rainstorm lightning & thunder
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 3.8);
    }
    if (this.rainBlend > 0.65) {
      this.thunderTimer -= dt;
      if (this.thunderTimer <= 0) {
        this.thunderTimer = 11 + Math.random() * 14;
        this.lightningFlash = 0.85;
        soundEngine.playThunder();
      }
    }

    // 4. Compute Smooth Day-to-Night Lighting & Weather Atmospheric Blending
    const h = this.timeOfDayHours;
    // Daylight factor: 1 at noon (12h), 0 at night (21h..4h)
    const sunElev = Math.sin(((h - 6) / 12) * Math.PI); // >0 day, <0 night
    const dayFactor = THREE.MathUtils.clamp((sunElev + 0.16) / 0.72, 0, 1);
    const duskWeight =
      Math.max(
        Math.exp(-Math.pow((h - 18.0) / 1.45, 2)),
        Math.exp(-Math.pow((h - 6.3) / 1.25, 2))
      );

    const theme = this.mapDef.theme;
    const baseSky = _colA.setHex(theme.skyColor);
    const nightSky = _colB.setHex(0x060b16);
    const duskSky = _colC.setHex(0x47282b);

    // Sky color: night -> day + warm dusk glow
    const skyColor = baseSky.clone().lerp(nightSky, 1 - dayFactor).lerp(duskSky, duskWeight * 0.52);
    // Weather atmosphere tinting on sky & fog
    if (this.rainBlend > 0.01) skyColor.lerp(_colB.setHex(0x132030), this.rainBlend * 0.58);
    if (this.snowBlend > 0.01) skyColor.lerp(_colB.setHex(dayFactor > 0.35 ? 0x8ea3b8 : 0x162233), this.snowBlend * 0.55);
    if (this.smogBlend > 0.01) skyColor.lerp(_colB.setHex(dayFactor > 0.35 ? 0x5c5c49 : 0x1e201b), this.smogBlend * 0.76);
    if (this.lightningFlash > 0.01) skyColor.lerp(_colB.setHex(0xcbd5e1), this.lightningFlash * 0.45);

    (this.scene.background as THREE.Color).copy(skyColor);
    const fog = this.scene.fog as THREE.FogExp2;
    if (fog) {
      fog.color.copy(skyColor);
      const nightFogScale = 1 + (1 - dayFactor) * 0.25;
      const weatherFogScale = 1 + this.rainBlend * 0.48 + this.snowBlend * 0.65 + this.smogBlend * 1.95;
      fog.density = theme.fogDensity * nightFogScale * weatherFogScale;
    }

    // Sun / Moon Directional Light Orbit, Color & Intensity
    const px3 = to3DX(this.px);
    const pz3 = to3DZ(this.py);
    const orbitRad = ((h - 6) / 12) * Math.PI;
    const sunIsUp = sunElev >= -0.05;
    const sunArcX = sunIsUp ? Math.cos(orbitRad) * 62 : -Math.cos(orbitRad) * 48;
    const sunArcY = sunIsUp ? Math.max(16, Math.sin(orbitRad) * 64) : 44;
    const sunArcZ = 38;
    this.sunLight.position.set(px3 + sunArcX, sunArcY, pz3 + sunArcZ);
    this.sunLight.target.position.set(px3, 0, pz3);

    const daySunCol = _colA.setHex(theme.sunColor);
    const nightMoonCol = _colB.setHex(0x5f85c4);
    const duskSunCol = _colC.setHex(0xfb923c);
    this.sunLight.color.copy(daySunCol).lerp(nightMoonCol, 1 - dayFactor).lerp(duskSunCol, duskWeight * 0.6);
    if (this.smogBlend > 0.05) this.sunLight.color.lerp(_colB.setHex(0xc8c098), this.smogBlend * 0.55);
    if (this.snowBlend > 0.05) this.sunLight.color.lerp(_colB.setHex(0xdbeafe), this.snowBlend * 0.45);

    const weatherSunAtten = 1 - this.rainBlend * 0.32 - this.smogBlend * 0.42 - this.snowBlend * 0.16;
    const baseSunInt = THREE.MathUtils.lerp(0.36, theme.sunIntensity * 1.12, dayFactor);
    this.sunLight.intensity = baseSunInt * weatherSunAtten + this.lightningFlash * 2.4;

    // Hemisphere Sky/Ground Fill Light
    this.hemiLight.color
      .setHex(theme.hemiSky)
      .lerp(_colB.setHex(0x16243d), 1 - dayFactor)
      .lerp(_colC.setHex(0x88876d), this.smogBlend * 0.55)
      .lerp(_colB.setHex(0xcbe0f5), this.snowBlend * 0.4);
    this.hemiLight.groundColor
      .setHex(theme.hemiGround)
      .lerp(_colB.setHex(0x090d16), 1 - dayFactor)
      .lerp(_colSnowFrost, this.snowBlend * 0.35);
    this.hemiLight.intensity =
      THREE.MathUtils.lerp(0.34, 0.78, dayFactor) * (1 - this.smogBlend * 0.15) + this.lightningFlash * 0.55;

    this.rimLight.intensity = THREE.MathUtils.lerp(0.45, 0.85, dayFactor);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(0.84, 0.98, dayFactor);

    // 5. Player Weapon Tactical Flashlight (auto-activates at dusk/night or heavy smog, or manual [L])
    const autoFlash = dayFactor < 0.42 || this.smogBlend > 0.55;
    this.flashlightOn = this.flashlightManualOverride !== null ? this.flashlightManualOverride : autoFlash;
    const targetFlashInt = this.flashlightOn ? (dayFactor < 0.35 ? 11.5 : 5.5) : 0;
    this.playerFlashlight.intensity = THREE.MathUtils.damp(this.playerFlashlight.intensity, targetFlashInt, 8, dt);
    if (this.playerFlashlight.intensity > 0.05) {
      const fx = Math.cos(this.pAngle);
      const fz = Math.sin(this.pAngle);
      this.playerFlashlight.position.set(px3 + fx * 0.45, 1.48, pz3 + fz * 0.45);
      const aimPitchY = this.cameraMode === 'first' ? Math.sin(this.fpPitch) * 16 : -0.6;
      this.playerFlashlight.target.position.set(px3 + fx * 18, Math.max(0.15, 1.48 + aimPitchY), pz3 + fz * 18);
    }

    // 6. Dynamic Ground Surface Wetness (Rain specular) & Frost Accumulation (Snow)
    for (const surf of this.weatherSurfaces) {
      const wetRough = Math.max(0.22, surf.baseRoughness - this.rainBlend * 0.58);
      const finalRough = THREE.MathUtils.lerp(wetRough, 0.94, this.snowBlend);
      surf.mat.roughness = finalRough;
      surf.mat.metalness = THREE.MathUtils.clamp(surf.baseMetalness + this.rainBlend * 0.24 - this.snowBlend * 0.04, 0.02, 0.42);
      surf.mat.color.copy(surf.baseColor);
      if (this.rainBlend > 0.02) surf.mat.color.lerp(_colWetTint, this.rainBlend * 0.28);
      if (this.snowBlend > 0.02) surf.mat.color.lerp(_colSnowFrost, this.snowBlend * 0.44);
    }

    // 7. Update Biome Ambient Motes
    const cx = px3;
    const cz = pz3;
    if (this.ambientWeatherPoints && this.ambientWeatherVelocities) {
      const posAttr = this.ambientWeatherPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const vel = this.ambientWeatherVelocities;
      const halfSpan = 22;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += vel[i] * dt;
        arr[i + 1] += vel[i + 1] * dt;
        arr[i + 2] += vel[i + 2] * dt;
        if (arr[i + 1] < 0.2 || arr[i + 1] > 15) {
          arr[i + 1] = vel[i + 1] < 0 ? 14 : 0.4;
          arr[i] = cx + (Math.random() - 0.5) * halfSpan * 2;
          arr[i + 2] = cz + (Math.random() - 0.5) * halfSpan * 2;
        }
        if (arr[i] < cx - halfSpan) arr[i] += halfSpan * 2;
        else if (arr[i] > cx + halfSpan) arr[i] -= halfSpan * 2;
        if (arr[i + 2] < cz - halfSpan) arr[i + 2] += halfSpan * 2;
        else if (arr[i + 2] > cz + halfSpan) arr[i + 2] -= halfSpan * 2;
      }
      posAttr.needsUpdate = true;
    }

    // 8. Update 3D Rain Streaks
    if (this.rainLines && this.rainPositions) {
      const active = this.rainBlend > 0.03;
      this.rainLines.visible = active;
      if (active) {
        (this.rainLines.material as THREE.LineBasicMaterial).opacity = 0.56 * this.rainBlend;
        const arr = this.rainPositions;
        const span = 19;
        for (let i = 0; i < arr.length; i += 6) {
          arr[i] += -2.8 * dt;
          arr[i + 1] += -22.5 * dt;
          arr[i + 2] += 1.9 * dt;
          if (arr[i + 1] < 0.2) {
            arr[i] = cx + (Math.random() - 0.5) * span * 2;
            arr[i + 1] = 14 + Math.random() * 5;
            arr[i + 2] = cz + (Math.random() - 0.5) * span * 2;
          }
          if (arr[i] < cx - span) arr[i] += span * 2;
          else if (arr[i] > cx + span) arr[i] -= span * 2;
          if (arr[i + 2] < cz - span) arr[i + 2] += span * 2;
          else if (arr[i + 2] > cz + span) arr[i + 2] -= span * 2;

          arr[i + 3] = arr[i] - 0.14;
          arr[i + 4] = arr[i + 1] - 0.92;
          arr[i + 5] = arr[i + 2] + 0.1;
        }
        (this.rainLines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      }
    }

    // 9. Update 3D Swirling Snowflakes
    if (this.snowPoints && this.snowVelocities) {
      const active = this.snowBlend > 0.03;
      this.snowPoints.visible = active;
      if (active) {
        (this.snowPoints.material as THREE.PointsMaterial).opacity = 0.85 * this.snowBlend;
        const posAttr = this.snowPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const vel = this.snowVelocities;
        const span = 20;
        for (let i = 0; i < arr.length; i += 3) {
          const flutter = Math.sin(this.raidElapsed * 2.2 + i * 0.37) * 0.85;
          arr[i] += (vel[i] + flutter) * dt;
          arr[i + 1] += vel[i + 1] * dt;
          arr[i + 2] += (vel[i + 2] + Math.cos(this.raidElapsed * 1.8 + i) * 0.65) * dt;
          if (arr[i + 1] < 0.15) {
            arr[i] = cx + (Math.random() - 0.5) * span * 2;
            arr[i + 1] = 13 + Math.random() * 4;
            arr[i + 2] = cz + (Math.random() - 0.5) * span * 2;
          }
          if (arr[i] < cx - span) arr[i] += span * 2;
          else if (arr[i] > cx + span) arr[i] -= span * 2;
          if (arr[i + 2] < cz - span) arr[i + 2] += span * 2;
          else if (arr[i + 2] > cz + span) arr[i + 2] -= span * 2;
        }
        posAttr.needsUpdate = true;
      }
    }

    // 10. Update 3D Swirling Smog / Particulate Clouds
    if (this.smogPoints && this.smogVelocities) {
      const active = this.smogBlend > 0.03;
      this.smogPoints.visible = active;
      if (active) {
        (this.smogPoints.material as THREE.PointsMaterial).opacity = 0.28 * this.smogBlend;
        const posAttr = this.smogPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const vel = this.smogVelocities;
        const span = 22;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i] += vel[i] * dt;
          arr[i + 1] += Math.sin(this.raidElapsed * 0.7 + i) * 0.12 * dt;
          arr[i + 2] += vel[i + 2] * dt;
          if (arr[i] < cx - span) arr[i] += span * 2;
          else if (arr[i] > cx + span) arr[i] -= span * 2;
          if (arr[i + 2] < cz - span) arr[i + 2] += span * 2;
          else if (arr[i + 2] > cz + span) arr[i + 2] -= span * 2;
        }
        posAttr.needsUpdate = true;
      }
    }

    // 11. Extraction signal flare smoke sparks (red while locked, emerald once lever is pulled)
    this.weatherSmokeAccum += dt;
    if (this.weatherSmokeAccum >= 0.22) {
      this.weatherSmokeAccum = 0;
      for (const ext of this.mapDef.extractions) {
        this.spawnBurst3D(to3DX(ext.x), 0.4, to3DZ(ext.y), this.leverPulled ? 0x10b981 : 0xef4444, 1);
      }
      if (!this.leverPulled) {
        this.spawnBurst3D(to3DX(this.leverPos.x), 1.9, to3DZ(this.leverPos.y), 0xf59e0b, 1);
      }
    }
  }

  private updateExtraction(dt: number) {
    if (!this.leverPulled) {
      this.extractProgress = 0;
      this.activeExtractId = null;
      return;
    }

    let insideAny = false;
    for (const ext of this.mapDef.extractions) {
      const d = Math.hypot(this.px - ext.x, this.py - ext.y);
      if (d <= ext.radius) {
        insideAny = true;
        if (this.activeExtractId !== ext.id) {
          this.activeExtractId = ext.id;
          this.showBanner(`已进入「${ext.name}」· 请坚守 03:00 倒计时完成撤离！`);
        }
        this.extractProgress += dt;
        this.extractPingAccum += dt;
        this.extractNoiseAccum += dt;
        if (this.extractPingAccum >= 3.0) {
          this.extractPingAccum = 0;
          soundEngine.playExtractPing(this.extractProgress / ext.holdDuration);
        }
        if (this.extractNoiseAccum >= 12.0) {
          this.extractNoiseAccum = 0;
          this.emitNoise(ext.x, ext.y, 460, 0.55);
        }
        if (this.extractProgress >= ext.holdDuration) {
          this.finishRaid(true, `已完成拉闸并在「${ext.name}」坚守 3 分钟安全撤离`);
          return;
        }
      }
    }
    if (!insideAny && this.extractProgress > 0) {
      // Stepping out pauses & slowly decays countdown so player must hold the zone
      this.extractProgress = Math.max(0, this.extractProgress - dt * 0.45);
      if (this.extractProgress <= 0.01) {
        this.extractProgress = 0;
        this.activeExtractId = null;
      }
    }
  }

  private finishRaid(extracted: boolean, reason: string) {
    if (this.ended) return;
    this.ended = true;
    soundEngine.stopRaidAmbience();
    this.heldKeys.clear();
    this.mouseDown = false;
    this.rightMouseDown = false;

    if (extracted) soundEngine.playVictory();
    else soundEngine.playDefeat();

    const keptLoot = extracted ? [...this.backpack, ...this.safeBox] : [...this.safeBox];
    const totalExtractedValue = keptLoot.reduce((acc, i) => acc + i.value, 0);
    const lostBackpackValue = extracted ? 0 : this.backpack.reduce((acc, i) => acc + i.value, 0);
    const lostBackpackCount = extracted ? 0 : this.backpack.length;
    const armorPrice = ARMOR_TIERS.find((a) => a.tier === this.loadout.armorTier)?.price || 0;
    const supplyLoss =
      this.loadout.medkits * 1500 +
      this.loadout.armorPlates * 2000 +
      (this.loadout.ammoTier === 'ap' ? 6000 : 1500);
    const lostLoadoutValue = extracted ? 0 : armorPrice + supplyLoss;
    const assetLossPenalty = extracted ? 0 : lostLoadoutValue;

    this.onRaidEnd({
      mapId: this.mapDef.id,
      extracted,
      reason,
      operatorId: this.loadout.operatorId,
      durationSec: this.raidElapsed,
      kills: this.kills,
      bossKilled: this.bossKilled,
      leverPulled: this.leverPulled,
      backpackLoot: [...this.backpack],
      safeBoxLoot: [...this.safeBox],
      totalExtractedValue,
      lostLoadoutValue,
      lostBackpackValue,
      lostBackpackCount,
      assetLossPenalty,
      gearUsed: { ...this.gearUseCounts },
      weaponId: this.loadout.weaponId,
      endingWeaponDurability: Number(this.weaponDurability.toFixed(1)),
      jamsExperienced: this.jamsExperienced,
    });
  }

  // Geometry collision helpers
  private moveCircleWithCollisions(dx: number, dy: number) {
    this.px += dx;
    for (const obs of this.mapDef.obstacles) this.resolveCircleRect(obs);
    for (const dw of this.deployableWalls) this.resolveCircleRect(dw.obstacle);
    this.py += dy;
    for (const obs of this.mapDef.obstacles) this.resolveCircleRect(obs);
    for (const dw of this.deployableWalls) this.resolveCircleRect(dw.obstacle);
    this.px = Math.max(this.pRadius + 40, Math.min(WORLD_WIDTH - this.pRadius - 40, this.px));
    this.py = Math.max(this.pRadius + 40, Math.min(WORLD_HEIGHT - this.pRadius - 40, this.py));
  }

  private resolveCircleRect(rect: MapObstacle) {
    const closestX = Math.max(rect.x, Math.min(this.px, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(this.py, rect.y + rect.h));
    const dx = this.px - closestX;
    const dy = this.py - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq < this.pRadius * this.pRadius) {
      const dist = Math.sqrt(distSq) || 0.001;
      const overlap = this.pRadius - dist;
      this.px += (dx / dist) * overlap;
      this.py += (dy / dist) * overlap;
    }
  }

  private moveEntity(e: Enemy3D, dx: number, dy: number) {
    e.x += dx;
    e.y += dy;
    for (const obs of this.mapDef.obstacles) {
      const closestX = Math.max(obs.x, Math.min(e.x, obs.x + obs.w));
      const closestY = Math.max(obs.y, Math.min(e.y, obs.y + obs.h));
      const ddx = e.x - closestX;
      const ddy = e.y - closestY;
      const distSq = ddx * ddx + ddy * ddy;
      if (distSq < e.radius * e.radius) {
        const dist = Math.sqrt(distSq) || 0.001;
        const overlap = e.radius - dist;
        e.x += (ddx / dist) * overlap;
        e.y += (ddy / dist) * overlap;
      }
    }
    for (const dw of this.deployableWalls) {
      const obs = dw.obstacle;
      const closestX = Math.max(obs.x, Math.min(e.x, obs.x + obs.w));
      const closestY = Math.max(obs.y, Math.min(e.y, obs.y + obs.h));
      const ddx = e.x - closestX;
      const ddy = e.y - closestY;
      const distSq = ddx * ddx + ddy * ddy;
      if (distSq < e.radius * e.radius) {
        const dist = Math.sqrt(distSq) || 0.001;
        const overlap = e.radius - dist;
        e.x += (ddx / dist) * overlap;
        e.y += (ddy / dist) * overlap;
      }
    }
  }

  private isPointBlocked(x: number, y: number, pad: number): boolean {
    if (x < 50 + pad || x > WORLD_WIDTH - 50 - pad || y < 50 + pad || y > WORLD_HEIGHT - 50 - pad) {
      return true;
    }
    for (const obs of this.mapDef.obstacles) {
      if (x >= obs.x - pad && x <= obs.x + obs.w + pad && y >= obs.y - pad && y <= obs.y + obs.h + pad) {
        return true;
      }
    }
    for (const dw of this.deployableWalls) {
      const obs = dw.obstacle;
      if (x >= obs.x - pad && x <= obs.x + obs.w + pad && y >= obs.y - pad && y <= obs.y + obs.h + pad) {
        return true;
      }
    }
    return false;
  }

  private getWallSafeLeanOffset2D(): { ox: number; oy: number } {
    if (Math.abs(this.leanAmount) < 0.004) return { ox: 0, oy: 0 };
    const rightX = -Math.sin(this.pAngle);
    const rightY = Math.cos(this.pAngle);
    const maxDist2D = (0.48 / WORLD_SCALE) * this.controlSettings.leanIntensity * this.leanAmount;
    let safeFrac = 0;
    for (const frac of [0.33, 0.66, 1.0]) {
      const tx = this.px + rightX * maxDist2D * frac;
      const ty = this.py + rightY * maxDist2D * frac;
      if (!this.isPointBlocked(tx, ty, 7)) {
        safeFrac = frac;
      } else {
        break;
      }
    }
    return {
      ox: rightX * maxDist2D * safeFrac,
      oy: rightY * maxDist2D * safeFrac,
    };
  }

  private pickRandomRoamPoint(e: Enemy3D): { x: number; y: number } {
    const anchors = e.patrolPoints.length > 0 ? e.patrolPoints : [{ x: e.x, y: e.y }];
    // 25% chance return near a patrol anchor; 75% chance pick a fresh randomized tactical roam waypoint
    const anchor = anchors[Math.floor(Math.random() * anchors.length)];
    if (Math.random() < 0.25) {
      e.patrolIdx = (e.patrolIdx + 1) % anchors.length;
      return { x: anchor.x, y: anchor.y };
    }
    const base = Math.random() < 0.55 ? { x: e.x, y: e.y } : anchor;
    for (let attempt = 0; attempt < 12; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 110 + Math.random() * 190;
      const cx = Math.max(70, Math.min(WORLD_WIDTH - 70, base.x + Math.cos(ang) * dist));
      const cy = Math.max(70, Math.min(WORLD_HEIGHT - 70, base.y + Math.sin(ang) * dist));
      if (!this.isPointBlocked(cx, cy, e.radius + 10)) {
        return { x: cx, y: cy };
      }
    }
    return { x: anchor.x, y: anchor.y };
  }

  private hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 26);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const sx = x1 + (x2 - x1) * t;
      const sy = y1 + (y2 - y1) * t;
      for (const obs of this.mapDef.obstacles) {
        if (!obs.blocksVision) continue;
        if (sx >= obs.x && sx <= obs.x + obs.w && sy >= obs.y && sy <= obs.y + obs.h) return false;
      }
      for (const dw of this.deployableWalls) {
        const obs = dw.obstacle;
        if (sx >= obs.x && sx <= obs.x + obs.w && sy >= obs.y && sy <= obs.y + obs.h) return false;
      }
    }
    return true;
  }

  private computeEnclosureFactor(x2d: number, y2d: number): number {
    let score = 0;

    // Proximity to tunnel/underground extraction shafts gives strong tunnel reverberation
    for (const ext of this.mapDef.extractions) {
      if (ext.id.includes('tunnel') || ext.id.includes('oasis')) {
        const d = Math.hypot(x2d - ext.x, y2d - ext.y);
        if (d < 260) {
          score = Math.max(score, 0.72 + (1 - d / 260) * 0.28);
        }
      }
    }

    // Check 8 compass directions for nearby tall concrete/steel walls (corridors & bunkers)
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.707, 0.707],
      [-0.707, 0.707],
      [0.707, -0.707],
      [-0.707, -0.707],
    ];
    let hitCount = 0;
    const hitCardinals = [false, false, false, false];

    for (let i = 0; i < dirs.length; i++) {
      const [dx, dy] = dirs[i];
      let hit = false;
      for (const dist of [75, 145, 210]) {
        const sx = x2d + dx * dist;
        const sy = y2d + dy * dist;
        for (const obs of this.mapDef.obstacles) {
          if (obs.id.startsWith('riv_') || obs.kind === 'sandbag' || (obs.height || 3) < 2.2) continue;
          if (sx >= obs.x && sx <= obs.x + obs.w && sy >= obs.y && sy <= obs.y + obs.h) {
            hit = true;
            break;
          }
        }
        if (hit) break;
        for (const dw of this.deployableWalls) {
          const obs = dw.obstacle;
          if (sx >= obs.x && sx <= obs.x + obs.w && sy >= obs.y && sy <= obs.y + obs.h) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (hit) {
        hitCount += 1;
        if (i < 4) hitCardinals[i] = true;
      }
    }

    // Opposing parallel walls (tunnel / container corridor) amplify reflection slapback
    const hasCorridorPair =
      (hitCardinals[0] && hitCardinals[1]) || (hitCardinals[2] && hitCardinals[3]);
    const wallEnclosure = (hitCount / 8) * 0.78 + (hasCorridorPair ? 0.28 : 0);
    return Math.min(1, Math.max(score, wallEnclosure));
  }

  private normalizeAngle(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  private lerpAngle(a: number, b: number, t: number): number {
    const diff = this.normalizeAngle(b - a);
    return a + diff * Math.min(1, t);
  }

  private syncHudNow() {
    const nearest = this.findNearestContainer();
    const activeCont = this.containers.find((c) => c.id === this.activeContainerId) || nearest;
    const boss = this.enemies.find((e) => e.kind === 'boss');

    const leverDist2D = Math.hypot(this.leverPos.x - this.px, this.leverPos.y - this.py);
    const extractionLever: HudSnapshot['extractionLever'] = {
      x: this.leverPos.x,
      y: this.leverPos.y,
      name: this.leverPos.name,
      zoneName: this.leverPos.zoneName,
      pulled: this.leverPulled,
      distanceMeters: Math.round(leverDist2D * WORLD_SCALE),
      canPull: !this.leverPulled && leverDist2D <= 110,
    };

    let nearbyExtract: HudSnapshot['nearbyExtract'] = null;
    let insideExtId: string | null = null;
    for (const ext of this.mapDef.extractions) {
      const dist = Math.hypot(this.px - ext.x, this.py - ext.y);
      if (dist <= ext.radius + 45) {
        if (dist <= ext.radius) insideExtId = ext.id;
        nearbyExtract = {
          name: ext.name,
          active: this.leverPulled,
          leverPulled: this.leverPulled,
          activatesIn: 0,
          progress: this.extractProgress,
          holdDuration: ext.holdDuration,
          remainingSec: Math.max(0, ext.holdDuration - this.extractProgress),
        };
        break;
      }
    }

    let activeExtraction: HudSnapshot['activeExtraction'] = null;
    if (this.leverPulled && this.activeExtractId) {
      const actExt = this.mapDef.extractions.find((ex) => ex.id === this.activeExtractId);
      if (actExt && (this.extractProgress > 0 || insideExtId === actExt.id)) {
        activeExtraction = {
          name: actExt.name,
          progress: this.extractProgress,
          holdDuration: actExt.holdDuration,
          remainingSec: Math.max(0, actExt.holdDuration - this.extractProgress),
          isInside: insideExtId === actExt.id,
        };
      }
    }

    const qGear = TACTICAL_GEAR[this.gearSlots.Q];
    const eGear = TACTICAL_GEAR[this.gearSlots.E];
    const xGear = TACTICAL_GEAR[this.gearSlots.X];
    const wMeta = WEATHER_META[this.weather];
    const todMeta = this.getTimeOfDayMeta(this.timeOfDayHours);
    this.onHudUpdate({
      mapId: this.mapDef.id,
      mapName: this.mapDef.name,
      bossDisplayName: this.mapDef.bossName,
      cameraMode: this.cameraMode,
      pointerLocked: this.pointerLocked,
      weather: this.weather,
      weatherLabel: wMeta.label,
      weatherEffectSummary: wMeta.effectSummary,
      timeOfDayHours: this.timeOfDayHours,
      timeOfDayPhase: todMeta.phase,
      timeOfDayLabel: todMeta.label,
      enemyVisionMult: this.currentEnemyVisionMult,
      playerNoiseMult: this.currentPlayerNoiseMult,
      flashlightOn: this.flashlightOn,
      damageFlash: this.playerHitFlash,
      hp: Math.ceil(this.hp),
      maxHp: this.maxHp,
      armor: Math.ceil(this.armor),
      maxArmor: this.maxArmor,
      stamina: Math.ceil(this.stamina),
      maxStamina: this.maxStamina,
      isSprinting: this.isCurrentlySprinting,
      isStaminaExhausted: this.isStaminaExhausted,
      staminaRegenRatePct: this.staminaRegenRatePct,
      ammoInMag: this.ammoInMag,
      magSize: this.weaponStats.magSize,
      reserveAmmo: this.reserveAmmo,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? 1 - this.reloadTimer / this.weaponStats.reloadTime : 1,
      weaponDurability: Number(this.weaponDurability.toFixed(1)),
      isJammed: this.isWeaponJammed,
      jamClearing: this.jamClearing,
      jamClearProgress: this.jamClearing
        ? 1 - this.jamClearTimer / (this.jamClearDuration * (this.loadout.operatorId === 'toxik' ? 0.82 : 1.0))
        : 1,
      medkits: this.medkits,
      armorPlates: this.armorPlates,
      qCooldown: this.qCooldown,
      qMaxCooldown: qGear.cooldown,
      eCooldown: this.eCooldown,
      eMaxCooldown: eGear.cooldown,
      xCooldown: this.xCooldown,
      xMaxCooldown: xGear.cooldown,
      qCharges: this.qCharges,
      eCharges: this.eCharges,
      xCharges: this.xCharges,
      laserActiveRemaining: this.laserActiveTimer,
      binocularsActiveRemaining: this.binocularsActiveTimer,
      irActiveRemaining: this.irActiveTimer,
      droneActiveRemaining: this.droneActiveTimer,
      radioReconActiveRemaining: this.radioReconActiveTimer,
      jammerActiveCount: this.signalJammers.length,
      raidTimeRemaining: this.raidTimeRemaining,
      raidElapsed: this.raidElapsed,
      kills: this.kills,
      bossAlive: Boolean(boss),
      bossHpRatio: boss ? boss.hp / boss.maxHp : null,
      bossEngaged: this.bossEngaged && Boolean(boss),
      introActive: this.introTimer > 0,
      isAds: this.rightMouseDown,
      leanState: this.controlSettings.leanEnabled ? this.leanTarget : 0,
      activeScopeTier: this.activeScopeTier,
      activeScopeLabel: this.activeScopeLabel,
      bleeding: this.getBleedingCount() > 0,
      bleedingCount: this.getBleedingCount(),
      bodyParts: {
        head: { ...this.bodyParts.head, hp: Math.ceil(this.bodyParts.head.hp) },
        chest: { ...this.bodyParts.chest, hp: Math.ceil(this.bodyParts.chest.hp) },
        arms: { ...this.bodyParts.arms, hp: Math.ceil(this.bodyParts.arms.hp) },
        legs: { ...this.bodyParts.legs, hp: Math.ceil(this.bodyParts.legs.hp) },
      },
      traumaEffects: {
        headConcussed: this.bodyParts.head.hp / this.bodyParts.head.maxHp < 0.5,
        armTremor: this.bodyParts.arms.hp / this.bodyParts.arms.maxHp < 0.55,
        legFractured: this.bodyParts.legs.hp / this.bodyParts.legs.maxHp < 0.55,
      },
      backpack: [...this.backpack],
      backpackCapacity: this.loadout.backpackCapacity,
      safeBox: [...this.safeBox],
      safeBoxCapacity: this.loadout.safeBoxCapacity,
      carriedWeightKg: this.getCarriedWeightKg(),
      encumbrancePenaltyPct: Math.round(computeEncumbrancePenalty(this.getCarriedWeightKg()) * 100),
      nearbyContainer: activeCont
        ? {
            id: activeCont.id,
            name: activeCont.name,
            kind: activeCont.kind,
            searching: activeCont.searching,
            searched: activeCont.searched,
            progress: activeCont.items.filter((i) => i.revealed).length / Math.max(1, activeCont.items.length),
            items: [...activeCont.items],
          }
        : null,
      extractionLever,
      nearbyExtract,
      activeExtraction,
      playerX: this.px,
      playerY: this.py,
      playerAngle: this.pAngle,
      minimapEnemies: this.enemies
        .filter((e) => e.markedTimer > 0 || Math.hypot(e.x - this.px, e.y - this.py) < 360)
        .map((e) => ({ x: e.x, y: e.y, kind: e.kind })),
      minimapExtracts: this.mapDef.extractions.map((ext) => ({
        x: ext.x,
        y: ext.y,
        name: ext.name,
        active: this.leverPulled,
      })),
      minimapContainers: this.containers.map((c) => ({
        x: c.x,
        y: c.y,
        searched: c.searched,
        kind: c.kind,
      })),
      statusBanner: this.statusBanner,
    });
  }
}
