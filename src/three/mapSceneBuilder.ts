import * as THREE from 'three';
import {
  WORLD_HEIGHT,
  WORLD_SCALE,
  WORLD_WIDTH,
} from '../data/gameData';
import { MapDef, MapObstacle } from '../types/game';
import {
  createBuildingFacadeTexture,
  createCorrugatedTexture,
  createHelipadTexture,
  createMapGroundTexture,
  createRoadTexture,
  createRoofTileTexture,
} from './textures';

export interface AnimatedMapProp {
  mesh: THREE.Object3D;
  axis: 'x' | 'y' | 'z';
  speed: number;
  bobAmp?: number;
  bobFreq?: number;
  baseY?: number;
}

export interface WeatherSurfaceRef {
  mat: THREE.MeshStandardMaterial;
  baseColor: THREE.Color;
  baseRoughness: number;
  baseMetalness: number;
}

export interface ExtractBeaconRef {
  id: string;
  ring: THREE.Mesh;
  beam: THREE.Mesh;
}

export interface MapSceneBuildResult {
  radarDishMesh: THREE.Object3D | null;
  extractRings: THREE.Mesh[];
  extractBeacons: ExtractBeaconRef[];
  animatedProps: AnimatedMapProp[];
  weatherSurfaces: WeatherSurfaceRef[];
}

function to3DX(x2d: number): number {
  return x2d * WORLD_SCALE;
}

function to3DZ(y2d: number): number {
  return y2d * WORLD_SCALE;
}

