#!/usr/bin/env bash
set -euo pipefail

# Dev helper: runs FastAPI (with reload) and the extension watcher concurrently.
# Usage: bash ./dev.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Activate local venv if present
if [ -d ".venv" ]; then
  # shellcheck disable=SC1091
  source ".venv/bin/activate" || true
fi

BACKEND_PORT="8000"
UVICORN_CMD=(python -m uvicorn backend.app.main:app --reload --port "$BACKEND_PORT")

echo "[dev] Starting backend: ${UVICORN_CMD[*]}"
"${UVICORN_CMD[@]}" &
BACKEND_PID=$!

cleanup() {
  echo
  echo "[dev] Shutting down..."
  kill "$BACKEND_PID" >/dev/null 2>&1 || true
  wait "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "[dev] Starting extension watcher in ./extension"
cd extension

if [ ! -d node_modules ]; then
  echo "[dev] Installing extension deps (npm install)..."
  npm install
fi

npm run watch

