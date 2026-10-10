#!/bin/sh
# Start BARGHEST on this Mac: the engine (8787) and the app (5180), then open the browser.
# The first run installs the packages and puts the two AI models in place. Close this window to stop BARGHEST.
cd "$(dirname "$0")" || exit 1
pause() { printf '\nPress Enter to close this window. '; read -r _; }

xattr -dr com.apple.quarantine . 2>/dev/null

NODE_OK=$(node -e 'const [a,b]=process.versions.node.split(".").map(Number);console.log(a>22||(a===22&&b>=18)?"yes":"no")' 2>/dev/null)
if [ "$NODE_OK" != "yes" ]; then
  echo "Node 22.18 or newer is needed. Install it from nodejs.org (the LTS button), then double-click this file again."
  open "https://nodejs.org/en/download"
  pause; exit 1
fi

OLLAMA=""
if command -v ollama >/dev/null 2>&1; then OLLAMA=ollama
elif [ -x /Applications/Ollama.app/Contents/Resources/ollama ]; then OLLAMA=/Applications/Ollama.app/Contents/Resources/ollama
fi
if [ -z "$OLLAMA" ]; then
  echo "Ollama is needed. Install it from ollama.com, open it once, then double-click this file again."
  open "https://ollama.com/download/mac"
  pause; exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run: installing packages (one time)..."
  if command -v pnpm >/dev/null 2>&1; then pnpm install || { pause; exit 1; }
  else npx --yes pnpm install || { pause; exit 1; }
  fi
fi

if ! curl -s -m 2 http://localhost:11434 >/dev/null 2>&1; then
  echo "Starting Ollama..."
  open -a Ollama 2>/dev/null || ("$OLLAMA" serve >/dev/null 2>&1 &)
  i=0; while [ $i -lt 30 ] && ! curl -s -m 2 http://localhost:11434 >/dev/null 2>&1; do sleep 1; i=$((i+1)); done
fi

MODELS="$HOME/.ollama/models"
if [ ! -f "$MODELS/manifests/registry.ollama.ai/library/qwen3/4b-instruct" ] || [ ! -f "$MODELS/manifests/registry.ollama.ai/library/nomic-embed-text/latest" ]; then
  echo "Putting the two AI models in place (one time, 2.6 GB)..."
  if [ -d ollama-models ]; then
    mkdir -p "$MODELS"
    ditto ollama-models "$MODELS" || { echo "Could not copy the models."; pause; exit 1; }
  else
    "$OLLAMA" pull qwen3:4b-instruct && "$OLLAMA" pull nomic-embed-text || { echo "Could not download the models."; pause; exit 1; }
  fi
fi
"$OLLAMA" list

export PATH="$PWD/node_modules/.bin:$PATH"
echo "Launching BARGHEST. Close this window to stop it."
(sleep 6; open "http://localhost:5180") &
BARGHEST_OLLAMA=on node scripts/dev.mjs
pause
