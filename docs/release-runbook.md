# Release Runbook

## 1. Version and tag

- Bump `tomato_app/package.json` to `X.Y.Z`.
- Create the release tag as `vX.Y.Z`.
- Push the commit and tag together.

## 2. Trigger

- The GitHub Action runs on tag push only.
- Any tag that matches `v*` starts `.github/workflows/release.yml`.
- The workflow verifies the tag, runs tests, builds the app, and publishes the release.

## 3. Artifacts

- macOS release assets are created in `tomato_app/release/`.
- Published files:
  - `*.dmg`
  - `*.zip`
- The workflow uploads both files to the GitHub Release for the tag.

## 4. Update flow in the app

- On startup, the app checks GitHub Releases for the latest published version.
- The Settings page shows the update card and the current update state.
- If a newer release exists, the app shows it as available and links to the release page.
- The current implementation is manual-download oriented: the app opens the GitHub release page instead of doing silent install.

## 5. Not supported yet

- Signed or notarized macOS distribution.
- Silent in-app installation/update.
- Fully trusted first-launch experience without the user allowing the app manually.

