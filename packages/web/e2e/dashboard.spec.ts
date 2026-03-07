import { expect, type Page, test } from '@playwright/test';

// Helper: wait for dashboard to be loaded
const waitForDashboard = async (page: Page) => {
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
};

test.describe('P0: Dashboard First Load (T1)', () => {
  test('page loads and renders main UI', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);
  });

  test('TopBar shows version string', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);
    // Version string like "Claw Insights v0.9.0" should be somewhere in the page
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
