---
name: install
description: Install, configure, and run the Claw Insights dashboard. Use when setting up a new instance, changing configuration, or managing the service lifecycle.
---

# Install & Configure Claw Insights

Install and run the OpenClaw monitoring dashboard. Requires Node.js ≥22.5 and a running OpenClaw gateway.

## Quick Reference

```bash
# Install (from source)

git clone https://github.com/nicepkg/claw-insights.git
cd claw-insights && npm install && npm run build && npm link

# Start
claw-insights start                   # Opens token URL in output
claw-insights start --no-auth         # Disable authentication
claw-insights start --port 8080       # Custom port

# Verify
curl http://localhost:4000/health     # No auth required

# Upgrade (pull latest + rebuild)
git pull && npm install && npm run build
```

### Key Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAW_INSIGHTS_SERVER_PORT` | `4000` | Server port |
| `CLAW_INSIGHTS_API_TOKEN` | *(auto-generated)* | Auth token (min 32 chars) |
| `CLAW_INSIGHTS_NO_AUTH` | `false` | Disable auth (`true` or `1`) |

## Details

For full documentation, see:
- [Configuration](../../configuration.md) — all env vars, config file, NODE_ENV defaults, auth flow
