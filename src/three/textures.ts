import * as THREE from 'three';
import { MapThemeDef, WeaponSkinDef, WeaponSkinId } from '../types/game';

export function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export function createMapGroundTexture(
  style: MapThemeDef['groundStyle'],
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (style === 'valley_forest') {
    ctx.fillStyle = '#263821';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random();
      ctx.fillStyle =
        r < 0.36
          ? 'rgba(66, 98, 46, 0.34)'
          : r < 0.68
            ? 'rgba(22, 34, 18, 0.28)'
            : r < 0.88
              ? 'rgba(104, 88, 60, 0.2)'
              : 'rgba(138, 152, 74, 0.22)';
      ctx.fillRect(x, y, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    ctx.strokeStyle = 'rgba(134, 168, 108, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.bezierCurveTo(180, 130, 320, 240, 512, 175);
    ctx.stroke();
  } else if (style === 'desert_city') {
    ctx.fillStyle = '#735a3d';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 12) {
      ctx.fillStyle = y % 24 === 0 ? 'rgba(222, 188, 138, 0.11)' : 'rgba(54, 38, 22, 0.09)';
      ctx.fillRect(0, y, 512, 5);
    }
    for (let i = 0; i < 3600; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.45 ? 'rgba(238, 206, 156, 0.14)' : 'rgba(72, 52, 32, 0.16)';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.strokeStyle = 'rgba(217, 178, 120, 0.12)';
    ctx.lineWidth = 1;
    for (let g = 64; g < 512; g += 64) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, 512);
      ctx.moveTo(0, g);
      ctx.lineTo(512, g);
      ctx.stroke();
    }
  } else if (style === 'space_tarmac') {
    ctx.fillStyle = '#141b27';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2400; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 508, 508);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let g = 128; g < 512; g += 128) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, 512);
      ctx.moveTo(0, g);
      ctx.lineTo(512, g);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.14)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 256);
    ctx.lineTo(512, 256);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#1c2533';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2800; i++) {
      const v = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
      ctx.fillStyle = v;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 510, 510);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.1)';
    ctx.lineWidth = 1;
    for (let g = 128; g < 512; g += 128) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, 512);
      ctx.moveTo(0, g);
      ctx.lineTo(512, g);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(44, 32);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBuildingFacadeTexture(
  style: MapThemeDef['groundStyle'],
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  if (style === 'desert_city') {
    ctx.fillStyle = '#b59268';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 24) {
      ctx.fillStyle = y % 48 === 0 ? 'rgba(255,240,210,0.08)' : 'rgba(55,36,18,0.1)';
      ctx.fillRect(0, y, 256, 12);
    }
    ctx.strokeStyle = 'rgba(48, 34, 20, 0.24)';
    ctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#3b2919';
    for (let x = 28; x < 230; x += 68) {
      ctx.fillRect(x, 60, 26, 48);
      ctx.fillRect(x, 152, 26, 48);
    }
  } else if (style === 'space_tarmac') {
    ctx.fillStyle = '#2d3a4f';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 2;
    for (let x = 0; x < 256; x += 64) {
      ctx.strokeRect(x + 4, 4, 56, 248);
    }
    ctx.fillStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.fillRect(10, 95, 236, 14);
  } else if (style === 'valley_forest') {
    ctx.fillStyle = '#736555';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 20) {
      ctx.fillStyle = y % 40 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, y, 256, 10);
    }
    // Exposed timber framing accents
    ctx.fillStyle = '#423222';
    ctx.fillRect(0, 0, 14, 256);
    ctx.fillRect(242, 0, 14, 256);
    ctx.fillRect(0, 122, 256, 12);
    ctx.fillStyle = '#231d17';
    ctx.fillRect(36, 56, 40, 48);
    ctx.fillRect(178, 56, 40, 48);
  } else {
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.48)';
    ctx.lineWidth = 3;
    for (let x = 0; x < 256; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(245, 158, 11, 0.28)';
    ctx.fillRect(0, 214, 256, 14);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

const roofTextureCache = new Map<string, THREE.CanvasTexture>();

export function createRoofTileTexture(
  roofStyle: 'pitched' | 'flat' | 'dome' | 'industrial',
  groundStyle: MapThemeDef['groundStyle'],
  maxAnisotropy: number
): THREE.CanvasTexture {
  const key = `${roofStyle}_${groundStyle}`;
  const cached = roofTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  if (roofStyle === 'pitched') {
    // Terracotta / weathered slate overlapping shingles for Layali cottages
    ctx.fillStyle = groundStyle === 'valley_forest' ? '#7c3f2c' : '#4a5568';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 24) {
      ctx.fillStyle = (y / 24) % 2 === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(255,220,180,0.08)';
      ctx.fillRect(0, y, 256, 4);
      const offset = (y / 24) % 2 === 0 ? 0 : 16;
      ctx.strokeStyle = 'rgba(24,14,10,0.32)';
      ctx.lineWidth = 2;
      for (let x = offset; x < 256; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 24);
        ctx.stroke();
      }
    }
  } else if (roofStyle === 'dome') {
    ctx.fillStyle = groundStyle === 'desert_city' ? '#bfa078' : '#3a4a63';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect((i * 47) % 256, (i * 89) % 256, 4, 4);
    }
  } else if (roofStyle === 'industrial') {
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 16) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x, 0, 5, 256);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 5, 0, 3, 256);
    }
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.28)';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 248);
  } else {
    ctx.fillStyle = groundStyle === 'desert_city' ? '#9e815c' : '#263344';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, 240, 240);
    for (let g = 64; g < 256; g += 64) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, 256);
      ctx.moveTo(0, g);
      ctx.lineTo(256, g);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  roofTextureCache.set(key, tex);
  return tex;
}

