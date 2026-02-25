---
name: screenshot
description: Server-rendered dashboard screenshots via POST /api/snapshot. Use when capturing the dashboard as a PNG image with control over detail level, time range, theme, and language.
---

# Screenshot API — POST /api/snapshot

Server-side dashboard rendering using Satori (no browser needed). Returns a PNG image in ~200ms. Auth: Bearer token or cookie.

## Quick Reference

### Parameters

| Field    | Type   | Default    | Values                                                |
| -------- | ------ | ---------- | ----------------------------------------------------- |
| `detail` | string | `standard` | `compact` (390px), `standard` (540px), `full` (540px) |
| `range`  | string | `1h`       | `1h`, `6h`, `12h`, `24h`                              |
| `theme`  | string | `dark`     | `dark`, `light`                                       |
| `lang`   | string | `en`       | `en`, `zh`                                            |
| `format` | string | `png`      | `png`, `json`                                         |

### Example

```bash
curl -X POST http://127.0.0.1:41041/api/snapshot \
  -H "Authorization: Bearer YOUR_EXAMPLE_TOKEN # gitleaks:allow" \
  -H "Content-Type: application/json" \
  -d '{"detail":"full","range":"24h","theme":"light","lang":"en"}' \
  -o snapshot.png
```

Response headers include `Content-Disposition` with a timestamped filename. Use `format: "json"` to get raw `SnapshotData` instead of an image.

## Details

For full documentation, see:

- [API Reference — POST /api/snapshot](../../api-reference.md#post-apisnapshot) — response format, no-auth mode, all examples
