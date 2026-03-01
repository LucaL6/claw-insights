import { expect, test } from '@playwright/test';

test.describe('P0/P1: Cross-page Navigation (T4, T8)', () => {
  test('Dashboard → Logs → Dashboard round-trip', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: /logs/i }).click();
    await expect(page).toHaveURL(/#logs/);
    await expect(page.getByText(/event log|logs/i).first()).toBeVisible({ timeout: 5000 });

    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/#dashboard/);
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
  });

  test('direct navigation to #logs works', async ({ page }) => {
    await page.goto('/#logs');
    await expect(page.getByText(/event log|logs/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('direct navigation to #dashboard works', async ({ page }) => {
    await page.goto('/#dashboard');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
  });

  test('no page errors during navigation', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('link', { name: /logs/i }).click();
    await expect(page).toHaveURL(/#logs/);
    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/#dashboard/);

    expect(errors).toHaveLength(0);
  });
});