const roadTextureCache = new Map<string, THREE.CanvasTexture>();

export function createRoadTexture(
  groundStyle: MapThemeDef['groundStyle'],
  baseHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const key = `${groundStyle}_${baseHex}`;
  const cached = roadTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect((i * 53) % 256, (i * 97) % 256, 2, 2);
  }
  if (groundStyle === 'valley_forest' || groundStyle === 'desert_city') {
    // Tire ruts
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(58, 0, 24, 256);
    ctx.fillRect(174, 0, 24, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = maxAnisotropy;
  roadTextureCache.set(key, tex);
  return tex;
}

export function createCorrugatedTexture(baseHex: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, 0, 6, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x + 6, 0, 3, 256);
  }

  ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
  ctx.fillRect(0, 0, 256, 14);
  ctx.fillRect(0, 242, 256, 14);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createHelipadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 512);

  ctx.strokeStyle = '#00E59B';
  ctx.lineWidth = 14;
  ctx.setLineDash([36, 18]);
  ctx.beginPath();
  ctx.arc(256, 256, 224, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(256, 256, 170, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(176, 146, 36, 220);
  ctx.fillRect(300, 146, 36, 220);
  ctx.fillRect(176, 238, 160, 36);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createPedestalTexture(accentHex: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0d131d';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(256, 256, 230, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.arc(256, 256, 188, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(248, 250, 252, 0.4)';
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r1 = i % 3 === 0 ? 204 : 214;
    const r2 = 224;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(a) * r1, 256 + Math.sin(a) * r1);
    ctx.lineTo(256 + Math.cos(a) * r2, 256 + Math.sin(a) * r2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// =====================================================================
// AAA PROCEDURAL PBR CHARACTER & WEAPON TEXTURES (CACHED)
// =====================================================================

interface FabricTextureBundle {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

const fabricCache = new Map<string, FabricTextureBundle>();
let sharedMetalBump: THREE.CanvasTexture | null = null;
let sharedMetalRough: THREE.CanvasTexture | null = null;
let sharedCarbonMap: THREE.CanvasTexture | null = null;
let sharedGlowSprite: THREE.CanvasTexture | null = null;
let sharedSkinBump: THREE.CanvasTexture | null = null;
let sharedSkinRough: THREE.CanvasTexture | null = null;
let sharedArmorBump: THREE.CanvasTexture | null = null;
let sharedArmorRough: THREE.CanvasTexture | null = null;
const irisCache = new Map<number, THREE.CanvasTexture>();

export function createTacticalFabricTextures(
  baseHex: number,
  pattern: 'ripstop' | 'hex' | 'multicam'
): FabricTextureBundle {
  const key = `${baseHex}_${pattern}`;
  const existing = fabricCache.get(key);
  if (existing) return existing;

  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const col = new THREE.Color(baseHex);
  const rBase = Math.round(col.r * 255);
  const gBase = Math.round(col.g * 255);
  const bBase = Math.round(col.b * 255);

  cCtx.fillStyle = `rgb(${rBase}, ${gBase}, ${bBase})`;
  cCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = 'rgb(128, 128, 128)';
  bCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = 'rgb(198, 198, 198)';
  rCtx.fillRect(0, 0, size, size);

  // Subtle camo or technical hex patterning
  if (pattern === 'multicam') {
    for (let i = 0; i < 42; i++) {
      const px = ((i * 73) % 256);
      const py = ((i * 137) % 256);
      const rw = 24 + (i % 4) * 14;
      const rh = 16 + (i % 3) * 12;
      const shade = i % 2 === 0 ? 18 : -18;
      cCtx.fillStyle = `rgba(${Math.min(255, Math.max(0, rBase + shade))}, ${Math.min(255, Math.max(0, gBase + shade))}, ${Math.min(255, Math.max(0, bBase + shade))}, 0.45)`;
      cCtx.beginPath();
      cCtx.ellipse(px, py, rw, rh, (i % 5) * 0.4, 0, Math.PI * 2);
      cCtx.fill();
    }
  } else if (pattern === 'hex') {
    cCtx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    cCtx.lineWidth = 1.2;
    bCtx.strokeStyle = 'rgb(165, 165, 165)';
    bCtx.lineWidth = 1.5;
    for (let y = 0; y < size; y += 16) {
      for (let x = 0; x < size; x += 16) {
        const ox = (y / 16) % 2 === 0 ? 0 : 8;
        cCtx.strokeRect(x + ox, y, 12, 12);
        bCtx.strokeRect(x + ox, y, 12, 12);
      }
    }
  }

  // Cordura Ripstop cross-hatch micro weave
  for (let x = 0; x < size; x += 4) {
    const strong = x % 16 === 0;
    cCtx.fillStyle = strong ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.03)';
    cCtx.fillRect(x, 0, 1, size);
    bCtx.fillStyle = strong ? 'rgb(175,175,175)' : 'rgb(142,142,142)';
    bCtx.fillRect(x, 0, 1, size);
    rCtx.fillStyle = strong ? 'rgb(225,225,225)' : 'rgb(185,185,185)';
    rCtx.fillRect(x, 0, 1, size);
  }
  for (let y = 0; y < size; y += 4) {
    const strong = y % 16 === 0;
    cCtx.fillStyle = strong ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.025)';
    cCtx.fillRect(0, y, size, 1);
    bCtx.fillStyle = strong ? 'rgb(170,170,170)' : 'rgb(140,140,140)';
    bCtx.fillRect(0, y, size, 1);
  }

  // Dark gritty battlefield soot & dust micro-weathering
  for (let i = 0; i < 180; i++) {
    const sx = (i * 53) % size;
    const sy = (i * 97) % size;
    const rad = 2 + (i % 6);
    cCtx.fillStyle = i % 3 === 0 ? 'rgba(12, 14, 16, 0.16)' : 'rgba(92, 84, 72, 0.1)';
    cCtx.beginPath();
    cCtx.arc(sx, sy, rad, 0, Math.PI * 2);
    cCtx.fill();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 3);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 3);

  const bundle = { map, bumpMap, roughnessMap };
  fabricCache.set(key, bundle);
  return bundle;
}

export function getWeaponMetalMaps(): {
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  carbonMap: THREE.CanvasTexture;
} {
  if (!sharedMetalBump || !sharedMetalRough || !sharedCarbonMap) {
    const s = 128;
    const bCan = document.createElement('canvas');
    bCan.width = bCan.height = s;
    const bCtx = bCan.getContext('2d')!;
    bCtx.fillStyle = 'rgb(128,128,128)';
    bCtx.fillRect(0, 0, s, s);

    const rCan = document.createElement('canvas');
    rCan.width = rCan.height = s;
    const rCtx = rCan.getContext('2d')!;
    rCtx.fillStyle = 'rgb(95,95,95)';
    rCtx.fillRect(0, 0, s, s);

    // Anisotropic horizontal brushed metal lines
    for (let y = 0; y < s; y += 2) {
      const v = 112 + Math.floor((Math.sin(y * 1.7) * 0.5 + 0.5) * 32);
      bCtx.fillStyle = `rgb(${v},${v},${v})`;
      bCtx.fillRect(0, y, s, 1);
      const rv = 70 + Math.floor(((y * 13) % 55));
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(0, y, s, 1);
    }

    const cCan = document.createElement('canvas');
    cCan.width = cCan.height = 64;
    const cCtx = cCan.getContext('2d')!;
    cCtx.fillStyle = '#18181b';
    cCtx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) {
      for (let x = 0; x < 64; x += 8) {
        cCtx.fillStyle = (x + y) % 16 === 0 ? '#27272a' : '#09090b';
        cCtx.fillRect(x, y, 4, 8);
      }
    }

    sharedMetalBump = new THREE.CanvasTexture(bCan);
    sharedMetalBump.colorSpace = THREE.NoColorSpace;
    sharedMetalBump.wrapS = sharedMetalBump.wrapT = THREE.RepeatWrapping;

    sharedMetalRough = new THREE.CanvasTexture(rCan);
    sharedMetalRough.colorSpace = THREE.NoColorSpace;
    sharedMetalRough.wrapS = sharedMetalRough.wrapT = THREE.RepeatWrapping;

    sharedCarbonMap = new THREE.CanvasTexture(cCan);
    sharedCarbonMap.colorSpace = THREE.SRGBColorSpace;
    sharedCarbonMap.wrapS = sharedCarbonMap.wrapT = THREE.RepeatWrapping;
    sharedCarbonMap.repeat.set(4, 4);
  }
  return { bumpMap: sharedMetalBump, roughnessMap: sharedMetalRough, carbonMap: sharedCarbonMap };
}

