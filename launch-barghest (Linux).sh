#!/bin/sh
# Launch BARGHEST: double-click this file and the project runs. Stamped by assembly sync-claude; do not
# hand-edit, regenerate. The .command copy is for macOS Finder, the .sh copy for Linux; same body.
cd "$(dirname "$0")" || exit 1
ROOT="$(cd ../../.. && pwd)"
pause() { printf '\nPress Enter to close this window. '; read -r _; }
if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is not installed. Install Node 22 and pnpm, then double-click this file again."
  pause; exit 1
fi
# A project that arrived after the last install (assembly new, a git pull) has no node_modules of its own yet.
if [ ! -d "$ROOT/node_modules" ] || [ ! -d node_modules ]; then
  echo "First run: installing (one time)..."
  (cd "$ROOT" && pnpm install) || { pause; exit 1; }
fi
open_url() {
  if command -v open >/dev/null 2>&1; then open -a "Google Chrome" "$1" 2>/dev/null || open "$1"
  elif command -v google-chrome >/dev/null 2>&1; then google-chrome "$1" >/dev/null 2>&1 &
  elif command -v chromium >/dev/null 2>&1; then chromium "$1" >/dev/null 2>&1 &
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 &
  fi
}
printf '%s\n' "Launching BARGHEST. Close this window to stop it."
pnpm exec vite --open
pause
