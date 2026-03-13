#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Manual verification plan (Task 6):
// 1) Query GraphQL sessions tree.
// 2) Read sessions.json spawnedBy links.
// 3) Verify every spawnedBy child is attached under parent in GraphQL.
// 4) Exit non-zero on mismatch.

const CONFIG_PATH = path.join(os.homedir(), '.claw-insights/config.json');
const DEFAULT_SESSIONS_PATH = path.join(os.homedir(), '.openclaw/agents/main/sessions/sessions.json');

/** @typedef {Record<string, unknown>} JsonRecord */

/** @returns {Promise<JsonRecord>} */
async function readConfigFile() {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** @param {unknown} value @returns {value is JsonRecord} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {JsonRecord} cfg @returns {string | null} */
function resolveApiToken(cfg) {
  const fromEnv = process.env.CLAW_INSIGHTS_API_TOKEN;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim();
  }

  const fromConfig = cfg.apiToken;
  if (typeof fromConfig === 'string' && fromConfig.trim()) {
    return fromConfig.trim();
  }

  return null;
}

/** @param {JsonRecord} cfg @returns {string} */
function resolveGraphqlUrl(cfg) {
  const explicit = process.env.CLAW_INSIGHTS_SERVER_URL;
  if (explicit && explicit.trim()) {
    const base = explicit.trim();
    return base.endsWith('/graphql') ? base : `${base.replace(/\/+$/, '')}/graphql`;
  }

  const envPort = Number(process.env.CLAW_INSIGHTS_SERVER_PORT);
  const cfgPort = typeof cfg.serverPort === 'number' ? cfg.serverPort : Number.NaN;
  const port = Number.isFinite(envPort) && envPort > 0 ? envPort : Number.isFinite(cfgPort) && cfgPort > 0 ? cfgPort : 41041;

  return `http://127.0.0.1:${port}/graphql`;
}

/** @returns {string} */
function resolveSessionsPath() {
  return process.env.CLAW_INSIGHTS_SESSIONS_PATH || DEFAULT_SESSIONS_PATH;
}

/** @returns {string} */
function resolveSourceId() {
  const sourceId = process.env.CLAW_INSIGHTS_SOURCE_ID;
  return sourceId && sourceId.trim() ? sourceId.trim() : 'agent:main';
}

/**
 * @param {string} graphqlUrl
 * @param {string} apiToken
 * @returns {Promise<Array<{ key: string, subAgents: Array<unknown> }>>}
 */
