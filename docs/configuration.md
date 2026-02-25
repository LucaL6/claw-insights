# Configuration

Claw Insights uses a three-layer configuration system:

1. **Environment variables** (highest priority)
2. **Config file** (`~/.claw-insights/config.json`)
3. **NODE_ENV defaults** (lowest priority)

## Environment Variables

All variables use the `CLAW_INSIGHTS_` prefix. For backward compatibility, `OPENCLAW_` prefix is also accepted (lower priority).

### Core

| Variable                    | Default            | Description                                                          |
| --------------------------- | ------------------ | -------------------------------------------------------------------- |
| `CLAW_INSIGHTS_SERVER_PORT` | `41041`            | GraphQL API + web server port                                        |
| `CLAW_INSIGHTS_WEB_PORT`    | `41042`            | Vite dev server port (development only)                              |
| `CLAW_INSIGHTS_API_TOKEN`   | _(auto-generated)_ | Auth token (minimum 32 characters). Empty = auto-generate on startup |
| `CLAW_INSIGHTS_NO_AUTH`     | `false`            | Disable authentication entirely (`true` or `1`)                      |
| `CLAW_INSIGHTS_SERVER_ONLY` | `false`            | Run API server without serving web UI                                |

### Data Sources

| Variable                      | Default                                          | Description                                           |
| ----------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `CLAW_INSIGHTS_DB`            | `~/.claw-insights/metrics.db`                    | SQLite database path (alias: `CLAW_INSIGHTS_DB_PATH`) |
| `CLAW_INSIGHTS_SESSIONS_PATH` | `~/.openclaw/agents/main/sessions/sessions.json` | OpenClaw sessions file                                |
| `CLAW_INSIGHTS_LOG_DIR`       | `/tmp/openclaw/`                                 | OpenClaw log directory                                |
| `CLAW_INSIGHTS_CRON_PATH`     | `~/.openclaw/cron/jobs.json`                     | OpenClaw cron jobs file                               |
| `CLAW_INSIGHTS_DIR`           | `~/.openclaw`                                    | OpenClaw base directory                               |
| `CLAW_INSIGHTS_CLI`           | _(auto-detected)_                                | Path to `openclaw` CLI binary                         |

### Data Retention

| Variable                           | Default     | Description                                      |
| ---------------------------------- | ----------- | ------------------------------------------------ |
| `CLAW_INSIGHTS_RAW_RETENTION_DAYS` | `7`         | Days to keep raw metric data                     |
| `CLAW_INSIGHTS_HOURLY_RETENTION`   | `permanent` | Hourly aggregate retention (`permanent` or days) |

### Fonts (Screenshot API)

| Variable                  | Default     | Description                               |
| ------------------------- | ----------- | ----------------------------------------- |
| `CLAW_INSIGHTS_FONTS_DIR` | _(bundled)_ | Custom font directory for Satori renderer |

## Config File

Create `~/.claw-insights/config.json`:

```json
{
  "serverPort": 41041,
  "apiToken": "your-secure-token-at-least-32-characters"
}
```

**Security:** If the file contains `apiToken`, restrict permissions:

```bash
chmod 600 ~/.claw-insights/config.json
```

## NODE_ENV Defaults

Settings change based on `NODE_ENV`:

| Setting        | `development` | `test`            | `production` |
| -------------- | ------------- | ----------------- | ------------ |
| Authentication | **disabled**  | **disabled**      | **enabled**  |
| Server port    | 41041         | 4111              | 41041        |
| Web port       | 41042         | 3211              | 41042        |
| Database       | `metrics.db`  | `test-metrics.db` | `metrics.db` |
| Raw retention  | 7 days        | 1 day             | 7 days       |

## Authentication Details

### Token flow

1. Server starts → generates token (or reads from env/config)
2. Prints token URL: `🔑 http://127.0.0.1:41041/?token=xxx`
3. Browser opens URL → server sets `claw_session` cookie containing a **hash** of the token (7 days, httpOnly)
4. Subsequent requests authenticated via cookie (automatic in browsers) or `Authorization: Bearer <token>` header

### Programmatic access

```bash
# Bearer token (recommended for scripts)
curl -H "Authorization: Bearer YOUR_EXAMPLE_TOKEN # gitleaks:allow" http://127.0.0.1:41041/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ gateway { version uptime } }"}'
```

> **Note:** Cookie-based auth (`claw_session`) is handled automatically by browsers after visiting the token URL. The cookie contains a hash of the token, not the raw token itself.
