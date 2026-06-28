#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Sturdy Fishstick ==="

# Detect local network IP for remote access info
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || \
           ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

# Start Ollama if not already running
if ! pgrep -x ollama > /dev/null; then
  echo "Starting Ollama..."
  ollama serve &>/dev/null &
  sleep 2
fi

# Backend
cd "$ROOT/backend"
if [ ! -f ".env" ]; then
  echo "ERROR: backend/.env not found. Copy backend/.env.example to backend/.env and fill in SERPER_API_KEY."
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

# Frontend
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
  echo "  On your network (use from other devices):"
  echo "    Dashboard: http://$LOCAL_IP:5173"
  echo "    Backend:   http://$LOCAL_IP:8001"
fi
echo ""
echo "Press Ctrl+C to stop."

trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
