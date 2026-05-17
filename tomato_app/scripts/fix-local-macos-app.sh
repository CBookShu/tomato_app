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
