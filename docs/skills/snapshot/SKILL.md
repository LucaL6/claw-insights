---
name: snapshot
description: Generate dashboard snapshots as PNG/SVG/JSON. Use when capturing agent status, taking screenshots for reports, sending dashboard images to chat, or querying metrics programmatically.
---

# Dashboard Snapshot

Server-side rendering via Satori — no browser needed, ~200ms response.

## MCP (recommended)

Add to your agent's MCP config:

```json
{ "mcpServers": { "claw-insights": { "url": "http://127.0.0.1:41041/mcp" } } }
```

The agent auto-discovers the `snapshot` tool. No auth needed (localhost only).

## REST API

```bash
curl -X POST http://127.0.0.1:41041/api/snapshot \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"detail":"standard","range":"6h","theme":"dark"}' \
  -o snapshot.png
```

Auth: Bearer token or `--no-auth` mode. Response includes `Content-Disposition` header with timestamped filename.

## Parameters

| Field    | Default    | Values                            |
| -------- | ---------- | --------------------------------- |
| `detail` | `standard` | `compact`, `standard`, `full`     |
| `format` | `png`      | `png`, `svg`, `json`              |
| `range`  | `24h`†     | `30m`\*, `1h`, `6h`, `12h`, `24h` |
| `theme`  | `dark`     | `dark`, `light`                   |
| `lang`   | `en`       | `en`, `zh`                        |

† MCP default is `6h`. \* `30m` not available via MCP.

Use `format: "json"` to get raw `SnapshotData` for programmatic analysis.