export function getSkinPoreMaps(): {
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  if (!sharedSkinBump || !sharedSkinRough) {
    const s = 128;
    const bCan = document.createElement('canvas');
    bCan.width = bCan.height = s;
    const bCtx = bCan.getContext('2d')!;
    bCtx.fillStyle = 'rgb(128,128,128)';
    bCtx.fillRect(0, 0, s, s);

    const rCan = document.createElement('canvas');
    rCan.width = rCan.height = s;
    const rCtx = rCan.getContext('2d')!;
    rCtx.fillStyle = 'rgb(168,168,168)';
    rCtx.fillRect(0, 0, s, s);

    // Deterministic skin micro-pores & subtle sweat/oil roughness variance
    for (let i = 0; i < 620; i++) {
      const px = (i * 37) % s;
      const py = (i * 71) % s;
      const pv = 104 + ((i * 19) % 44);
      bCtx.fillStyle = `rgb(${pv},${pv},${pv})`;
      bCtx.fillRect(px, py, 1, 1);

      const rv = 140 + ((i * 23) % 62);
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(px, py, 2, 2);
    }

    sharedSkinBump = new THREE.CanvasTexture(bCan);
    sharedSkinBump.colorSpace = THREE.NoColorSpace;
    sharedSkinBump.wrapS = sharedSkinBump.wrapT = THREE.RepeatWrapping;
    sharedSkinBump.repeat.set(3, 3);

    sharedSkinRough = new THREE.CanvasTexture(rCan);
    sharedSkinRough.colorSpace = THREE.NoColorSpace;
    sharedSkinRough.wrapS = sharedSkinRough.wrapT = THREE.RepeatWrapping;
    sharedSkinRough.repeat.set(3, 3);
  }
  return { bumpMap: sharedSkinBump, roughnessMap: sharedSkinRough };
}

