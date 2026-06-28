#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${YELLOW}→${NC} $1"; }

echo ""
echo "🐟 Sturdy Fishstick — Setup"
echo "================================"

# 1. Python version check
step "Checking Python version..."
PY=$(python3 --version 2>&1 | awk '{print $2}')
MAJOR=$(echo "$PY" | cut -d. -f1)
MINOR=$(echo "$PY" | cut -d. -f2)
if [ "$MAJOR" -lt 3 ] || ([ "$MAJOR" -eq 3 ] && [ "$MINOR" -lt 11 ]); then
  fail "Python 3.11+ required (found $PY). Install via brew: brew install python@3.12"
fi
ok "Python $PY"

# 2. Backend virtualenv
step "Setting up Python environment..."
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  ok "Created .venv"
fi
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt
ok "Python dependencies installed"

# 3. .env file
step "Checking environment config..."
if [ ! -f ".env" ]; then
  cp .env.example .env
  warn "Created backend/.env — please set your SERPER_API_KEY before running."
  warn "  Edit: $ROOT/backend/.env"
else
  ok "backend/.env exists"
fi

# 4. Resume directory
step "Checking Resume directory..."
mkdir -p "$ROOT/backend/Resume" "$ROOT/backend/data"
ok "backend/Resume and backend/data ready"
RESUME_COUNT=$(ls "$ROOT/backend/Resume"/*.txt "$ROOT/backend/Resume"/*.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$RESUME_COUNT" -eq 0 ]; then
  warn "No resume files in backend/Resume/ yet."
  warn "  Add your resume as a .txt or .md file to enable Resume Tips feature."
  warn "  Or run: python parse_resume.py path/to/resume.pdf"
else
  ok "Found $RESUME_COUNT resume file(s)"
fi

# 5. Ollama
step "Checking Ollama..."
if ! command -v ollama &>/dev/null; then
  warn "Ollama not found. Install from https://ollama.com and re-run setup."
else
  ok "Ollama found"
  if ollama list 2>/dev/null | grep -q "phi3:mini"; then
    ok "phi3:mini model already pulled"
  else
    echo "  Pulling phi3:mini (~2.3 GB)..."
    ollama pull phi3:mini
    ok "phi3:mini pulled"
  fi
fi

# 6. Frontend
step "Setting up frontend..."
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  npm install --silent
fi
ok "Frontend dependencies installed"

echo ""
echo "================================"
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit backend/.env and set SERPER_API_KEY"
echo "  2. (Optional) Add your resume to backend/Resume/"
echo "  3. Run: ./start.sh"
echo ""
