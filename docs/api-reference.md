# API Reference

Claw Insights exposes a GraphQL API and REST endpoints.

## GraphQL

**Endpoint:** `POST /graphql` (also `GET` for playground)  
**Auth:** Bearer token or cookie ([details](./configuration.md#authentication-details))  
**Schema source:** [`packages/server/src/schema/schema.graphql`](../packages/server/src/schema/schema.graphql)

### Queries

| Query                   | Returns                  | Description                                                |
| ----------------------- | ------------------------ | ---------------------------------------------------------- |
| `gateway`               | `GatewayStatus!`         | Gateway process status, version, uptime, security findings |
| `resources`             | `SystemResources!`       | CPU, memory, disk usage                                    |
| `channels`              | `[Channel!]!`            | Connected messaging channels                               |
| `sessions`              | `[Session!]!`            | Active/recent sessions with sub-agent tree                 |
| `metricsSummary(range)` | `MetricsSummary!`        | Aggregated metrics for time range                          |
| `metricsBuckets(range)` | `[MetricsBucket!]!`      | Time-series metric buckets                                 |
| `cronJobs`              | `[CronJob!]!`            | Scheduled cron jobs                                        |
| `events(...)`           | `EventsResult!`          | Event log with filtering + pagination                      |
| `eventCounts(range)`    | `EventCounts!`           | Event type counts                                          |
| `eventDensity(range)`   | `[EventDensityBucket!]!` | Hourly event density heatmap data                          |
| `usageCost`             | `UsageCost!`             | Token usage and cost summary                               |
| `recentLogs(...)`       | `LogBatch!`              | Recent log entries with filters                            |

### Mutations

| Mutation         | Returns              | Description                      |
| ---------------- | -------------------- | -------------------------------- |
| `restartGateway` | `OperationResult!`   | Restart the OpenClaw gateway     |
| `updateGateway`  | `OperationResult!`   | Update gateway to latest version |
| `runDiagnostics` | `DiagnosticsResult!` | Run gateway doctor diagnostics   |

### Subscriptions

| Subscription  | Returns             | Transport | Description                       |
| ------------- | ------------------- | --------- | --------------------------------- |
| `dataChanged` | `DataChangeSignal!` | SSE       | Notifies when data sources update |
| `logs`        | `LogEntry!`         | SSE       | Live log stream                   |

### Examples

**Query gateway status:**

```bash
curl http://127.0.0.1:41041/graphql \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ gateway { running version uptime pid updateAvailable } }"}'
```

**Query sessions:**

```bash
curl http://127.0.0.1:41041/graphql \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ sessions { key displayName model status totalTokens subAgents { key displayName status } } }"}'
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
