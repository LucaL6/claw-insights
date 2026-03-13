---
name: claw-insights-install
description: Install, configure, and run the Claw Insights real-time monitoring dashboard for OpenClaw agents. Use when setting up claw-insights for the first time, upgrading versions, configuring auth or port, starting or stopping the service, or troubleshooting connection and startup failures.
---

# Install Claw Insights

**Announce at start:** "I'm using the claw-insights-install skill to set up the dashboard."

Real-time monitoring dashboard for OpenClaw agents. Requires Node.js ≥ 22.5 and a running OpenClaw gateway.

## Install

```bash
# One-line install (recommended)
curl -fsSL https://claw-insights.com/install.sh | sh

# Or via npm
npm install -g claw-insights
```

## Run

```bash
claw-insights start             # Default port 41041, opens browser
claw-insights start --port 8080 # Custom port
claw-insights start --no-auth   # Disable authentication
claw-insights stop              # Stop the service
claw-insights restart           # Restart
```

## Verify

```bash
curl http://127.0.0.1:41041/health
# → {"status":"ok",...}
```

## Upgrade

```bash
npm update -g claw-insights
# Or re-run the install script
curl -fsSL https://claw-insights.com/install.sh | sh
```

## Quick Config

| Variable                           | Default                       | Description                 |
| ---------------------------------- | ----------------------------- | --------------------------- |
| `CLAW_INSIGHTS_SERVER_PORT`        | `41041`                       | Server port                 |
| `CLAW_INSIGHTS_API_TOKEN`          | _(auto)_                      | Auth token (min 32 chars)   |
| `CLAW_INSIGHTS_NO_AUTH`            | `false`                       | Disable auth entirely       |
| `CLAW_INSIGHTS_DB`                 | `~/.claw-insights/metrics.db` | SQLite database path        |
| `CLAW_INSIGHTS_RAW_RETENTION_DAYS` | `7`                           | Raw metric retention (days) |

Full configuration reference: See [references/configuration.md](references/configuration.md)

## Troubleshooting

| Symptom                     | Cause                        | Fix                                                |
| --------------------------- | ---------------------------- | -------------------------------------------------- |
| `EADDRINUSE`                | Port already in use          | `claw-insights stop` then retry, or use `--port`   |
| `Cannot connect to gateway` | OpenClaw gateway not running | Start gateway: `openclaw gateway start`            |
| `401 Unauthorized`          | Token mismatch               | Check `CLAW_INSIGHTS_API_TOKEN` or use `--no-auth` |
| `Node.js version error`     | Node.js < 22.5               | Upgrade Node.js to ≥ 22.5                          |

More troubleshooting: See [references/troubleshooting.md](references/troubleshooting.md)

## Next Step

Use the `claw-insights-snapshot` skill to capture dashboard screenshots via REST API.
