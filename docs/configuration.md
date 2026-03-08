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

### Web Dashboard (Schema Toggle)

| Variable                 | Default | Description                                                                                   |
| ------------------------ | ------- | --------------------------------------------------------------------------------------------- |
| `VITE_SCHEMA_V2_ENABLED` | `false` | Enable dashboard v2 query path (`system(context)` + `source(selector, context)`) in web build |

> Current phase note: this is a **build-level dev/test toggle**. It is **not** an instant runtime rollback switch.
>
> Local rollback steps:
>
> 1. Set `VITE_SCHEMA_V2_ENABLED=false`
> 2. Restart Vite dev server (or run a fresh production build)
> 3. Reload dashboard

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