export function getWeatheredArmorMaps(): {
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  if (!sharedArmorBump || !sharedArmorRough) {
    const s = 128;
    const bCan = document.createElement('canvas');
    bCan.width = bCan.height = s;
    const bCtx = bCan.getContext('2d')!;
    bCtx.fillStyle = 'rgb(128,128,128)';
    bCtx.fillRect(0, 0, s, s);

    const rCan = document.createElement('canvas');
    rCan.width = rCan.height = s;
    const rCtx = rCan.getContext('2d')!;
    rCtx.fillStyle = 'rgb(122,122,122)';
    rCtx.fillRect(0, 0, s, s);

    // Ceramic composite grain + battle-worn scratches & chipped paint roughness
    for (let i = 0; i < 380; i++) {
      const x = (i * 43) % s;
      const y = (i * 89) % s;
      const g = 112 + (i % 34);
      bCtx.fillStyle = `rgb(${g},${g},${g})`;
      bCtx.fillRect(x, y, 2, 2);
    }
    for (let i = 0; i < 28; i++) {
      const sx = (i * 41) % s;
      const sy = (i * 67) % s;
      const len = 8 + (i % 18);
      const ang = ((i * 29) % 100) * 0.03;
      bCtx.strokeStyle = i % 2 === 0 ? 'rgb(88,88,88)' : 'rgb(164,164,164)';
      bCtx.lineWidth = 1;
      bCtx.beginPath();
      bCtx.moveTo(sx, sy);
      bCtx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      bCtx.stroke();

      rCtx.strokeStyle = 'rgb(64,64,64)';
      rCtx.lineWidth = 1.2;
      rCtx.beginPath();
      rCtx.moveTo(sx, sy);
      rCtx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      rCtx.stroke();
    }

    sharedArmorBump = new THREE.CanvasTexture(bCan);
    sharedArmorBump.colorSpace = THREE.NoColorSpace;
    sharedArmorBump.wrapS = sharedArmorBump.wrapT = THREE.RepeatWrapping;
    sharedArmorBump.repeat.set(2, 2);

    sharedArmorRough = new THREE.CanvasTexture(rCan);
    sharedArmorRough.colorSpace = THREE.NoColorSpace;
    sharedArmorRough.wrapS = sharedArmorRough.wrapT = THREE.RepeatWrapping;
    sharedArmorRough.repeat.set(2, 2);
  }
  return { bumpMap: sharedArmorBump, roughnessMap: sharedArmorRough };
}

export function createIrisTexture(accentHex: number): THREE.CanvasTexture {
  const existing = irisCache.get(accentHex);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Blend operator accent gently into a grounded realistic iris color (hazel/steel/amber/slate)
  const naturalBase = new THREE.Color(0x3a4752);
  const tint = new THREE.Color(accentHex);
  naturalBase.lerp(tint, 0.38);
  const irisStr = `#${naturalBase.getHexString()}`;
  const midRim = `#${naturalBase.clone().multiplyScalar(0.58).getHexString()}`;

  // Realistic shadowed human sclera (never pure #ffffff anime glow)
  const scleraGrad = ctx.createRadialGradient(64, 64, 24, 64, 64, 64);
  scleraGrad.addColorStop(0, '#cfd5dc');
  scleraGrad.addColorStop(0.72, '#adb5bf');
  scleraGrad.addColorStop(1, '#7a838e');
  ctx.fillStyle = scleraGrad;
  ctx.fillRect(0, 0, 128, 128);

  // Subtle realistic limbal ring & iris stroma
  const grad = ctx.createRadialGradient(64, 64, 11, 64, 64, 34);
  grad.addColorStop(0, '#090b0f');
  grad.addColorStop(0.36, irisStr);
  grad.addColorStop(0.84, midRim);
  grad.addColorStop(1, '#11161d');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 34, 0, Math.PI * 2);
  ctx.fill();

  // Fine anatomical iris radial stroma fibers
  ctx.strokeStyle = 'rgba(220,226,232,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * 14, 64 + Math.sin(a) * 14);
    ctx.lineTo(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30);
    ctx.stroke();
  }

  // Deep anatomical pupil
  ctx.fillStyle = '#05070a';
  ctx.beginPath();
  ctx.arc(64, 64, 13, 0, Math.PI * 2);
  ctx.fill();

  // Single tiny crisp corneal specular reflection (photorealistic CG, zero anime circles)
  ctx.fillStyle = 'rgba(248, 250, 252, 0.86)';
  ctx.beginPath();
  ctx.arc(54, 52, 2.3, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  irisCache.set(accentHex, tex);
  return tex;
}

export function getSoftGlowSpriteTexture(): THREE.CanvasTexture {
  if (sharedGlowSprite) return sharedGlowSprite;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.72)');
  grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.16)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  sharedGlowSprite = new THREE.CanvasTexture(canvas);
  sharedGlowSprite.colorSpace = THREE.SRGBColorSpace;
  return sharedGlowSprite;
}

