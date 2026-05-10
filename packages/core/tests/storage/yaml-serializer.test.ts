// packages/core/tests/storage/yaml-serializer.test.ts
import { describe, test, expect } from '@jest/globals';
import { stringifyYaml, parseYaml } from '../../src/storage/yaml-serializer.js';

describe('YAML Serializer', () => {
  test('stringifyYaml converts object to YAML string', () => {
    const obj = { name: 'test', count: 42, items: ['a', 'b'] };
    const yaml = stringifyYaml(obj);
    expect(yaml).toContain('name: test');
    expect(yaml).toContain('count: 42');
    expect(yaml).toContain('items:');
  });

  test('parseYaml converts YAML string to object', () => {
    const yaml = 'name: test\ncount: 42\nitems:\n  - a\n  - b\n';
    const obj = parseYaml(yaml);
    expect(obj).toEqual({ name: 'test', count: 42, items: ['a', 'b'] });
  });

  test('roundtrip preserves data', () => {
    const original = { name: 'test', count: 42, items: ['a', 'b'] };
    const yaml = stringifyYaml(original);
    const parsed = parseYaml(yaml);
    expect(parsed).toEqual(original);
  });

  test('handles null values', () => {
    const obj = { name: 'test', value: null };
    const yaml = stringifyYaml(obj);
    const parsed = parseYaml<{ name: string; value: null }>(yaml);
    expect(parsed.value).toBeNull();
  });
});