async function fetchGraphqlSessions(graphqlUrl, apiToken) {
  const query = `
    query SessionHierarchyParity($selector: SourceSelector!) {
      source(selector: $selector) {
        __typename
        ... on AgentNamespace {
          sessions {
            key
            subAgents {
              key
              subAgents {
                key
                subAgents {
                  key
                  subAgents {
                    key
                    subAgents {
                      key
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const variables = { selector: { id: resolveSourceId() } };

  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GraphQL request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  /** @type {unknown} */
  const payload = await response.json();
  if (!isRecord(payload)) {
    throw new Error('GraphQL response is not an object');
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error(`GraphQL returned errors: ${JSON.stringify(payload.errors.slice(0, 3))}`);
  }

  const data = payload.data;
  if (!isRecord(data) || !isRecord(data.source)) {
    throw new Error('GraphQL response missing data.source');
  }

  const source = data.source;
  if (source.__typename !== 'AgentNamespace') {
    throw new Error(`GraphQL source resolved to unexpected type: ${String(source.__typename)}`);
  }

  if (!Array.isArray(source.sessions)) {
    throw new Error('GraphQL response missing data.source.sessions');
  }

  return /** @type {Array<{ key: string, subAgents: Array<unknown> }>} */ (source.sessions);
}

/**
 * @param {Array<{ key: string, subAgents: Array<unknown> }>} sessions
 * @returns {Set<string>}
 */
function collectGraphqlLinks(sessions) {
  /** @type {Set<string>} */
  const links = new Set();

  /** @param {unknown} node */
  function visit(node) {
    if (!isRecord(node)) {
      return;
    }
    const parentKey = typeof node.key === 'string' ? node.key : null;
    const children = Array.isArray(node.subAgents) ? node.subAgents : [];

    for (const child of children) {
      if (!isRecord(child)) {
        continue;
      }
      const childKey = typeof child.key === 'string' ? child.key : null;
      if (parentKey && childKey) {
        links.add(`${parentKey}=>${childKey}`);
      }
      visit(child);
    }
  }

  for (const session of sessions) {
    visit(session);
  }

  return links;
}

/**
 * @param {string} sessionsPath
 * @returns {Promise<{ expectedLinks: Set<string>, skippedMissingParentLinks: Set<string> }>}
 */
async function collectExpectedLinks(sessionsPath) {
  const raw = await readFile(sessionsPath, 'utf8');
  /** @type {unknown} */
  const parsed = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error('sessions.json must be an object keyed by session key');
  }

  const sessionKeys = new Set(Object.keys(parsed));
  /** @type {Set<string>} */
  const expectedLinks = new Set();
  /** @type {Set<string>} */
  const skippedMissingParentLinks = new Set();

  for (const [childKey, value] of Object.entries(parsed)) {
    if (!isRecord(value)) {
      continue;
    }
    const spawnedBy = value.spawnedBy;
    if (typeof spawnedBy !== 'string' || spawnedBy.trim().length === 0) {
      continue;
    }

    const parentKey = spawnedBy.trim();
    const link = `${parentKey}=>${childKey}`;

    if (!sessionKeys.has(parentKey)) {
      skippedMissingParentLinks.add(link);
      continue;
    }

    expectedLinks.add(link);
  }

  return { expectedLinks, skippedMissingParentLinks };
}

async function main() {
  const cfg = await readConfigFile();
  const apiToken = resolveApiToken(cfg);

  if (!apiToken) {
    console.error('[check:session-hierarchy] ERROR: missing API token.');
    console.error('Set CLAW_INSIGHTS_API_TOKEN or add apiToken to ~/.claw-insights/config.json.');
    process.exit(1);
  }

  const graphqlUrl = resolveGraphqlUrl(cfg);
  const sessionsPath = resolveSessionsPath();

  let graphqlLinks;
  try {
    const sessions = await fetchGraphqlSessions(graphqlUrl, apiToken);
    graphqlLinks = collectGraphqlLinks(sessions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[check:session-hierarchy] ERROR: failed querying GraphQL (${graphqlUrl}): ${message}`);
    process.exit(1);
  }

  let expectedLinks;
  let skippedMissingParentLinks;
  try {
    ({ expectedLinks, skippedMissingParentLinks } = await collectExpectedLinks(sessionsPath));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[check:session-hierarchy] ERROR: failed reading sessions (${sessionsPath}): ${message}`);
    process.exit(1);
  }

  /** @type {string[]} */
  const missingLinks = [];
  for (const link of expectedLinks) {
    if (!graphqlLinks.has(link)) {
      missingLinks.push(link);
    }
  }

  console.log('[check:session-hierarchy] summary');
  console.log(`  graphqlUrl=${graphqlUrl}`);
  console.log(`  sessionsPath=${sessionsPath}`);
  console.log(`  expectedLinks=${expectedLinks.size}`);
  console.log(`  graphLinks=${graphqlLinks.size}`);
  console.log(`  skippedMissingParentLinks=${skippedMissingParentLinks.size}`);
  console.log(`  mismatches=${missingLinks.length}`);

  if (skippedMissingParentLinks.size > 0) {
    for (const link of Array.from(skippedMissingParentLinks).slice(0, 5)) {
      console.log(`  skipped(parent-missing): ${link}`);
    }
  }

  if (missingLinks.length > 0) {
    console.error('[check:session-hierarchy] FAIL: spawnedBy links missing from GraphQL tree');
    for (const link of missingLinks.slice(0, 20)) {
      console.error(`  missing: ${link}`);
    }
    process.exit(1);
  }

  console.log('PASS: hierarchy parity ok');
}

main();
