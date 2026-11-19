import { TacticalControlSettings } from '../types/game';

const SETTINGS_STORAGE_KEY = 'delta_force_control_settings_v1';

export const DEFAULT_CONTROL_SETTINGS: TacticalControlSettings = {
  leanEnabled: true,
  leanMode: 'hold',
  leanIntensity: 1.0,
  adsMode: 'hold',
  baseSensitivity: 1.0,
  ironSensitivity: 1.0,
  scope1xSensitivity: 0.85,
  scope4xSensitivity: 0.62,
  scope8xSensitivity: 0.45,
  fpFov: 74,
  tpZoom: 1.0,
};

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.max(min, Math.min(max, n));
}

export function sanitizeControlSettings(
  raw: Partial<TacticalControlSettings> | null | undefined
): TacticalControlSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONTROL_SETTINGS };
  return {
    leanEnabled: typeof raw.leanEnabled === 'boolean' ? raw.leanEnabled : DEFAULT_CONTROL_SETTINGS.leanEnabled,
    leanMode: raw.leanMode === 'toggle' ? 'toggle' : 'hold',
    leanIntensity: clampNum(raw.leanIntensity, 0.6, 1.4, DEFAULT_CONTROL_SETTINGS.leanIntensity),
    adsMode: raw.adsMode === 'toggle' ? 'toggle' : 'hold',
    baseSensitivity: clampNum(raw.baseSensitivity, 0.3, 2.5, DEFAULT_CONTROL_SETTINGS.baseSensitivity),
    ironSensitivity: clampNum(raw.ironSensitivity, 0.3, 2.0, DEFAULT_CONTROL_SETTINGS.ironSensitivity),
    scope1xSensitivity: clampNum(raw.scope1xSensitivity, 0.25, 2.0, DEFAULT_CONTROL_SETTINGS.scope1xSensitivity),
    scope4xSensitivity: clampNum(raw.scope4xSensitivity, 0.2, 1.8, DEFAULT_CONTROL_SETTINGS.scope4xSensitivity),
    scope8xSensitivity: clampNum(raw.scope8xSensitivity, 0.15, 1.6, DEFAULT_CONTROL_SETTINGS.scope8xSensitivity),
    fpFov: clampNum(raw.fpFov, 60, 110, DEFAULT_CONTROL_SETTINGS.fpFov),
    tpZoom: clampNum(raw.tpZoom, 0.7, 1.45, DEFAULT_CONTROL_SETTINGS.tpZoom),
  };
}

export function loadControlSettings(): TacticalControlSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_CONTROL_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONTROL_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<TacticalControlSettings>;
    return sanitizeControlSettings(parsed);
  } catch {
    return { ...DEFAULT_CONTROL_SETTINGS };
  }
}

export function saveControlSettings(next: TacticalControlSettings): TacticalControlSettings {
  const clean = sanitizeControlSettings(next);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // Ignore storage quota errors
    }
  }
  return clean;
}

export function resetControlSettings(): TacticalControlSettings {
  return saveControlSettings({ ...DEFAULT_CONTROL_SETTINGS });
}
