# Configuration

Claw Insights uses a three-layer configuration system:

1. **Environment variables** (highest priority)
2. **Config file** (`~/.claw-insights/config.json`)
3. **NODE_ENV defaults** (lowest priority)

## Environment Variables

All variables use the `CLAW_INSIGHTS_` prefix. For backward compatibility, `OPENCLAW_` prefix is also accepted (lower priority).

### Core

| Variable                    | Default            | Description                                                                |
| --------------------------- | ------------------ | -------------------------------------------------------------------------- |
| `CLAW_INSIGHTS_SERVER_PORT` | `41041`            | GraphQL API + web server port                                              |
| `CLAW_INSIGHTS_WEB_PORT`    | `41042`            | Vite dev server port (development only)                                    |
| `CLAW_INSIGHTS_API_TOKEN`   | _(auto-generated)_ | Fixed Bearer token (minimum 32 characters). Empty = auto-generate on fresh |
| `CLAW_INSIGHTS_NO_AUTH`     | `false`            | Disable authentication entirely (`true` or `1`)                            |
| `CLAW_INSIGHTS_SERVER_ONLY` | `false`            | Run API server without serving web UI                                      |

### Session Rotation

| Variable                                         | Default    | Description                              |
| ------------------------------------------------ | ---------- | ---------------------------------------- |
| `CLAW_INSIGHTS_TOKEN_ROTATION_ENABLED`           | `true`     | Enable rotating session-cookie key-ring  |
| `CLAW_INSIGHTS_TOKEN_ROTATION_INTERVAL_MS`       | `86400000` | Rotation interval (24h)                  |
| `CLAW_INSIGHTS_TOKEN_GRACE_MS`                   | `43200000` | Previous-key grace window (12h)          |
| `CLAW_INSIGHTS_TOKEN_ROTATION_CHECK_INTERVAL_MS` | `300000`   | Background rotation check cadence (5min) |
| `CLAW_INSIGHTS_TOKEN_MAX_PREVIOUS`               | `2`        | Max retained previous keys in key-ring   |

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

### Logging (Layered Mode)

Claw Insights uses a layered logging pipeline with stream-separated segments (`app`, `error`, `debug`), backpressure management, budget enforcement, and automatic retention.

| Variable                              | Default  | Description                                    |
| ------------------------------------- | -------- | ---------------------------------------------- |
| `CLAW_INSIGHTS_LOG_BUDGET_MB`         | `1024`   | Global logging budget (MB)                     |
| `CLAW_INSIGHTS_LOG_RETENTION_DAYS`    | `14`     | Retention window in days                       |
| `CLAW_INSIGHTS_ERROR_FLOOR_MB`        | `300`    | Critical (`error`) minimum floor               |
| `CLAW_INSIGHTS_ERROR_RESERVE_MB`      | `50`     | Additional emergency reserve for critical lane |
| `CLAW_INSIGHTS_APP_SOFT_MB`           | `500`    | Soft cap for `app` stream                      |
| `CLAW_INSIGHTS_DEBUG_SOFT_MB`         | `200`    | Soft cap for `debug` stream                    |
| `CLAW_INSIGHTS_CRITICAL_QUEUE_MAX`    | `10000`  | Critical lane max queued entries               |
| `CLAW_INSIGHTS_BEST_EFFORT_QUEUE_MAX` | `50000`  | Best-effort lane max queued entries            |
| `CLAW_INSIGHTS_CRITICAL_FSYNC_MS`     | `100`    | Critical lane sync interval upper bound        |
| `CLAW_INSIGHTS_CRITICAL_SYNC_BATCH`   | `1000`   | Critical lane sync batch upper bound           |
| `CLAW_INSIGHTS_LOG_FILE_MODE`         | `0644`   | File mode for created log segments             |
| `CLAW_INSIGHTS_LOG_SWEEP_INTERVAL_MS` | `600000` | TTL sweeper interval                           |

Pressure/Emergency threshold controls:

| Variable                                | Default |
| --------------------------------------- | ------- |
| `CLAW_INSIGHTS_PRESSURE_QUEUE_PCT`      | `70`    |
| `CLAW_INSIGHTS_PRESSURE_IO_LAG_MS`      | `200`   |
| `CLAW_INSIGHTS_PRESSURE_BUDGET_PCT`     | `85`    |
| `CLAW_INSIGHTS_PRESSURE_FREE_SPACE_MB`  | `512`   |
| `CLAW_INSIGHTS_EMERGENCY_QUEUE_PCT`     | `90`    |
| `CLAW_INSIGHTS_EMERGENCY_IO_LAG_MS`     | `1000`  |
| `CLAW_INSIGHTS_EMERGENCY_BUDGET_PCT`    | `95`    |
| `CLAW_INSIGHTS_EMERGENCY_FREE_SPACE_MB` | `128`   |

> **Note:** `CLAW_INSIGHTS_LOG_MODE` was removed in v0.10. Layered logging is now the only mode. Legacy `server.log` files are automatically cleaned up on daemon start.
>
> **Writer backend:** uses `pino.destination` for segment writes (`error` stream sync, `app/debug` async) while preserving router/pressure/budget/retention semantics.

### Fonts (Screenshot API)

| Variable                  | Default     | Description                               |
| ------------------------- | ----------- | ----------------------------------------- |
| `CLAW_INSIGHTS_FONTS_DIR` | _(bundled)_ | Custom font directory for Satori renderer |

## Config File

Create `~/.claw-insights/config.json`:

```json
{
  "serverPort": 41041
}
```

`apiToken` in config file is treated as **legacy migration input only** and will be migrated into `~/.claw-insights/auth-secret` on startup.

**Security:** If the file contains legacy `apiToken`, restrict permissions:

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

1. Server starts and resolves a **stable Bearer token** using precedence: `CLAW_INSIGHTS_API_TOKEN` → `~/.claw-insights/auth-secret` → legacy `config.json.apiToken` (migration only) → generated token (fresh install only)
2. Prints token URL: `🔑 http://127.0.0.1:41041/?token=xxx`
3. Browser opens URL → server exchanges token for `claw_session=<kid>:<digest>` cookie (7 days, httpOnly)
4. Session key-ring rotates automatically (default: every 24h, previous key valid for 12h grace)
5. Subsequent requests authenticate via cookie (browser) or `Authorization: Bearer <token>` (scripts)

If a browser session expires, is cleared, or stays idle beyond rotation + grace windows, **re-exchange cookie via `/?token=...`**.

### Programmatic access

```bash
# Bearer token (recommended for scripts)
TOKEN="${CLAW_INSIGHTS_API_TOKEN:-$(cat ~/.claw-insights/auth-secret 2>/dev/null)}"
test -n "$TOKEN" || {
  echo "No token found. Set CLAW_INSIGHTS_API_TOKEN or ~/.claw-insights/auth-secret";
  exit 1;
}

curl -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:41041/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ system(context: {}) { ... on OpenClawSystem { gateway { version uptime } } } }"}'
```

> **Note:** Bearer token auth is stable across cookie rotations. Browser cookie auth (`claw_session`) uses rotating `kid:digest` values; legacy bare `64hex` cookie format is not accepted.
