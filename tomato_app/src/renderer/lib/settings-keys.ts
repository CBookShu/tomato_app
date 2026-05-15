export const CANONICAL_SETTING_DEFAULTS = {
  pomodoroDuration: '25',
  shortBreakDuration: '5',
  longBreakDuration: '15',
  longBreakInterval: '4',
  soundEnabled: 'true',
  notificationEnabled: 'true',
  darkMode: 'false',
  autoStart: 'false',
} as const;

export type CanonicalSettingKey = keyof typeof CANONICAL_SETTING_DEFAULTS;

export function readSetting(
  settings: Record<string, string>,
  key: CanonicalSettingKey,
  fallback: string,
): string {
  return settings[key] ?? fallback;
}
