# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Instead, please report them via [GitHub Security Advisories](https://github.com/nicepkg/claw-insights/security/advisories/new).

We will:
- Acknowledge receipt within 72 hours
- Provide an initial assessment within 1 week
- Work with you on a fix and coordinate disclosure

## Security Model

Claw Insights is designed for **local/trusted network** monitoring:

- **Production:** Token-based authentication enabled by default (auto-generated on startup)
- **Development/Test:** Authentication disabled by default (`NODE_ENV=development` or `test`)
- API token must be ≥32 characters
- Auth can be disabled explicitly in production with `--no-auth` or `CLAW_INSIGHTS_NO_AUTH=true`
- No data leaves your machine — all metrics are stored locally in SQLite
- GraphQL API is read-heavy; mutations are limited to gateway operations (restart/update/doctor)

## Best Practices

- Keep `~/.claw-insights/config.json` permissions restricted (`chmod 600`)
- Use a strong API token in production
- Do not expose the dashboard port to the public internet without a reverse proxy + TLS
