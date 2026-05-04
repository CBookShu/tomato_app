import { generateId } from '../../src/utils/id-generator.js';

describe('generateId', () => {
  test('returns a string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
  });

  test('returns a non-empty string', () => {
    const id = generateId();
    expect(id.length).toBeGreaterThan(0);
  });

  test('returns unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  test('returns a UUID v4 format string', () => {
    const id = generateId();
    const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidV4Pattern);
  });
});