interface WeaponSkinTextureBundle {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

const weaponSkinCache = new Map<WeaponSkinId, WeaponSkinTextureBundle>();

export function createWeaponSkinTextures(skin: WeaponSkinDef): WeaponSkinTextureBundle {
  const cached = weaponSkinCache.get(skin.id);
  if (cached) return cached;

  const size = 256;
  const cCan = document.createElement('canvas');
  cCan.width = cCan.height = size;
  const cCtx = cCan.getContext('2d')!;

  const rCan = document.createElement('canvas');
  rCan.width = rCan.height = size;
  const rCtx = rCan.getContext('2d')!;

  const bCan = document.createElement('canvas');
  bCan.width = bCan.height = size;
  const bCtx = bCan.getContext('2d')!;

  cCtx.fillStyle = skin.primaryHex;
  cCtx.fillRect(0, 0, size, size);

  const roughByte = Math.round(skin.roughness * 255);
  rCtx.fillStyle = `rgb(${roughByte},${roughByte},${roughByte})`;
  rCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = 'rgb(128,128,128)';
  bCtx.fillRect(0, 0, size, size);

  if (skin.pattern === 'digital') {
    const cell = 16;
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        const hash = ((x * 37 + y * 91) ^ (x * 13)) % 17;
        if (hash < 5) {
          cCtx.fillStyle = skin.secondaryHex;
          cCtx.fillRect(x, y, cell, cell);
          rCtx.fillStyle = 'rgb(195,195,195)';
          rCtx.fillRect(x, y, cell, cell);
        } else if (hash === 7 || hash === 11) {
          cCtx.fillStyle = skin.accentHex;
          cCtx.fillRect(x, y, cell, cell);
          rCtx.fillStyle = 'rgb(145,145,145)';
          rCtx.fillRect(x, y, cell, cell);
        }
      }
    }
  } else if (skin.pattern === 'camo') {
    for (let i = 0; i < 38; i++) {
      const px = (i * 67) % size;
      const py = (i * 113) % size;
      const rx = 22 + (i % 5) * 11;
      const ry = 14 + (i % 4) * 9;
      cCtx.fillStyle = i % 3 === 0 ? skin.accentHex : skin.secondaryHex;
      cCtx.beginPath();
      cCtx.ellipse(px, py, rx, ry, (i % 6) * 0.5, 0, Math.PI * 2);
      cCtx.fill();
    }
  } else if (skin.pattern === 'topo') {
    // Diagonal geometric facets + crisp tactical laser accent stripes
    cCtx.fillStyle = skin.secondaryHex;
    cCtx.beginPath();
    cCtx.moveTo(0, 64);
    cCtx.lineTo(150, 0);
    cCtx.lineTo(256, 110);
    cCtx.lineTo(110, 256);
    cCtx.closePath();
    cCtx.fill();

    cCtx.strokeStyle = skin.accentHex;
    cCtx.lineWidth = 4;
    bCtx.strokeStyle = 'rgb(205,205,205)';
    bCtx.lineWidth = 4;
    rCtx.strokeStyle = 'rgb(45,45,45)';
    rCtx.lineWidth = 4;
    for (let offset = -120; offset <= 320; offset += 52) {
      cCtx.beginPath();
      cCtx.moveTo(offset, 0);
      cCtx.lineTo(offset + 140, 256);
      cCtx.stroke();
      bCtx.beginPath();
      bCtx.moveTo(offset, 0);
      bCtx.lineTo(offset + 140, 256);
      bCtx.stroke();
      rCtx.beginPath();
      rCtx.moveTo(offset, 0);
      rCtx.lineTo(offset + 140, 256);
      rCtx.stroke();
    }
  } else if (skin.pattern === 'hex') {
    cCtx.fillStyle = skin.secondaryHex;
    cCtx.fillRect(0, 110, size, 36);
    cCtx.strokeStyle = skin.accentHex;
    cCtx.lineWidth = 1.6;
    bCtx.strokeStyle = 'rgb(190,190,190)';
    bCtx.lineWidth = 2;
    rCtx.strokeStyle = 'rgb(30,30,30)';
    rCtx.lineWidth = 2;
    for (let y = 0; y < size; y += 20) {
      for (let x = 0; x < size; x += 20) {
        const ox = (y / 20) % 2 === 0 ? 0 : 10;
        cCtx.strokeRect(x + ox + 2, y + 2, 14, 14);
        bCtx.strokeRect(x + ox + 2, y + 2, 14, 14);
        rCtx.strokeRect(x + ox + 2, y + 2, 14, 14);
      }
    }
    // High-contrast glowing speed stripe
    cCtx.fillStyle = skin.accentHex;
    cCtx.fillRect(0, 124, size, 7);
  } else if (skin.pattern === 'carbon_gold') {
    // Luxury Damascus / Gold filigree waves over obsidian steel
    cCtx.fillStyle = skin.secondaryHex;
    for (let y = 0; y < size; y += 16) {
      cCtx.beginPath();
      cCtx.moveTo(0, y);
      for (let x = 0; x <= size; x += 16) {
        cCtx.lineTo(x, y + Math.sin(x * 0.06 + y * 0.1) * 7);
      }
      cCtx.lineTo(size, y + 8);
      cCtx.lineTo(0, y + 8);
      cCtx.closePath();
      cCtx.fill();
    }
    cCtx.strokeStyle = skin.accentHex;
    cCtx.lineWidth = 2;
    for (let y = 8; y < size; y += 32) {
      cCtx.beginPath();
      cCtx.moveTo(0, y);
      for (let x = 0; x <= size; x += 16) {
        cCtx.lineTo(x, y + Math.sin(x * 0.06 + y * 0.1) * 7);
      }
      cCtx.stroke();
    }
  } else if (skin.pattern === 'tiger') {
    // Aggressive jagged predator tiger stripes
    for (let i = -32; i < size + 48; i += 32) {
      cCtx.fillStyle = skin.secondaryHex;
      cCtx.beginPath();
      cCtx.moveTo(i, 0);
      cCtx.lineTo(i + 20, 0);
      cCtx.lineTo(i + 58, size * 0.5);
      cCtx.lineTo(i + 12, size);
      cCtx.lineTo(i - 8, size);
      cCtx.lineTo(i + 34, size * 0.5);
      cCtx.closePath();
      cCtx.fill();

      cCtx.strokeStyle = skin.accentHex;
      cCtx.lineWidth = 2.5;
      cCtx.beginPath();
      cCtx.moveTo(i + 20, 0);
      cCtx.lineTo(i + 58, size * 0.5);
      cCtx.lineTo(i + 12, size);
      cCtx.stroke();

      rCtx.fillStyle = 'rgb(175,175,175)';
      rCtx.fillRect(i, 0, 14, size);
    }
  } else if (skin.pattern === 'prism') {
    // Iridescent titanium anodized facet shards
    const grad = cCtx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, skin.primaryHex);
    grad.addColorStop(0.5, skin.secondaryHex);
    grad.addColorStop(1, skin.accentHex);
    cCtx.fillStyle = grad;
    cCtx.fillRect(0, 0, size, size);

    cCtx.strokeStyle = 'rgba(255,255,255,0.28)';
    cCtx.lineWidth = 2;
    bCtx.strokeStyle = 'rgb(205,205,205)';
    bCtx.lineWidth = 2;
    for (let y = 0; y < size; y += 48) {
      for (let x = 0; x < size; x += 48) {
        cCtx.fillStyle = ((x + y) / 48) % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
        cCtx.beginPath();
        cCtx.moveTo(x, y);
        cCtx.lineTo(x + 48, y + 18);
        cCtx.lineTo(x + 30, y + 48);
        cCtx.closePath();
        cCtx.fill();
        cCtx.stroke();
        bCtx.strokeRect(x + 2, y + 2, 44, 44);
      }
    }
  }

  // Subtle brushed machining micro-lines for metallic realism
  for (let y = 0; y < size; y += 3) {
    cCtx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
    cCtx.fillRect(0, y, size, 1);
  }

  const map = new THREE.CanvasTexture(cCan);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1.5, 1.5);

  const roughnessMap = new THREE.CanvasTexture(rCan);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bCan);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  const bundle = { map, roughnessMap, bumpMap };
  weaponSkinCache.set(skin.id, bundle);
  return bundle;
}

