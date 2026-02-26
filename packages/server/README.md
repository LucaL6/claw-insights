# @claw-insights/server

GraphQL API + REST endpoint for the Claw Insights dashboard.

## Architecture

```
src/
├── index.ts                    # Bootstrap: create app → register routes → listen
├── config.ts                   # Environment + path configuration
├── context.ts                  # AppContext: wires all data sources together
├── events.ts                   # DataBus for real-time change signals
│
├── routes/                     # HTTP entry points
│   ├── graphql.ts              # GraphQL Yoga schema + middleware
│   ├── snapshot.ts             # POST /api/snapshot — data source wiring
│   └── snapshot-handler.ts     # Snapshot request handling (JSON + PNG)
│
├── schema/                     # GraphQL schema definition
│   ├── schema.graphql          # SDL source of truth
│   ├── typeDefs.ts             # Reads .graphql file at runtime
│   ├── generated/              # Codegen output (do not edit)
│   │   └── resolver-types.ts   # Typed resolver signatures (AppContext-aware)
│   └── resolvers/              # Domain-split resolver modules
│       ├── index.ts            # Merges all domain resolvers
│       ├── utils.ts            # safe() error wrapper
│       ├── gateway.resolver.ts # Query: gateway, channels, resources
│       ├── sessions.resolver.ts
│       ├── metrics.resolver.ts
│       ├── cron.resolver.ts
│       ├── events.resolver.ts  # Query: events, eventDensity
│       ├── usage.resolver.ts   # Query: usageCost, recentLogs
│       └── subscriptions.resolver.ts  # Subscription: logs, dataChanged
│
├── services/                   # Business logic
│   ├── snapshot-service.ts     # Data aggregation for snapshot API
│   ├── snapshot-types.ts       # Request types + validation
│   ├── template-renderer.ts    # HTML template rendering (mobile layouts)
│   └── templates/              # Handlebars-style HTML templates
│
├── browser/                    # Browser infrastructure
│   ├── browser-pool.ts         # Playwright browser pool with idle timeout
│   └── capture.ts              # Screenshot capture (desktop + HTML-to-PNG)
│
├── middleware/
│   └── auth.ts                 # Bearer token authentication
│
├── db/                         # SQLite persistence
│   ├── init.ts                 # Schema migrations (versioned)
│   └── queries.ts              # Parameterized query functions
│
└── sources/                    # Data source adapters
    ├── aggregator.ts           # Metrics aggregation with bucketing + cache
    ├── session-reader.ts       # Reads OpenClaw session JSON files
    ├── cron-reader.ts          # Reads cron job state
    ├── log-tailer.ts           # Tails gateway log files (EventEmitter)
    ├── gateway-cli.ts          # Executes `openclaw status` CLI (cached)
    ├── system-metrics.ts       # CPU / memory / disk sampling
    ├── usage-cost.ts           # Token usage cost from gateway
    ├── spawn-tracker.ts        # Sub-agent parent-child mapping
    ├── metrics-collector.ts    # Periodic sampling → SQLite
    ├── data-validator.ts       # Cross-source consistency checks
    ├── data-retention.ts       # Hourly rollup + raw data pruning
    └── events-mapper.ts        # Event type → category mapping
```

## Layers

| Layer          | Directory     | Responsibility                                                 |
| -------------- | ------------- | -------------------------------------------------------------- |
| **Routes**     | `routes/`     | HTTP entry points, middleware binding, data source wiring      |
| **Schema**     | `schema/`     | GraphQL SDL, codegen types, domain-split resolvers             |
| **Services**   | `services/`   | Business logic (snapshot data aggregation, template rendering) |
| **Browser**    | `browser/`    | Playwright browser pool + screenshot capture                   |
| **DB**         | `db/`         | SQLite schema, migrations, query functions                     |
| **Sources**    | `sources/`    | Data source adapters (files, CLI, system metrics)              |
| **Middleware** | `middleware/` | Express middleware (auth)                                      |

## Data Flow

