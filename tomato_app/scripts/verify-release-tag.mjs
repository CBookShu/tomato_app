#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

const versionPattern = /^\d+\.\d+\.\d+$/;
const tagPattern = /^v\d+\.\d+\.\d+$/;
const expectedTag = `v${packageJson.version}`;
const actualTag = process.env.GITHUB_REF_NAME ?? process.argv[2];

if (!versionPattern.test(packageJson.version)) {
  console.error(
    `Release version must be a plain semver X.Y.Z value, got ${packageJson.version}`
  );
  process.exit(1);
}

if (!actualTag) {
  console.error('Missing release tag. Set GITHUB_REF_NAME or pass the tag as an argument.');
  process.exit(1);
}

if (!tagPattern.test(actualTag)) {
  console.error(`Release tag must match vX.Y.Z, got ${actualTag}`);
  process.exit(1);
}

if (actualTag !== expectedTag) {
  console.error(
    `Release tag/version mismatch: expected ${expectedTag} from tomato_app/package.json, got ${actualTag}`
  );
  process.exit(1);
}

console.log(`Release tag verified: ${actualTag}`);
