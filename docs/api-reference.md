# API Reference

Claw Insights exposes a GraphQL API and REST endpoints.

## GraphQL

**Endpoint:** `POST /graphql` (also `GET` for playground)  
**Auth:** Bearer token or cookie ([details](./configuration.md#authentication-details))  
**Schema source:** [`packages/server/src/schema/schema.graphql`](../packages/server/src/schema/schema.graphql)

### Source-centric query contract

The canonical entrypoints are top-level root fields:

| Root field                  | Returns            | Purpose                                        |
| --------------------------- | ------------------ | ---------------------------------------------- |
| `system(context)`           | `SystemNamespace!` | System-level status/resources/channels/gateway |
| `sources(filter, context)`  | `[DataSource!]!`   | List registered data sources                   |
| `source(selector, context)` | `SourceNamespace`  | Resolve one source namespace by selector       |

### Namespace fields

#### `system(context)` → `... on OpenClawSystem`

| Field       | Returns            |
| ----------- | ------------------ |
| `health`    | `HealthStatus!`    |
| `gateway`   | `GatewayStatus!`   |
| `resources` | `SystemResources!` |
| `channels`  | `[Channel!]!`      |

#### `source(selector, context)` → `... on AgentNamespace`

| Field                                                 | Returns                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `info`                                                | `DataSource!`                                                |
| `gateway`                                             | `GatewayStatus!` (deprecated alias; prefer `system.gateway`) |
| `sessions(filter)`                                    | `[Session!]!`                                                |
| `session(key)`                                        | `Session`                                                    |
| `metrics(date, range)`                                | `MetricsSummary!`                                            |
| `cronJobs`                                            | `[CronJob!]!`                                                |
| `usageCost`                                           | `UsageCost!`                                                 |
| `recentLogs(count)`                                   | `[LogEntry!]!`                                               |
| `events(from, to, types, limit)`                      | `EventsResult!`                                              |
| `eventDensity`                                        | `[EventDensityBucket!]!`                                     |
| `eventCounts(from, to)`                               | `EventCounts!`                                               |
| `lifetimeStats`                                       | `LifetimeStats!`                                             |
| `sessionTranscript(sessionKey, limit, before, after)` | `SessionTranscript`                                          |

### v1 root queries (deprecated)

The following root query fields are still available for compatibility but are marked `@deprecated` in schema:

- `gateway`, `resources`, `channels`
- `sessions`, `metrics`, `cronJobs`, `usageCost`, `recentLogs`
- `events`, `eventDensity`, `eventCounts`, `lifetimeStats`, `sessionTranscript`

Prefer canonical root fields (`system`, `sources`, `source`) for new clients.

### Legacy → canonical migration examples

#### 1) sessions

```graphql
# v1 (deprecated)
query {
  sessions(filter: { activeOnly: true }) {
    key
    displayName
    status
  }
}
```

```graphql
# canonical
query {
  source(selector: { id: "agent:main" }) {
    ... on AgentNamespace {
      sessions(filter: { activeOnly: true }) {
        key
        displayName
        status
      }
    }
  }
}
```

#### 2) metrics

```graphql
# v1 (deprecated)
query {
  metrics(range: SIX_HOUR) {
    range
    totalTokensK
    totalErrors
  }
}
```

```graphql
# canonical
query {
  source(selector: { id: "agent:main" }) {
    ... on AgentNamespace {
      metrics(range: SIX_HOUR) {
        range
        totalTokensK
        totalErrors
      }
    }
  }
}
```

#### 3) gateway + resources + channels

```graphql
# v1 (deprecated)
query {
  gateway {
    running
    version
  }
  resources {
    cpu
    memoryMB
  }
  channels {
    provider
    connected
  }
}
```

```graphql
# canonical
query {
  system(context: {}) {
    ... on OpenClawSystem {
      gateway {
        running
        version
      }
      resources {
        cpu
        memoryMB
      }
      channels {
        provider
        connected
      }
    }
  }
}
```

### Subscriptions

| Subscription  | Returns             | Transport | Description                       |
| ------------- | ------------------- | --------- | --------------------------------- |
| `dataChanged` | `DataChangeSignal!` | SSE       | Notifies when data sources update |
| `logs`        | `LogBatch!`         | SSE       | Live log stream                   |

### Transcript API (cursor pagination)

`sessionTranscript` uses cursor pagination (`before` / `after`) and `pageInfo`.

- `before`: fetch older messages before a cursor
- `after`: fetch newer messages after a cursor
- `pageInfo.startCursor`, `pageInfo.endCursor`: cursors for follow-up requests
- `pageInfo.hasPreviousPage`, `pageInfo.hasNextPage`: page boundaries

Do not use offset-style pagination (`offset`, `hasMore`) — they are not part of the current contract.

#### Transcript query example (`after` + `pageInfo`)

```graphql
query TranscriptPage($sessionKey: String!, $limit: Int!, $after: String) {
  source(selector: { id: "agent:main" }) {
    ... on AgentNamespace {
      sessionTranscript(sessionKey: $sessionKey, limit: $limit, after: $after) {
        sessionKey
        totalMessages
        messages {
          timestamp
          role
          content
          contentTruncated
          model
          toolName
          usage {
            input
            output
            cacheRead
            cacheWrite
          }
        }
        pageInfo {
          startCursor
          endCursor
          hasPreviousPage
          hasNextPage
        }
      }
    }
  }
}
```

#### Transcript query example (`before`)

```graphql
query TranscriptPageBefore($sessionKey: String!, $limit: Int!, $before: String) {
  source(selector: { id: "agent:main" }) {
    ... on AgentNamespace {
      sessionTranscript(sessionKey: $sessionKey, limit: $limit, before: $before) {
        messages {
          timestamp
          role
          content
        }
        pageInfo {
          startCursor
          endCursor
          hasPreviousPage
          hasNextPage
        }
      }
    }
  }
}
```

#### BAD_USER_INPUT behavior (`before` + `after`)

`before` and `after` are mutually exclusive in the same request.

If both are provided, GraphQL returns an error with:

- `message`: `Cannot specify both before and after`
- `extensions.code`: `BAD_USER_INPUT`

> Note: this validation runs only after transcript/file resolution. If the transcript does not exist, the resolver returns `null` (legacy/canonical parity) instead of raising `BAD_USER_INPUT`.

### cURL examples

**Query gateway status (canonical):**

```bash
curl http://127.0.0.1:41041/graphql \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ system(context: {}) { ... on OpenClawSystem { gateway { running version uptime pid updateAvailable } } } }"}'
```

**Query sessions (canonical):**

```bash
curl http://127.0.0.1:41041/graphql \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ source(selector: { id: \"agent:main\" }) { ... on AgentNamespace { sessions { key displayName model status totalTokens subAgents { key displayName status } } } } }"}'
```

**Subscribe to data changes (SSE):**

```bash
curl -N http://127.0.0.1:41041/graphql/stream \
  -H "Authorization: Bearer TOKEN" \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"query":"subscription { dataChanged { source ts } }"}'
```

## REST Endpoints

### `GET /health`

Health check endpoint (no auth required).

Response:

```json
{ "status": "ok", "gateway": "connected", "db": "ok", "uptime": "2h 15m", "version": "0.1.0" }
```

### `POST /api/snapshot`

Render dashboard as PNG image.

**Auth:** Required (Bearer token or cookie)

| Parameter | Type   | Default      | Description                                 |
| --------- | ------ | ------------ | ------------------------------------------- |
| `detail`  | string | `"standard"` | Detail level: `compact`, `standard`, `full` |
| `theme`   | string | `"dark"`     | Theme: `dark`, `light`                      |
| `range`   | string | `"6h"`       | Time range: `1h`, `6h`, `12h`, `24h`        |
| `lang`    | string | `"en"`       | Language: `en`, `zh`                        |

Example:

```bash
curl -X POST http://127.0.0.1:41041/api/snapshot \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"detail":"standard","theme":"dark"}' \
  -o dashboard.png
```

---

## Enums

### SourceProvider

| Value         | Description                 |
| ------------- | --------------------------- |
| `OPENCLAW`    | OpenClaw gateway agent      |
| `CLAUDE_CODE` | Anthropic Claude Code agent |
| `CODEX`       | OpenAI Codex agent          |

> **Breaking change:** The `provider` field in `SourceAttributes`, `SourceFilter`, and `SourceSelector` changed from `String` to `SourceProvider` enum. Clients must now use one of the enum values listed above.
