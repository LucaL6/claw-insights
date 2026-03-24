<div align="center">
  <img src="packages/web/public/logo/icon-dark.svg" width="80" alt="Claw Insights" />
  <h1>Claw Insights</h1>
  <p><strong>Open-source agent observability — replay, metrics, logs & shareable snapshots</strong></p>
  <p><sub>Built for <a href="https://github.com/openclaw/openclaw">OpenClaw</a> · Adapter architecture — extend to any agent runtime</sub></p>
  <p>
    <img src="https://img.shields.io/badge/%F0%9F%94%8C_Zero_Intrusion-read--only_sidecar-10b981" alt="Zero Intrusion" />
    <img src="https://img.shields.io/badge/%F0%9F%94%8D_Full_Replay-session_transcripts-6366f1" alt="Full Replay" />
    <img src="https://img.shields.io/badge/%F0%9F%93%B8_Shareable_Snapshots-PNG_%7C_SVG-f59e0b" alt="Shareable Snapshots" />
  </p>
  <p>
    <a href="https://github.com/LucaL6/claw-insights/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/LucaL6/claw-insights/ci.yml?branch=main&label=CI" alt="CI" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-%E2%89%A522.5-green" alt="Node.js" /></a>
    <img src="https://img.shields.io/badge/macOS-supported-blue" alt="macOS" />
    <img src="https://img.shields.io/badge/Linux-supported-blue" alt="Linux" />
  </p>
  <br />
  <img src="docs/assets/hero-montage.png" width="100%" alt="Claw Insights dashboard — agent observability with session replay, token analytics, and shareable snapshots" />
</div>

---

<p align="center">
  <strong>English</strong> ·
  <a href="README.zh-CN.md">中文</a>
</p>

## Features

- **Zero Intrusion** — Self-hosted, local-first observability sidecar; no SDK, no code changes, no cloud calls, data never leaves your machine
- **Session Replay** — Full transcript timeline with role separation, tool calls, thinking steps, and per-turn token tracking
- **Shareable Snapshots** — Generate PNG/SVG status cards via REST API or CLI with themes, languages, and detail levels
- **Metrics Dashboard** — Per-model token analytics, error rates, and uptime over 30m / 1h / 6h / 12h / 24h
- **Event Logs** — Structured log viewer with density heatmap, filtering, and search for AI agent debugging
- **One Command Setup** — Auto-discovers your running gateway, lightweight SQLite storage
- **Dark / Light · EN / 中文** — Full theming and i18n with runtime toggle

## Quick Start

```bash
# Install globally
npm install -g claw-insights

# Start — auto-connects to your running OpenClaw gateway
claw-insights start
```

On launch you'll see:

```
✅ Claw Insights v0.1.0    ready in 1.2s

➜  Open:  http://127.0.0.1:41041/?token=abc123...
   Auth:  token (auto-generated)

PID 12345 · daemon · Port 41041
```

Open the URL — token is exchanged for a session cookie, and you're in.

## Usage

### 🔌 Zero Intrusion — start & connect

```bash
claw-insights start                    # Auto-discovers running OpenClaw gateway
claw-insights start --gateway <url>    # Connect to specific gateway
claw-insights start --no-auth          # Disable token authentication
claw-insights start --open             # Start and open browser automatically
claw-insights status                   # Show access URL & connection info
claw-insights status --json            # Machine-readable status (includes auth.accessUrl)
claw-insights logs -n 50               # Tail daemon logs
claw-insights restart                  # Restart daemon
claw-insights stop                     # Stop daemon
```

### 🔍 Full Replay — sessions & transcripts

Browse all sessions in the dashboard. Click any session to see the full transcript timeline — with role separation, tool call detail, and per-turn token / latency tracking.

### 📸 Shareable Snapshots — capture & share

```bash
claw-insights snapshot                              # Default: PNG, dark theme, 6h range
claw-insights snapshot --format svg --theme light   # SVG light theme
claw-insights snapshot --range 24h --detail full    # 24h detailed snapshot
claw-insights snapshot --lang zh --quick            # Quick Chinese compact card
```

REST API for programmatic access:

```bash
curl -X POST http://localhost:41041/api/snapshot \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"format":"svg","theme":"light","detail":"full","range":"24h"}'
```

## How It Works

Claw Insights runs as a **read-only sidecar** for LLM & agent observability alongside your AI agent runtime.
It tails log files and CLI output — no SDK, no code changes, no network calls.

```
Agent Runtime (OpenClaw / Claude Code / ...)
  │
  ├─ log files ──→  claw-insights daemon
  │                     │
  ├─ CLI probe ──→      ├─→ SQLite (local-only storage)
  │                     ├─→ GraphQL API + SSE subscriptions
  │                     └─→ Satori renderer (PNG/SVG)
  │                              │
  └─────────────────────────→  React dashboard (real-time)
```

**Tech stack:** Express · GraphQL Yoga · SQLite · Satori · React 19 · Vite · ECharts

→ Full configuration and install options: [docs/configuration.md](docs/configuration.md)

## 🤖 AI Agent Friendly

Claw Insights ships with structured skills for AI agents —
your agent can install, operate, and capture snapshots autonomously.

See **[AGENTS.md](AGENTS.md)** for the full index.

### Install Skill

Help AI agents set up Claw Insights from scratch — install, configure, launch, and verify.

```bash
# Agent reads the skill, then executes:
npm install -g claw-insights
claw-insights start
claw-insights status   # Verify: running + gateway connected
```

→ Full skill: [docs/skills/install/SKILL.md](docs/skills/install/SKILL.md)

### Snapshot Skill

Teach agents to capture dashboard state as PNG/SVG/JSON and share to chat channels.

```bash
# Capture a dark-theme Chinese snapshot for the last 6 hours
claw-insights snapshot --theme dark --lang zh --range 6h -o status.png

# REST API — programmatic access from any agent
curl -X POST http://localhost:41041/api/snapshot \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"format":"svg","theme":"light","detail":"full"}'
```

→ Full skill: [docs/skills/snapshot/SKILL.md](docs/skills/snapshot/SKILL.md)

## Roadmap

✅ Shipped · 🔧 In Progress · 📋 Planned

- ✅ Session replay & transcript timeline
- ✅ Metrics dashboard (token analytics, error rates, uptime)
- ✅ Shareable snapshots (PNG / SVG / JSON)
- 🔧 Thinking / reasoning step visualization — *in progress*
- 🔧 Agent tool call observability — *in progress*
- 📋 Multiple data source adapters (Claude Code, Codex, ...)
- 📋 Multi-agent topology view

## Architecture

```
claw-insights/
├── packages/
│   ├── server/     Express + GraphQL Yoga + SQLite + Satori renderer
│   ├── web/        React 19 + Vite + Tailwind + ECharts + urql
│   └── shared/     Codegen TypeScript types (shared between server & web)
├── bin/            CLI entry (start/stop/restart/status/logs/snapshot/run)
└── codegen.ts      GraphQL codegen config (3 targets)
```

→ Full architecture, dev setup, and codegen: [docs/architecture.md](docs/architecture.md)

## Documentation

| Document                               | Description                                        |
| -------------------------------------- | -------------------------------------------------- |
| [Configuration](docs/configuration.md) | All env vars, config file, auth model              |
| [Architecture](docs/architecture.md)   | System design, dev setup, testing                  |
| [API Reference](docs/api-reference.md) | GraphQL + REST endpoint signatures                 |
| [AGENTS.md](AGENTS.md)                 | AI agent skill index                               |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, PR guidelines, and code conventions.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting and security model.

## License

[MIT](LICENSE)
