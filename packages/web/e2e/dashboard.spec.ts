import { test, expect } from '@playwright/test';

if (typeof Bun === 'undefined') {
  test.describe('Dashboard E2E', () => {
  test('NFR-1.1: page loads within 2 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForSelector('text=OpenClaw');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });

  test('F1.1: TopBar shows Gateway version', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=OpenClaw')).toBeVisible();
    await expect(page.locator('text=/2026/')).toBeVisible();
  });

  test('F1.3: TopBar shows CPU/MEM/DISK', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=CPU')).toBeVisible();
    await expect(page.locator('text=/^MEM /')).toBeVisible();
    await expect(page.locator('text=DISK')).toBeVisible();
  });

  test('F2.1: Session list renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Sessions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Active Only' })).toBeVisible();
    // Data may be empty or populated depending on runtime; assert panel structure + at least one row or empty state
    const hasNoSessions = await page.locator('text=No sessions').isVisible().catch(() => false);
    if (!hasNoSessions) {
      await expect(page.getByText(/\d+\.\dk tokens/).first()).toBeVisible();
    }
  });

  test('F3: Metrics section renders charts', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=METRICS')).toBeVisible();
    const canvases = page.locator('canvas');
    expect(await canvases.count()).toBeGreaterThanOrEqual(4);
  });

  test('F4: Logs section renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Logs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ALL' })).toBeVisible();
  });

  test('F6.1: sections can be collapsed', async ({ page }) => {
    await page.goto('/');
    const sessionsHeader = page.getByRole('button', { name: 'Sessions' });
    await sessionsHeader.click();
    const content = page.locator('button:has-text("Sessions") + div');
    await expect(content).toHaveClass(/max-h-0/);
  });

  test('F5.1: restart modal opens and closes', async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("Restart")').click();
    await expect(page.locator('text=Restart Gateway')).toBeVisible();
    await page.locator('text=Cancel').click();
    await expect(page.locator('text=Restart Gateway')).not.toBeVisible();
  });
  });
}