function createRng(seed: number) {
  let s = (seed | 0) || 1337;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function isPointInsideRect(
  px: number,
  pz: number,
  rx: number,
  rz: number,
  rw: number,
  rd: number,
  margin: number
): boolean {
  return (
    px >= rx - margin &&
    px <= rx + rw + margin &&
    pz >= rz - margin &&
    pz <= rz + rd + margin
  );
}

function createGrassTuftGeometry(): THREE.BufferGeometry {
  // 3 crossed curved tapered blades in one single draw-efficient BufferGeometry with vertexColors
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const bladeCount = 3;

  for (let b = 0; b < bladeCount; b++) {
    const yaw = (b / bladeCount) * Math.PI + (b === 1 ? 0.25 : -0.15);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const bend = (b % 2 === 0 ? 1 : -1) * 0.14;
    const h = 0.42 + (b % 2) * 0.1;
    const wBase = 0.085;
    const wMid = 0.05;

    const pushVert = (lx: number, ly: number, lz: number, r: number, g: number, bl: number) => {
      positions.push(lx * cosY - lz * sinY, ly, lx * sinY + lz * cosY);
      normals.push(0, 0.85, 0.5);
      colors.push(r, g, bl);
    };

    // Lower quad (2 triangles)
    pushVert(-wBase, 0, 0, 0.35, 0.42, 0.28);
    pushVert(wBase, 0, 0, 0.35, 0.42, 0.28);
    pushVert(wMid, h * 0.55, bend * 0.35, 0.68, 0.78, 0.52);

    pushVert(-wBase, 0, 0, 0.35, 0.42, 0.28);
    pushVert(wMid, h * 0.55, bend * 0.35, 0.68, 0.78, 0.52);
    pushVert(-wMid, h * 0.55, bend * 0.35, 0.68, 0.78, 0.52);

    // Upper tip triangle
    pushVert(-wMid, h * 0.55, bend * 0.35, 0.68, 0.78, 0.52);
    pushVert(wMid, h * 0.55, bend * 0.35, 0.68, 0.78, 0.52);
    pushVert(0, h, bend, 0.96, 1.0, 0.76);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildMultiPartBuilding(
  obs: MapObstacle,
  mapDef: MapDef,
  facadeTex: THREE.CanvasTexture,
  roofMats: Record<'pitched' | 'flat' | 'dome' | 'industrial', THREE.MeshStandardMaterial>,
  trimMat: THREE.MeshStandardMaterial,
  windowLitMat: THREE.MeshStandardMaterial,
  windowDarkMat: THREE.MeshStandardMaterial,
  doorWoodMat: THREE.MeshStandardMaterial,
  hvacMat: THREE.MeshStandardMaterial
): THREE.Group {
  const grp = new THREE.Group();
  const cx = to3DX(obs.x + obs.w / 2);
  const cz = to3DZ(obs.y + obs.h / 2);
  const ow = obs.w * WORLD_SCALE;
  const od = obs.h * WORLD_SCALE;
  const oh = obs.height || 4.0;
  const roofStyle = obs.roofStyle || 'flat';
  const isDesert = mapDef.theme.groundStyle === 'desert_city';
  const isValley = mapDef.theme.groundStyle === 'valley_forest';
  const isSpace = mapDef.theme.groundStyle === 'space_tarmac';

  grp.position.set(cx, 0, cz);

  // 1. Stone / Concrete Foundation Plinth
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(ow + 0.16, 0.32, od + 0.16),
    trimMat
  );
  plinth.position.y = 0.16;
  plinth.receiveShadow = true;
  grp.add(plinth);

  // 2. Main Structural Body
  const wallMat = new THREE.MeshStandardMaterial({
    map: facadeTex,
    color: obs.color || mapDef.theme.wallColor,
    roughness: isSpace ? 0.45 : isDesert ? 0.88 : 0.76,
    metalness: isSpace ? 0.36 : 0.08,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(ow, oh, od), wallMat);
  body.position.y = oh / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  grp.add(body);

  // 3. Recessed Doors & Windows along front/back/side facades
  const winCountX = Math.max(2, Math.floor(ow / 3.4));
  const winW = Math.min(1.05, ow / (winCountX * 2.1));
  const winH = Math.min(1.15, oh * 0.3);
  const winY = oh * 0.56;
  const hashSeed = obs.id.charCodeAt(obs.id.length - 1) + Math.round(obs.x);

  for (let i = 0; i < winCountX; i++) {
    const wx = -ow * 0.36 + (winCountX === 1 ? ow * 0.36 : (i / (winCountX - 1)) * (ow * 0.72));
    const lit = (i + hashSeed) % 3 !== 0;
    const wMat = lit ? windowLitMat : windowDarkMat;
    // South (+Z) facade windows
    const wf = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.08), wMat);
    wf.position.set(wx, winY, od / 2 + 0.02);
    grp.add(wf);
    // North (-Z) facade windows
    const wb = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.08), wMat);
    wb.position.set(wx, winY, -od / 2 - 0.02);
    grp.add(wb);
  }

  // Front entrance door + canopy awning (positioned above 2.6m so players never clip overhang)
  const doorW = 1.25;
  const doorH = Math.min(2.25, oh * 0.62);
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.1), doorWoodMat);
  door.position.set(0, doorH / 2 + 0.16, od / 2 + 0.03);
  grp.add(door);

  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(doorW + 1.1, 0.14, 0.85),
    roofStyle === 'pitched' ? roofMats.pitched : trimMat
  );
  awning.position.set(0, Math.max(2.55, doorH + 0.25), od / 2 + 0.42);
  awning.castShadow = true;
  grp.add(awning);

  // 4. Biome-Specific Roof Architecture
  if (roofStyle === 'pitched') {
    // Authentic pitched gable/hip roof for Layali cottages & villas!
    const roofH = Math.min(2.4, Math.max(1.3, Math.min(ow, od) * 0.24));
    const rLen = Math.max(ow, od) + 0.75;
    const rSpan = Math.min(ow, od) + 0.85;
    const ridgeAlongX = ow >= od;

    // Gable triangular prism built via ExtrudeGeometry or 2 tilted roof slopes + gable caps
    const halfSpan = rSpan / 2;
    const slopeHyp = Math.hypot(halfSpan, roofH);
    const slopeAngle = Math.atan2(roofH, halfSpan);

    const slopeGroup = new THREE.Group();
    slopeGroup.position.y = oh;
    if (!ridgeAlongX) slopeGroup.rotation.y = Math.PI / 2;

    const slopeA = new THREE.Mesh(
      new THREE.BoxGeometry(rLen, 0.18, slopeHyp + 0.15),
      roofMats.pitched
    );
    slopeA.position.set(0, roofH / 2, -halfSpan / 2);
    slopeA.rotation.x = slopeAngle;
    slopeA.castShadow = true;
    slopeA.receiveShadow = true;

    const slopeB = new THREE.Mesh(
      new THREE.BoxGeometry(rLen, 0.18, slopeHyp + 0.15),
      roofMats.pitched
    );
    slopeB.position.set(0, roofH / 2, halfSpan / 2);
    slopeB.rotation.x = -slopeAngle;
    slopeB.castShadow = true;
    slopeB.receiveShadow = true;

    const ridgeCap = new THREE.Mesh(
      new THREE.BoxGeometry(rLen + 0.1, 0.22, 0.28),
      trimMat
    );
    ridgeCap.position.set(0, roofH + 0.04, 0);

    // Gable wall filler beam
    const gableBeam = new THREE.Mesh(
      new THREE.BoxGeometry(rLen - 0.6, roofH * 0.75, rSpan * 0.55),
      wallMat
    );
    gableBeam.position.set(0, roofH * 0.36, 0);

    // Brick chimney
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, roofH + 0.9, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x6c3d32, roughness: 0.9 })
    );
    chimney.position.set(rLen * 0.24, roofH * 0.72, -halfSpan * 0.28);
    chimney.castShadow = true;

    slopeGroup.add(gableBeam, slopeA, slopeB, ridgeCap, chimney);
    grp.add(slopeGroup);
  } else if (roofStyle === 'dome') {
    // Sandstone parapet + dome cupola (Brakkesh) or cleanroom geodesic dome (Space City)
    const parapetH = 0.45;
    const pThick = 0.28;
    const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(ow + 0.1, 0.18, od + 0.1), roofMats.dome);
    roofSlab.position.y = oh + 0.08;
    roofSlab.receiveShadow = true;
    grp.add(roofSlab);

    const pN = new THREE.Mesh(new THREE.BoxGeometry(ow + 0.16, parapetH, pThick), trimMat);
    pN.position.set(0, oh + parapetH / 2, -od / 2);
    const pS = pN.clone();
    pS.position.z = od / 2;
    const pW = new THREE.Mesh(new THREE.BoxGeometry(pThick, parapetH, od + 0.16), trimMat);
    pW.position.set(-ow / 2, oh + parapetH / 2, 0);
    const pE = pW.clone();
    pE.position.x = ow / 2;
    grp.add(pN, pS, pW, pE);

    const domeRad = Math.min(ow, od) * 0.28;
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(domeRad * 1.06, domeRad * 1.1, 0.55, 16),
      trimMat
    );
    drum.position.y = oh + 0.35;
    const domeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(domeRad, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      isSpace
        ? new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.22, metalness: 0.72 })
        : roofMats.dome
    );
    domeMesh.position.y = oh + 0.58;
    domeMesh.castShadow = true;
    grp.add(drum, domeMesh);

    if (isDesert) {
      // Protruding wooden roof vigas beams typical of Brakkesh adobe architecture
      for (let vx = -ow * 0.35; vx <= ow * 0.35; vx += 1.6) {
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, od + 0.7, 6),
          doorWoodMat
        );
        beam.rotation.x = Math.PI / 2;
        beam.position.set(vx, oh - 0.38, 0);
        grp.add(beam);
      }
    }
  } else if (roofStyle === 'industrial') {
    // Industrial corrugated roof + rooftop HVAC units & vents + hazard edge trim
    const roofDeck = new THREE.Mesh(
      new THREE.BoxGeometry(ow + 0.24, 0.24, od + 0.24),
      roofMats.industrial
    );
    roofDeck.position.y = oh + 0.12;
    roofDeck.castShadow = true;
    roofDeck.receiveShadow = true;
    grp.add(roofDeck);

    // Rooftop HVAC unit + exhaust fan duct
    const hvac = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(2.2, ow * 0.24), 0.75, Math.min(1.8, od * 0.24)),
      hvacMat
    );
    hvac.position.set(-ow * 0.2, oh + 0.58, -od * 0.15);
    hvac.castShadow = true;
    const fanHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.58, 0.45, 12),
      trimMat
    );
    fanHousing.position.set(ow * 0.22, oh + 0.42, od * 0.18);
    grp.add(hvac, fanHousing);

    if (isSpace) {
      const ledTrim = new THREE.Mesh(
        new THREE.BoxGeometry(ow + 0.28, 0.1, od + 0.28),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.9,
        })
      );
      ledTrim.position.y = oh + 0.24;
      grp.add(ledTrim);
    }
  } else {
    // Flat parapet roof (Zero Dam admin / Space CEO wing / Brakkesh flat houses)
    const roofDeck = new THREE.Mesh(
      new THREE.BoxGeometry(ow + 0.14, 0.18, od + 0.14),
      roofMats.flat
    );
    roofDeck.position.y = oh + 0.08;
    roofDeck.receiveShadow = true;
    grp.add(roofDeck);

    const parapetH = 0.42;
    const pN = new THREE.Mesh(new THREE.BoxGeometry(ow + 0.2, parapetH, 0.26), trimMat);
    pN.position.set(0, oh + parapetH / 2, -od / 2);
    const pS = pN.clone();
    pS.position.z = od / 2;
    const pW = new THREE.Mesh(new THREE.BoxGeometry(0.26, parapetH, od + 0.2), trimMat);
    pW.position.set(-ow / 2, oh + parapetH / 2, 0);
    const pE = pW.clone();
    pE.position.x = ow / 2;
    grp.add(pN, pS, pW, pE);

    // Rooftop utility box or water tank
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 1.0, 12),
      hvacMat
    );
    tank.position.set(ow * 0.22, oh + 0.65, -od * 0.18);
    grp.add(tank);

    if (isDesert) {
      for (let vx = -ow * 0.35; vx <= ow * 0.35; vx += 1.7) {
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.075, 0.075, od + 0.65, 6),
          doorWoodMat
        );
        beam.rotation.x = Math.PI / 2;
        beam.position.set(vx, oh - 0.36, 0);
        grp.add(beam);
      }
    }
  }

  return grp;
}

