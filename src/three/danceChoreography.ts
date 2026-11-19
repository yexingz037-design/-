import * as THREE from 'three';
import { DanceDef } from '../data/danceCatalog';
import { HumanoidRig } from './characterBuilder';

/**
 * Ensures the rig remembers its original weaponMount idle position so we can sling
 * the weapon onto the operator's back during hand dances and cleanly restore it afterward.
 */
function ensureWeaponDefaults(rig: HumanoidRig) {
  if (rig.weaponMount.userData.defaultPosX === undefined) {
    rig.weaponMount.userData.defaultPosX = rig.weaponMount.position.x;
    rig.weaponMount.userData.defaultPosY = rig.weaponMount.position.y;
    rig.weaponMount.userData.defaultPosZ = rig.weaponMount.position.z;
  }
}

/**
 * Smoothly blends all rig joints back to standard tactical idle posture after a dance stops.
 */
export function resetOperatorRigPose(rig: HumanoidRig, dt: number) {
  ensureWeaponDefaults(rig);
  const k = Math.min(1, dt * 8.5);
  const lerp = THREE.MathUtils.lerp;

  rig.pelvis.position.x = lerp(rig.pelvis.position.x, 0, k);
  rig.pelvis.position.y = lerp(rig.pelvis.position.y, 0.88, k);
  rig.pelvis.position.z = lerp(rig.pelvis.position.z, 0, k);
  rig.pelvis.rotation.x = lerp(rig.pelvis.rotation.x, 0, k);
  rig.pelvis.rotation.y = lerp(rig.pelvis.rotation.y, 0, k);
  rig.pelvis.rotation.z = lerp(rig.pelvis.rotation.z, 0, k);

  rig.upperBody.rotation.x = lerp(rig.upperBody.rotation.x, 0, k);
  rig.upperBody.rotation.y = lerp(rig.upperBody.rotation.y, 0, k);
  rig.upperBody.rotation.z = lerp(rig.upperBody.rotation.z, 0, k);

  rig.head.rotation.x = lerp(rig.head.rotation.x, 0, k);
  rig.head.rotation.y = lerp(rig.head.rotation.y, 0, k);
  rig.head.rotation.z = lerp(rig.head.rotation.z, 0, k);

  rig.leftArm.rotation.x = lerp(rig.leftArm.rotation.x, 0, k);
  rig.leftArm.rotation.y = lerp(rig.leftArm.rotation.y, 0, k);
  rig.leftArm.rotation.z = lerp(rig.leftArm.rotation.z, 0, k);
  rig.rightArm.rotation.x = lerp(rig.rightArm.rotation.x, 0, k);
  rig.rightArm.rotation.y = lerp(rig.rightArm.rotation.y, 0, k);
  rig.rightArm.rotation.z = lerp(rig.rightArm.rotation.z, 0, k);

  rig.leftLeg.rotation.x = lerp(rig.leftLeg.rotation.x, 0, k);
  rig.leftLeg.rotation.y = lerp(rig.leftLeg.rotation.y, 0, k);
  rig.leftLeg.rotation.z = lerp(rig.leftLeg.rotation.z, 0, k);
  rig.rightLeg.rotation.x = lerp(rig.rightLeg.rotation.x, 0, k);
  rig.rightLeg.rotation.y = lerp(rig.rightLeg.rotation.y, 0, k);
  rig.rightLeg.rotation.z = lerp(rig.rightLeg.rotation.z, 0, k);

  rig.weaponMount.position.x = lerp(rig.weaponMount.position.x, rig.weaponMount.userData.defaultPosX, k);
  rig.weaponMount.position.y = lerp(rig.weaponMount.position.y, rig.weaponMount.userData.defaultPosY, k);
  rig.weaponMount.position.z = lerp(rig.weaponMount.position.z, rig.weaponMount.userData.defaultPosZ, k);
  rig.weaponMount.rotation.x = lerp(rig.weaponMount.rotation.x, 0, k);
  rig.weaponMount.rotation.y = lerp(rig.weaponMount.rotation.y, 0, k);
  rig.weaponMount.rotation.z = lerp(rig.weaponMount.rotation.z, 0, k);
}

/**
 * Animates the 3D operator HumanoidRig with 20 distinct, beat-synced choreographies.
 * Zero per-frame heap allocations.
 */
