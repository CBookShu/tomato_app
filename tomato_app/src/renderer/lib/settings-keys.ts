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

export function readSetting(
  settings: Record<string, string>,
  key: CanonicalSettingKey,
  fallback: string,
): string {
  const canonical = settings[key];
  if (canonical !== undefined) return canonical;

  const legacy = settings[LEGACY_SETTINGS_MAP[key]];
  if (legacy !== undefined) return legacy;

  return fallback;
}

export function normalizeSettings(raw: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = { ...raw };

  for (const [canonical, legacy] of Object.entries(LEGACY_SETTINGS_MAP)) {
    if (normalized[canonical] === undefined && raw[legacy] !== undefined) {
      normalized[canonical] = raw[legacy];
    }
  }

  return normalized;
}
