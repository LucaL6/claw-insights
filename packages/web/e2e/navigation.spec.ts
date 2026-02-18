import { test, expect } from '@playwright/test';

test.describe('P0/P1: Cross-page Navigation (T4, T8)', () => {
  test('Dashboard → Logs → Dashboard round-trip', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Claw Insights')).toBeVisible({ timeout: 5000 });

    // Navigate to Logs
    await page.getByRole('button', { name: /logs/i }).click();
    await expect(page).toHaveURL(/#logs/);
    await expect(page.getByText(/event log|logs/i).first()).toBeVisible({ timeout: 5000 });

    // Navigate back to Dashboard
    await page.getByRole('button', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/#dashboard/);
    await expect(page.getByText('Claw Insights')).toBeVisible();
  });

  test('direct navigation to #logs works', async ({ page }) => {
    await page.goto('/#logs');
    await expect(page.getByText(/event log|logs/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('direct navigation to #dashboard works', async ({ page }) => {
    await page.goto('/#dashboard');
    await expect(page.getByText('Claw Insights')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 5000 });
  });

  test('no page errors during navigation', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /logs/i }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /dashboard/i }).click();
    await page.waitForTimeout(1000);

    expect(errors).toHaveLength(0);
  });
});
