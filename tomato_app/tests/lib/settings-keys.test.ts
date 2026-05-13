import { describe, expect, test } from 'vitest';
import { normalizeSettings, readSetting } from '../../src/renderer/lib/settings-keys.js';

describe('settings-keys', () => {
  test('readSetting prefers canonical values over legacy values', () => {
    const settings = {
      pomodoroDuration: '30',
      pomodoro_duration: '31',
    };

    expect(readSetting(settings, 'pomodoroDuration', '25')).toBe('30');
  });

  test('readSetting falls back to legacy values when canonical is missing', () => {
    const settings = {
      pomodoro_duration: '31',
    };

    expect(readSetting(settings, 'pomodoroDuration', '25')).toBe('31');
  });

  test('normalizeSettings fills canonical keys from legacy keys', () => {
    const normalized = normalizeSettings({
      pomodoro_duration: '32',
      sound_enabled: 'false',
    });

    expect(normalized.pomodoroDuration).toBe('32');
    expect(normalized.soundEnabled).toBe('false');
  });
});
