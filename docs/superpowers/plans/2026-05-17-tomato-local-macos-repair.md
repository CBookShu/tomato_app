# Tomato Local macOS Repair Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair a locally installed `Tomato.app` on macOS so it can launch again, and provide a reusable shell script for the same repair flow.

**Architecture:** Use a single shell script that accepts an app bundle path, removes quarantine metadata, re-signs the bundle ad hoc with `codesign`, verifies the bundle signature, and then launches the app to confirm it starts. Keep the script focused on local repair only; do not attempt notarization or GitHub release changes here.

**Tech Stack:** POSIX shell, `xattr`, `codesign`, `spctl`, `open`, `pgrep`

---

### Task 1: Add the local repair script

**Files:**
- Create: `tomato_app/scripts/fix-local-macos-app.sh`

- [ ] **Step 1: Write the script**

```sh
#!/bin/sh
set -eu

APP_PATH="${1:-/Applications/Tomato.app}"
APP_NAME="$(basename "$APP_PATH" .app)"
APP_EXECUTABLE="$APP_PATH/Contents/MacOS/$APP_NAME"

if [ ! -d "$APP_PATH" ]; then
  echo "error: app bundle not found: $APP_PATH" >&2
  exit 1
fi

if [ ! -x "$APP_EXECUTABLE" ]; then
  echo "error: app executable not found: $APP_EXECUTABLE" >&2
  exit 1
fi

echo "Repairing: $APP_PATH"
echo "Quitting any running app instance..."
osascript -e "tell application \"$APP_NAME\" to quit" >/dev/null 2>&1 || true
sleep 2
pkill -x "$APP_NAME" >/dev/null 2>&1 || true

echo "Removing quarantine metadata..."
xattr -dr com.apple.quarantine "$APP_PATH" >/dev/null 2>&1 || true

echo "Re-signing bundle ad hoc..."
codesign --force --deep --sign - "$APP_PATH"

echo "Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

echo "Checking Gatekeeper assessment..."
if spctl --assess --type execute --verbose=4 "$APP_PATH"; then
  echo "Gatekeeper assessment passed."
else
  echo "Gatekeeper still rejects the app bundle."
  echo "This can happen on unsigned local builds, but the app may still launch after quarantine removal and ad hoc re-signing."
fi

echo "Launching app..."
open "$APP_PATH"
sleep 5

if pgrep -f "$APP_EXECUTABLE" >/dev/null 2>&1; then
  echo "Verification passed: $APP_NAME is running."
  exit 0
fi

echo "error: app did not stay running after launch"
exit 1
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x tomato_app/scripts/fix-local-macos-app.sh`

- [ ] **Step 3: Verify the script on a temporary copy**

Run:
```bash
/Users/cbookshu/dev/temp/tomato_app/tomato_app/scripts/fix-local-macos-app.sh /private/tmp/tomato-repair-test/Tomato.app
```
Expected: `codesign --verify` passes, `open` launches the app, and the final line says `Verification passed`.

### Task 2: Apply the repair to the installed app

**Files:**
- None beyond the installed `/Applications/Tomato.app`

- [ ] **Step 1: Run the repair script against the installed bundle**

Run:
```bash
/Users/cbookshu/dev/temp/tomato_app/tomato_app/scripts/fix-local-macos-app.sh /Applications/Tomato.app
```
Expected: the app launches successfully and stays running.

