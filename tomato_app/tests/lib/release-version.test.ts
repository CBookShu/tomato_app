import { describe, expect, test } from 'vitest';
import {
  compareSemver,
  formatReleaseTag,
  isMatchingReleaseTag,
} from '../../src/shared/release-version.js';

describe('release-version', () => {
  test('compareSemver orders patch versions correctly', () => {
    expect(compareSemver('0.1.0', '0.1.1')).toBeLessThan(0);
  });

  test('formatReleaseTag prefixes the package version with v', () => {
    expect(formatReleaseTag('0.1.0')).toBe('v0.1.0');
  });

  test('isMatchingReleaseTag only accepts an exact vX.Y.Z match', () => {
    expect(isMatchingReleaseTag('v0.1.0', '0.1.0')).toBe(true);
    expect(isMatchingReleaseTag('0.1.0', '0.1.0')).toBe(false);
    expect(isMatchingReleaseTag('v0.1.1', '0.1.0')).toBe(false);
  });
});
