import { describe, expect, test } from 'vitest';
import { readSetting } from '../../src/renderer/lib/settings-keys.js';

describe('settings-keys', () => {
  test('readSetting returns canonical values when present', () => {
    const settings = {
      pomodoroDuration: '30',
      pomodoro_duration: '31',
    };

    expect(readSetting(settings, 'pomodoroDuration', '25')).toBe('30');
  });

  test('readSetting falls back to default when canonical is missing', () => {
    const settings = {
      pomodoro_duration: '31',
    };

    expect(readSetting(settings, 'pomodoroDuration', '25')).toBe('25');
  });
});
