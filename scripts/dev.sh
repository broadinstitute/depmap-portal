#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MODE="${1:-}"

# Check for Procfile process managers first
if command -v overmind >/dev/null 2>&1; then
    echo "Starting development environment with overmind..."
    exec overmind start -f Procfile.dev
elif command -v honcho >/dev/null 2>&1; then
    echo "Starting development environment with honcho..."
    exec honcho start -f Procfile.dev
elif command -v foreman >/dev/null 2>&1; then
    echo "Starting development environment with foreman..."
    exec foreman start -f Procfile.dev
fi

# Fallback: native multi-process supervisor with trap cleanup
echo "No Procfile manager (overmind/honcho/foreman) detected. Running built-in supervisor..."

PIDS=()

cleanup() {
    echo ""
    echo "Shutting down development services..."
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    wait 2>/dev/null || true
    echo "All development services stopped."
}

trap cleanup SIGINT SIGTERM EXIT

log() {
    local service="$1"
    shift
    while IFS= read -r line; do
        printf "[%-15s] %s\n" "$service" "$line"
    done
}

# 1. Start Redis if not already running on port 6379
if nc -z 127.0.0.1 6379 2>/dev/null; then
    echo "[redis          ] Redis is already running on port 6379."
else
    if command -v redis-server >/dev/null 2>&1; then
        echo "[redis          ] Starting redis-server..."
        redis-server 2>&1 | log "redis" &
        PIDS+=($!)
        sleep 1
    else
        echo "[redis          ] WARNING: redis-server not found on PATH. Celery workers may fail."
    fi
fi

# 2. Start Breadbox API
echo "[breadbox       ] Starting Breadbox on http://127.0.0.1:8000..."
(cd breadbox && ./bb run) 2>&1 | log "breadbox" &
PIDS+=($!)

# 3. Start Breadbox Worker
echo "[breadbox-worker] Starting Breadbox Celery worker..."
(cd breadbox && ./bb run_worker) 2>&1 | log "breadbox-worker" &
PIDS+=($!)

if [[ "$MODE" == "--elara" ]]; then
    # Elara mode: start Elara frontend
    echo "[frontend-elara ] Starting Elara frontend on http://localhost:8001..."
    (cd frontend && yarn dev:elara) 2>&1 | log "frontend-elara" &
    PIDS+=($!)
else
    # Portal mode: start portal-backend and portal-frontend
    echo "[portal-backend ] Starting portal-backend on http://127.0.0.1:5000..."
    (cd portal-backend && ./flask run) 2>&1 | log "portal-backend" &
    PIDS+=($!)

    echo "[portal-worker  ] Starting portal-backend Celery worker..."
    (cd portal-backend && ./flask run_dev_worker) 2>&1 | log "portal-worker" &
    PIDS+=($!)

    echo "[frontend-portal] Starting portal-frontend on http://127.0.0.1:5001..."
    (cd frontend && yarn dev:portal) 2>&1 | log "frontend-portal" &
    PIDS+=($!)
fi

echo "Development environment running. Press Ctrl+C to terminate all services."
wait