export type BulletHoleSurface = 'concrete' | 'metal' | 'wood' | 'kevlar';

export interface BulletHolePBRBundle {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

const bulletHoleCache = new Map<string, BulletHolePBRBundle>();
let sharedDustPuffSprite: THREE.CanvasTexture | null = null;

function createSeededRng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function getDustPuffSpriteTexture(): THREE.CanvasTexture {
  if (sharedDustPuffSprite) return sharedDustPuffSprite;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = createSeededRng(90217);

  ctx.clearRect(0, 0, size, size);
  // Multi-lobe matte particulate cloud puff
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + rng() * 0.4;
    const dist = i === 0 ? 0 : 5 + rng() * 11;
    const cx = 32 + Math.cos(angle) * dist;
    const cy = 32 + Math.sin(angle) * dist;
    const rad = 12 + rng() * 11;
    const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, rad);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
    grad.addColorStop(0.55, 'rgba(235, 232, 226, 0.22)');
    grad.addColorStop(1, 'rgba(220, 218, 212, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  sharedDustPuffSprite = new THREE.CanvasTexture(canvas);
  sharedDustPuffSprite.colorSpace = THREE.SRGBColorSpace;
  return sharedDustPuffSprite;
}

export function getBulletHolePBRTextures(
  surface: BulletHoleSurface,
  variant = 0
): BulletHolePBRBundle {
  const v = ((variant % 3) + 3) % 3;
  const cacheKey = `${surface}_${v}`;
  const cached = bulletHoleCache.get(cacheKey);
  if (cached) return cached;

  const size = 128;
  const cx = 64;
  const cy = 64;
  const surfaceOffset =
    surface === 'concrete' ? 101 : surface === 'metal' ? 202 : surface === 'wood' ? 303 : 404;
  const rng = createSeededRng(surfaceOffset + v * 977);

  // Albedo RGBA canvas (transparent exterior, crisp crater & spalling inside)
  const cCan = document.createElement('canvas');
  cCan.width = cCan.height = size;
  const cCtx = cCan.getContext('2d')!;

  // Bump heightmap canvas (128 = neutral surface level, <128 = recessed cavity, >128 = raised lip)
  const bCan = document.createElement('canvas');
  bCan.width = bCan.height = size;
  const bCtx = bCan.getContext('2d')!;
  bCtx.fillStyle = 'rgb(128,128,128)';
  bCtx.fillRect(0, 0, size, size);

  // Roughness canvas (grayscale: low = glossy torn metal bevel, high = matte pulverized dust/soot)
  const rCan = document.createElement('canvas');
  rCan.width = rCan.height = size;
  const rCtx = rCan.getContext('2d')!;
  rCtx.fillStyle = surface === 'metal' ? 'rgb(145,145,145)' : 'rgb(215,215,215)';
  rCtx.fillRect(0, 0, size, size);

  // 1. Outer impact dust / cordite scorch halo
  const haloGrad = cCtx.createRadialGradient(cx, cy, 8, cx, cy, 56);
  if (surface === 'concrete') {
    haloGrad.addColorStop(0, 'rgba(38, 37, 34, 0.72)');
    haloGrad.addColorStop(0.32, 'rgba(176, 173, 166, 0.62)');
    haloGrad.addColorStop(0.68, 'rgba(205, 202, 195, 0.28)');
    haloGrad.addColorStop(1, 'rgba(205, 202, 195, 0)');
  } else if (surface === 'metal') {
    haloGrad.addColorStop(0, 'rgba(10, 12, 16, 0.85)');
    haloGrad.addColorStop(0.38, 'rgba(28, 32, 39, 0.56)');
    haloGrad.addColorStop(0.7, 'rgba(42, 46, 54, 0.2)');
    haloGrad.addColorStop(1, 'rgba(42, 46, 54, 0)');
  } else if (surface === 'wood') {
    haloGrad.addColorStop(0, 'rgba(28, 19, 12, 0.78)');
    haloGrad.addColorStop(0.38, 'rgba(128, 92, 54, 0.52)');
    haloGrad.addColorStop(0.75, 'rgba(164, 126, 82, 0.2)');
    haloGrad.addColorStop(1, 'rgba(164, 126, 82, 0)');
  } else {
    // kevlar / ballistic polymer
    haloGrad.addColorStop(0, 'rgba(16, 17, 20, 0.86)');
    haloGrad.addColorStop(0.4, 'rgba(72, 70, 63, 0.52)');
    haloGrad.addColorStop(0.74, 'rgba(110, 108, 98, 0.2)');
    haloGrad.addColorStop(1, 'rgba(110, 108, 98, 0)');
  }
  cCtx.fillStyle = haloGrad;
  cCtx.beginPath();
  cCtx.arc(cx, cy, 56, 0, Math.PI * 2);
  cCtx.fill();

  if (surface === 'concrete') {
    // Concrete radial micro-fissures
    const crackCount = 8 + Math.floor(rng() * 4);
    for (let i = 0; i < crackCount; i++) {
      let ang = (i / crackCount) * Math.PI * 2 + (rng() - 0.5) * 0.42;
      let px = cx + Math.cos(ang) * 11;
      let py = cy + Math.sin(ang) * 11;
      const segs = 3 + Math.floor(rng() * 3);
      const totalLen = 22 + rng() * 28;

      cCtx.beginPath();
      cCtx.moveTo(px, py);
      bCtx.beginPath();
      bCtx.moveTo(px, py);

      for (let s = 1; s <= segs; s++) {
        ang += (rng() - 0.5) * 0.55;
        const step = totalLen / segs;
        px += Math.cos(ang) * step;
        py += Math.sin(ang) * step;
        cCtx.lineTo(px, py);
        bCtx.lineTo(px, py);
      }

      cCtx.strokeStyle = 'rgba(24, 24, 22, 0.78)';
      cCtx.lineWidth = 1.1 + rng() * 1.3;
      cCtx.stroke();

      bCtx.strokeStyle = 'rgb(42,42,42)';
      bCtx.lineWidth = 1.6;
      bCtx.stroke();
    }

    // Chipped concrete spall crater ring (aggregate chunks & chalky beveled rim)
    const rimPts = 14;
    const rimCoords: Array<[number, number]> = [];
    for (let i = 0; i < rimPts; i++) {
      const a = (i / rimPts) * Math.PI * 2;
      const r = 17 + rng() * 10;
      rimCoords.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }

    cCtx.beginPath();
    bCtx.beginPath();
    rCtx.beginPath();
    rimCoords.forEach(([x, y], idx) => {
      if (idx === 0) {
        cCtx.moveTo(x, y);
        bCtx.moveTo(x, y);
        rCtx.moveTo(x, y);
      } else {
        cCtx.lineTo(x, y);
        bCtx.lineTo(x, y);
        rCtx.lineTo(x, y);
      }
    });
    cCtx.closePath();
    bCtx.closePath();
    rCtx.closePath();

    cCtx.fillStyle = 'rgba(130, 127, 120, 0.88)';
    cCtx.fill();
    cCtx.strokeStyle = 'rgba(218, 214, 206, 0.72)';
    cCtx.lineWidth = 2.4;
    cCtx.stroke();

    bCtx.fillStyle = 'rgb(76,76,76)';
    bCtx.fill();
    bCtx.strokeStyle = 'rgb(206,206,206)';
    bCtx.lineWidth = 3;
    bCtx.stroke();

    rCtx.fillStyle = 'rgb(242,242,242)';
    rCtx.fill();

    // Concrete aggregate flecks around spall
    for (let i = 0; i < 24; i++) {
      const a = rng() * Math.PI * 2;
      const d = 14 + rng() * 28;
      const fx = cx + Math.cos(a) * d;
      const fy = cy + Math.sin(a) * d;
      const fr = 1 + rng() * 2.2;
      cCtx.fillStyle = rng() > 0.5 ? 'rgba(222,219,210,0.65)' : 'rgba(58,56,52,0.7)';
      cCtx.fillRect(fx, fy, fr, fr);
    }
  } else if (surface === 'metal') {
    // Torn outward curled steel petals with sharp specular rim
    const petalCount = 7 + (v % 2);
    for (let i = 0; i < petalCount; i++) {
      const a = (i / petalCount) * Math.PI * 2 + (rng() - 0.5) * 0.25;
      const spread = 0.26 + rng() * 0.14;
      const tipR = 23 + rng() * 9;
      const baseR = 11;

      const x1 = cx + Math.cos(a - spread) * baseR;
      const y1 = cy + Math.sin(a - spread) * baseR;
      const x2 = cx + Math.cos(a) * tipR;
      const y2 = cy + Math.sin(a) * tipR;
      const x3 = cx + Math.cos(a + spread) * baseR;
      const y3 = cy + Math.sin(a + spread) * baseR;

      // Shadow side + bright freshly sheared steel lip
      cCtx.beginPath();
      cCtx.moveTo(x1, y1);
      cCtx.lineTo(x2, y2);
      cCtx.lineTo(x3, y3);
      cCtx.closePath();
      cCtx.fillStyle = i % 2 === 0 ? 'rgba(94, 104, 118, 0.9)' : 'rgba(54, 62, 74, 0.9)';
      cCtx.fill();
      cCtx.strokeStyle = 'rgba(226, 232, 240, 0.92)';
      cCtx.lineWidth = 1.6;
      cCtx.stroke();

      // Raised torn lip in bump map + glossy sheared steel in roughness map
      bCtx.beginPath();
      bCtx.moveTo(x1, y1);
      bCtx.lineTo(x2, y2);
      bCtx.lineTo(x3, y3);
      bCtx.closePath();
      bCtx.fillStyle = 'rgb(225,225,225)';
      bCtx.fill();

      rCtx.beginPath();
      rCtx.moveTo(x1, y1);
      rCtx.lineTo(x2, y2);
      rCtx.lineTo(x3, y3);
      rCtx.closePath();
      rCtx.fillStyle = 'rgb(42,42,42)';
      rCtx.fill();
    }

    // Radial scratch gouges on metal plate
    for (let i = 0; i < 6; i++) {
      const a = rng() * Math.PI * 2;
      const r0 = 16 + rng() * 6;
      const r1 = r0 + 10 + rng() * 14;
      cCtx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
      cCtx.lineWidth = 1;
      cCtx.beginPath();
      cCtx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      cCtx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      cCtx.stroke();
    }
  } else if (surface === 'wood') {
    // Directional wooden splinter tears along crate plank grain
    const grainAngle = (v - 1) * 0.28;
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const offY = (rng() - 0.5) * 26;
      const len = 18 + rng() * 28;
      const a = grainAngle + (rng() - 0.5) * 0.22;
      const x0 = cx + Math.cos(a + Math.PI / 2) * offY;
      const y0 = cy + Math.sin(a + Math.PI / 2) * offY;
      const x1 = x0 + Math.cos(a) * len * side;
      const y1 = y0 + Math.sin(a) * len * side;

      cCtx.strokeStyle = rng() > 0.45 ? 'rgba(154, 111, 68, 0.85)' : 'rgba(66, 44, 24, 0.85)';
      cCtx.lineWidth = 1.5 + rng() * 2.2;
      cCtx.beginPath();
      cCtx.moveTo(x0, y0);
      cCtx.lineTo(x1, y1);
      cCtx.stroke();

      bCtx.strokeStyle = rng() > 0.5 ? 'rgb(185,185,185)' : 'rgb(70,70,70)';
      bCtx.lineWidth = 2;
      bCtx.beginPath();
      bCtx.moveTo(x0, y0);
      bCtx.lineTo(x1, y1);
      bCtx.stroke();
    }
  } else {
    // Kevlar / ballistic panel frayed weave & composite delamination
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + (rng() - 0.5) * 0.2;
      const r0 = 9;
      const r1 = 18 + rng() * 14;
      cCtx.strokeStyle = i % 2 === 0 ? 'rgba(163, 158, 141, 0.82)' : 'rgba(63, 62, 56, 0.88)';
      cCtx.lineWidth = 1.5 + rng() * 1.4;
      cCtx.beginPath();
      cCtx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      cCtx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      cCtx.stroke();

      bCtx.strokeStyle = 'rgb(188,188,188)';
      bCtx.lineWidth = 1.6;
      bCtx.beginPath();
      bCtx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      bCtx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      bCtx.stroke();
    }
  }

  // 2. Deep central bullet perforation cavity (dark core + internal shadow rim)
  const corePts = 12;
  const coreRadius = surface === 'metal' ? 11.5 : 10.5;
  cCtx.beginPath();
  bCtx.beginPath();
  rCtx.beginPath();
  for (let i = 0; i < corePts; i++) {
    const a = (i / corePts) * Math.PI * 2;
    const r = coreRadius * (0.82 + rng() * 0.34);
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) {
      cCtx.moveTo(px, py);
      bCtx.moveTo(px, py);
      rCtx.moveTo(px, py);
    } else {
      cCtx.lineTo(px, py);
      bCtx.lineTo(px, py);
      rCtx.lineTo(px, py);
    }
  }
  cCtx.closePath();
  bCtx.closePath();
  rCtx.closePath();

  const coreGrad = cCtx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, coreRadius * 1.15);
  coreGrad.addColorStop(0, '#040507');
  coreGrad.addColorStop(0.68, '#0c0e12');
  coreGrad.addColorStop(1, '#262930');
  cCtx.fillStyle = coreGrad;
  cCtx.fill();

  bCtx.fillStyle = 'rgb(12,12,12)';
  bCtx.fill();

  rCtx.fillStyle = 'rgb(245,245,245)';
  rCtx.fill();

  const map = new THREE.CanvasTexture(cCan);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = new THREE.CanvasTexture(bCan);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  const roughnessMap = new THREE.CanvasTexture(rCan);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.ClampToEdgeWrapping;

  const bundle: BulletHolePBRBundle = { map, bumpMap, roughnessMap };
  bulletHoleCache.set(cacheKey, bundle);
  return bundle;
}

