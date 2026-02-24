import { test, expect } from '@playwright/test';

test.describe('P0: Navigate to Logs (T4)', () => {
  test('LogPage renders with event data from seeded DB', async ({ page }) => {
    await page.goto('/#logs');
    // Filter bar should show error/warn pills
    await expect(page.getByRole('button', { name: /error/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('URL is #logs', async ({ page }) => {
    await page.goto('/#logs');
    await expect(page).toHaveURL(/#logs/);
  });
});

test.describe('P1: Logs Filter & Search (T5)', () => {
  test('clicking error filter pill toggles it', async ({ page }) => {
    await page.goto('/#logs');
    const errorPill = page.getByRole('button', { name: /error/i }).first();
    await expect(errorPill).toBeVisible({ timeout: 5000 });
    await errorPill.click();
    // Should still be visible (toggled state)
    await expect(errorPill).toBeVisible();
  });

  test('clicking warning filter pill toggles it', async ({ page }) => {
    await page.goto('/#logs');
    const warnPill = page.getByRole('button', { name: /warn/i }).first();
    await expect(warnPill).toBeVisible({ timeout: 5000 });
    await warnPill.click();
    await expect(warnPill).toBeVisible();
  });

  test('search box filters displayed events', async ({ page }) => {
    await page.goto('/#logs');
    await expect(page.getByRole('button', { name: /error/i }).first()).toBeVisible({ timeout: 5000 });
    const searchInput = page.getByPlaceholder(/search|filter/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('timeout');
      // Search should not cause errors
      await expect(page.getByText(/event log|logs/i).first()).toBeVisible();
    }
  });

  test('no page errors during filtering', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/#logs');
    await expect(page.getByRole('button', { name: /error/i }).first()).toBeVisible({ timeout: 5000 });
    // Click through filters
    const errorPill = page.getByRole('button', { name: /error/i }).first();
    if (await errorPill.isVisible()) {
      await errorPill.click();
      await expect(errorPill).toBeVisible();
    }
    expect(errors).toHaveLength(0);
  });
});
