import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { danceMusicEngine } from '../audio/danceMusicEngine';
import { DANCE_MAP, DanceId } from '../data/danceCatalog';
import { OPERATORS } from '../data/gameData';
import { animateHumanoid, buildOperatorModel, buildWeaponModel, HumanoidRig } from '../three/characterBuilder';
import { animateOperatorDance, resetOperatorRigPose } from '../three/danceChoreography';
import {
  createContactShadowTexture,
  createPedestalTexture,
  detectSoftwareWebGL,
  getSoftGlowSpriteTexture,
} from '../three/textures';
import { AttachmentSlot, OperatorId, WeaponId, WeaponSkinId } from '../types/game';

export type ShowcaseCameraPreset = 'fullbody' | 'upper' | 'weapon' | 'cinematic';

interface CharacterShowcase3DProps {
  operatorId: OperatorId;
  weaponId: WeaponId;
  attachments: Record<AttachmentSlot, string | null>;
  armorTier: number;
  mode: 'operator' | 'weapon_only';
  cameraPreset: ShowcaseCameraPreset;
  weaponSkin?: WeaponSkinId;
  activeDanceId?: DanceId | null;
  danceTriggerKey?: number;
}

const PRESET_TARGETS: Record<ShowcaseCameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  fullbody: { pos: [1.48, 1.38, 3.12], target: [0, 0.92, 0] },
  upper: { pos: [0.64, 1.54, 1.46], target: [0.01, 1.44, 0] },
  weapon: { pos: [0.58, 0.44, 1.88], target: [0, 0.24, 0] },
  cinematic: { pos: [1.95, 0.72, 2.35], target: [0, 1.08, 0] },
};

// --- Procedural Canvas Textures for Real Battlefield + Cyberpunk Lobby Stage ---

function createBattlefieldGroundTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#141922';
  ctx.fillRect(0, 0, 512, 512);

  // Asphalt grit & rubble micro-noise
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 16 + Math.floor(Math.random() * 26);
    const s = Math.random() < 0.85 ? 2 : 4;
    ctx.fillStyle = `rgb(${v},${v + 4},${v + 10})`;
    ctx.fillRect(x, y, s, s);
  }

  // Blast scorch patches & oil puddles
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 36 + Math.random() * 75;
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, 'rgba(5, 7, 11, 0.72)');
    g.addColorStop(0.55, 'rgba(11, 15, 22, 0.35)');
    g.addColorStop(1, 'rgba(15, 20, 30, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cracked concrete & shell impact fractures
  ctx.strokeStyle = 'rgba(4, 6, 10, 0.8)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    let px = Math.random() * 512;
    let py = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let seg = 0; seg < 6; seg++) {
      px += (Math.random() - 0.5) * 65;
      py += (Math.random() - 0.5) * 65;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Subtle faded tactical road grid / cyber trench lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 18, 476, 476);
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.14)';
  ctx.setLineDash([18, 14]);
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.stroke();
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.anisotropy = Math.min(8, maxAniso);
  return tex;
}

function createHazardConcreteTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#333b47';
  ctx.fillRect(0, 0, 256, 128);

  // Concrete grain & soot streaks
  for (let i = 0; i < 1200; i++) {
    const v = 40 + Math.floor(Math.random() * 34);
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 9},0.55)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 128, 3, 2);
  }

  // Weathered amber/black tactical hazard stripe band
  ctx.fillStyle = '#181e28';
  ctx.fillRect(0, 82, 256, 22);
  ctx.fillStyle = '#d97706';
  for (let x = -24; x < 280; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 82);
    ctx.lineTo(x + 14, 82);
    ctx.lineTo(x + 4, 104);
    ctx.lineTo(x - 10, 104);
    ctx.closePath();
    ctx.fill();
  }

  // Battle wear scratches over stripe
  ctx.fillStyle = 'rgba(24, 30, 40, 0.45)';
  for (let i = 0; i < 90; i++) {
    ctx.fillRect(Math.random() * 256, 80 + Math.random() * 26, 5 + Math.random() * 10, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAniso);
  return tex;
}

function createCyberBillboardTexture(
  title: string,
  subtitle: string,
  primaryHex: string,
  secondaryHex: string,
  maxAniso: number
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  // Translucent cyber dark backing
  const bg = ctx.createLinearGradient(0, 0, 512, 256);
  bg.addColorStop(0, '#071321');
  bg.addColorStop(1, '#0b192b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);

  // Fine horizontal scanlines
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 0; y < 256; y += 4) {
    ctx.fillRect(0, y, 512, 1);
  }

  // Neon frame & corner brackets
  ctx.strokeStyle = primaryHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 492, 236);
  ctx.fillStyle = secondaryHex;
  ctx.fillRect(10, 10, 110, 8);
  ctx.fillRect(392, 238, 110, 8);

  // Signal waveform bars
  for (let i = 0; i < 18; i++) {
    const h = 16 + ((i * 37) % 48);
    ctx.fillStyle = i % 3 === 0 ? secondaryHex : primaryHex;
    ctx.globalAlpha = 0.72;
    ctx.fillRect(28 + i * 11, 214 - h, 6, h);
  }
  ctx.globalAlpha = 1;

  // Bold cyber typography
  ctx.fillStyle = primaryHex;
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(title, 28, 96);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 22px monospace';
  ctx.fillText(subtitle, 30, 140);

  // Target reticle glyph on right
  ctx.strokeStyle = secondaryHex;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(418, 128, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(418, 128, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(360, 128);
  ctx.lineTo(476, 128);
  ctx.moveTo(418, 70);
  ctx.lineTo(418, 186);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAniso);
  return tex;
}

function createCyberHoloPanelTexture(accentHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 512);
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, 'rgba(0, 229, 155, 0.02)');
  grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.16)');
  grad.addColorStop(1, 'rgba(0, 229, 155, 0.04)');
  ctx.fillStyle = grad;
  ctx.fillRect(12, 12, 232, 488);

  // Horizontal scan lines
  ctx.fillStyle = 'rgba(125, 211, 252, 0.14)';
  for (let y = 16; y < 496; y += 8) {
    ctx.fillRect(16, y, 224, 1.5);
  }

  // Border frame
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, 228, 484);

  // Tactical telemetry bars & hex grid lines
  ctx.fillStyle = accentHex;
  ctx.font = 'bold 20px monospace';
  ctx.fillText('SECTOR // 09', 28, 56);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#bae6fd';
  ctx.fillText('NET-LINK: ACTIVE', 28, 84);
  ctx.fillText('SAT-ORBIT: LOCKED', 28, 108);

  for (let row = 0; row < 7; row++) {
    const w = 65 + ((row * 43) % 130);
    ctx.fillStyle = row % 2 === 0 ? 'rgba(0,229,155,0.68)' : 'rgba(56,189,248,0.62)';
    ctx.fillRect(28, 146 + row * 24, w, 10);
  }

  // Radar ring at bottom
  ctx.strokeStyle = 'rgba(0, 229, 155, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(128, 396, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 396, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(128, 396);
  ctx.lineTo(176, 362);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface BattlefieldAnimRefs {
  droneGroup: THREE.Group;
  droneRotors: THREE.Mesh[];
  holoRings: THREE.Mesh[];
  holoPanels: THREE.Mesh[];
  searchlights: THREE.Mesh[];
  wreckLight: THREE.PointLight;
  cyberGeo: THREE.BufferGeometry;
  cyberVel: Float32Array;
}

