import { SettingsRepository } from '../../src/db/settings-repository.js';
import { setupTestDb } from './helpers.js';

describe('SettingsRepository', () => {
  let db: ReturnType<typeof setupTestDb>;
  let repo: SettingsRepository;

  beforeEach(() => {
    db = setupTestDb();
    repo = new SettingsRepository(db);
  });

  test('set creates a new setting', async () => {
    await repo.set('pomodoro_duration', '25');
    const value = await repo.get('pomodoro_duration');
    expect(value).toBe('25');
  });

  test('set overwrites an existing setting', async () => {
    await repo.set('theme', 'light');
    await repo.set('theme', 'dark');
    const value = await repo.get('theme');
    expect(value).toBe('dark');
  });

  test('get returns null for missing key', async () => {
    const value = await repo.get('nonexistent');
    expect(value).toBeNull();
  });

  test('get returns default value when key is missing', async () => {
    const value = await repo.get('not_set', 'default_val');
    expect(value).toBe('default_val');
  });

  test('getAll returns all settings', async () => {
    await repo.set('key1', 'value1');
    await repo.set('key2', 'value2');
    const all = await repo.getAll();
    expect(all).toEqual({ key1: 'value1', key2: 'value2' });
  });

  test('delete removes a setting', async () => {
    await repo.set('temp_key', 'temp_value');
    await repo.delete('temp_key');
    const value = await repo.get('temp_key');
    expect(value).toBeNull();
  });

  test('set with numeric value stored as string', async () => {
    await repo.set('pomodoro_duration', '25');
    const value = await repo.get('pomodoro_duration');
    expect(value).toBe('25');
  });

  test('set with boolean value stored as string', async () => {
    await repo.set('sound_enabled', 'true');
    const value = await repo.get('sound_enabled');
    expect(value).toBe('true');
  });
});