export function animateOperatorDance(
  rig: HumanoidRig,
  dance: DanceDef,
  elapsed: number,
  beatEnergy: number,
  dt: number
) {
  ensureWeaponDefaults(rig);

  // Beat-synchronized radian phase (1 full cycle = 2 beats)
  const bps = dance.bpm / 60;
  const b = elapsed * bps; // beats elapsed
  const w = b * Math.PI; // PI per beat, 2*PI per 2 beats
  const w2 = w * 2;
  const wHalf = w * 0.5;
  const blend = Math.min(1, dt * 14);
  const lerp = THREE.MathUtils.lerp;

  // Target joint pose values (defaults)
  let rootRotY = 0;
  let px = 0;
  let py = 0.88;
  let pz = 0;
  let prx = 0;
  let pry = 0;
  let prz = 0;

  let urx = 0;
  let ury = 0;
  let urz = 0;

  let hrx = 0;
  let hry = 0;
  let hrz = 0;

  let lax = 0;
  let lay = 0;
  let laz = 0;
  let rax = 0;
  let ray = 0;
  let raz = 0;

  let llx = 0;
  let lly = 0;
  let llz = 0;
  let rlx = 0;
  let rly = 0;
  let rlz = 0;

  // Default weapon handling: slung cleanly across back unless rifle_show dance
  let wPosX = 0.02;
  let wPosY = 0.29;
  let wPosZ = -0.21;
  let wRotX = 0.14;
  let wRotY = Math.PI;
  let wRotZ = 0.68;

  if (dance.weaponMode === 'rifle_show') {
    wPosX = rig.weaponMount.userData.defaultPosX;
    wPosY = rig.weaponMount.userData.defaultPosY;
    wPosZ = rig.weaponMount.userData.defaultPosZ;
    wRotX = 0;
    wRotY = 0;
    wRotZ = 0;
  }

  switch (dance.id) {
    case 'cyber_shuffle': {
      // Crisp Melbourne shuffle: fast alternating heel-toe leg stride + bouncy torso + pumping arms
      const step = Math.sin(w2);
      const bounce = Math.abs(Math.sin(w2));
      px = Math.sin(wHalf) * 0.24;
      py = 0.84 + bounce * 0.1;
      pry = Math.cos(wHalf) * 0.26;
      ury = -Math.sin(w2) * 0.22;
      urx = 0.1 + bounce * 0.08;
      llx = step * 0.72;
      rlx = -step * 0.72;
      llz = 0.14 + Math.max(0, step) * 0.18;
      rlz = -0.14 - Math.max(0, -step) * 0.18;
      lax = -0.45 - step * 0.75;
      rax = -0.45 + step * 0.75;
      laz = 0.48 + bounce * 0.24;
      raz = -0.48 - bounce * 0.24;
      hrx = -0.06 + beatEnergy * 0.14;
      hry = Math.sin(w) * 0.25;
      break;
    }

    case 'moonwalk_glide': {
      // Smooth backward-gliding moonwalk strides with stylized lean & alternating wrist sweeps
      const stride = Math.sin(w);
      pz = Math.sin(wHalf * 0.5) * 0.22;
      py = 0.86 + Math.abs(Math.cos(w)) * 0.035;
      prx = 0.12;
      pry = -0.28 + Math.sin(wHalf) * 0.14;
      urx = 0.16;
      urz = Math.sin(w) * 0.08;
      llx = stride * 0.58 - 0.12;
      rlx = -stride * 0.58 - 0.12;
      lax = -0.35 + Math.cos(w) * 0.52;
      rax = -0.95 + Math.sin(w) * 0.28; // Hand near visor/hat tip
      laz = 0.35;
      raz = -0.42;
      hrx = 0.14;
      hry = 0.24 + Math.sin(w) * 0.16;
      hrz = -0.12;
      break;
    }

    case 'robot_popping': {
      // Quantized step-snapped robotic joint angles (mechanical isolation feel)
      const qBeat = Math.floor(b * 2);
      const snap = (v: number) => Math.round(v * 3) / 3;
      const seq = qBeat % 8;
      py = 0.87 + (seq % 2 === 0 ? 0.025 : -0.015);
      pry = snap(Math.sin(qBeat * 0.85) * 0.38);
      ury = snap(Math.cos(qBeat * 1.1) * 0.44);
      urz = snap(Math.sin(qBeat * 0.65) * 0.2);
      hry = snap(Math.sin(qBeat * 1.5) * 0.52);
      hrz = snap(Math.cos(qBeat * 1.3) * 0.28);
      lax = seq % 4 < 2 ? -1.45 : -0.35;
      laz = seq % 2 === 0 ? 1.15 : 0.32;
      rax = seq % 4 >= 2 ? -1.45 : -0.35;
      raz = seq % 2 === 1 ? -1.15 : -0.32;
      llx = seq === 1 ? 0.35 : seq === 5 ? -0.25 : 0;
      rlx = seq === 3 ? 0.35 : seq === 7 ? -0.25 : 0;
      break;
    }

    case 'tactical_hardbass': {
      // Iconic energetic Slavic squat-kick bounce (kazotsky / hardbass)
      const kickPhase = Math.sin(w2);
      const drop = Math.abs(Math.cos(w2));
      py = 0.66 + drop * 0.16;
      prx = 0.14;
      urx = 0.18;
      urz = kickPhase * 0.16;
      // Alternating high forward kicks from low crouch
      llx = kickPhase > 0 ? -0.95 * kickPhase : 0.32;
      rlx = kickPhase < 0 ? 0.95 * kickPhase : 0.32;
      llz = 0.18;
      rlz = -0.18;
      // Folded chest pumping arms
      lax = -0.82 - beatEnergy * 0.24;
      rax = -0.82 - beatEnergy * 0.24;
      lay = 0.72;
      ray = -0.72;
      laz = -0.22;
      raz = 0.22;
      hrx = beatEnergy * 0.24;
      hry = kickPhase * 0.18;
      break;
    }

    case 'neon_floss': {
      // Fast counter-phase hip sway + dual parallel arms swinging front & back
      const hip = Math.sin(w2);
      const arm = -Math.sin(w2);
      const fb = Math.sign(Math.sin(w)) * 0.26;
      px = hip * 0.18;
      py = 0.87 + Math.abs(hip) * 0.035;
      prz = hip * 0.16;
      urz = -hip * 0.14;
      llz = -hip * 0.22 + 0.14;
      rlz = -hip * 0.22 - 0.14;
      lax = 0.35 + fb;
      rax = 0.35 - fb;
      laz = 0.28 + arm * 0.82;
      raz = -0.28 + arm * 0.82;
      hry = -hip * 0.18;
      hrz = hip * 0.1;
      break;
    }

    case 'victory_salute_spin': {
      // 360° celebratory spin + rifle aloft victory flourish
      const spinPhase = (elapsed % 3.5) / 3.5;
      rootRotY = spinPhase < 0.45 ? (spinPhase / 0.45) * Math.PI * 2 : Math.sin(w) * 0.25;
      py = 0.88 + Math.abs(Math.sin(w2)) * 0.07;
      urx = -0.1;
      ury = Math.sin(w) * 0.24;
      lax = -1.75 + Math.sin(w2) * 0.22; // Left fist raised high in victory
      laz = 0.65;
      rax = -1.15 + Math.sin(w) * 0.25;
      raz = -0.38;
      llx = Math.sin(w2) * 0.32;
      rlx = -Math.sin(w2) * 0.32;
      hrx = -0.14;
      // Flourish rifle upward & spin along rhythm
      wPosX = 0.24;
      wPosY = 0.56 + Math.sin(w2) * 0.08;
      wPosZ = 0.22;
      wRotX = -0.85 + Math.sin(w2) * 0.35;
      wRotY = Math.sin(w) * 0.45;
      wRotZ = -0.35;
      break;
    }

    case 'breakdance_windmill': {
      // Alternating top-rock swagger into dramatic spinning crouch twist
      const cycle = elapsed % 4.0;
      if (cycle < 2.2) {
        // Energetic B-boy top-rock crossover steps
        const s = Math.sin(w2);
        px = s * 0.26;
        py = 0.85 + Math.abs(Math.cos(w2)) * 0.08;
        pry = s * 0.42;
        ury = -s * 0.34;
        llx = s * 0.65;
        rlx = -s * 0.65;
        llz = 0.16;
        rlz = -0.16;
        lax = -0.95 + s * 0.55;
        rax = -0.95 - s * 0.55;
        laz = 0.95;
        raz = -0.95;
        hrx = beatEnergy * 0.22;
      } else {
        // Low-drop 720° whirlwind break spin
        const tSpin = (cycle - 2.2) / 1.8;
        rootRotY = tSpin * Math.PI * 4;
        py = 0.72 + Math.sin(tSpin * Math.PI) * 0.24;
        prx = 0.42;
        urx = 0.28;
        lax = -1.6;
        rax = -1.6;
        laz = 1.25;
        raz = -1.25;
        llx = -0.68;
        rlx = 0.68;
        llz = 0.48;
        rlz = -0.48;
      }
      break;
    }

    case 'synthwave_groove': {
      // Cool 80s retro shoulder roll, side-to-side knee dip & double finger-gun swings
      const sway = Math.sin(w);
      const pulse = Math.sin(w2);
      px = sway * 0.2;
      py = 0.85 + (pulse * 0.5 + 0.5) * 0.06;
      prz = sway * 0.12;
      ury = sway * 0.32;
      urz = -sway * 0.14;
      llz = 0.16 + Math.max(0, sway) * 0.12;
      rlz = -0.16 - Math.max(0, -sway) * 0.12;
      llx = pulse * 0.22;
      rlx = -pulse * 0.22;
      lax = -1.05 + sway * 0.35;
      rax = -1.05 - sway * 0.35;
      lay = -0.35 + sway * 0.55;
      ray = 0.35 + sway * 0.55;
      laz = 0.55;
      raz = -0.55;
      hry = sway * 0.28;
      hrz = sway * 0.14;
      break;
    }

    case 'cyber_phonk_walk': {
      // Aggressive Phonk boss-walk: heavy swaggering stride, forward crouch & wide elbow swings
      const stride = Math.sin(w);
      const stomp = Math.abs(Math.sin(w));
      py = 0.81 + stomp * 0.08;
      prx = 0.16;
      pry = stride * 0.34;
      urx = 0.2;
      ury = -stride * 0.38;
      urz = stride * 0.18;
      llx = stride * 0.72;
      rlx = -stride * 0.72;
      llz = 0.18;
      rlz = -0.18;
      lax = -0.55 - stride * 0.75;
      rax = -0.55 + stride * 0.75;
      laz = 0.78 + beatEnergy * 0.22;
      raz = -0.78 - beatEnergy * 0.22;
      hrx = -0.12 + beatEnergy * 0.24;
      hry = -stride * 0.22;
      break;
    }

    case 'disco_fever': {
      // Classic Saturday Night Fever diagonal sky-point to hip-point + groovy hip bounce
      const phase = Math.sin(w);
      const up = phase > 0 ? phase : 0;
      const dn = phase < 0 ? -phase : 0;
      px = phase * 0.16;
      py = 0.85 + Math.abs(Math.sin(w2)) * 0.06;
      prz = phase * 0.18;
      urz = -phase * 0.16;
      ury = phase * 0.24;
      // Right arm points high diagonally to sky, then sweeps down to left hip
      rax = -2.35 * up + 0.18 * dn - 0.35;
      raz = -0.95 * up + 0.45 * dn;
      // Left hand rests sassily on hip / counter-swings
      lax = -0.25 + dn * 0.35;
      laz = 0.65 + up * 0.25;
      llx = phase * 0.26;
      rlx = -phase * 0.26;
      llz = 0.16;
      rlz = -0.16;
      hry = -phase * 0.25;
      hrx = -up * 0.18;
      break;
    }

    case 'dubstep_glitch': {
      // Electric body-wave ripple + sharp bass-drop stutter glitches
      const glitch = Math.sin(elapsed * 29) * (beatEnergy > 0.55 ? 0.18 : 0.02);
      const wave1 = Math.sin(w2);
      const wave2 = Math.sin(w2 - 0.8);
      const wave3 = Math.sin(w2 - 1.6);
      py = 0.82 - beatEnergy * 0.08 + Math.abs(wave2) * 0.06;
      urz = wave2 * 0.24 + glitch;
      ury = wave1 * 0.32;
      lax = -1.2 + wave1 * 0.55 + glitch;
      laz = 0.95 + wave1 * 0.4;
      rax = -1.2 + wave3 * 0.55 - glitch;
      raz = -0.95 - wave3 * 0.4;
      llx = wave1 * 0.3;
      rlx = wave3 * 0.3;
      llz = 0.2;
      rlz = -0.2;
      hrz = wave2 * 0.28 + glitch * 1.4;
      hry = -wave1 * 0.32;
      break;
    }

    case 'kpop_sharp_wave': {
      // Sharp synchronized geometric arm choreography + nimble hip-pops & head snaps
      const barStep = Math.floor(b) % 4;
      const pop = Math.sin(w2);
      px = Math.sin(w) * 0.22;
      py = 0.86 + Math.abs(pop) * 0.075;
      prz = Math.sin(w2) * 0.2;
      ury = Math.cos(w) * 0.3;
      if (barStep === 0 || barStep === 1) {
        // Overhead crisp frame & alternating elbow snaps
        lax = -2.1 + pop * 0.35;
        rax = -2.1 - pop * 0.35;
        laz = 0.65 + pop * 0.3;
        raz = -0.65 + pop * 0.3;
      } else {
        // Horizontal chest-wave & point
        lax = -1.15;
        rax = -1.15;
        laz = 1.25 * Math.sin(w2);
        raz = -1.25 * Math.cos(w2);
      }
      llx = Math.sin(w2) * 0.46;
      rlx = -Math.sin(w2) * 0.46;
      llz = 0.14;
      rlz = -0.14;
      hry = Math.sin(w) * 0.34;
      hrz = -Math.sin(w2) * 0.16;
      break;
    }

    case 'gun_kata_drill': {
      // Tactical Gun-Kata: snappy rhythmic left/right/high sector clears on every beat
      const pose = Math.floor(b) % 4;
      const snapEase = Math.min(1, (b % 1) * 4);
      py = pose === 2 ? 0.74 : 0.87;
      prx = pose === 2 ? 0.14 : 0.04;
      const targetYaw = pose === 0 ? -0.58 : pose === 1 ? 0.58 : pose === 2 ? 0 : Math.PI * 0.25;
      rootRotY = targetYaw * snapEase + (pose === 3 ? Math.sin(w2) * 0.15 : 0);
      ury = pose === 0 ? -0.22 : pose === 1 ? 0.22 : 0;
      urx = pose === 2 ? 0.18 : -0.06;
      lax = -0.85 - (pose === 3 ? 0.55 : 0);
      rax = -0.95 - (pose === 3 ? 0.55 : 0);
      llx = pose === 2 ? -0.45 : pose === 0 ? 0.35 : -0.25;
      rlx = pose === 2 ? 0.45 : pose === 1 ? 0.35 : -0.25;
      llz = 0.2;
      rlz = -0.2;
      // Crisp tactical rifle punch & tilt
      wPosZ = 0.34 + beatEnergy * 0.07;
      wPosY = pose === 3 ? 0.44 : 0.26;
      wRotX = pose === 3 ? -0.68 : -beatEnergy * 0.18;
      wRotZ = pose === 0 ? 0.28 : pose === 1 ? -0.28 : 0;
      hry = -ury * 0.5;
      break;
    }

    case 'samba_carnival': {
      // High-energy bouncy Brazilian samba footwork & festive raised shaking arms
      const bounce = Math.abs(Math.sin(w2));
      const shimmy = Math.sin(w2 * 2);
      px = Math.sin(w) * 0.22;
      py = 0.85 + bounce * 0.09;
      pry = Math.sin(w2) * 0.32;
      prz = Math.sin(w2) * 0.18;
      ury = -Math.sin(w2) * 0.26;
      urz = shimmy * 0.09;
      lax = -2.05 + shimmy * 0.22;
      rax = -2.05 - shimmy * 0.22;
      laz = 0.95 + Math.sin(w) * 0.25;
      raz = -0.95 + Math.sin(w) * 0.25;
      llx = Math.sin(w2) * 0.58;
      rlx = -Math.sin(w2) * 0.58;
      llz = 0.12;
      rlz = -0.12;
      hrx = -0.1;
      hrz = Math.sin(w) * 0.18;
      break;
    }

    case 'shadow_boxing_rap': {
      // Rhythmic boxing bob-and-weave + jab-cross-hook combo on the boom-bap beat
      const combo = Math.floor(b * 2) % 4;
      const punch = Math.sin(w2);
      px = Math.sin(w) * 0.18;
      py = 0.82 + Math.abs(Math.cos(w)) * 0.07;
      prx = 0.14;
      pry = -0.32 + Math.sin(w) * 0.22;
      urx = 0.16;
      ury = combo === 0 ? 0.38 : combo === 2 ? -0.45 : Math.sin(w) * 0.25;
      lax = combo === 0 ? -1.48 : -0.95;
      rax = combo === 2 ? -1.55 : -0.95;
      laz = combo === 0 ? 0.25 : 0.45;
      raz = combo === 2 ? -0.25 : -0.45;
      llx = 0.35 + punch * 0.22;
      rlx = -0.35 - punch * 0.22;
      llz = 0.16;
      rlz = -0.16;
      hrx = 0.12 + beatEnergy * 0.12;
      hry = -ury * 0.5;
      break;
    }

    case 'zero_g_levitate': {
      // Sci-fi anti-gravity levitation above pedestal with slow 360° float spin & cosmic arm spread
      const lift = Math.sin(Math.min(1, elapsed / 1.4) * (Math.PI / 2));
      const hover = Math.sin(elapsed * 2.1) * 0.12;
      py = 0.88 + lift * 0.48 + hover;
      rootRotY = elapsed * 0.92;
      prx = -0.16 + Math.sin(elapsed * 1.4) * 0.1;
      urx = -0.18;
      urz = Math.sin(elapsed * 1.6) * 0.12;
      lax = -1.35 + Math.sin(w) * 0.28;
      rax = -1.35 + Math.cos(w) * 0.28;
      laz = 1.18 + Math.sin(wHalf) * 0.2;
      raz = -1.18 - Math.sin(wHalf) * 0.2;
      llx = 0.22 + Math.sin(elapsed * 2.2) * 0.18;
      rlx = -0.14 + Math.cos(elapsed * 2.2) * 0.18;
      llz = 0.15;
      rlz = -0.15;
      hrx = -0.22;
      break;
    }

    case 'pixel_8bit_hop': {
      // Cheerful retro arcade double-hops & snappy alternating sky waves
      const hop = Math.abs(Math.sin(w2));
      const alt = Math.sin(w);
      py = 0.88 + hop * 0.22;
      prz = alt * 0.1;
      urz = -alt * 0.12;
      lax = -2.2 + Math.max(0, alt) * 0.55;
      rax = -2.2 + Math.max(0, -alt) * 0.55;
      laz = 0.85 + hop * 0.35;
      raz = -0.85 - hop * 0.35;
      llx = hop * 0.38 * Math.sign(alt || 1);
      rlx = -hop * 0.38 * Math.sign(alt || 1);
      llz = 0.18 + hop * 0.22;
      rlz = -0.18 - hop * 0.22;
      hrz = alt * 0.22;
      break;
    }

    case 'eurobeat_drift': {
      // High-BPM Para-Para twin arm sweep + aggressive drift lean
      const drift = Math.sin(wHalf);
      const sweep = Math.sin(w2);
      px = drift * 0.28;
      py = 0.83 + Math.abs(sweep) * 0.08;
      prz = -drift * 0.2;
      urz = -drift * 0.18;
      ury = sweep * 0.35;
      lax = -1.4 + sweep * 0.55;
      rax = -1.4 + sweep * 0.55;
      laz = 0.65 + drift * 0.72;
      raz = -0.65 + drift * 0.72;
      llx = sweep * 0.45;
      rlx = -sweep * 0.45;
      llz = 0.22;
      rlz = -0.22;
      hry = drift * 0.32;
      hrx = beatEnergy * 0.18;
      break;
    }

    case 'heavy_metal_headbang': {
      // Wide power-stance air-guitar riffing with primary rifle + furious headbanging
      const bang = Math.sin(w2);
      py = 0.79 + Math.abs(bang) * 0.04;
      prx = 0.18;
      pry = -0.25;
      urx = 0.24 + bang * 0.24;
      urz = Math.sin(w) * 0.14;
      hrx = 0.12 + bang * 0.55; // Iconic intense headbanging
      llz = 0.32;
      rlz = -0.32;
      llx = -0.15;
      rlx = 0.15;
      // Hold rifle diagonally like an electric guitar & strum furiously
      lax = -0.92;
      laz = 0.22;
      rax = -0.78 + Math.sin(w2 * 2) * 0.32;
      raz = -0.35;
      wPosX = 0.02;
      wPosY = 0.16;
      wPosZ = 0.26;
      wRotX = 0.25;
      wRotY = -1.08;
      wRotZ = 0.45 + Math.sin(w) * 0.12;
      break;
    }

    case 'trance_rave_laser': {
      // Euphoric hands-up rave fist-pumps & climactic jumping groove
      const pump = Math.sin(w2);
      const jump = Math.max(0, Math.sin(w2));
      py = 0.87 + jump * 0.18;
      rootRotY = Math.sin(wHalf * 0.5) * 0.55;
      urx = -0.14 + pump * 0.12;
      urz = Math.sin(w) * 0.14;
      lax = -2.45 + pump * 0.45;
      rax = -2.45 + pump * 0.45;
      laz = 0.55 + Math.sin(w) * 0.35;
      raz = -0.55 - Math.sin(w) * 0.35;
      llx = Math.sin(w) * 0.36;
      rlx = -Math.sin(w) * 0.36;
      llz = 0.16;
      rlz = -0.16;
      hrx = -0.18 + beatEnergy * 0.26;
      hry = Math.sin(w) * 0.24;
      break;
    }
  }

  // Smoothly apply pose to rig (snappy tracking without sudden snap popping)
  rig.root.rotation.y = lerp(rig.root.rotation.y, rootRotY, blend);

  rig.pelvis.position.x = lerp(rig.pelvis.position.x, px, blend);
  rig.pelvis.position.y = lerp(rig.pelvis.position.y, py, blend);
  rig.pelvis.position.z = lerp(rig.pelvis.position.z, pz, blend);
  rig.pelvis.rotation.x = lerp(rig.pelvis.rotation.x, prx, blend);
  rig.pelvis.rotation.y = lerp(rig.pelvis.rotation.y, pry, blend);
  rig.pelvis.rotation.z = lerp(rig.pelvis.rotation.z, prz, blend);

  rig.upperBody.rotation.x = lerp(rig.upperBody.rotation.x, urx, blend);
  rig.upperBody.rotation.y = lerp(rig.upperBody.rotation.y, ury, blend);
  rig.upperBody.rotation.z = lerp(rig.upperBody.rotation.z, urz, blend);

  rig.head.rotation.x = lerp(rig.head.rotation.x, hrx, blend);
  rig.head.rotation.y = lerp(rig.head.rotation.y, hry, blend);
  rig.head.rotation.z = lerp(rig.head.rotation.z, hrz, blend);

  rig.leftArm.rotation.x = lerp(rig.leftArm.rotation.x, lax, blend);
  rig.leftArm.rotation.y = lerp(rig.leftArm.rotation.y, lay, blend);
  rig.leftArm.rotation.z = lerp(rig.leftArm.rotation.z, laz, blend);
  rig.rightArm.rotation.x = lerp(rig.rightArm.rotation.x, rax, blend);
  rig.rightArm.rotation.y = lerp(rig.rightArm.rotation.y, ray, blend);
  rig.rightArm.rotation.z = lerp(rig.rightArm.rotation.z, raz, blend);

  rig.leftLeg.rotation.x = lerp(rig.leftLeg.rotation.x, llx, blend);
  rig.leftLeg.rotation.y = lerp(rig.leftLeg.rotation.y, lly, blend);
  rig.leftLeg.rotation.z = lerp(rig.leftLeg.rotation.z, llz, blend);
  rig.rightLeg.rotation.x = lerp(rig.rightLeg.rotation.x, rlx, blend);
  rig.rightLeg.rotation.y = lerp(rig.rightLeg.rotation.y, rly, blend);
  rig.rightLeg.rotation.z = lerp(rig.rightLeg.rotation.z, rlz, blend);

  rig.weaponMount.position.x = lerp(rig.weaponMount.position.x, wPosX, blend);
  rig.weaponMount.position.y = lerp(rig.weaponMount.position.y, wPosY, blend);
  rig.weaponMount.position.z = lerp(rig.weaponMount.position.z, wPosZ, blend);
  rig.weaponMount.rotation.x = lerp(rig.weaponMount.rotation.x, wRotX, blend);
  rig.weaponMount.rotation.y = lerp(rig.weaponMount.rotation.y, wRotY, blend);
  rig.weaponMount.rotation.z = lerp(rig.weaponMount.rotation.z, wRotZ, blend);

  // Orbit companion drone/device excitedly if operator has one
  if (rig.companionMesh) {
    rig.companionMesh.position.y = 0.78 + Math.sin(w2) * 0.14;
    rig.companionMesh.rotation.y = elapsed * 3.6;
  }
}
