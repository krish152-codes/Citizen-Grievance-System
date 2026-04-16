#!/bin/bash
# ============================================================
# SheharSetu / CityPulse AI — One-Shot Setup Script
# Run: chmod +x setup.sh && ./setup.sh
# ============================================================

set -e  # Exit on any error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

print_step() { echo -e "\n${BLUE}${BOLD}▶ $1${NC}"; }
print_ok()   { echo -e "  ${GREEN}✓ $1${NC}"; }
print_warn() { echo -e "  ${YELLOW}⚠ $1${NC}"; }
print_err()  { echo -e "  ${RED}✗ $1${NC}"; }
print_info() { echo -e "  ${CYAN}ℹ $1${NC}"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     CityPulse AI — Setup Script          ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check Node.js ──────────────────────────────────────
print_step "Checking Node.js..."
if command -v node &> /dev/null; then
  NODE_VER=$(node -v)
  print_ok "Node.js $NODE_VER found"
else
  print_err "Node.js not found!"
  echo "  Install from: https://nodejs.org (v18 or higher)"
  exit 1
fi

# ── 2. Check MongoDB ──────────────────────────────────────
print_step "Checking MongoDB..."
if command -v mongod &> /dev/null; then
  print_ok "MongoDB found"
  # Try to start if not running
  if ! pgrep -x "mongod" > /dev/null; then
    print_warn "MongoDB not running, starting..."
    mongod --fork --logpath /tmp/mongod.log --dbpath /tmp/mongodb || true
    sleep 2
    print_ok "MongoDB started"
  else
    print_ok "MongoDB already running"
  fi
else
  print_warn "MongoDB not found as local service."
  print_info "You can use MongoDB Atlas (cloud) or install: https://www.mongodb.com/try/download/community"
  print_info "For Atlas, update MONGODB_URI in backend/.env"
  echo ""
  read -p "  Continue anyway? (you'll need MongoDB URI in .env) [y/N]: " CONTINUE
  if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# ── 3. Setup Backend ──────────────────────────────────────
print_step "Setting up Backend..."
cd backend

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
  cp .env.example .env
  print_ok ".env created from .env.example"
else
  print_ok ".env already exists"
fi

# Install dependencies
print_info "Installing backend dependencies..."
npm install
print_ok "Backend dependencies installed"

# Create uploads directory
mkdir -p uploads
print_ok "Uploads directory ready"

# Seed the database
print_info "Seeding database with demo data..."
npm run seed
print_ok "Database seeded!"

cd ..

# ── 4. Setup Frontend ─────────────────────────────────────
print_step "Setting up Frontend..."
cd frontend

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
  cp .env.example .env
  print_ok ".env created from .env.example"
else
  print_ok ".env already exists"
fi

# Install dependencies
print_info "Installing frontend dependencies..."
npm install
print_ok "Frontend dependencies installed"

cd ..

# ── 5. Done! ──────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║         ✅ Setup Complete!                    ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}To start the app, open TWO terminals:${NC}"
echo ""
echo -e "  ${CYAN}Terminal 1 (Backend):${NC}"
echo -e "  ${YELLOW}  cd backend && npm run dev${NC}"
echo ""
echo -e "  ${CYAN}Terminal 2 (Frontend):${NC}"
echo -e "  ${YELLOW}  cd frontend && npm run dev${NC}"
echo ""
echo -e "${BOLD}Then open: ${CYAN}http://localhost:5173${NC}"
echo ""
echo -e "${BOLD}Demo Login Credentials:${NC}"
echo -e "  ${CYAN}Admin:   ${NC}admin@citypulse.gov   /  admin123"
echo -e "  ${CYAN}Manager: ${NC}a.moore@infrastructure.gov  /  manager123"
echo -e "  ${CYAN}Citizen: ${NC}rahul@citizen.in  /  citizen123"
echo ""