function buildCyberBattlefieldStage(
  scene: THREE.Scene,
  maxAniso: number,
  disposables: {
    geos: THREE.BufferGeometry[];
    mats: THREE.Material[];
    texs: THREE.Texture[];
  }
): { group: THREE.Group; anim: BattlefieldAnimRefs } {
  const group = new THREE.Group();

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.geos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.mats.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposables.texs.push(t);
    return t;
  };

  // 1. War-Torn Asphalt & Tactical Battlefield Ground
  const groundTex = trackTex(createBattlefieldGroundTexture(maxAniso));
  const groundMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.78,
      metalness: 0.22,
    })
  );
  const groundMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(64, 64)), groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.08;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // Armored cyber deck framing rings around the operator pedestal (flush with ground)
  const cyberRimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x111a27,
      roughness: 0.42,
      metalness: 0.78,
    })
  );
  const outerDeck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.72, 1.88, 0.05, 8)), cyberRimMat);
  outerDeck.position.y = -0.055;
  outerDeck.receiveShadow = true;
  group.add(outerDeck);

  const cyanNeonMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.85,
    })
  );
  const emeraldNeonMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x00e59b,
      transparent: true,
      opacity: 0.82,
    })
  );
  const amberNeonMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.86,
    })
  );
  const magentaNeonMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.78,
    })
  );

  // Rotating holographic deployment rings around the base
  const holoRings: THREE.Mesh[] = [];
  const holoRingA = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(1.48, 1.53, 48, 1, 0, Math.PI * 1.45)),
    trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x00e59b,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  holoRingA.rotation.x = -Math.PI / 2;
  holoRingA.position.y = 0.012;
  group.add(holoRingA);
  holoRings.push(holoRingA);

  const holoRingB = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(1.66, 1.7, 48, 1, Math.PI * 0.4, Math.PI * 1.15)),
    trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  holoRingB.rotation.x = -Math.PI / 2;
  holoRingB.position.y = 0.014;
  group.add(holoRingB);
  holoRings.push(holoRingB);

  // Shared Battlefield Materials
  const hazardTex = trackTex(createHazardConcreteTexture(maxAniso));
  const barrierMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.88,
      metalness: 0.12,
    })
  );
  const concreteMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x374151,
      roughness: 0.92,
      metalness: 0.08,
    })
  );
  const darkMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1b2330,
      roughness: 0.45,
      metalness: 0.72,
    })
  );
  const oliveArmorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2f3b36,
      roughness: 0.62,
      metalness: 0.48,
    })
  );
  const sandbagMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x5c5346,
      roughness: 0.95,
      metalness: 0.02,
    })
  );
  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x111318,
      roughness: 0.9,
      metalness: 0.08,
    })
  );

  // 2. Concrete Jersey Blast Barriers (grounded at y = -0.08)
  const addJerseyBarrier = (x: number, z: number, rotY: number) => {
    const bGroup = new THREE.Group();
    const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 0.3, 0.64)), barrierMat);
    base.position.y = 0.15;
    const mid = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.06, 0.62, 0.36)), barrierMat);
    mid.position.y = 0.56;
    const cap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.02, 0.1, 0.24)), concreteMat);
    cap.position.y = 0.9;
    // Cyber warning beacon strip on top edge
    const strip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.04, 0.05)), amberNeonMat);
    strip.position.set(0, 0.95, 0.12);
    bGroup.add(base, mid, cap, strip);
    bGroup.position.set(x, -0.08, z);
    bGroup.rotation.y = rotY;
    group.add(bGroup);
  };

  addJerseyBarrier(-2.5, -4.1, 0.34);
  addJerseyBarrier(-0.35, -5.0, -0.08);
  addJerseyBarrier(3.6, -5.2, -0.52);

  // 3. Sandbag Bunker Fortification & Tactical Supply Crates (back-right)
  const sandbagGeo = trackGeo(new THREE.BoxGeometry(0.56, 0.19, 0.3));
  const bunkerGroup = new THREE.Group();
  for (let row = 0; row < 3; row++) {
    const count = row === 2 ? 4 : 5;
    for (let i = 0; i < count; i++) {
      const bag = new THREE.Mesh(sandbagGeo, sandbagMat);
      bag.position.set(
        (i - (count - 1) * 0.5) * 0.52 + (row % 2) * 0.12,
        0.095 + row * 0.18,
        (Math.sin(i * 1.9 + row) * 0.04)
      );
      bag.rotation.y = (Math.sin(i * 3.1 + row) * 0.08);
      bunkerGroup.add(bag);
    }
  }
  bunkerGroup.position.set(2.85, -0.08, -3.75);
  bunkerGroup.rotation.y = -0.58;
  group.add(bunkerGroup);

  // Stacked military cyber-supply crates
  const addSupplyCrate = (x: number, y: number, z: number, rotY: number, scale = 1) => {
    const cg = new THREE.Group();
    const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.92, 0.52, 0.58)), oliveArmorMat);
    body.position.y = 0.26;
    const lid = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.96, 0.09, 0.62)), darkMetalMat);
    lid.position.y = 0.54;
    const latchL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.14, 0.04)), darkMetalMat);
    latchL.position.set(-0.28, 0.44, 0.3);
    const latchR = latchL.clone();
    latchR.position.x = 0.28;
    const led = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.03, 0.03)), emeraldNeonMat);
    led.position.set(0, 0.45, 0.3);
    cg.add(body, lid, latchL, latchR, led);
    cg.position.set(x, y, z);
    cg.rotation.y = rotY;
    cg.scale.setScalar(scale);
    group.add(cg);
  };
  addSupplyCrate(3.65, -0.08, -4.3, -0.35, 1.0);
  addSupplyCrate(3.72, 0.5, -4.35, -0.18, 0.84);
  addSupplyCrate(-3.65, -0.08, -3.5, 0.45, 0.92);

  // 4. Shattered War-Torn Concrete Pillars with Exposed Steel Rebar
  const addRuinedPillar = (x: number, z: number, height: number, rotY: number) => {
    const pg = new THREE.Group();
    const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.95, 0.4, 0.95)), concreteMat);
    plinth.position.y = 0.2;
    const shaft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, height, 0.68)), concreteMat);
    shaft.position.y = 0.4 + height * 0.5;
    pg.add(plinth, shaft);

    // Jagged broken top chunks & exposed rebar rods
    const rebarGeo = trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6));
    for (let i = 0; i < 4; i++) {
      const rod = new THREE.Mesh(rebarGeo, darkMetalMat);
      rod.position.set(
        (i % 2 === 0 ? -0.18 : 0.18),
        0.4 + height + 0.35,
        (i < 2 ? -0.18 : 0.18)
      );
      rod.rotation.z = (i % 2 === 0 ? 0.16 : -0.14);
      rod.rotation.x = (i < 2 ? -0.12 : 0.18);
      pg.add(rod);
    }
    pg.position.set(x, -0.08, z);
    pg.rotation.y = rotY;
    group.add(pg);
  };
  addRuinedPillar(-4.1, -4.9, 3.2, 0.22);
  addRuinedPillar(5.3, -6.5, 4.4, -0.31);

  // 5. Disabled Armored Recon Vehicle (6x6 Tactical IFV Wreck, back-left)
  const apc = new THREE.Group();
  const apcHull = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.15, 0.88, 4.4)), oliveArmorMat);
  apcHull.position.set(0, 0.96, 0);
  const apcGlacis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.05, 0.58, 1.35)), oliveArmorMat);
  apcGlacis.position.set(0, 1.05, 2.25);
  apcGlacis.rotation.x = 0.42;
  const apcRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.78, 0.32, 3.1)), darkMetalMat);
  apcRoof.position.set(0, 1.54, -0.2);
  const apcTurret = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.56, 0.72, 0.46, 8)), oliveArmorMat);
  apcTurret.position.set(0, 1.88, 0.15);
  const apcBarrel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.075, 2.15, 8)), darkMetalMat);
  apcBarrel.rotation.x = Math.PI / 2 - 0.16;
  apcBarrel.position.set(0, 2.02, 1.45);
  // Subtle damaged cyan optical sensor on turret + amber distress strobe bar
  const apcOptic = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.1, 0.16)), cyanNeonMat);
  apcOptic.position.set(0.32, 1.96, 0.56);
  const apcGrillGlow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 0.14, 0.08)), amberNeonMat);
  apcGrillGlow.position.set(0, 0.92, 2.75);
  apc.add(apcHull, apcGlacis, apcRoof, apcTurret, apcBarrel, apcOptic, apcGrillGlow);

  const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.46, 0.46, 0.34, 14));
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.37, 8));
  hubGeo.rotateZ(Math.PI / 2);
  for (const side of [-1.05, 1.05]) {
    for (const wz of [-1.45, 0, 1.45]) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(side, 0.46, wz);
      const hub = new THREE.Mesh(hubGeo, darkMetalMat);
      hub.position.set(side, 0.46, wz);
      apc.add(wheel, hub);
    }
  }
  apc.position.set(-4.8, -0.08, -7.2);
  apc.rotation.y = 0.62;
  group.add(apc);

  // Localized warm smoldering glow strictly on the APC wreck (short distance so it never affects the operator at origin)
  const wreckLight = new THREE.PointLight(0xff6b2b, 3.2, 5.2, 2.0);
  wreckLight.position.set(-3.8, 1.15, -5.8);
  group.add(wreckLight);

  // 6. High-Tech Cyberpunk Tactical Relay Pylons & Holo-Screens flanking behind the operator
  const holoPanels: THREE.Mesh[] = [];
  const holoTexA = trackTex(createCyberHoloPanelTexture('#00E59B'));
  const holoTexB = trackTex(createCyberHoloPanelTexture('#38BDF8'));

  const addCyberPylon = (x: number, z: number, rotY: number, tex: THREE.CanvasTexture, neonMat: THREE.Material) => {
    const pylon = new THREE.Group();
    const foot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.42, 0.22, 6)), darkMetalMat);
    foot.position.y = 0.11;
    const mast = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 2.65, 0.22)), darkMetalMat);
    mast.position.y = 1.42;
    const strip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 2.35, 0.04)), neonMat);
    strip.position.set(0, 1.42, 0.12);
    const arm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.08, 0.14)), darkMetalMat);
    arm.position.set(x < 0 ? 0.28 : -0.28, 2.52, 0);
    const projectorHead = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.14, 0.22)), neonMat);
    projectorHead.position.set(x < 0 ? 0.52 : -0.52, 2.52, 0.02);

    // Translucent holographic tactical readout sheet
    const holoMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const panel = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.95, 1.85)), holoMat);
    panel.position.set(x < 0 ? 0.58 : -0.58, 1.48, 0.04);
    holoPanels.push(panel);

    pylon.add(foot, mast, strip, arm, projectorHead, panel);
    pylon.position.set(x, -0.08, z);
    pylon.rotation.y = rotY;
    group.add(pylon);
  };

  addCyberPylon(-2.55, -2.55, 0.42, holoTexA, emeraldNeonMat);
  addCyberPylon(2.55, -2.55, -0.42, holoTexB, cyanNeonMat);

  // 7. Ruined Cyber-Megacity Skyline Towers & Neon Holographic Billboards (far backdrop)
  const towerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0d1422,
      roughness: 0.72,
      metalness: 0.35,
    })
  );
  const towers: Array<{ x: number; z: number; w: number; h: number; d: number; neon: THREE.Material }> = [
    { x: -16.5, z: -18.5, w: 3.6, h: 14.5, d: 3.4, neon: cyanNeonMat },
    { x: -11.4, z: -16.5, w: 3.2, h: 19.2, d: 3.2, neon: magentaNeonMat },
    { x: -6.4, z: -19.5, w: 4.1, h: 16.0, d: 3.6, neon: emeraldNeonMat },
    { x: -1.6, z: -22.0, w: 4.4, h: 22.5, d: 4.0, neon: cyanNeonMat },
    { x: 3.8, z: -20.5, w: 3.8, h: 17.8, d: 3.6, neon: amberNeonMat },
    { x: 8.8, z: -17.5, w: 3.4, h: 20.4, d: 3.2, neon: cyanNeonMat },
    { x: 14.2, z: -19.0, w: 4.2, h: 15.2, d: 3.8, neon: emeraldNeonMat },
    { x: -13.8, z: -11.8, w: 2.6, h: 8.6, d: 2.6, neon: amberNeonMat },
    { x: 12.2, z: -12.2, w: 2.8, h: 9.8, d: 2.8, neon: magentaNeonMat },
  ];

  towers.forEach((t, idx) => {
    const tg = new THREE.Group();
    const main = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(t.w, t.h, t.d)), towerMat);
    main.position.y = t.h * 0.5;
    tg.add(main);

    // Architectural vertical neon edge strip
    const vStrip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, t.h * 0.82, 0.12)), t.neon);
    vStrip.position.set((idx % 2 === 0 ? -1 : 1) * (t.w * 0.48), t.h * 0.52, t.d * 0.5 + 0.04);
    tg.add(vStrip);

    // Rooftop antenna spire & beacon
    const spire = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.07, 3.2, 6)), darkMetalMat);
    spire.position.set(0, t.h + 1.6, 0);
    const beacon = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.1, 8, 8)), magentaNeonMat);
    beacon.position.set(0, t.h + 3.25, 0);
    tg.add(spire, beacon);

    // Horizontal cyber cornice accent
    const cornice = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(t.w + 0.18, 0.12, 0.14)), t.neon);
    cornice.position.set(0, t.h * 0.88, t.d * 0.5 + 0.05);
    tg.add(cornice);

    tg.position.set(t.x, -0.08, t.z);
    group.add(tg);
  });

  // Two large cyber-holographic skyscraper billboards in the deep background
  const bbTexLeft = trackTex(
    createCyberBillboardTexture('烽火禁区', 'WARZONE // CYBER-OPS 09', '#22d3ee', '#00e59b', maxAniso)
  );
  const bbLeft = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(5.6, 2.8)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: bbTexLeft,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  bbLeft.position.set(-7.6, 8.2, -14.2);
  bbLeft.rotation.y = 0.24;
  group.add(bbLeft);

  const bbTexRight = trackTex(
    createCyberBillboardTexture('战术防线', 'DEFENSE GRID // LIVE', '#f59e0b', '#f43f5e', maxAniso)
  );
  const bbRight = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(5.2, 2.6)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: bbTexRight,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  bbRight.position.set(7.4, 7.6, -14.8);
  bbRight.rotation.y = -0.26;
  group.add(bbRight);

  // 8. Distant Sweeping Battlefield Searchlight Beams (high sky backdrop)
  const searchlights: THREE.Mesh[] = [];
  const beamGeo = trackGeo(new THREE.ConeGeometry(2.4, 24, 16, 1, true));
  beamGeo.translate(0, 12, 0);
  const beamMatA = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  const beamMatB = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x00e59b,
      transparent: true,
      opacity: 0.045,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  const beamL = new THREE.Mesh(beamGeo, beamMatA);
  beamL.position.set(-9.5, -0.1, -15.5);
  beamL.rotation.z = -0.26;
  const beamR = new THREE.Mesh(beamGeo, beamMatB);
  beamR.position.set(9.8, -0.1, -16.2);
  beamR.rotation.z = 0.3;
  group.add(beamL, beamR);
  searchlights.push(beamL, beamR);

  // 9. Hovering Cyber Tactical Recon Drone (patrolling in midground sky)
  const droneGroup = new THREE.Group();
  const droneBody = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.24, 1)), darkMetalMat);
  droneBody.scale.set(1.4, 0.55, 1.15);
  const droneEye = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.08, 10, 10)), cyanNeonMat);
  droneEye.position.set(0, -0.04, 0.25);
  const droneWingL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.46, 0.05, 0.14)), darkMetalMat);
  droneWingL.position.set(-0.34, 0.04, 0);
  const droneWingR = droneWingL.clone();
  droneWingR.position.x = 0.34;
  const rotorShroudGeo = trackGeo(new THREE.TorusGeometry(0.15, 0.025, 8, 18));
  rotorShroudGeo.rotateX(Math.PI / 2);
  const shroudL = new THREE.Mesh(rotorShroudGeo, darkMetalMat);
  shroudL.position.set(-0.52, 0.06, 0);
  const shroudR = new THREE.Mesh(rotorShroudGeo, darkMetalMat);
  shroudR.position.set(0.52, 0.06, 0);
  const rotorBladeGeo = trackGeo(new THREE.BoxGeometry(0.26, 0.012, 0.035));
  const rotorL = new THREE.Mesh(rotorBladeGeo, cyanNeonMat);
  rotorL.position.set(-0.52, 0.06, 0);
  const rotorR = new THREE.Mesh(rotorBladeGeo, cyanNeonMat);
  rotorR.position.set(0.52, 0.06, 0);
  const scanCone = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.55, 1.85, 14, 1, true)),
    trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.09,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    )
  );
  scanCone.position.set(0, -1.02, 0.18);
  scanCone.rotation.x = 0.22;
  droneGroup.add(droneBody, droneEye, droneWingL, droneWingR, shroudL, shroudR, rotorL, rotorR, scanCone);
  droneGroup.position.set(0.8, 2.75, -6.2);
  group.add(droneGroup);

  // 10. Cool Cyan Cyber Data Motes floating in the battlefield air
  const cyberCount = 64;
  const cyberPos = new Float32Array(cyberCount * 3);
  const cyberVel = new Float32Array(cyberCount * 3);
  for (let i = 0; i < cyberCount; i++) {
    cyberPos[i * 3] = (Math.random() - 0.5) * 12;
    cyberPos[i * 3 + 1] = 0.2 + Math.random() * 4.5;
    cyberPos[i * 3 + 2] = -1.5 - Math.random() * 11;
    cyberVel[i * 3] = (Math.random() - 0.5) * 0.24;
    cyberVel[i * 3 + 1] = 0.08 + Math.random() * 0.16;
    cyberVel[i * 3 + 2] = (Math.random() - 0.5) * 0.18;
  }
  const cyberGeo = trackGeo(new THREE.BufferGeometry());
  cyberGeo.setAttribute('position', new THREE.BufferAttribute(cyberPos, 3));
  const cyberPoints = new THREE.Points(
    cyberGeo,
    trackMat(
      new THREE.PointsMaterial({
        color: 0x38bdf8,
        size: 0.055,
        map: getSoftGlowSpriteTexture(),
        transparent: true,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  group.add(cyberPoints);

  scene.add(group);
  return {
    group,
    anim: {
      droneGroup,
      droneRotors: [rotorL, rotorR],
      holoRings,
      holoPanels,
      searchlights,
      wreckLight,
      cyberGeo,
      cyberVel,
    },
  };
}

export function CharacterShowcase3D({
  operatorId,
  weaponId,
  attachments,
  armorTier,
  mode,
  cameraPreset,
  weaponSkin = 'factory_standard',
  activeDanceId = null,
  danceTriggerKey = 0,
}: CharacterShowcase3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const presetRef = useRef<ShowcaseCameraPreset>(cameraPreset);
  const isTransitioningRef = useRef(false);
  const isDraggingRef = useRef(false);
  const activeDanceRef = useRef<DanceId | null>(activeDanceId);
  const danceStartPerfRef = useRef<number>(0);
  const sceneObjectsRef = useRef<{
    scene: THREE.Scene;
    subjectGroup: THREE.Group;
    rig: HumanoidRig | null;
    pedestalRing: THREE.Mesh;
    maxAniso: number;
    armoryFloor: THREE.Mesh;
    battlefieldGroup: THREE.Group;
  } | null>(null);

  useEffect(() => {
    activeDanceRef.current = mode === 'operator' ? activeDanceId : null;
    if (activeDanceId && mode === 'operator') {
      danceStartPerfRef.current = performance.now();
    }
  }, [activeDanceId, danceTriggerKey, mode]);

  useEffect(() => {
    presetRef.current = mode === 'weapon_only' ? 'weapon' : cameraPreset;
    isTransitioningRef.current = true;
  }, [cameraPreset, mode]);

  // Mount Three.js Stage once (Real Battlefield + Cyberpunk for Operator Lobby; clean dark armory for Weapon Workbench)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const disposables: {
      geos: THREE.BufferGeometry[];
      mats: THREE.Material[];
      texs: THREE.Texture[];
    } = { geos: [], mats: [], texs: [] };

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const isOperatorLobby = mode === 'operator';
    scene.background = new THREE.Color(isOperatorLobby ? 0x070d18 : 0x05070b);
    scene.fog = new THREE.FogExp2(isOperatorLobby ? 0x070d18 : 0x05070b, isOperatorLobby ? 0.036 : 0.085);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      85
    );
    camera.position.set(1.48, 1.38, 3.12);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 0.7;
    controls.maxDistance = 5.5;
    controls.maxPolarAngle = Math.PI * 0.55;
    controls.minPolarAngle = Math.PI * 0.1;
    controls.target.set(0, 0.92, 0);

    controls.addEventListener('start', () => {
      isTransitioningRef.current = false;
      isDraggingRef.current = true;
    });
    controls.addEventListener('end', () => {
      isDraggingRef.current = false;
    });

    // Dedicated Character Chiaroscuro Studio Lighting (kept crisp & unaffected by background environment)
    const hemi = new THREE.HemisphereLight(0x6482ab, 0x090e16, 0.58);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffdfba, 2.25);
    keyLight.position.set(3.4, 5.0, 3.6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -2.5;
    keyLight.shadow.camera.right = 2.5;
    keyLight.shadow.camera.top = 2.5;
    keyLight.shadow.camera.bottom = -2.5;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.85);
    rimLight.position.set(-3.4, 3.2, -3.4);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.44);
    fillLight.position.set(-2.5, 1.6, 3.0);
    scene.add(fillLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const areaKey = new THREE.RectAreaLight(0xffdfb8, 3.0, 2.2, 3.2);
      areaKey.position.set(2.5, 2.1, 2.2);
      areaKey.lookAt(0, 1.0, 0);
      scene.add(areaKey);

      const areaRim = new THREE.RectAreaLight(0x38bdf8, 2.7, 1.8, 2.8);
      areaRim.position.set(-2.4, 1.8, -2.1);
      areaRim.lookAt(0, 1.0, 0);
      scene.add(areaRim);
    }

    // Armory Concrete Floor (used when mode === 'weapon_only')
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const armoryFloorGeo = new THREE.CircleGeometry(14, 48);
    const armoryFloorMat = new THREE.MeshStandardMaterial({ color: 0x080c12, roughness: 0.9, metalness: 0.14 });
    disposables.geos.push(armoryFloorGeo);
    disposables.mats.push(armoryFloorMat);
    const armoryFloor = new THREE.Mesh(armoryFloorGeo, armoryFloorMat);
    armoryFloor.rotation.x = -Math.PI / 2;
    armoryFloor.position.y = -0.08;
    armoryFloor.receiveShadow = true;
    armoryFloor.visible = !isOperatorLobby;
    scene.add(armoryFloor);

    // Real Battlefield + High-Tech Cyberpunk Stage (active when mode === 'operator')
    const { group: battlefieldGroup, anim: bfAnim } = buildCyberBattlefieldStage(scene, maxAniso, disposables);
    battlefieldGroup.visible = isOperatorLobby;

    // Central Operator Tactical Deployment Pedestal
    const pedBaseGeo = new THREE.CylinderGeometry(1.15, 1.28, 0.08, 40);
    const pedBaseMat = new THREE.MeshStandardMaterial({ color: 0x161d28, roughness: 0.46, metalness: 0.68 });
    disposables.geos.push(pedBaseGeo);
    disposables.mats.push(pedBaseMat);
    const pedestalBase = new THREE.Mesh(pedBaseGeo, pedBaseMat);
    pedestalBase.position.y = -0.04;
    pedestalBase.receiveShadow = true;
    scene.add(pedestalBase);

    const pedTex = createPedestalTexture('#10B981', maxAniso);
    const pedRingGeo = new THREE.CircleGeometry(1.12, 40);
    const pedRingMat = new THREE.MeshStandardMaterial({
      map: pedTex,
      roughness: 0.52,
      metalness: 0.36,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    disposables.geos.push(pedRingGeo);
    disposables.mats.push(pedRingMat);
    const pedestalRing = new THREE.Mesh(pedRingGeo, pedRingMat);
    pedestalRing.rotation.x = -Math.PI / 2;
    pedestalRing.position.y = 0.002;
    pedestalRing.receiveShadow = true;
    scene.add(pedestalRing);

    const contactTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    });
    disposables.geos.push(shadowGeo);
    disposables.mats.push(shadowMat);
    disposables.texs.push(contactTex);
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.004;
    scene.add(shadowPlane);

    // Floating Atmospheric Battlefield Embers & Dust Motes
    const dustCount = 80;
    const dustPos = new Float32Array(dustCount * 3);
    const dustVel = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 6.5;
      dustPos[i * 3 + 1] = 0.15 + Math.random() * 2.9;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 6.5 - 1.2;
      dustVel[i * 3] = (Math.random() - 0.5) * 0.2;
      dustVel[i * 3 + 1] = 0.08 + Math.random() * 0.16;
      dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.18;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xfdba74,
      size: 0.044,
      map: getSoftGlowSpriteTexture(),
      transparent: true,
      opacity: 0.46,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    disposables.geos.push(dustGeo);
    disposables.mats.push(dustMat);
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    // --- 3D Dance Stage Lighting, Beat-Synced Laser Cones, Floor Shockwave Rings & Vortex Particles ---
    const danceFxGroup = new THREE.Group();
    danceFxGroup.visible = false;
    scene.add(danceFxGroup);

    const danceLightA = new THREE.PointLight(0x00e59b, 0, 7.5, 1.8);
    danceLightA.position.set(-2.1, 2.35, -1.25);
    const danceLightB = new THREE.PointLight(0x22d3ee, 0, 7.5, 1.8);
    danceLightB.position.set(2.1, 2.35, -1.25);
    danceFxGroup.add(danceLightA, danceLightB);

    const danceLaserGeo = new THREE.ConeGeometry(0.95, 7.5, 16, 1, true);
    danceLaserGeo.translate(0, 3.75, 0);
    const danceLaserMatL = new THREE.MeshBasicMaterial({
      color: 0x00e59b,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const danceLaserMatR = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    disposables.geos.push(danceLaserGeo);
    disposables.mats.push(danceLaserMatL, danceLaserMatR);

    const danceLaserL = new THREE.Mesh(danceLaserGeo, danceLaserMatL);
    danceLaserL.position.set(-1.95, 0.02, -1.75);
    const danceLaserR = new THREE.Mesh(danceLaserGeo, danceLaserMatR);
    danceLaserR.position.set(1.95, 0.02, -1.75);
    danceFxGroup.add(danceLaserL, danceLaserR);

    // Expanding beat-synced holo floor shockwave rings
    const pulseRingGeo = new THREE.RingGeometry(0.96, 1.04, 48);
    const pulseRingMatA = new THREE.MeshBasicMaterial({
      color: 0x00e59b,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pulseRingMatB = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    disposables.geos.push(pulseRingGeo);
    disposables.mats.push(pulseRingMatA, pulseRingMatB);

    const pulseRingA = new THREE.Mesh(pulseRingGeo, pulseRingMatA);
    pulseRingA.rotation.x = -Math.PI / 2;
    pulseRingA.position.y = 0.018;
    const pulseRingB = new THREE.Mesh(pulseRingGeo, pulseRingMatB);
    pulseRingB.rotation.x = -Math.PI / 2;
    pulseRingB.position.y = 0.02;
    danceFxGroup.add(pulseRingA, pulseRingB);

    // Swirling / bursting neon dance particles around pedestal
    const danceSparkCount = 64;
    const danceSparkPos = new Float32Array(danceSparkCount * 3);
    const danceSparkSeeds = new Float32Array(danceSparkCount * 3);
    for (let i = 0; i < danceSparkCount; i++) {
      const ang = (i / danceSparkCount) * Math.PI * 2;
      const rad = 0.75 + Math.random() * 1.15;
      danceSparkSeeds[i * 3] = ang;
      danceSparkSeeds[i * 3 + 1] = rad;
      danceSparkSeeds[i * 3 + 2] = Math.random();
      danceSparkPos[i * 3] = Math.cos(ang) * rad;
      danceSparkPos[i * 3 + 1] = 0.2 + Math.random() * 2.2;
      danceSparkPos[i * 3 + 2] = Math.sin(ang) * rad;
    }
    const danceSparkGeo = new THREE.BufferGeometry();
    danceSparkGeo.setAttribute('position', new THREE.BufferAttribute(danceSparkPos, 3));
    const danceSparkMat = new THREE.PointsMaterial({
      color: 0x00e59b,
      size: 0.075,
      map: getSoftGlowSpriteTexture(),
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    disposables.geos.push(danceSparkGeo);
    disposables.mats.push(danceSparkMat);
    const danceSparks = new THREE.Points(danceSparkGeo, danceSparkMat);
    danceFxGroup.add(danceSparks);

    const subjectGroup = new THREE.Group();
    scene.add(subjectGroup);

    sceneObjectsRef.current = {
      scene,
      subjectGroup,
      rig: null,
      pedestalRing,
      maxAniso,
      armoryFloor,
      battlefieldGroup,
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let disposed = false;
    let frameId = 0;
    const clock = new THREE.Clock();
    const targetPos = new THREE.Vector3();
    const targetLook = new THREE.Vector3();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      // Update warm battlefield embers
      const posAttr = dustGeo.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += dustVel[i] * dt;
        arr[i + 1] += dustVel[i + 1] * dt;
        arr[i + 2] += dustVel[i + 2] * dt;
        if (arr[i + 1] > 3.2) {
          arr[i] = (Math.random() - 0.5) * 6.5;
          arr[i + 1] = 0.08;
          arr[i + 2] = (Math.random() - 0.5) * 6.5 - 1.2;
        }
      }
      posAttr.needsUpdate = true;

      // Animate Real Battlefield + Cyberpunk Background Elements when in Operator Lobby
      if (battlefieldGroup.visible) {
        // Hovering cyber recon drone figure-8 patrol in rear airspace
        const droneX = Math.sin(elapsed * 0.42) * 3.4;
        const droneY = 2.85 + Math.sin(elapsed * 1.15) * 0.24;
        const droneZ = -6.6 + Math.sin(elapsed * 0.84) * 1.1;
        bfAnim.droneGroup.position.set(droneX, droneY, droneZ);
        bfAnim.droneGroup.rotation.y = Math.cos(elapsed * 0.42) * 0.45;
        bfAnim.droneGroup.rotation.z = -Math.cos(elapsed * 0.42) * 0.12;
        bfAnim.droneRotors[0].rotation.y = elapsed * 24;
        bfAnim.droneRotors[1].rotation.y = -elapsed * 24;

        // Subtle holographic deck rings & pylon panel pulse
        bfAnim.holoRings[0].rotation.z = elapsed * 0.22;
        bfAnim.holoRings[1].rotation.z = -elapsed * 0.16;
        for (let i = 0; i < bfAnim.holoPanels.length; i++) {
          const mat = bfAnim.holoPanels[i].material as THREE.MeshBasicMaterial;
          mat.opacity = 0.42 + Math.sin(elapsed * 2.2 + i * 1.7) * 0.07;
        }

        // Distant sweeping battlefield searchlights
        bfAnim.searchlights[0].rotation.z = -0.24 + Math.sin(elapsed * 0.26) * 0.22;
        bfAnim.searchlights[1].rotation.z = 0.28 + Math.cos(elapsed * 0.21) * 0.2;

        // Smoldering APC wreck fire flicker (localized away from operator)
        bfAnim.wreckLight.intensity = 2.8 + Math.sin(elapsed * 7.3) * 0.45 + Math.cos(elapsed * 13.1) * 0.25;

        // Cool cyan cyber data motes drift
        const cyberAttr = bfAnim.cyberGeo.getAttribute('position') as THREE.BufferAttribute;
        const cArr = cyberAttr.array as Float32Array;
        for (let i = 0; i < cArr.length; i += 3) {
          cArr[i] += bfAnim.cyberVel[i] * dt;
          cArr[i + 1] += bfAnim.cyberVel[i + 1] * dt;
          cArr[i + 2] += bfAnim.cyberVel[i + 2] * dt;
          if (cArr[i + 1] > 4.8) {
            cArr[i] = (Math.random() - 0.5) * 12;
            cArr[i + 1] = 0.15;
            cArr[i + 2] = -1.5 - Math.random() * 11;
          }
        }
        cyberAttr.needsUpdate = true;
      }

      if (presetRef.current === 'cinematic' && !isDraggingRef.current) {
        // Dramatic low-angle game cutscene dolly & crane orbit + subtle 35mm handheld breath
        const orbitAngle = elapsed * 0.24 + 0.65;
        const radius = 2.45 + Math.sin(elapsed * 0.35) * 0.32;
        const camY = 0.72 + Math.sin(elapsed * 0.42) * 0.28 + Math.cos(elapsed * 1.35) * 0.014;
        targetPos.set(Math.cos(orbitAngle) * radius, camY, Math.sin(orbitAngle) * radius);
        targetLook.set(Math.sin(elapsed * 0.9) * 0.02, 1.08 + Math.sin(elapsed * 0.45) * 0.12, 0);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, targetPos.x, 3.2, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, targetPos.y, 3.2, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetPos.z, 3.2, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, targetLook.x, 4.0, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, targetLook.y, 4.0, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, targetLook.z, 4.0, dt);
      } else if (isTransitioningRef.current) {
        const preset = PRESET_TARGETS[presetRef.current];
        targetPos.set(...preset.pos);
        targetLook.set(...preset.target);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, targetPos.x, 5.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, targetPos.y, 5.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetPos.z, 5.5, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, targetLook.x, 5.5, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, targetLook.y, 5.5, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, targetLook.z, 5.5, dt);
        if (camera.position.distanceTo(targetPos) < 0.02) {
          isTransitioningRef.current = false;
        }
      } else if (!isDraggingRef.current && (presetRef.current === 'fullbody' || presetRef.current === 'upper')) {
        // Subtle 35mm cinematic camera breathing
        const preset = PRESET_TARGETS[presetRef.current];
        const breathY = Math.sin(elapsed * 1.15) * 0.012;
        const breathX = Math.cos(elapsed * 0.72) * 0.014;
        camera.position.y = THREE.MathUtils.damp(camera.position.y, preset.pos[1] + breathY, 2.2, dt);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, preset.pos[0] + breathX, 2.2, dt);
      }

      const activeDanceIdNow = activeDanceRef.current;
      const activeDanceDef = activeDanceIdNow ? DANCE_MAP[activeDanceIdNow] : null;

      if (sceneObjectsRef.current?.rig) {
        if (activeDanceDef) {
          const danceElapsed = Math.max(0, (performance.now() - danceStartPerfRef.current) / 1000);
          const beatEnergy = danceMusicEngine.getBeatEnergy(activeDanceDef.id, danceElapsed);
          animateOperatorDance(sceneObjectsRef.current.rig, activeDanceDef, danceElapsed, beatEnergy, dt);

          // Activate & drive dance-specific 3D stage lighting, laser sweeps, pulse rings & sparks
          danceFxGroup.visible = true;
          danceLightA.color.set(activeDanceDef.accentHex);
          danceLightB.color.set(activeDanceDef.secondaryHex);
          danceLaserMatL.color.set(activeDanceDef.accentHex);
          danceLaserMatR.color.set(activeDanceDef.secondaryHex);
          pulseRingMatA.color.set(activeDanceDef.accentHex);
          pulseRingMatB.color.set(activeDanceDef.secondaryHex);
          danceSparkMat.color.set(activeDanceDef.accentHex);

          const bps = activeDanceDef.bpm / 60;
          const beatCycle = (danceElapsed * bps) % 1;
          const halfBeatCycle = (danceElapsed * bps * 0.5) % 1;

          // Distinct visual staging behavior per vfxMode
          if (activeDanceDef.vfxMode === 'strobe_spot') {
            const alt = Math.floor(danceElapsed * bps * 2) % 2 === 0;
            danceLightA.intensity = alt ? 4.4 + beatEnergy * 3.2 : 0.7;
            danceLightB.intensity = !alt ? 4.4 + beatEnergy * 3.2 : 0.7;
            danceLaserMatL.opacity = alt ? 0.2 : 0.04;
            danceLaserMatR.opacity = !alt ? 0.2 : 0.04;
            danceLaserL.rotation.z = -0.35 + Math.sin(danceElapsed * 3.8) * 0.35;
            danceLaserR.rotation.z = 0.35 - Math.sin(danceElapsed * 3.8) * 0.35;
          } else if (activeDanceDef.vfxMode === 'laser_sweep') {
            danceLightA.intensity = 2.6 + beatEnergy * 2.8;
            danceLightB.intensity = 2.6 + beatEnergy * 2.8;
            danceLaserMatL.opacity = 0.16 + beatEnergy * 0.12;
            danceLaserMatR.opacity = 0.16 + beatEnergy * 0.12;
            danceLaserL.rotation.z = -0.5 + Math.sin(danceElapsed * 2.9) * 0.62;
            danceLaserL.rotation.x = Math.cos(danceElapsed * 2.1) * 0.22;
            danceLaserR.rotation.z = 0.5 - Math.sin(danceElapsed * 2.9) * 0.62;
            danceLaserR.rotation.x = -Math.cos(danceElapsed * 2.1) * 0.22;
          } else if (activeDanceDef.vfxMode === 'cyber_vortex') {
            danceLightA.intensity = 3.1 + beatEnergy * 2.4;
            danceLightB.intensity = 3.1 + beatEnergy * 2.4;
            danceLaserMatL.opacity = 0.15 + beatEnergy * 0.09;
            danceLaserMatR.opacity = 0.15 + beatEnergy * 0.09;
            danceLaserL.rotation.z = -0.28 + Math.sin(danceElapsed * 2.2) * 0.32;
            danceLaserR.rotation.z = 0.28 + Math.cos(danceElapsed * 2.2) * 0.32;
          } else if (activeDanceDef.vfxMode === 'ember_burst') {
            danceLightA.intensity = 3.5 + beatEnergy * 3.4;
            danceLightB.intensity = 3.0 + beatEnergy * 2.6;
            danceLaserMatL.opacity = 0.08 + beatEnergy * 0.1;
            danceLaserMatR.opacity = 0.08 + beatEnergy * 0.1;
            danceLaserL.rotation.z = -0.42;
            danceLaserR.rotation.z = 0.42;
          } else {
            // pulse_rings / holo_wave
            danceLightA.intensity = 2.4 + beatEnergy * 2.6;
            danceLightB.intensity = 2.4 + beatEnergy * 2.6;
            danceLaserMatL.opacity = 0.11 + beatEnergy * 0.08;
            danceLaserMatR.opacity = 0.11 + beatEnergy * 0.08;
            danceLaserL.rotation.z = -0.3 + Math.sin(danceElapsed * 1.7) * 0.28;
            danceLaserR.rotation.z = 0.3 + Math.sin(danceElapsed * 1.7) * 0.28;
          }

          // Expanding floor pulse shockwaves synchronized to every beat
          const scaleA = 0.95 + beatCycle * 1.45;
          pulseRingA.scale.set(scaleA, scaleA, 1);
          pulseRingMatA.opacity = (1 - beatCycle) * 0.62;

          const scaleB = 0.95 + halfBeatCycle * 1.85;
          pulseRingB.scale.set(scaleB, scaleB, 1);
          pulseRingMatB.opacity = (1 - halfBeatCycle) * 0.45;

          // Update swirling / bursting dance spark particles
          const spAttr = danceSparkGeo.getAttribute('position') as THREE.BufferAttribute;
          const spArr = spAttr.array as Float32Array;
          const isVortex = activeDanceDef.vfxMode === 'cyber_vortex';
          const isBurst = activeDanceDef.vfxMode === 'ember_burst';
          for (let i = 0; i < danceSparkCount; i++) {
            const baseAng = danceSparkSeeds[i * 3];
            const baseRad = danceSparkSeeds[i * 3 + 1];
            const phaseSeed = danceSparkSeeds[i * 3 + 2];
            const life = (danceElapsed * (isBurst ? 1.1 : 0.58) + phaseSeed) % 1;
            const ang = baseAng + danceElapsed * (isVortex ? 2.8 : 1.15);
            const rad = isBurst ? 0.55 + life * 1.65 : isVortex ? baseRad * (1.15 - life * 0.45) : baseRad + beatEnergy * 0.18;
            spArr[i * 3] = Math.cos(ang) * rad;
            spArr[i * 3 + 1] = 0.08 + life * (isVortex ? 2.75 : 2.3);
            spArr[i * 3 + 2] = Math.sin(ang) * rad;
          }
          spAttr.needsUpdate = true;
          pedestalRing.rotation.z = elapsed * 0.42;
        } else {
          danceFxGroup.visible = false;
          resetOperatorRigPose(sceneObjectsRef.current.rig, dt);
          animateHumanoid(sceneObjectsRef.current.rig, elapsed, 0, 0, false);
          sceneObjectsRef.current.rig.root.rotation.y = THREE.MathUtils.lerp(
            sceneObjectsRef.current.rig.root.rotation.y,
            presetRef.current === 'cinematic'
              ? Math.sin(elapsed * 0.3) * 0.08
              : Math.sin(elapsed * 0.45) * 0.16,
            Math.min(1, dt * 6)
          );
          pedestalRing.rotation.z = elapsed * 0.06;
        }
      } else {
        danceFxGroup.visible = false;
        subjectGroup.rotation.y = elapsed * 0.45;
        pedestalRing.rotation.z = elapsed * 0.06;
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
    };
    const handleContextRestored = () => {
      if (!disposed) tick();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      (pedestalRing.material as THREE.MeshStandardMaterial).map?.dispose();
      disposables.geos.forEach((g) => g.dispose());
      disposables.mats.forEach((m) => m.dispose());
      disposables.texs.forEach((t) => t.dispose());
      envTarget.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneObjectsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild 3D Operator or Weapon Model & sync Stage Mode when selection/attachments/mode change
  useEffect(() => {
    const objs = sceneObjectsRef.current;
    if (!objs) return;

    const isOpMode = mode === 'operator';
    objs.battlefieldGroup.visible = isOpMode;
    objs.armoryFloor.visible = !isOpMode;
    objs.scene.background = new THREE.Color(isOpMode ? 0x070d18 : 0x05070b);
    objs.scene.fog = new THREE.FogExp2(isOpMode ? 0x070d18 : 0x05070b, isOpMode ? 0.036 : 0.085);

    while (objs.subjectGroup.children.length > 0) {
      objs.subjectGroup.remove(objs.subjectGroup.children[0]);
    }
    objs.subjectGroup.rotation.set(0, 0, 0);

    const opDef = OPERATORS[operatorId];
    const ringMat = objs.pedestalRing.material as THREE.MeshStandardMaterial;
    const oldMap = ringMat.map;
    ringMat.map = createPedestalTexture(opDef.accentColor, objs.maxAniso);
    ringMat.needsUpdate = true;
    oldMap?.dispose();

    if (mode === 'weapon_only') {
      const { group } = buildWeaponModel(weaponId, attachments, weaponSkin);
      const scale = 1.52;
      group.scale.setScalar(scale);
      group.rotation.y = Math.PI / 2;
      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(group);
      const center = new THREE.Vector3();
      box.getCenter(center);
      group.position.set(-center.x, 0.24 - center.y, -center.z);
      objs.subjectGroup.add(group);
      objs.rig = null;
    } else {
      const rig = buildOperatorModel(operatorId, weaponId, attachments, armorTier, weaponSkin);
      objs.subjectGroup.add(rig.root);
      objs.rig = rig;
    }
  }, [operatorId, weaponId, attachments, armorTier, mode, weaponSkin]);

  const isCinematic = mode === 'operator' && cameraPreset === 'cinematic';

  return (
    <div className="w-full h-full relative">
      <div
        ref={mountRef}
        className="w-full h-full relative cursor-grab active:cursor-grabbing"
        aria-label="3D 干员与武器全身展示区"
      />
      {/* Crisp Film Vignette (no backdrop-filter over WebGL) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 45%, transparent 45%, rgba(4, 6, 10, 0.72) 100%)',
        }}
      />
      {/* 2.39:1 Cutscene Letterbox Bars when in Cinematic Cutscene Preset */}
      {isCinematic && (
        <>
          <div className="absolute top-0 inset-x-0 h-7 bg-[#030407] border-b border-white/10 pointer-events-none" />
          <div className="absolute bottom-0 inset-x-0 h-7 bg-[#030407] border-t border-white/10 pointer-events-none" />
        </>
      )}
    </div>
  );
}