export function buildMapScene3D(
  scene: THREE.Scene,
  mapDef: MapDef,
  maxAnisotropy: number
): MapSceneBuildResult {
  const w3d = WORLD_WIDTH * WORLD_SCALE; // 220m
  const h3d = WORLD_HEIGHT * WORLD_SCALE; // 160m
  const theme = mapDef.theme;
  const extractRings: THREE.Mesh[] = [];
  const extractBeacons: ExtractBeaconRef[] = [];
  const animatedProps: AnimatedMapProp[] = [];
  const weatherSurfaces: WeatherSurfaceRef[] = [];
  let radarDishMesh: THREE.Object3D | null = null;

  // 1. Extended Surrounding Horizon Terrain
  const outerTerrainMat = new THREE.MeshStandardMaterial({
    color: theme.outerTerrainColor,
    roughness: 0.95,
    metalness: 0.04,
  });
  weatherSurfaces.push({
    mat: outerTerrainMat,
    baseColor: outerTerrainMat.color.clone(),
    baseRoughness: 0.95,
    baseMetalness: 0.04,
  });
  const outerTerrain = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 480),
    outerTerrainMat
  );
  outerTerrain.rotation.x = -Math.PI / 2;
  outerTerrain.position.set(w3d / 2, -0.05, h3d / 2);
  outerTerrain.receiveShadow = true;
  scene.add(outerTerrain);

  // 2. Main Playable Biome Ground
  const floorTex = createMapGroundTexture(theme.groundStyle, maxAnisotropy);
  const floorRough = theme.groundStyle === 'desert_city' ? 0.92 : 0.86;
  const floorMetal = theme.groundStyle === 'space_tarmac' ? 0.16 : 0.05;
  const arenaFloorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: floorRough,
    metalness: floorMetal,
  });
  weatherSurfaces.push({
    mat: arenaFloorMat,
    baseColor: arenaFloorMat.color.clone(),
    baseRoughness: floorRough,
    baseMetalness: floorMetal,
  });
  const arenaFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(w3d, h3d),
    arenaFloorMat
  );
  arenaFloor.rotation.x = -Math.PI / 2;
  arenaFloor.position.set(w3d / 2, 0, h3d / 2);
  arenaFloor.receiveShadow = true;
  scene.add(arenaFloor);

  // 3. Tactical Zone Ground Plates
  for (const z of mapDef.zones) {
    const zMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(z.w * WORLD_SCALE, z.h * WORLD_SCALE),
      new THREE.MeshStandardMaterial({
        color: z.color,
        roughness: 0.88,
        metalness: theme.groundStyle === 'space_tarmac' ? 0.18 : 0.07,
        transparent: true,
        opacity: theme.groundStyle === 'valley_forest' ? 0.34 : 0.65,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    zMesh.rotation.x = -Math.PI / 2;
    zMesh.position.set(to3DX(z.x + z.w / 2), 0.014, to3DZ(z.y + z.h / 2));
    zMesh.receiveShadow = true;
    scene.add(zMesh);
  }

  // 4. Roads & Avenues (with dashed lane markings where enabled)
  if (mapDef.roads) {
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.55 });
    for (const r of mapDef.roads) {
      const rw = r.w * WORLD_SCALE;
      const rd = r.h * WORLD_SCALE;
      const rTex = createRoadTexture(theme.groundStyle, r.color || '#28303d', maxAnisotropy);
      const roadMat = new THREE.MeshStandardMaterial({
        map: rTex,
        roughness: 0.85,
        metalness: 0.06,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      weatherSurfaces.push({
        mat: roadMat,
        baseColor: roadMat.color.clone(),
        baseRoughness: 0.85,
        baseMetalness: 0.06,
      });
      const roadMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(rw, rd),
        roadMat
      );
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.position.set(to3DX(r.x + r.w / 2), 0.022, to3DZ(r.y + r.h / 2));
      roadMesh.receiveShadow = true;
      scene.add(roadMesh);

      if (r.dashed) {
        const horiz = rw >= rd;
        const len = horiz ? rw : rd;
        const cx = to3DX(r.x + r.w / 2);
        const cz = to3DZ(r.y + r.h / 2);
        const step = 4.2;
        for (let d = -len / 2 + 2; d < len / 2 - 2; d += step) {
          const dash = new THREE.Mesh(
            new THREE.PlaneGeometry(horiz ? 2.1 : 0.18, horiz ? 0.18 : 2.1),
            dashMat
          );
          dash.rotation.x = -Math.PI / 2;
          dash.position.set(horiz ? cx + d : cx, 0.028, horiz ? cz : cz + d);
          scene.add(dash);
        }
      }
    }
  }

  // 5. Water Bodies (Rivers, Oasis Pools, Canals)
  if (mapDef.waterBodies) {
    for (const wb of mapDef.waterBodies) {
      const ww = wb.w * WORLD_SCALE;
      const wd = wb.h * WORLD_SCALE;
      const waterMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(ww, wd),
        new THREE.MeshStandardMaterial({
          color: wb.color ?? 0x0e5868,
          roughness: 0.11,
          metalness: 0.78,
          emissive: 0x042935,
          emissiveIntensity: 0.35,
        })
      );
      waterMesh.rotation.x = -Math.PI / 2;
      waterMesh.position.set(to3DX(wb.x + wb.w / 2), 0.036, to3DZ(wb.y + wb.h / 2));
      waterMesh.receiveShadow = true;
      scene.add(waterMesh);
    }
  }

  // 6. Perimeter Rock Ridges / Dunes / Blast Berms
  const rockMat = new THREE.MeshStandardMaterial({
    color:
      theme.groundStyle === 'desert_city'
        ? 0x8a6740
        : theme.groundStyle === 'valley_forest'
          ? 0x3b4836
          : 0x1e293b,
    roughness: 0.92,
    flatShading: true,
  });
  const rockGeo = new THREE.DodecahedronGeometry(3.4, 0);
  const perimeterRocks: Array<[number, number, number]> = [];
  const rngPerim = createRng(9123);
  for (let x = -4; x <= w3d + 4; x += 6.8) {
    perimeterRocks.push([x, -3.8, 0.85 + rngPerim() * 0.75]);
    perimeterRocks.push([x, h3d + 3.8, 0.85 + rngPerim() * 0.75]);
  }
  for (let z = 0; z <= h3d; z += 6.8) {
    perimeterRocks.push([-3.8, z, 0.85 + rngPerim() * 0.75]);
    perimeterRocks.push([w3d + 3.8, z, 0.85 + rngPerim() * 0.75]);
  }
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, perimeterRocks.length);
  const rockDummy = new THREE.Object3D();
  perimeterRocks.forEach(([rx, rz, sc], idx) => {
    rockDummy.position.set(rx, 0.85 * sc, rz);
    rockDummy.rotation.set(rngPerim(), rngPerim(), rngPerim());
    rockDummy.scale.set(sc * 1.5, sc * 0.95, sc * 1.4);
    rockDummy.updateMatrix();
    rockInst.setMatrixAt(idx, rockDummy.matrix);
  });
  rockInst.computeBoundingSphere();
  scene.add(rockInst);

  // 7. Shared Materials for Buildings, Walls, Containers & Props
  const facadeTex = createBuildingFacadeTexture(theme.groundStyle, maxAnisotropy);
  const wallMat = new THREE.MeshStandardMaterial({
    map: facadeTex,
    color: theme.wallColor,
    roughness: 0.78,
    metalness: theme.groundStyle === 'space_tarmac' ? 0.28 : 0.1,
  });
  const pillarMat = new THREE.MeshStandardMaterial({
    color: theme.pillarColor,
    roughness: 0.55,
    metalness: theme.groundStyle === 'desert_city' ? 0.12 : 0.45,
  });
  const crateMat = new THREE.MeshStandardMaterial({
    color: theme.crateColor,
    roughness: 0.76,
    metalness: 0.12,
  });
  const sandbagMat = new THREE.MeshStandardMaterial({
    color: theme.groundStyle === 'desert_city' ? 0xa38964 : 0x78716c,
    roughness: 0.92,
    metalness: 0.02,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: theme.groundStyle === 'desert_city' ? 0x8b6c4a : theme.groundStyle === 'valley_forest' ? 0x4b4238 : 0x475569,
    roughness: 0.72,
    metalness: 0.2,
  });
  const windowLitMat = new THREE.MeshStandardMaterial({
    color: theme.groundStyle === 'space_tarmac' ? 0x38bdf8 : 0xfef08a,
    emissive: theme.groundStyle === 'space_tarmac' ? 0x0284c7 : 0xf59e0b,
    emissiveIntensity: 0.65,
    roughness: 0.2,
  });
  const windowDarkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.2,
    metalness: 0.65,
  });
  const doorWoodMat = new THREE.MeshStandardMaterial({ color: 0x4b3624, roughness: 0.85 });
  const hvacMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.55 });

  const roofMats: Record<'pitched' | 'flat' | 'dome' | 'industrial', THREE.MeshStandardMaterial> = {
    pitched: new THREE.MeshStandardMaterial({
      map: createRoofTileTexture('pitched', theme.groundStyle, maxAnisotropy),
      roughness: 0.78,
      metalness: 0.08,
    }),
    flat: new THREE.MeshStandardMaterial({
      map: createRoofTileTexture('flat', theme.groundStyle, maxAnisotropy),
      roughness: 0.8,
      metalness: 0.15,
    }),
    dome: new THREE.MeshStandardMaterial({
      map: createRoofTileTexture('dome', theme.groundStyle, maxAnisotropy),
      roughness: 0.76,
      metalness: 0.14,
    }),
    industrial: new THREE.MeshStandardMaterial({
      map: createRoofTileTexture('industrial', theme.groundStyle, maxAnisotropy),
      roughness: 0.62,
      metalness: 0.45,
    }),
  };

  // 8. Build All Obstacles & Multi-Part 3D Houses
  for (const obs of mapDef.obstacles) {
    if (obs.id.startsWith('riv_')) continue;

    const ow = obs.w * WORLD_SCALE;
    const od = obs.h * WORLD_SCALE;
    const oh = obs.height || 3.4;

    if (obs.kind === 'building') {
      const bld = buildMultiPartBuilding(
        obs,
        mapDef,
        facadeTex,
        roofMats,
        trimMat,
        windowLitMat,
        windowDarkMat,
        doorWoodMat,
        hvacMat
      );
      scene.add(bld);
      continue;
    }

    let mat: THREE.Material = wallMat;
    if (obs.kind === 'container') {
      mat = new THREE.MeshStandardMaterial({
        map: createCorrugatedTexture(obs.color || '#7F1D1D', maxAnisotropy),
        roughness: 0.48,
        metalness: 0.45,
      });
    } else if (obs.kind === 'pillar') {
      mat = obs.color
        ? new THREE.MeshStandardMaterial({ color: obs.color, roughness: 0.5, metalness: 0.45 })
        : pillarMat;
    } else if (obs.kind === 'crate') {
      mat = crateMat;
    } else if (obs.kind === 'sandbag') {
      mat = sandbagMat;
    }

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(ow, oh, od), mat);
    mesh.position.set(to3DX(obs.x + obs.w / 2), oh / 2, to3DZ(obs.y + obs.h / 2));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Architectural roof cornice / eaves along tall CQB perimeter walls
    if (obs.kind === 'wall' && oh >= 3.4) {
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(ow + 0.24, 0.24, od + 0.24),
        trimMat
      );
      cap.position.set(to3DX(obs.x + obs.w / 2), oh + 0.1, to3DZ(obs.y + obs.h / 2));
      cap.castShadow = true;
      scene.add(cap);
    }
  }

  // 9. Biome Grass Tufts & Trees (InstancedMesh)
  buildBiomeGrassAndFlora(scene, mapDef, w3d, h3d);

  // 10. Signature Map Landmarks (Iconic & Distinct per Map)
  const landmarkRes = buildSignatureLandmarks(scene, mapDef, w3d, maxAnisotropy);
  radarDishMesh = landmarkRes.radarDishMesh;
  animatedProps.push(...landmarkRes.animatedProps);

  // 11. Tactical Streetlamps / Floodlight Masts
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: mapDef.id === 'brakkesh' ? 0xfbbf24 : mapDef.id === 'space_city' ? 0x7dd3fc : 0xfef08a,
    emissive: mapDef.id === 'brakkesh' ? 0xf59e0b : mapDef.id === 'space_city' ? 0x38bdf8 : 0xfde047,
    emissiveIntensity: 1.5,
  });
  const lampSpots: Array<[number, number]> = [
    [34, 92],
    [72, 86],
    [130, 86],
    [182, 86],
    [72, 40],
    [156, 40],
    [110, 132],
    [176, 132],
  ];
  for (const [lx, lz] of lampSpots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 6.4, 8), poleMat);
    pole.position.set(lx, 3.2, lz);
    pole.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.26, 0.48), lampMat);
    head.position.set(lx, 6.4, lz);
    scene.add(pole, head);
  }

  // 12. Extraction Zones + Helipads + Light Beacons
  const helipadTex = createHelipadTexture(maxAnisotropy);
  for (const ext of mapDef.extractions) {
    const ex = to3DX(ext.x);
    const ez = to3DZ(ext.y);
    const rad = ext.radius * WORLD_SCALE;

    if (ext.id.includes('heli') || ext.id.includes('helipad')) {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(rad * 2.1, rad * 2.1),
        new THREE.MeshStandardMaterial({
          map: helipadTex,
          transparent: true,
          roughness: 0.7,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(ex, 0.032, ez);
      scene.add(pad);
    }

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.68,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(rad - 0.35, rad, 36), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(ex, 0.055, ez);
    scene.add(ring);
    extractRings.push(ring);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.55, 16, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.set(ex, 8, ez);
    scene.add(beam);
    extractBeacons.push({ id: ext.id, ring, beam });
  }

  return { radarDishMesh, extractRings, extractBeacons, animatedProps, weatherSurfaces };
}

function buildBiomeGrassAndFlora(
  scene: THREE.Scene,
  mapDef: MapDef,
  w3d: number,
  h3d: number
) {
  const mapId = mapDef.id;
  const rng = createRng(mapId === 'layali_grove' ? 404 : mapId === 'brakkesh' ? 505 : mapId === 'space_city' ? 606 : 707);

  const targetCount =
    mapId === 'layali_grove'
      ? 2300
      : mapId === 'zero_dam'
        ? 900
        : mapId === 'brakkesh'
          ? 600
          : 380;

  const isClearForFlora = (x3: number, z3: number, obsPad: number, roadPad = 0.6): boolean => {
    for (const obs of mapDef.obstacles) {
      if (
        isPointInsideRect(
          x3,
          z3,
          obs.x * WORLD_SCALE,
          obs.y * WORLD_SCALE,
          obs.w * WORLD_SCALE,
          obs.h * WORLD_SCALE,
          obsPad
        )
      ) {
        return false;
      }
    }
    if (mapDef.roads) {
      for (const r of mapDef.roads) {
        if (
          isPointInsideRect(
            x3,
            z3,
            r.x * WORLD_SCALE,
            r.y * WORLD_SCALE,
            r.w * WORLD_SCALE,
            r.h * WORLD_SCALE,
            roadPad
          )
        ) {
          return false;
        }
      }
    }
    if (mapDef.waterBodies) {
      for (const wb of mapDef.waterBodies) {
        if (
          isPointInsideRect(
            x3,
            z3,
            wb.x * WORLD_SCALE,
            wb.y * WORLD_SCALE,
            wb.w * WORLD_SCALE,
            wb.h * WORLD_SCALE,
            0.35
          )
        ) {
          return false;
        }
      }
    }
    return true;
  };

  // Instanced Grass Tufts
  const grassGeo = createGrassTuftGeometry();
  const grassMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const placements: Array<{ x: number; z: number; sc: number; yaw: number; color: THREE.Color }> = [];
  const palette =
    mapId === 'layali_grove'
      ? [new THREE.Color(0x3b6e34), new THREE.Color(0x4b7f3c), new THREE.Color(0x6c8738), new THREE.Color(0x2d5a2b)]
      : mapId === 'brakkesh'
        ? [new THREE.Color(0x8c7b42), new THREE.Color(0x526b36), new THREE.Color(0xa68c4c)]
        : mapId === 'space_city'
          ? [new THREE.Color(0x214834), new THREE.Color(0x2b583f)]
          : [new THREE.Color(0x3f5734), new THREE.Color(0x5b643b), new THREE.Color(0x2e4229)];

  let attempts = 0;
  while (placements.length < targetCount && attempts < targetCount * 6) {
    attempts++;
    const x3 = 1.5 + rng() * (w3d - 3);
    const z3 = 1.5 + rng() * (h3d - 3);

    // On Brakkesh, bias grass tightly around the oasis/canal or near buildings
    if (mapId === 'brakkesh') {
      const nearOasis = x3 > 138 && x3 < 205 && z3 > 94 && z3 < 152;
      if (!nearOasis && rng() > 0.28) continue;
    }
    // On Space City, place manicured dark lawn clusters near perimeter & plaza edges
    if (mapId === 'space_city') {
      const nearBorder = x3 < 16 || x3 > w3d - 16 || z3 < 14 || z3 > h3d - 14;
      if (!nearBorder && rng() > 0.25) continue;
    }

    if (!isClearForFlora(x3, z3, 0.65, 0.35)) continue;
    const baseCol = palette[Math.floor(rng() * palette.length)].clone();
    if (mapId === 'brakkesh' && x3 > 142 && x3 < 192 && z3 > 100 && z3 < 142) {
      baseCol.setHex(0x3c7d3c); // Lush oasis green around water
    }
    placements.push({
      x: x3,
      z: z3,
      sc: 0.75 + rng() * 0.78,
      yaw: rng() * Math.PI * 2,
      color: baseCol,
    });
  }

  if (placements.length > 0) {
    const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, placements.length);
    const d = new THREE.Object3D();
    placements.forEach((p, idx) => {
      d.position.set(p.x, 0, p.z);
      d.rotation.set(0, p.yaw, 0);
      d.scale.set(p.sc, p.sc * (0.9 + (idx % 3) * 0.15), p.sc);
      d.updateMatrix();
      grassInst.setMatrixAt(idx, d.matrix);
      grassInst.setColorAt(idx, p.color);
    });
    grassInst.instanceMatrix.needsUpdate = true;
    if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
    grassInst.computeBoundingSphere();
    scene.add(grassInst);
  }

  // Instanced Multi-Tiered Pine Forest on Layali Grove & Scrub Pines on Zero Dam
  if (mapId === 'layali_grove' || mapId === 'zero_dam') {
    const treeCount = mapId === 'layali_grove' ? 105 : 28;
    const treeCoords: Array<{ x: number; z: number; sc: number }> = [];
    let tAttempts = 0;
    while (treeCoords.length < treeCount && tAttempts < treeCount * 10) {
      tAttempts++;
      const tx = rng() < 0.28 ? (rng() < 0.5 ? -8 - rng() * 14 : w3d + 8 + rng() * 14) : 4 + rng() * (w3d - 8);
      const tz = rng() < 0.22 ? (rng() < 0.5 ? -8 - rng() * 12 : h3d + 8 + rng() * 12) : 4 + rng() * (h3d - 8);
      if (tx > 0 && tx < w3d && tz > 0 && tz < h3d && !isClearForFlora(tx, tz, 2.2, 1.5)) continue;
      // Avoid spawn, containers, and extractions
      if (Math.hypot(tx - to3DX(mapDef.spawnPoint.x), tz - to3DZ(mapDef.spawnPoint.y)) < 6) continue;
      if (mapDef.extractions.some((ex) => Math.hypot(tx - to3DX(ex.x), tz - to3DZ(ex.y)) < 6.5)) continue;
      treeCoords.push({ x: tx, z: tz, sc: 0.85 + rng() * 0.6 });
    }

    if (treeCoords.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 2.4, 7);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.92 });
      const tier1Geo = new THREE.ConeGeometry(1.85, 2.4, 8);
      const tier2Geo = new THREE.ConeGeometry(1.42, 2.1, 8);
      const tier3Geo = new THREE.ConeGeometry(0.95, 1.8, 8);
      const foliageMat = new THREE.MeshStandardMaterial({
        color: mapId === 'layali_grove' ? 0x1e5128 : 0x2a4228,
        roughness: 0.85,
        flatShading: true,
      });

      const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCoords.length);
      const t1Inst = new THREE.InstancedMesh(tier1Geo, foliageMat, treeCoords.length);
      const t2Inst = new THREE.InstancedMesh(tier2Geo, foliageMat, treeCoords.length);
      const t3Inst = new THREE.InstancedMesh(tier3Geo, foliageMat, treeCoords.length);
      t1Inst.castShadow = true;
      t2Inst.castShadow = true;
      t3Inst.castShadow = true;

      const td = new THREE.Object3D();
      treeCoords.forEach((tc, idx) => {
        const s = tc.sc;
        td.rotation.set(0, idx * 0.7, 0);
        td.scale.setScalar(s);

        td.position.set(tc.x, 1.2 * s, tc.z);
        td.updateMatrix();
        trunkInst.setMatrixAt(idx, td.matrix);

        td.position.set(tc.x, 2.7 * s, tc.z);
        td.updateMatrix();
        t1Inst.setMatrixAt(idx, td.matrix);

        td.position.set(tc.x, 4.1 * s, tc.z);
        td.updateMatrix();
        t2Inst.setMatrixAt(idx, td.matrix);

        td.position.set(tc.x, 5.35 * s, tc.z);
        td.updateMatrix();
        t3Inst.setMatrixAt(idx, td.matrix);
      });
      trunkInst.computeBoundingSphere();
      t1Inst.computeBoundingSphere();
      t2Inst.computeBoundingSphere();
      t3Inst.computeBoundingSphere();
      scene.add(trunkInst, t1Inst, t2Inst, t3Inst);
    }
  }
}

