export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

const semverPattern = /^(\d+)\.(\d+)\.(\d+)$/;

function parseSemver(version: string): SemverParts {
  const match = semverPattern.exec(version);

  if (!match) {
    throw new Error(`Invalid semver version: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function compareSemver(left: string, right: string): number {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);

  if (leftParts.major !== rightParts.major) {
    return leftParts.major - rightParts.major;
  }

  if (leftParts.minor !== rightParts.minor) {
    return leftParts.minor - rightParts.minor;
  }

  return leftParts.patch - rightParts.patch;
}

export function formatReleaseTag(version: string): string {
  return `v${version}`;
}

export function isMatchingReleaseTag(tag: string, version: string): boolean {
  return tag === formatReleaseTag(version);
}
