# 💡 Claw Insights

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.5-green)](https://nodejs.org)

Real-time monitoring dashboard for [OpenClaw](https://github.com/openclaw/openclaw) gateway.

## 🤖 AI Agent Friendly

This project ships with structured resources for AI agents — see **[AGENTS.md](AGENTS.md)** for the full skill index, or jump directly to a skill:

| Skill                                           | Use case                                    |
| ----------------------------------------------- | ------------------------------------------- |
| [install](docs/skills/install/SKILL.md)         | Install, configure, and launch              |
| [api](docs/skills/api/SKILL.md)                 | Query sessions, metrics, events via GraphQL |
| [screenshot](docs/skills/screenshot/SKILL.md)   | Capture dashboard as PNG                    |
| [overview](docs/skills/overview/SKILL.md)       | Architecture and data flow                  |
| [development](docs/skills/development/SKILL.md) | Local dev, tests, PR workflow               |

## Features

- **Live Sessions** — Active sessions with sub-agent tree, token usage, and context progress
- **Metrics Charts** — Sessions, token consumption (per-model breakdown), errors, and uptime over 1h/6h/12h/24h
- **Event Logs** — Structured event viewer with density heatmap, type filtering, and search
- **Gateway Control** — Restart and update operations
- **Screenshot API** — Capture dashboard state as PNG via REST endpoint
- **Dark / Light Theme** — CSS variable-based theming with toggle
- **i18n** — English and Chinese (中文) with runtime switching

## Quick Start

**Prerequisites:** Node.js ≥22.5 (`nvm use` reads `.nvmrc`), OpenClaw gateway running

### Install

**Recommended (npm):**

```bash
npm install -g claw-insights
```

**From source (development):**

```bash
git clone https://github.com/LucaL6/claw-insights.git
cd claw-insights
npm install
npm run build
npm link
```

### Start

```bash
claw-insights start
# or (from source checkout)
npm start
```

On first launch you'll see an access URL:

```text
💡 Claw Insights started (PID 12345, mode: full, port: 41041)
🔑 http://127.0.0.1:41041/?token=abc123...
```

Open the URL in your browser. The token is exchanged for a rotating session cookie (max-age 7 days) backed by rotating server keys.

```bash
claw-insights start --no-auth      # Disable authentication
claw-insights start --port 8080    # Custom port
claw-insights start --server-only  # API only, no web UI
claw-insights status               # Show current access URL
claw-insights stop                 # Stop daemon
```

### Verify

1. **Health check:**

   ```bash
   curl http://127.0.0.1:41041/health
   ```

   Expected: `{"status":"ok","gateway":"connected","db":"ok",...}`

2. **Dashboard:** Open the token URL — you should see live session data, metrics charts, and event logs.

3. **GraphQL Playground:** Navigate to `http://127.0.0.1:41041/graphql` for the interactive API explorer.

### Snapshot API Quick Start

```bash
# JSON snapshot
curl -sS -X POST "http://127.0.0.1:41041/api/snapshot" \
  -H "Content-Type: application/json" \
  -d '{"format":"json","detail":"standard","range":"6h","theme":"dark","lang":"en"}'

# PNG snapshot
curl -sS -X POST "http://127.0.0.1:41041/api/snapshot" \
  -H "Content-Type: application/json" \
  -d '{"format":"png","detail":"compact","range":"1h","theme":"light","lang":"zh"}' \
  --output snapshot.png
```

If auth is enabled, add:

```bash
-H "Authorization: Bearer $CLAW_INSIGHTS_API_TOKEN"
```

See server docs for full options and error semantics: [`packages/server/README.md`](packages/server/README.md#snapshot-api-integration).

### Common Issues

| Problem                            | Solution                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `claw-insights: command not found` | Run `npx claw-insights start` or add npm global bin to `PATH`: `export PATH="$(npm config get prefix)/bin:$PATH"` |
| `gateway: disconnected`            | Ensure OpenClaw is running: `openclaw gateway start`                                                              |
| `EADDRINUSE`                       | Port 41041 in use — set `CLAW_INSIGHTS_SERVER_PORT`                                                               |
| Empty dashboard                    | Check OpenClaw has active sessions: `openclaw status`                                                             |
| Token rejected                     | Run `claw-insights status` and open the current URL; if still rejected, clear cookies and re-exchange session     |

## Architecture

```
claw-insights/
├── packages/
│   ├── web/        React 19 + Vite + Tailwind + ECharts + urql
│   ├── server/     Express + GraphQL Yoga + SQLite + Satori
│   └── shared/     TypeScript types (codegen) shared between web & server
├── codegen.ts      GraphQL codegen config (3 targets: shared/server/web)
```

**Data pipeline:** OpenClaw gateway → log tailing + CLI/RPC → SQLite → GraphQL → urql + WebSocket subscriptions → React

→ See [Architecture & Development](docs/architecture.md) for full design, dev setup, testing, and codegen.

## Authentication

Claw Insights uses URL token exchange (similar to Jupyter Notebook) with a fixed Bearer token + rotating browser session cookie.

1. On startup, Bearer token is resolved (`CLAW_INSIGHTS_API_TOKEN` preferred; otherwise local secret/fresh bootstrap)
2. The token URL is printed: `🔑 http://127.0.0.1:41041/?token=xxx`
3. Open the URL → `claw_session=<kid>:<digest>` cookie is set → redirected to dashboard
4. Session cookie key-ring rotates automatically (default: 24h interval + 12h grace)
5. Bearer token remains stable for scripts and automation

If needed, re-exchange browser auth via `/?token=...` (for example after long inactivity beyond rotation + grace window).

Auth is disabled by default in development (`NODE_ENV=development`).

## Configuration

Priority: Environment variables > `~/.claw-insights/config.json` > NODE_ENV defaults.

| Variable                                         | Default                       | Description                              |
| ------------------------------------------------ | ----------------------------- | ---------------------------------------- |
| `CLAW_INSIGHTS_SERVER_PORT`                      | `41041`                       | API server port                          |
| `CLAW_INSIGHTS_WEB_PORT`                         | `41042`                       | Web UI port (dev only)                   |
| `CLAW_INSIGHTS_API_TOKEN`                        | _(auto)_                      | Fixed Bearer token (≥32 chars)           |
| `CLAW_INSIGHTS_NO_AUTH`                          | `false`                       | Disable auth                             |
| `CLAW_INSIGHTS_TOKEN_ROTATION_ENABLED`           | `true`                        | Enable rotating session-cookie key-ring  |
| `CLAW_INSIGHTS_TOKEN_ROTATION_INTERVAL_MS`       | `86400000`                    | Rotation interval (24h)                  |
| `CLAW_INSIGHTS_TOKEN_GRACE_MS`                   | `43200000`                    | Previous-key grace window (12h)          |
| `CLAW_INSIGHTS_TOKEN_ROTATION_CHECK_INTERVAL_MS` | `300000`                      | Background rotation check cadence (5min) |
| `CLAW_INSIGHTS_TOKEN_MAX_PREVIOUS`               | `2`                           | Max retained previous keys               |
| `CLAW_INSIGHTS_DB`                               | `~/.claw-insights/metrics.db` | Database path                            |
| `CLAW_INSIGHTS_RAW_RETENTION_DAYS`               | `7`                           | Raw data retention (days)                |

→ See [Configuration](docs/configuration.md) for all options, config file, and NODE_ENV defaults.

## Documentation

| Document                                           | Description                                  |
| -------------------------------------------------- | -------------------------------------------- |
| [Configuration](docs/configuration.md)             | All env vars, config file, NODE_ENV defaults |
| [Architecture & Development](docs/architecture.md) | System design + dev setup, testing, codegen  |
| [API Reference](docs/api-reference.md)             | GraphQL + REST endpoint signatures           |
| [AGENTS.md](AGENTS.md)                             | AI agent skill index                         |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development setup and workflow
- Pull request guidelines
- Code style and commit conventions

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting and security model.

## License

[MIT](LICENSE)
