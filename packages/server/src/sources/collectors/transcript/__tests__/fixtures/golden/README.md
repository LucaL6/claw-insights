# Golden Dataset (DESIGN-063 P0b)

Frozen .jsonl transcript fixtures used to verify that refactored `processFile` produces
identical output to the original `streamScanFile`.

`baseline.json` was generated programmatically by running `streamScanFile` over each fixture.

## Files

| File | Purpose |
|------|---------|
| `normal.jsonl` | 10 lines, mixed roles, trailing newline |
| `no-trailing-newline.jsonl` | 5 lines, no trailing newline (partial handling) |
| `long-single-line.jsonl` | Single line >1MB (memory pressure) |
| `multibyte-emoji.jsonl` | CJK + emoji (encoding correctness) |
| `empty.jsonl` | 0 bytes (edge case) |

**Do not modify these files.** The baseline test will fail if any content changes.
