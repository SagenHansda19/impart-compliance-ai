#!/usr/bin/env bash
# ==============================================================================
# IMPART Compliance AI - Local Development Runner
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PY="$DIR/.venv/bin/python"

echo "======================================================================"
echo "  ✦ IMPART Compliance AI - Local Development Launcher"
echo "======================================================================"
echo "Select startup mode:"
echo "  1) [Recommended] Frontend only -> Connect to Live Render Backend"
echo "     (Instant startup, 0 local memory, full production DB & model)"
echo ""
echo "  2) Full Local Stack (Model Service: 8001 + Backend: 8080 + Frontend: 8000)"
echo "     (Runs everything locally using Supabase pgvector + SQLite)"
echo ""
echo "  3) Local Backend (8080) + Local Frontend (8000) -> Cloud Model Service"
echo "     (Runs local FastAPI backend proxying to Render Model Engine)"
echo ""
echo "  4) Run All Tests (Pytest + Vitest)"
echo "======================================================================"
read -p "Enter choice [1-4] (default: 1): " choice
choice="${choice:-1}"

case "$choice" in
  1)
    echo ""
    echo ">> Starting Frontend on http://localhost:8000 connected to Render Cloud Backend..."
    cd "$DIR/frontend"
    BACKEND_URL=https://impart-compliance-ai.onrender.com npm run dev
    ;;

  2)
    echo ""
    echo ">> Starting Full Local Stack..."
    trap 'kill $(jobs -p) 2>/dev/null || true' EXIT

    echo ">> [1/3] Starting Model Service on http://127.0.0.1:8001..."
    "$VENV_PY" -m uvicorn --app-dir "$DIR/model" api:app --host 127.0.0.1 --port 8001 --reload &

    sleep 1

    echo ">> [2/3] Starting Backend API on http://127.0.0.1:8080..."
    "$VENV_PY" -m uvicorn --app-dir "$DIR/backend" app.main:app --host 127.0.0.1 --port 8080 --reload &

    sleep 1

    echo ">> [3/3] Starting Frontend Dashboard on http://localhost:8000..."
    cd "$DIR/frontend"
    npm run dev
    ;;

  3)
    echo ""
    echo ">> Starting Local Backend (8080) connected to Render Cloud Model..."
    trap 'kill $(jobs -p) 2>/dev/null || true' EXIT

    MODEL_URL=https://impart-model-service.onrender.com/api/evaluate \
      "$VENV_PY" -m uvicorn --app-dir "$DIR/backend" app.main:app --host 127.0.0.1 --port 8080 --reload &

    sleep 1

    echo ">> Starting Frontend on http://localhost:8000..."
    cd "$DIR/frontend"
    npm run dev
    ;;

  4)
    echo ""
    echo ">> Running Backend & Model Unit Tests (Pytest)..."
    "$VENV_PY" -m pytest model/test_cache_and_guardrails.py backend/tests/test_all.py
    echo ""
    echo ">> Running Frontend Unit Tests (Vitest)..."
    cd "$DIR/frontend" && npm test
    ;;

  *)
    echo "Invalid option. Exiting."
    exit 1
    ;;
esac
