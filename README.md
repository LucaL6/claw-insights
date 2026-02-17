# 🦞 Claw Insights

Real-time monitoring dashboard for [OpenClaw](https://github.com/openclaw/openclaw) gateway.

## Features

- **Live Sessions** — Active sessions with sub-agent tree, token usage, and context progress
- **Metrics Charts** — Sessions, token consumption (per-model breakdown), errors, and uptime over 1h/6h/12h/24h
- **Event Logs** — Structured event viewer with density heatmap, type filtering, and search
- **Gateway Control** — Restart, diagnostics (Doctor), and update operations
- **Screenshot API** — Capture dashboard state as PNG via REST endpoint
- **Dark / Light Theme** — CSS variable-based theming with toggle
- **i18n** — English and Chinese (中文) with runtime switching

## Architecture

```
claw-insights/
├── packages/
│   ├── web/        React 19 + Vite + Tailwind + ECharts + urql
│   ├── server/     Express + GraphQL Yoga + SQLite + Playwright
│   └── shared/     TypeScript types shared between web & server
```

- **Data pipeline:** OpenClaw gateway → log tailing + CLI/RPC → SQLite → GraphQL → urql + WebSocket subscriptions → React
- **Real-time:** `dataChanged` subscription triggers selective refetch (debounced)

## Quick Start

```bash
# Prerequisites: Node.js v22+, OpenClaw gateway running
npm install
./start.sh
# Open http://localhost:3200
```

## Configuration

Default ports:
- Dashboard web: `3200`
- GraphQL API: `4000`

The dashboard connects to the local OpenClaw gateway via RPC (auto-detected) and tails `~/.openclaw/logs/`.

## Plugin (Future)

```bash
openclaw plugins install claw-insights
```

See `packages/server/src/plugin.ts` for the plugin contract interface.

## Development

```bash
./start.sh               # Run all (server + web)
npm run dev:server        # GraphQL API on :4000
npm run dev:web           # Vite dev server on :3200

# Tests
cd packages/server && npx vitest run
cd packages/web && npx vitest run
cd packages/web && npx playwright test  # E2E
```

## License

MIT
