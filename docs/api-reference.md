# API Reference

Claw Insights exposes a GraphQL API and REST endpoints.

## GraphQL

**Endpoint:** `POST /graphql` (also `GET` for playground)
**Auth:** Bearer token or cookie ([details](./configuration.md#authentication-details))
**Schema source:** [`packages/server/src/schema/schema.graphql`](../packages/server/src/schema/schema.graphql)

### v2 source-centric query contract

> Terminology note: DEV-067 plan language uses `system`, `sources`, `source` as the v2 query list.
> In the current schema, these are represented under `context` as:
>
> - `context.system` (system namespace)
> - `context.source` (source namespace)
> - `context` (root namespace container)

#### v2 query list (`system`, `sources`, `source`)

| v2 name (plan/docs) | Schema path      | Returns            | Notes                                          |
| ------------------- | ---------------- | ------------------ | ---------------------------------------------- |
| `system`            | `context.system` | `SystemNamespace!` | System-level queries (`resources`, `channels`) |
| `sources`           | `context`        | `QueryContext!`    | Namespace container (groups source/system)     |
| `source`            | `context.source` | `SourceNamespace!` | Source-centric business queries                |

> Phase 3 note: source selector routing and context defaults extraction are scaffolded in server code but not exposed as schema inputs yet. Current v2 runtime resolves the default AGENT source.

#### v2 namespace fields

| Namespace        | Field                                                 | Returns                  |
| ---------------- | ----------------------------------------------------- | ------------------------ |
| `context.system` | `resources`                                           | `SystemResources!`       |
| `context.system` | `channels`                                            | `[Channel!]!`            |
| `context.source` | `gateway`                                             | `GatewayStatus!`         |
| `context.source` | `sessions(filter)`                                    | `[Session!]!`            |
| `context.source` | `metrics(date, range)`                                | `MetricsSummary!`        |
| `context.source` | `cronJobs`                                            | `[CronJob!]!`            |
| `context.source` | `usageCost`                                           | `UsageCost!`             |
| `context.source` | `recentLogs(count)`                                   | `[LogEntry!]!`           |
| `context.source` | `events(from, to, types, limit)`                      | `EventsResult!`          |
| `context.source` | `eventDensity`                                        | `[EventDensityBucket!]!` |
| `context.source` | `eventCounts(from, to)`                               | `EventCounts!`           |
| `context.source` | `lifetimeStats`                                       | `LifetimeStats!`         |
| `context.source` | `sessionTranscript(sessionKey, limit, before, after)` | `SessionTranscript`      |

### v1 root queries (deprecated)

The following root query fields are still available for compatibility but are marked `@deprecated` in schema:

- `gateway`, `resources`, `channels`
- `sessions`, `metrics`, `cronJobs`, `usageCost`, `recentLogs`
- `events`, `eventDensity`, `eventCounts`, `lifetimeStats`, `sessionTranscript`

Use v2 namespace paths (`context.system.*`, `context.source.*`) for new clients.

### v1 → v2 migration examples

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
# v2
query {
  context {
    source {
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
# v2
query {
  context {
    source {
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
# v2
query {
  context {
    source {
      gateway {
        running
        version
      }
    }
    system {
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
  context {
    source {
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
  context {
    source {
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

#### v2 transcript BAD_USER_INPUT behavior (`before` + `after`)

`before` and `after` are mutually exclusive in the same request.

If both are provided, GraphQL returns an error with:

- `message`: `Cannot specify both before and after`
- `extensions.code`: `BAD_USER_INPUT`

> Note: this validation runs only after transcript/file resolution. If the transcript does not exist, the resolver returns `null` (v1/v2 parity) instead of raising `BAD_USER_INPUT`.

Example error shape:

```json
{
  "errors": [
    {
      "message": "Cannot specify both before and after",
      "extensions": {
        "code": "BAD_USER_INPUT"
      }
    }
  ],
  "data": {
    "context": {
      "source": {
        "sessionTranscript": null
      }
    }
  }
}
```

### cURL examples

**Query gateway status (v2):**

```bash
curl http://127.0.0.1:41041/graphql \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ context { source { gateway { running version uptime pid updateAvailable } } } }"}'
```

**Query sessions (v2):**

```bash
curl http://127.0.0.1:41041/graphql \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ context { source { sessions { key displayName model status totalTokens subAgents { key displayName status } } } } }"}'
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
{ "status": "ok", "gateway": "connected", "db": "ok", "uptime": "2h 15m", "version": "0.9.0" }
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
