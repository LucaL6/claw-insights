---
name: api
description: GraphQL and REST API for the Claw Insights dashboard. Use when fetching dashboard data, checking gateway status, listing sessions, getting metrics, taking screenshots, or performing mutations.
---

# Claw Insights API

GraphQL API and REST endpoints for the OpenClaw monitoring dashboard. Base URL: `http://localhost:4000` (default). Auth via Bearer token or cookie (disabled in development).

## Quick Reference

### Health Check (no auth)

```bash
curl http://localhost:4000/health
# {"status":"ok","version":"0.1.0","gateway":"connected","db":"ok",...}
```

### Gateway Status

```bash
curl http://localhost:4000/graphql \
  -H "Authorization: Bearer YOUR_EXAMPLE_TOKEN # gitleaks:allow" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ gateway { running version uptime pid connectLatencyMs } }"}'
```

### Sessions

```bash
curl http://localhost:4000/graphql \
  -H "Authorization: Bearer YOUR_EXAMPLE_TOKEN # gitleaks:allow" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ sessions(filter: { activeOnly: true, grouped: true, sortBy: UPDATED_AT }) { key displayName model totalTokens status subAgents { key displayName status } } }"}'
```

### Screenshot

```bash
curl -X POST http://localhost:4000/api/snapshot \
  -H "Authorization: Bearer YOUR_EXAMPLE_TOKEN # gitleaks:allow" \
  -H "Content-Type: application/json" \
  -d '{"detail":"standard","range":"6h","theme":"dark"}' \
  -o snapshot.png
```

### GraphQL Playground

Open `http://localhost:4000/graphql` in a browser for the interactive explorer.

## Details

For full documentation, see:
- [API Reference](../../api-reference.md) — all queries, mutations, subscriptions, and REST endpoints
- [GraphQL Schema](../../../packages/server/src/schema/schema.graphql) — source of truth for all types and fields
