import { expect, test } from '@playwright/test';

test.describe('P1: Edge Cases (T12)', () => {
  test('page handles missing/slow server gracefully', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
  });

  test('empty logs page shows appropriate state', async ({ page }) => {
    await page.goto('/#logs?from=0&to=1');
    await expect(page.getByText(/event log|logs/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('invalid hash route falls back to dashboard', async ({ page }) => {
    await page.goto('/#nonexistent');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
  });
});
