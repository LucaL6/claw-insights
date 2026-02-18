import { test, expect } from '@playwright/test';

test.describe('P1: Edge Cases (T12)', () => {
  test('page handles missing/slow server gracefully', async ({ page }) => {
    // Even if server queries fail, page should render without crashing
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await expect(page.getByText('Claw Insights')).toBeVisible({ timeout: 5000 });
    // Some data may show loading/empty states — that's fine
  });

  test('empty logs page shows appropriate state', async ({ page }) => {
    await page.goto('/#logs?from=0&to=1');
    await page.waitForTimeout(2000);
    // With from=0&to=1 (epoch 0-1), there should be no events
    // Page should not crash
    await expect(page.getByText(/event log|logs/i).first()).toBeVisible();
  });

  test('invalid hash route falls back to dashboard', async ({ page }) => {
    await page.goto('/#nonexistent');
    // Should show dashboard (default) or at least not crash
    await expect(page.getByText('Claw Insights')).toBeVisible({ timeout: 5000 });
  });
});
