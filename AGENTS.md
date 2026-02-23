# AGENTS.md — Claw Insights

This file is for AI agents. It indexes available skills for automated interaction with Claw Insights.

## Available Skills

| Skill | Description | Location |
|-------|-------------|----------|
| **install** | Install, configure, and run the dashboard | `docs/skills/install/SKILL.md` |
| **overview** | Architecture, tech stack, data flow | `docs/skills/overview/SKILL.md` |
| **api** | GraphQL and REST API queries | `docs/skills/api/SKILL.md` |
| **screenshot** | Dashboard screenshots via POST /api/snapshot | `docs/skills/screenshot/SKILL.md` |
| **development** | Local dev setup, tests, codegen, PR workflow | `docs/skills/development/SKILL.md` |

## Quick Reference

- **GraphQL endpoint:** `http://localhost:4000/graphql`
- **Health check:** `GET http://localhost:4000/health`
- **Screenshot:** `POST http://localhost:4000/api/snapshot`
- **Default port:** 4000 (configurable via `CLAW_INSIGHTS_SERVER_PORT`)
- **Auth:** Bearer token or `?token=` URL param

## Documentation

- `docs/configuration.md` — all env vars, config file, auth
- `docs/architecture.md` — architecture, data flow, directory structure, development workflow
- `docs/api-reference.md` — full API (queries, mutations, subscriptions, REST)

## Project Structure

```
packages/server/   — Express + GraphQL Yoga + SQLite + Satori
packages/web/      — React 19 + Vite + Tailwind + ECharts
packages/shared/   — Shared TypeScript types (codegen)
```
