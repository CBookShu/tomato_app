import { describe, expect, test } from 'vitest';
import {
  compareSemver,
  formatReleaseTag,
  isMatchingReleaseTag,
} from '../../src/shared/release-version.js';
import { appVersion } from '../test-version.js';

describe('release-version', () => {
  test('compareSemver orders patch versions correctly', () => {
    expect(compareSemver(appVersion, '0.1.1')).toBeLessThan(0);
  });

  test('formatReleaseTag prefixes the package version with v', () => {
    expect(formatReleaseTag(appVersion)).toBe(`v${appVersion}`);
  });

  test('isMatchingReleaseTag only accepts an exact vX.Y.Z match', () => {
    expect(isMatchingReleaseTag(`v${appVersion}`, appVersion)).toBe(true);
    expect(isMatchingReleaseTag(appVersion, appVersion)).toBe(false);
    expect(isMatchingReleaseTag('v0.1.1', appVersion)).toBe(false);
  });
});
