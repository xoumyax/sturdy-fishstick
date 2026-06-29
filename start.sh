#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Remote / ngrok mode ──────────────────────────────────────────────────────
# Usage: ./start.sh --remote
# Builds the React app, serves everything from FastAPI on port 8001,
# then opens an ngrok tunnel. Share the printed https URL with any device.
if [[ "$1" == "--remote" ]]; then
  echo "=== Sturdy Fishstick — remote mode ==="

  if ! command -v ngrok &>/dev/null; then
    echo "ngrok not found. Install it first:"
    echo "  brew install ngrok"
    echo "  ngrok config add-authtoken <your-token>  # free at ngrok.com"
    exit 1
  fi

  # Start Ollama if not running
  if ! pgrep -x ollama > /dev/null; then
    echo "Starting Ollama..."
    ollama serve &>/dev/null &
    sleep 2
  fi

  # Build frontend
  echo "Building frontend..."
  cd "$ROOT/frontend"
  npm run build --silent

  # Start backend (serves API + built frontend)
  echo "Starting backend..."
  cd "$ROOT/backend"
  if [ ! -f ".env" ]; then
    echo "ERROR: backend/.env not found."
    exit 1
  fi
  .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 &
  BACKEND_PID=$!
  sleep 2

  echo ""
  echo "  Local preview: http://localhost:8001"
  echo ""
  echo "Starting ngrok — copy the https:// URL and open it on any device:"
  echo "─────────────────────────────────────────────────────────────────"

  trap "echo 'Stopping...'; kill $BACKEND_PID 2>/dev/null; exit 0" INT TERM
  ngrok http 8001

  kill $BACKEND_PID 2>/dev/null
  exit 0
fi

# ── Normal dev mode ──────────────────────────────────────────────────────────
echo "=== Sturdy Fishstick ==="

LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || \
           ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

if ! pgrep -x ollama > /dev/null; then
  echo "Starting Ollama..."
  ollama serve &>/dev/null &
  sleep 2
fi

cd "$ROOT/backend"
if [ ! -f ".env" ]; then
  echo "ERROR: backend/.env not found. Copy backend/.env.example and fill in SERPER_API_KEY."
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "Creating Python virtualenv..."
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi

echo "Starting backend on 0.0.0.0:8001 ..."
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!

cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "Installing frontend deps..."
  npm install --silent
fi

echo "Starting frontend on 0.0.0.0:5173 ..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Local:"
echo "    Dashboard: http://localhost:5173"
echo "    Backend:   http://localhost:8001"
if [ -n "$LOCAL_IP" ]; then
  echo ""
  echo "  On your LAN:"
  echo "    Dashboard: http://$LOCAL_IP:5173"
  echo ""
  echo "  For other networks: ./start.sh --remote"
fi
echo ""
echo "Press Ctrl+C to stop."

trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
