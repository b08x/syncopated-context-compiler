# Syncopated Context Compiler (SCC)

> Visual driver and context compiler for LLM conversation graphs and `SKILL.md` distillation.

Syncopated Context Compiler compiles multi-turn conversation exports (Claude, ChatGPT, Mistral) into a rich 3D graph space, evaluates conversational trajectories, and distills high-value lessons into gitagent-compatible `SKILL.md` artifacts. Within the broader ecosystem, SCC serves as the visual driver and interactive frontend for `sfl-engine`.

---

## Features

- **Full-Stack Architecture**: React 19 + Vite frontend served alongside an Express API proxy (`/api/llm/*`) supporting Gemini, OpenRouter, Mistral, Groq, and local Ollama.
- **Rootless Podman Native**: Designed specifically for Podman with the `docker-compose` plugin, with support for OCI Containerfiles and netavark/pasta rootless networking.
- **Hardware-Adaptive Profiles**: Auto-detects and supports `cpu`, `nvidia` (CUDA / CDI), and `intel` (`/dev/dri` render nodes) acceleration profiles.
- **Host Gateway Routing**: Pre-configured `host.containers.internal` routing to communicate with host-native Ollama (port 11434) and `sfl-engine` (port 3001) without requiring host networking.
- **Fast Graceful Shutdown**: Dedicated SIGTERM/SIGINT signal handling ensures sub-second container termination.

---

## Quick Start with Podman

### Prerequisites

- Podman (`v5.0+`)
- Podman Docker Compose provider (`/usr/libexec/docker/cli-plugins/docker-compose` or `docker-compose`)
- (Optional) NVIDIA Container Toolkit (`nvidia-ctk`) for GPU acceleration

### 1. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Adjust API keys or endpoints in `.env` if desired. By default, `OLLAMA_BASE_URL` points to `http://host.containers.internal:11434` to communicate with any Ollama instance already running on the host.

### 2. Auto-Detect Hardware and Launch

Use the included launcher script to automatically detect your host's GPU capabilities and start the container:

```bash
# Auto-detects NVIDIA -> Intel -> CPU and starts in background
./docker/start.sh

# Or rebuild image before launching
./docker/start.sh --build
```

### 3. Check Status and Logs

```bash
# View service status
./docker/start.sh --status

# Follow container logs
./docker/start.sh --logs
```

### 4. Stop Services

```bash
./docker/start.sh --down
```

---

## Direct Compose Commands

You can run `podman compose` directly using specific hardware profiles against `docker/compose.yaml`:

### CPU Profile (Universal Fallback)
```bash
podman compose -f docker/compose.yaml --profile cpu up -d
```

### NVIDIA Profile (CUDA Acceleration)
```bash
podman compose -f docker/compose.yaml --profile nvidia up -d
```

### Intel Profile (OpenVINO / iGPU)
```bash
podman compose -f docker/compose.yaml --profile intel up -d
```

### Build or Rebuild
```bash
podman compose -f docker/compose.yaml --profile cpu build
# or using podman build directly:
podman build -t syncopated-context-compiler:latest -f docker/Containerfile .
```

---

## Hardware Acceleration Profiles

| Profile | Target Hardware | Configuration Mechanism | Verification Command |
|---|---|---|---|
| `cpu` | Standard x86_64 CPU | Default fallback, minimal footprint | `podman exec syncopated-context-compiler uname -m` |
| `nvidia` | NVIDIA GPUs (T1200, RTX, etc.) | CUDA / CDI device reservation (`driver: nvidia`) | `nvidia-smi` |
| `intel` | Intel Iris Xe / Arc / Core Ultra | Device passthrough `/dev/dri` + `video`/`render` groups | `ls -la /dev/dri` |

---

## Service Endpoints

Once running, access the services:

- **Web Application UI**: [http://localhost:3000](http://localhost:3000)
- **API Health Check**: [http://localhost:3000/api/health](http://localhost:3000/api/health)
- **LLM Provider Status**: [http://localhost:3000/api/llm/status](http://localhost:3000/api/llm/status)

---

## Project Structure

```
├── docker/
│   ├── Containerfile              # Multi-stage production OCI build definition
│   ├── Dockerfile                 # Symlink to Containerfile for Docker CLI compatibility
│   ├── compose.yaml               # Compose orchestration with hardware profiles
│   ├── containerization-plan.json # Preflight deployment decision manifest
│   ├── start.sh                   # Hardware auto-detection & lifecycle launcher
│   ├── .containerignore           # Build context exclusions for Podman
│   └── .dockerignore              # Build context exclusions for Docker (symlink)
├── .env.example                   # Template environment configuration
├── server.ts                      # Express server, LLM proxy, & static SPA runner
├── src/                           # React 19 application components and graph engines
├── lib/                           # Utility libraries
└── components/                    # UI primitives
```
