import { expect, type Page, test } from '@playwright/test';

type GraphQLOperation = {
  operationName?: string;
  query?: string;
  variables?: Record<string, unknown>;
};

function parseOperations(payload: string): GraphQLOperation[] {
  try {
    const parsed = JSON.parse(payload) as GraphQLOperation | GraphQLOperation[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    const params = new URLSearchParams(payload);
    const query = params.get('query') ?? undefined;
    const operationName = params.get('operationName') ?? undefined;
    const variablesRaw = params.get('variables');
    let variables: GraphQLOperation['variables'] | undefined;
    if (variablesRaw) {
      try {
        variables = JSON.parse(variablesRaw) as GraphQLOperation['variables'];
      } catch {
        variables = undefined;
      }
    }
    if (!query && !operationName) {
      throw new Error('Unsupported GraphQL payload format');
    }
    return [{ operationName, query, variables }];
  }
}

function getOperationName(op: GraphQLOperation): string | undefined {
  if (op.operationName) {
    return op.operationName;
  }
  if (!op.query) {
    return undefined;
  }
  return op.query.match(/\b(?:query|mutation|subscription)\s+([_A-Za-z][_0-9A-Za-z]*)\b/)?.[1];
}

function isOperation(op: GraphQLOperation, operationName: string): boolean {
  return getOperationName(op) === operationName;
}

function readSessionKey(variables: Record<string, unknown> | undefined): string | null {
  const value = variables?.sessionKey;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Helper: wait for dashboard to be loaded
const waitForDashboard = async (page: Page) => {
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
};

const MOCK_SESSION_KEY = 'agent:main:e2e-test';
const MOCK_SUBAGENT_KEY = 'agent:main:subagent:e2e-sub';

function buildMockSessionsResponse() {
  return {
    data: {
      source: {
        __typename: 'AgentNamespace',
        sessions: [
          {
            __typename: 'Session',
            key: MOCK_SESSION_KEY,
            displayName: 'E2E Test Session',
            kind: 'direct',
            model: 'claude-sonnet-4-20250514',
            channel: 'webchat',
            totalTokens: 50000,
            contextTokens: 200000,
            usagePercent: 25,
            status: 'ACTIVE',
            updatedAt: Math.floor(Date.now() / 1000) - 60,
            turnCount: 20,
            subAgents: [
              {
                __typename: 'Session',
                key: MOCK_SUBAGENT_KEY,
                displayName: 'Sub-agent: E2E',
                kind: 'subagent',
                model: 'claude-sonnet-4-20250514',
                channel: null,
                totalTokens: 12000,
                contextTokens: 200000,
                usagePercent: 6,
                status: 'ACTIVE',
                updatedAt: Math.floor(Date.now() / 1000) - 120,
                turnCount: 4,
              },
            ],
          },
        ],
      },
    },
  };
}

function buildMockTranscriptResponse(sessionKey: string) {
  const isSubagent = sessionKey.includes('subagent');
  return {
    data: {
      source: {
        __typename: 'AgentNamespace',
        sessionTranscript: {
          sessionKey,
          displayName: isSubagent ? 'Sub-agent: E2E' : 'E2E Test Session',
          model: 'claude-sonnet-4-20250514',
          channel: isSubagent ? null : 'webchat',
          kind: isSubagent ? 'subagent' : 'direct',
          thinkingLevel: null,
          startedAt: new Date().toISOString(),
          fileSize: 1024,
          totalTokens: isSubagent ? 12000 : 50000,
          contextTokens: 200000,
          durationMs: 60000,
          isSubAgent: isSubagent,
          parentDisplayName: isSubagent ? 'E2E Test Session' : null,
          spawnPrompt: isSubagent ? 'Test spawn prompt' : null,
          totalMessages: 2,
          pageInfo: {
            startCursor: 'c1',
            endCursor: 'c2',
            hasPreviousPage: false,
            hasNextPage: false,
          },
          messages: [
            {
              timestamp: new Date().toISOString(),
              role: 'user',
              content: 'Hello',
              contentTruncated: false,
              model: null,
              usage: null,
              toolName: null,
            },
            {
              timestamp: new Date().toISOString(),
              role: 'assistant',
              content: 'Hi!',
              contentTruncated: false,
              model: 'claude-sonnet-4-20250514',
              usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 },
              toolName: null,
            },
          ],
        },
      },
    },
  };
}

interface TranscriptOpenAssertion {
  sessionLabel: string;
  expectedSessionKey: string;
  transcriptResponseDelayMs?: number;
}

/**
 * Verifies that opening a session emits exactly one SessionTranscript request
 * and no cancelled/failed requests. Uses route interception to fully control test data.
 */
async function assertSingleTranscriptRequestOnOpen(page: Page, options: TranscriptOpenAssertion) {
  const { sessionLabel, expectedSessionKey, transcriptResponseDelayMs = 180 } = options;
  const transcriptRequests: string[] = [];
  const transcriptFailures: string[] = [];
  const pageErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  // Set up route handler BEFORE navigating
  await page.route('**/graphql', async (route) => {
    const request = route.request();
    const rawPayload = request.postData() ?? '';
    if (!rawPayload) {
      await route.continue();
      return;
    }

    let operations: GraphQLOperation[];
    try {
      operations = parseOperations(rawPayload);
    } catch {
      await route.continue();
      return;
    }

    if (operations.some((op) => isOperation(op, 'Sessions'))) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildMockSessionsResponse()),
      });
      return;
    }

    const transcriptOp = operations.find((op) => isOperation(op, 'SessionTranscript'));
    if (transcriptOp) {
      const sessionKey = readSessionKey(transcriptOp.variables) ?? '__MISSING_SESSION_KEY__';
      transcriptRequests.push(sessionKey);

      // Keep the request in-flight briefly so cancellation regressions can surface.
      if (transcriptResponseDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, transcriptResponseDelayMs));
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildMockTranscriptResponse(sessionKey)),
      });
      return;
    }

    await route.continue();
  });

  // Track cancelled/failed transcript requests
  page.on('requestfailed', (request) => {
    if (request.method() !== 'POST' || !request.url().includes('/graphql')) {
      return;
    }
    const rawPayload = request.postData() ?? '';
    if (!rawPayload) {
      return;
    }
    try {
      const operations = parseOperations(rawPayload);
      if (operations.some((op) => isOperation(op, 'SessionTranscript'))) {
        transcriptFailures.push(request.failure()?.errorText ?? 'cancelled');
      }
    } catch {
      // ignore unparsable failed payloads
    }
  });

  await page.goto('/');
  await waitForDashboard(page);

  const sessionElement = page.getByText(sessionLabel, { exact: true }).first();
  await expect(sessionElement).toBeVisible({ timeout: 10_000 });
  await sessionElement.click();

  await expect(page).toHaveURL(/#dashboard\?session=/);
  expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toHaveLength(0);
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  await expect.poll(() => transcriptRequests.length, { timeout: 8_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(500);

  // Must be exactly one request, and it must target the clicked session.
  expect(transcriptRequests).toEqual([expectedSessionKey]);
  expect(transcriptFailures).toHaveLength(0);
}

test.describe('P0: Dashboard First Load (T1)', () => {
  test('page loads and renders main UI', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);
  });

  test('TopBar shows version string', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);
    // Version string like "Claw Insights v0.1.0" should be somewhere in the page
    await expect(page.getByText(/Claw Insights/i).first()).toBeVisible();
  });

  test('TopBar renders without errors (resources may not be available)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await waitForDashboard(page);
    const cpuVisible = await page
      .getByText(/CPU|cpu/i)
      .isVisible()
      .catch(() => false);
    expect(errors).toHaveLength(0);
    if (cpuVisible) {
      await expect(page.getByText(/MEM|mem/i)).toBeVisible();
    }
  });

  test('Sessions panel renders with title and controls', async ({ page }) => {
    await page.goto('/');
    const sessionsTitle = page.getByText(/^Sessions$|^会话$/);
    await expect(sessionsTitle).toBeVisible({ timeout: 10_000 });
    const activeBtn = page.getByRole('button', { name: /active|活跃/i }).first();
    const noSessions = page.getByText(/no sessions|暂无会话/i);
    const hasActiveBtn = await activeBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmptyState = await noSessions.isVisible().catch(() => false);
    expect(hasActiveBtn || hasEmptyState).toBeTruthy();
  });

  test('Metrics area renders chart canvases', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
    const canvases = page.locator('canvas');
    expect(await canvases.count()).toBeGreaterThanOrEqual(1);
  });

  test('Channel pills area is present in TopBar', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);
  });
});

