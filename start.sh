#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== JobRadar ==="

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

echo "Starting backend on http://127.0.0.1:8001 ..."
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001 &
BACKEND_PID=$!

# Frontend
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "Installing frontend deps..."
  npm install --silent
fi

echo "Starting frontend on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:   http://localhost:8001"
echo "  Dashboard: http://localhost:5173"
echo "  API docs:  http://localhost:8001/docs"
echo ""
echo "Press Ctrl+C to stop."

trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
