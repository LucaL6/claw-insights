---
name: install
description: Install and run the Claw Insights dashboard. Use when setting up a new instance, configuring auth or port, starting/stopping the service, or upgrading.
---

# Install Claw Insights

Monitoring dashboard for OpenClaw agents. Requires Node.js ≥22.5 and a running OpenClaw gateway.

## Quick Start

```bash
git clone https://github.com/LucaL6/claw-insights.git
cd claw-insights && npm install && npm run build && npm link

claw-insights start              # Opens browser, prints auth token
claw-insights start --no-auth    # Disable authentication
claw-insights start --port 8080  # Custom port
```

Verify: `curl http://127.0.0.1:41041/health`

## Configuration

| Variable                    | Default  | Description               |
| --------------------------- | -------- | ------------------------- |
| `CLAW_INSIGHTS_SERVER_PORT` | `41041`  | Server port               |
| `CLAW_INSIGHTS_API_TOKEN`   | _(auto)_ | Auth token (min 32 chars) |
| `CLAW_INSIGHTS_NO_AUTH`     | `false`  | Disable auth              |

## Upgrade

```bash
cd claw-insights && git pull && npm install && npm run build
```

## Next Step

Configure the `snapshot` skill for agent-driven screenshots (REST or MCP).
