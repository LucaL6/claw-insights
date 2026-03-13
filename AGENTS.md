# AGENTS.md — Claw Insights

This file is for AI agents. It indexes available skills for automated interaction with Claw Insights.

## Available Skills

| Skill                      | Description                                                                            | Location                        |
| -------------------------- | -------------------------------------------------------------------------------------- | ------------------------------- |
| **claw-insights-install**  | Install, configure, and run the Claw Insights monitoring dashboard for OpenClaw agents | `docs/skills/install/SKILL.md`  |
| **claw-insights-snapshot** | Capture dashboard as PNG, SVG, or JSON via REST API or CLI                             | `docs/skills/snapshot/SKILL.md` |

## Quick Reference

- **GraphQL endpoint:** `http://localhost:41041/graphql`
- **Health check:** `GET http://localhost:41041/health`
- **Snapshot:** `POST http://localhost:41041/api/snapshot`
- **Snapshot CLI:** `claw-insights snapshot`
- **Default port:** 41041 (configurable via `CLAW_INSIGHTS_SERVER_PORT`)
- **Auth:** Bearer token or `?token=` URL param

## Documentation

- `docs/configuration.md` — all env vars, config file, auth
- `docs/architecture.md` — architecture, data flow, directory structure, development workflow
- `docs/api-reference.md` — full API (queries, subscriptions, REST)

## Project Structure

```
packages/server/   — Express + GraphQL Yoga + SQLite + Satori
packages/web/      — React 19 + Vite + Tailwind + ECharts
packages/shared/   — Shared TypeScript types (codegen)
```
