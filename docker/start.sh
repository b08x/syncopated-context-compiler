#!/usr/bin/env bash
# ==============================================================================
# Syncopated Context Compiler - Hardware Auto-detection & Container Launcher
# Supports Podman (with docker-compose CLI plugin) and Docker Compose
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$SCRIPT_DIR"

# Source project root .env if present
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

# Determine Compose Command
if command -v podman &>/dev/null && podman compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="podman compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
elif command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v podman-compose &>/dev/null; then
  COMPOSE_CMD="podman-compose"
else
  echo "Error: Neither 'podman compose', 'docker compose', nor 'podman-compose' found." >&2
  exit 1
fi

ACTION="up -d"
BUILD_FLAG=""
REQUESTED_PROFILE=""

# Parse command line options
while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)
      BUILD_FLAG="--build"
      shift
      ;;
    --down|down)
      ACTION="down"
      shift
      ;;
    --logs|logs)
      ACTION="logs -f"
      shift
      ;;
    --status|ps)
      ACTION="ps"
      shift
      ;;
    --profile)
      if [[ -n "${2:-}" ]]; then
        REQUESTED_PROFILE="$2"
        shift 2
      else
        echo "Error: --profile requires an argument (cpu, nvidia, intel, etc.)" >&2
        exit 1
      fi
      ;;
    -h|--help)
      cat <<EOF
Usage: ./docker/start.sh [OPTIONS]

Options:
  --build              Rebuild container images before starting
  --profile <name>     Manually specify compose profile (cpu, nvidia, intel)
  --down               Stop and remove running containers
  --logs               Follow container logs
  --status             Show container status
  -h, --help           Show this help message

Default behavior:
  Auto-detects host hardware (NVIDIA GPU -> 'nvidia', Intel iGPU -> 'intel', fallback -> 'cpu')
  and starts containers in background.
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1 (see --help)" >&2
      exit 1
      ;;
  esac
done

# If action is down, logs, or ps, execute directly across all profiles
if [[ "$ACTION" == "down" || "$ACTION" == "ps" || "$ACTION" == "logs -f" ]]; then
  echo "Executing: $COMPOSE_CMD --profile \"*\" $ACTION"
  exec $COMPOSE_CMD --profile "*" $ACTION
fi

# Detect hardware acceleration profile if not explicitly requested
if [[ -n "$REQUESTED_PROFILE" ]]; then
  PROFILE="$REQUESTED_PROFILE"
  echo "Using explicitly requested profile: $PROFILE"
else
  if command -v nvidia-smi &>/dev/null && nvidia-smi &>/dev/null; then
    PROFILE="nvidia"
    echo "Hardware detection: NVIDIA GPU found -> activating 'nvidia' profile"
  elif [[ -d "/dev/dri" ]] && compgen -G "/dev/dri/renderD*" >/dev/null 2>&1; then
    PROFILE="intel"
    echo "Hardware detection: Intel GPU / render device found -> activating 'intel' profile"
  else
    PROFILE="cpu"
    echo "Hardware detection: No supported GPU detected -> activating 'cpu' profile"
  fi
fi

echo "Starting Syncopated Context Compiler using: $COMPOSE_CMD --profile $PROFILE $ACTION $BUILD_FLAG"
$COMPOSE_CMD --profile "$PROFILE" up -d $BUILD_FLAG

echo ""
echo "=== Services Status ==="
$COMPOSE_CMD --profile "$PROFILE" ps

echo ""
echo "Application URL: http://localhost:${APP_PORT:-3000}"
echo "API Health:      http://localhost:${APP_PORT:-3000}/api/health"
echo "To view logs:    ./docker/start.sh --logs"
echo "To stop:         ./docker/start.sh --down"