function buildSignatureLandmarks(
  scene: THREE.Scene,
  mapDef: MapDef,
  w3d: number,
  maxAnisotropy: number
): { radarDishMesh: THREE.Object3D | null; animatedProps: AnimatedMapProp[] } {
  const mapId = mapDef.id;
  const animatedProps: AnimatedMapProp[] = [];
  let radarDishMesh: THREE.Object3D | null = null;

  if (mapId === 'zero_dam') {
    // 1. Massive Northern Concrete Gravity Dam (260m wide, sloped spillway + buttresses + turbine towers)
    const damMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.82,
      metalness: 0.18,
    });
    const darkConcrete = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.86 });
    const damWall = new THREE.Mesh(new THREE.BoxGeometry(w3d + 40, 17, 9), damMat);
    damWall.position.set(w3d / 2, 8.5, -7.5);
    damWall.receiveShadow = true;
    scene.add(damWall);

    // Sloped spillway apron & 6 vertical concrete buttress piers
    for (let px = 14; px <= w3d - 10; px += 38) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(4.5, 18.2, 12.5), darkConcrete);
      pier.position.set(px, 9.1, -6.5);
      pier.castShadow = true;
      scene.add(pier);

      const gateHouse = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.2, 5.6), damMat);
      gateHouse.position.set(px, 18.6, -7.5);
      scene.add(gateHouse);
    }

    // Spillway discharge water pool right beneath the dam wall
    const hydroPool = new THREE.Mesh(
      new THREE.PlaneGeometry(w3d + 40, 14),
      new THREE.MeshStandardMaterial({ color: 0x0b344a, roughness: 0.12, metalness: 0.8 })
    );
    hydroPool.rotation.x = -Math.PI / 2;
    hydroPool.position.set(w3d / 2, 0.05, -18);
    scene.add(hydroPool);

    // 2. Cement Plant Silo Conical Tops & Overhead Steel Conveyor Catwalk
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.45, metalness: 0.6 });
    const siloCenters = [101.25, 111.25, 121.25];
    for (const sx of siloCenters) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.2, 16), steelMat);
      cap.position.set(sx, 8.6, 111.25);
      scene.add(cap);
    }
    const catwalk = new THREE.Mesh(new THREE.BoxGeometry(28, 0.9, 2.2), steelMat);
    catwalk.position.set(114, 7.9, 111.25);
    scene.add(catwalk);

    // 3. Substation High-Voltage Transmission Pylon + Cooling Fins
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.65, roughness: 0.4 });
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.35, 13, 4), pylonMat);
    pylon.position.set(33.25, 6.5, 25);
    const crossArm = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.35, 0.45), pylonMat);
    crossArm.position.set(33.25, 11.2, 25);
    scene.add(pylon, crossArm);

    // 4. Yellow Gantry Cranes over Container Yard & Admin Lane
    const craneMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45, metalness: 0.55 });
    [
      [164, 136],
      [108, 76],
    ].forEach(([gx, gz]) => {
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 12.5, 0.85), craneMat);
      leg1.position.set(gx - 9, 6.25, gz);
      const leg2 = leg1.clone();
      leg2.position.x = gx + 9;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(23, 1.2, 1.5), craneMat);
      beam.position.set(gx, 12.6, gz);
      const trolley = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 2.1), darkConcrete);
      trolley.position.set(gx + 2, 11.6, gz);
      scene.add(leg1, leg2, beam, trolley);
    });

    // 5. Armored Tunnel Portal at Southern Tunnel Extraction (4180, 2940 -> 209m, 147m)
    const portal = new THREE.Group();
    portal.position.set(209, 0, 152.5);
    const arch = new THREE.Mesh(new THREE.BoxGeometry(10, 5.2, 4.5), darkConcrete);
    arch.position.y = 2.6;
    const tunnelVoid = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 3.6, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x05070b })
    );
    tunnelVoid.position.set(0, 1.8, -2.15);
    const beacon = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.35, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 1.5 })
    );
    beacon.position.set(0, 4.6, -2.25);
    portal.add(arch, tunnelVoid, beacon);
    scene.add(portal);
  } else if (mapId === 'layali_grove') {
    // 1. 4 Distinct Tactical Bridges across the River (z = 74m..82m, center 78m)
    const woodDeck = new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 0.82 });
    const stoneBridgeMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.88 });
    const railSteel = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.48, metalness: 0.62 });

    const bridges = [
      { cx: 38.5, w: 10.2, style: 'stone' as const },
      { cx: 93.25, w: 10.6, style: 'wood' as const },
      { cx: 144.25, w: 10.6, style: 'truss' as const },
      { cx: 189.0, w: 10.2, style: 'wood' as const },
    ];
    for (const br of bridges) {
      const deckMat = br.style === 'stone' ? stoneBridgeMat : woodDeck;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(br.w, 0.45, 9.2), deckMat);
      deck.position.set(br.cx, 0.24, 78);
      deck.receiveShadow = true;
      const railL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.95, 9.2), br.style === 'stone' ? stoneBridgeMat : railSteel);
      railL.position.set(br.cx - br.w / 2 + 0.16, 0.72, 78);
      const railR = railL.clone();
      railR.position.x = br.cx + br.w / 2 - 0.16;
      scene.add(deck, railL, railR);

      if (br.style === 'truss') {
        // Overhead steel bridge truss arch
        const topCross = new THREE.Mesh(new THREE.BoxGeometry(br.w, 0.38, 0.45), railSteel);
        topCross.position.set(br.cx, 3.8, 78);
        const postL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 3.5, 0.45), railSteel);
        postL.position.set(br.cx - br.w / 2 + 0.2, 2.0, 78);
        const postR = postL.clone();
        postR.position.x = br.cx + br.w / 2 - 0.2;
        scene.add(topCross, postL, postR);
      }
    }

    // 2. Rotating Radar Dish atop North-West Radar Station (520..660, 740..880 -> center 29.5m, 40.5m)
    const dishPivot = new THREE.Group();
    dishPivot.position.set(29.5, 6.2, 40.5);
    const dishBowl = new THREE.Mesh(
      new THREE.ConeGeometry(2.5, 1.35, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide, metalness: 0.55, roughness: 0.35 })
    );
    dishBowl.rotation.x = Math.PI * 0.35;
    const feedHorn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 1.5, 8),
      railSteel
    );
    feedHorn.rotation.x = Math.PI * 0.35;
    feedHorn.position.set(0, 0.35, 0.6);
    dishPivot.add(dishBowl, feedHorn);
    scene.add(dishPivot);
    radarDishMesh = dishPivot;

    // 3. Diamond Empress Hotel Ornate Courtyard Fountain (center ~117.5m, 27m)
    const fountain = new THREE.Group();
    fountain.position.set(117.5, 0, 27);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.55, 20), stoneBridgeMat);
    rim.position.y = 0.28;
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(2.95, 2.95, 0.42, 20),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.15, metalness: 0.65 })
    );
    water.position.y = 0.34;
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.75, 2.2, 12), stoneBridgeMat);
    spire.position.y = 1.1;
    fountain.add(rim, water, spire);
    scene.add(fountain);

    // 4. Chaoxing Railway Tracks + Armored Freight Train (along northern rail corridor z=6.2m, x=166..218m)
    const ballast = new THREE.Mesh(
      new THREE.BoxGeometry(54, 0.14, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x3b3834, roughness: 0.95 })
    );
    ballast.position.set(193, 0.07, 6.2);
    const railA = new THREE.Mesh(new THREE.BoxGeometry(54, 0.12, 0.12), railSteel);
    railA.position.set(193, 0.18, 5.4);
    const railB = railA.clone();
    railB.position.z = 7.0;
    scene.add(ballast, railA, railB);

    const trainMat = new THREE.MeshStandardMaterial({
      map: createCorrugatedTexture('#1e3a2f', maxAnisotropy),
      roughness: 0.52,
      metalness: 0.45,
    });
    const loco = new THREE.Mesh(new THREE.BoxGeometry(10.5, 3.3, 2.7), trainMat);
    loco.position.set(184, 1.85, 6.2);
    loco.castShadow = true;
    const car1 = new THREE.Mesh(new THREE.BoxGeometry(11.5, 3.0, 2.65), trainMat);
    car1.position.set(196.5, 1.7, 6.2);
    car1.castShadow = true;
    const car2 = car1.clone();
    car2.position.x = 209;
    scene.add(loco, car1, car2);

    // 5. Lumber Yard Stacked Pine Logs near (145m, 114m)
    const logMat = new THREE.MeshStandardMaterial({ color: 0x6b4728, roughness: 0.9 });
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3 - r; c++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 4.6, 8), logMat);
        log.rotation.z = Math.PI / 2;
        log.position.set(145, 0.32 + r * 0.56, 112 + c * 0.68 + r * 0.34);
        scene.add(log);
      }
    }
  } else if (mapId === 'brakkesh') {
    // 1. Monumental Babel Tower Skyscraper overlooking Northern Courtyard (121.5m, 4.5m)
    const babelGroup = new THREE.Group();
    babelGroup.position.set(121.5, 0, 4.8);
    const sandstoneMat = new THREE.MeshStandardMaterial({ color: 0xb08b62, roughness: 0.72, metalness: 0.08 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.45,
      roughness: 0.16,
      metalness: 0.78,
    });
    const baseTier = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 6.2, 9.5, 8), sandstoneMat);
    baseTier.position.y = 4.75;
    baseTier.castShadow = true;
    const midTier = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.6, 11, 8), glassMat);
    midTier.position.y = 14.5;
    const crownTier = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 5.5, 8), sandstoneMat);
    crownTier.position.y = 22.5;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7.5, 8), glassMat);
    spire.position.y = 28.8;
    babelGroup.add(baseTier, midTier, crownTier, spire);
    scene.add(babelGroup);

    // 2. Colorful Bazaar Market Canopies draped over alleyways
    const awningColors = [0xb91c1c, 0xd97706, 0x0f766e, 0x1d4ed8, 0x9a3412];
    [
      [62, 102],
      [79, 102],
      [62, 125],
      [112, 102],
      [108, 128],
      [50, 114],
    ].forEach(([ax, az], idx) => {
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(6.2, 0.16, 4.2),
        new THREE.MeshStandardMaterial({ color: awningColors[idx % awningColors.length], roughness: 0.86 })
      );
      awning.position.set(ax, 3.4, az);
      awning.rotation.z = idx % 2 === 0 ? 0.07 : -0.07;
      awning.castShadow = true;
      scene.add(awning);
    });

    // 3. Date Palm Trees around Oasis & Canal
    const palmCoords: Array<[number, number]> = [
      [149, 108], [183, 109], [148, 129], [184, 130], [166, 132], [168, 107],
      [19, 130], [136, 145], [190, 50], [188, 70], [188, 18], [150, 88],
    ];
    const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4c2e, roughness: 0.92 });
    const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x2f7634, roughness: 0.78 });
    for (const [px, pz] of palmCoords) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 5.6, 7), palmTrunkMat);
      trunk.position.set(px, 2.8, pz);
      trunk.castShadow = true;
      scene.add(trunk);
      for (let k = 0; k < 6; k++) {
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.65), palmLeafMat);
        const a = (k / 6) * Math.PI * 2;
        leaf.position.set(px + Math.cos(a) * 1.25, 5.55, pz + Math.sin(a) * 1.25);
        leaf.rotation.y = -a;
        leaf.rotation.z = -0.28;
        scene.add(leaf);
      }
    }

    // 4. Northeast Canal Quay & Moored Patrol Boat (199m, 42m)
    const boatGroup = new THREE.Group();
    boatGroup.position.set(201, 0.35, 42);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.45 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 8.8), hullMat);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.3, 3.4), new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45 }));
    cabin.position.set(0, 1.1, -0.8);
    boatGroup.add(hull, cabin);
    scene.add(boatGroup);
    animatedProps.push({ mesh: boatGroup, axis: 'y', speed: 0, bobAmp: 0.08, bobFreq: 1.8, baseY: 0.35 });
  } else if (mapId === 'space_city') {
    // 1. Monumental Orbital Launch Rocket + 4 Boosters + Red Lattice Umbilical Gantry (121m, 39.5m)
    const rocketGroup = new THREE.Group();
    rocketGroup.position.set(121, 0, 39.5);

    const hullMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.26, metalness: 0.58 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.42, metalness: 0.38 });
    const gantryMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.48, metalness: 0.65 });
    const nozzleGlow = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.9,
    });

    const coreStage = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 18, 16), hullMat);
    coreStage.position.y = 10;
    coreStage.castShadow = true;
    const fairing = new THREE.Mesh(new THREE.ConeGeometry(1.55, 5.2, 16), hullMat);
    fairing.position.y = 21.6;
    const engineBell = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 1.6, 14), nozzleGlow);
    engineBell.position.y = 0.85;
    rocketGroup.add(coreStage, fairing, engineBell);

    [
      [-2.35, 0],
      [2.35, 0],
      [0, -2.35],
      [0, 2.35],
    ].forEach(([bx, bz]) => {
      const booster = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.78, 11.5, 12), tankMat);
      booster.position.set(bx, 6.7, bz);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.7, 12), hullMat);
      nose.position.set(bx, 13.3, bz);
      rocketGroup.add(booster, nose);
    });

    // Red Umbilical Gantry Tower + Swing Arms
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.1, 22, 2.1), gantryMat);
    tower.position.set(-4.3, 11, -3.0);
    tower.castShadow = true;
    [9, 14.5, 18.5].forEach((ay) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.48, 0.65), gantryMat);
      arm.position.set(-2.2, ay, -1.5);
      rocketGroup.add(arm);
    });
    rocketGroup.add(tower);
    scene.add(rocketGroup);

    // 2. Spherical Cryogenic Fuel Tanks & Elevated Cryo Pipelines (55m/77m/99m, 120m)
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.24, metalness: 0.68 });
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.7,
    });
    const tankXs = [55, 77, 99];
    for (const fx of tankXs) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(3.8, 18, 14), sphereMat);
      sphere.position.set(fx, 5.2, 120);
      sphere.castShadow = true;
      scene.add(sphere);
    }
    const cryoPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 46, 10), pipeMat);
    cryoPipe.rotation.z = Math.PI / 2;
    cryoPipe.position.set(77, 6.4, 120);
    scene.add(cryoPipe);

    // 3. Black Chamber Centrifuge Geodesic Dome + Rotating Rotor Ring (39m, 44m)
    const dome = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.8, 1),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.28, metalness: 0.62 })
    );
    dome.position.set(39, 5.0, 44);
    scene.add(dome);
    radarDishMesh = dome;

    const rotor = new THREE.Mesh(
      new THREE.TorusGeometry(4.8, 0.35, 8, 28),
      pipeMat
    );
    rotor.rotation.x = Math.PI / 2;
    rotor.position.set(39, 5.1, 44);
    scene.add(rotor);
    animatedProps.push({ mesh: rotor, axis: 'z', speed: 1.4 });
  }

  return { radarDishMesh, animatedProps };
}