```
OpenClaw Gateway
    │
    ├── CLI (`openclaw status`)  →  gateway-cli.ts (10s cache)
    ├── Log files (~/.openclaw/logs/) →  log-tailer.ts (EventEmitter)
    ├── Session JSON  →  session-reader.ts
    └── Cron state  →  cron-reader.ts
                          │
                    context.ts (AppContext)
                          │
            ┌─────────────┼─────────────┐
            │             │             │
      routes/graphql  routes/snapshot  log events
            │             │             │
      resolvers/     services/      aggregator.ts
            │             │             │
            └─────────────┴──── db/ ────┘
                                │
                          SQLite (metrics, events)
```

## GraphQL Codegen

Schema types are generated at three levels:

| Output                                                   | Plugin                 | Consumer                                    |
| -------------------------------------------------------- | ---------------------- | ------------------------------------------- |
| `packages/shared/src/generated/schema-types.ts`          | `typescript`           | shared types for web + server               |
| `packages/server/src/schema/generated/resolver-types.ts` | `typescript-resolvers` | typed resolver signatures with `AppContext` |
| `packages/web/src/generated/`                            | `client-preset`        | typed document nodes for urql               |

Run codegen:

```bash
npm run codegen        # from monorepo root
npm run codegen:watch  # watch mode during dev
```

## Naming Conventions

- **Files:** `kebab-case.ts` (exception: `typeDefs.ts` for historical reasons)
- **Resolvers:** `<domain>.resolver.ts`
- **Tests:** colocated in `__tests__/` directories, named `<module>.test.ts`

## Development

```bash
npm run -w @claw-insights/server dev    # tsx --watch
npm run -w @claw-insights/server test   # vitest run
npm run -w @claw-insights/server build  # tsup → dist/
```

## Snapshot API

### API Endpoint

```
POST /api/snapshot
```

**Parameters** (JSON body):

| Param     | Values                        | Default     | Notes                                  |
| --------- | ----------------------------- | ----------- | -------------------------------------- |
| `format`  | `png`, `svg`, `json`          | `png`       | SVG returns `image/svg+xml`            |
| `detail`  | `compact`, `standard`, `full` | `standard`  | Auto-degrades if output exceeds 2MB    |
| `range`   | `1h`, `6h`, `12h`, `24h`      | `6h`        | Default changed from 24h to 6h         |
| `theme`   | `dark`, `light`               | `dark`      |                                        |
| `lang`    | `en`, `zh`                    | `en`        |                                        |
| `layout`  | `desktop`, `mobile`           | `desktop`   |                                        |
| `section` | `dashboard`, `logs`           | `dashboard` | v1 no-op (forward-compatibility param) |

**Response headers:** `X-Snapshot-Duration`, `Content-Disposition`, `Cache-Control: no-store`

**Error codes:** `INVALID_PARAM` (400), `RATE_LIMITED` (429), `QUEUE_FULL` (503), `QUEUE_TIMEOUT` (503), `COLLECT_TIMEOUT` (504), `TOTAL_TIMEOUT` (504), `PAYLOAD_TOO_LARGE` (413), `RENDER_FAILED` (500)

All error responses use a unified format: `{ error, code, suggestion?, retryAfter? }`

### Data Freshness

Data sources use a 10-second cache (coalescing). Snapshots reflect data that is **at most 10 seconds stale**. This is an intentional v1 trade-off to avoid hammering the OpenClaw CLI.

### CLI Snapshot

```bash
# Save PNG snapshot
claw-insights snapshot

# Custom options
claw-insights snapshot --format svg --range 1h --detail full --theme light

# Output to stdout (pipe to file)
claw-insights snapshot --format json > status.json
```

### MCP Integration

The server exposes a Streamable HTTP MCP endpoint at `/mcp` (port 41041) with a single `snapshot` tool.

**OpenClaw** (`~/.openclaw/config.yaml`):

```yaml
mcp:
  claw-insights:
    url: http://127.0.0.1:41041/mcp
```

**Claude Code** (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "claw-insights": {
      "type": "url",
      "url": "http://127.0.0.1:41041/mcp"
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "claw-insights": {
      "type": "url",
      "url": "http://127.0.0.1:41041/mcp"
    }
  }
}
```

### `section` Parameter

The `section` parameter (`dashboard` | `logs`) is accepted in v1 but has no effect — it exists for forward-compatibility with future section-specific rendering. The default is `dashboard`.
