export const LEGACY_SETTINGS_MAP = {
  pomodoroDuration: 'pomodoro_duration',
  shortBreakDuration: 'short_break',
  longBreakDuration: 'long_break',
  longBreakInterval: 'long_break_interval',
  soundEnabled: 'sound_enabled',
  notificationEnabled: 'notification_enabled',
  darkMode: 'dark_mode',
  autoStart: 'auto_start',
} as const;

export type CanonicalSettingKey = keyof typeof LEGACY_SETTINGS_MAP;

export const CANONICAL_SETTING_DEFAULTS: Record<CanonicalSettingKey, string> = {
  pomodoroDuration: '25',
  shortBreakDuration: '5',
  longBreakDuration: '15',
  longBreakInterval: '4',
  soundEnabled: 'true',
  notificationEnabled: 'true',
  darkMode: 'false',
  autoStart: 'false',
};

export function getLegacySettingKey(key: CanonicalSettingKey): string {
  return LEGACY_SETTINGS_MAP[key];
}

export function readSetting(
  settings: Record<string, string>,
  key: CanonicalSettingKey,
  fallback: string,
): string {
  const canonical = settings[key];
  const legacy = settings[getLegacySettingKey(key)];

  // Preserve legacy values when canonical is still at default fallback.
  if (legacy !== undefined && (canonical === undefined || canonical === fallback)) {
    return legacy;
  }
  if (canonical !== undefined) return canonical;

  return fallback;
}

export function normalizeSettings(raw: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = { ...raw };

  for (const [canonical, legacy] of Object.entries(LEGACY_SETTINGS_MAP) as Array<[CanonicalSettingKey, string]>) {
    const canonicalVal = normalized[canonical];
    const legacyVal = raw[legacy];
    if (legacyVal !== undefined && (canonicalVal === undefined || canonicalVal === CANONICAL_SETTING_DEFAULTS[canonical])) {
      normalized[canonical] = legacyVal;
    } else if (normalized[canonical] === undefined && legacyVal !== undefined) {
      normalized[canonical] = raw[legacy];
    }
  }

  return normalized;
}
