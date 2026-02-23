#!/usr/bin/env node

const usage = `
  Claw Insights v0.1.0

  Usage:
    claw-insights [options]

  Options:
    --port <port>       Server port (default: 3200)
    --gateway <url>     Gateway URL (default: http://localhost:3377)
    --help              Show this help

  ⚠️  Standalone mode not yet implemented.
  Currently: cd into project && bun run dev
`;

console.log(usage.trim());
process.exit(0);
