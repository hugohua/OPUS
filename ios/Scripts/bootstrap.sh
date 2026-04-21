#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IOS_DIR="$ROOT_DIR/ios"
SECRETS_FILE="$IOS_DIR/Config/Local.secrets.xcconfig"
SECRETS_TEMPLATE="$IOS_DIR/Config/Local.secrets.xcconfig.example"

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "Installing xcodegen via Homebrew..."
  brew install xcodegen
fi

if [ ! -f "$SECRETS_FILE" ]; then
  cp "$SECRETS_TEMPLATE" "$SECRETS_FILE"
  echo "Created $SECRETS_FILE from template."
fi

cd "$IOS_DIR"
xcodegen generate

echo "Generated $IOS_DIR/OpusApp.xcodeproj"
echo "Open it with: open $IOS_DIR/OpusApp.xcodeproj"