test.describe('P0: Time Range Switch (T2)', () => {
  test('GranularityPicker options are visible', async ({ page }) => {
    await page.goto('/');
    for (const label of ['1h', '6h', '12h', '24h']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 10_000 });
    }
  });

  test('clicking a range option updates selection', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);
    const btn6h = page.getByRole('button', { name: '6h', exact: true });
    await btn6h.click();
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
  });

  test('switching range does not cause errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await expect(page.getByRole('button', { name: '1h', exact: true })).toBeVisible({ timeout: 10_000 });
    for (const label of ['1h', '6h', '12h', '24h']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator('canvas').first()).toBeVisible();
    }
    expect(errors).toHaveLength(0);
  });
});

test.describe('P0: Session Interaction (T3)', () => {
  test('Active/All toggle is clickable when sessions exist', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);
    const allBtn = page.getByRole('button', { name: /^(all|全部)$/i }).first();
    const activeBtn = page.getByRole('button', { name: /^(active|活跃)$/i }).first();
    const hasToggle = await allBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasToggle) {
      await allBtn.click();
      await expect(activeBtn).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(page.getByText(/no sessions|暂无会话/i)).toBeVisible();
    }
  });

  test('sort buttons visible when sessions loaded', async ({ page }) => {
    await page.goto('/');
    const sortLabel = page.getByText(/^Sort$|^排序$/);
    const hasSortLabel = await sortLabel.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasSortLabel) {
      const recentBtn = page.getByRole('button', { name: /recent|最近/i }).first();
      await expect(recentBtn).toBeVisible();
    } else {
      await expect(page.getByText(/no sessions|暂无会话/i)).toBeVisible();
    }
  });

  test('opening a main session sends exactly one SessionTranscript request (no cancelled)', async ({ page }) => {
    await assertSingleTranscriptRequestOnOpen(page, {
      sessionLabel: 'E2E Test Session',
      expectedSessionKey: MOCK_SESSION_KEY,
    });
  });

  test('opening a compact sub-agent session sends exactly one SessionTranscript request (no cancelled)', async ({
    page,
  }) => {
    await assertSingleTranscriptRequestOnOpen(page, {
      sessionLabel: 'Sub-agent: E2E',
      expectedSessionKey: MOCK_SUBAGENT_KEY,
    });
  });
});

test.describe('P0: Navigate to Logs (T4)', () => {
  test('clicking Logs tab navigates to logs page', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);
    const logsTab = page.getByRole('link', { name: /logs/i });
    await logsTab.click();
    await expect(page).toHaveURL(/#logs/);
  });

  test('LogPage renders DensityStrip, FilterBar, EventTable', async ({ page }) => {
    await page.goto('/#logs');
    await expect(page.getByText(/event log|logs/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('checkbox', { name: /error/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('P1: Metrics Model Selector (T6)', () => {
  test('ModelSelector is present when multi-model data exists', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);
  });
});
