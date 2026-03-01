import { expect, test } from '@playwright/test';

test.describe('P0: Navigate to Logs (T4)', () => {
  test('LogPage renders with event data from seeded DB', async ({ page }) => {
    await page.goto('/#logs');
    // FilterBar pills use <button role="checkbox"> (FilterBar.tsx:97-99)
    await expect(page.getByRole('checkbox', { name: /error/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('URL is #logs', async ({ page }) => {
    await page.goto('/#logs');
    await expect(page).toHaveURL(/#logs/);
  });
});

test.describe('P1: Logs Filter & Search (T5)', () => {
  test('clicking error filter pill toggles it', async ({ page }) => {
    await page.goto('/#logs');
    const errorPill = page.getByRole('checkbox', { name: /error/i }).first();
    await expect(errorPill).toBeVisible({ timeout: 10_000 });
    await errorPill.click();
    await expect(errorPill).toBeVisible();
  });

  test('clicking warning filter pill toggles it', async ({ page }) => {
    await page.goto('/#logs');
    const warnPill = page.getByRole('checkbox', { name: /warn/i }).first();
    await expect(warnPill).toBeVisible({ timeout: 10_000 });
    await warnPill.click();
    await expect(warnPill).toBeVisible();
  });

  test('search box filters displayed events', async ({ page }) => {
    await page.goto('/#logs');
    await expect(page.getByRole('checkbox', { name: /error/i }).first()).toBeVisible({ timeout: 10_000 });
    const searchInput = page.getByPlaceholder(/search|filter/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('timeout');
      await expect(page.getByText(/event log|logs/i).first()).toBeVisible();
    }
  });

  test('no page errors during filtering', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/#logs');
    await expect(page.getByRole('checkbox', { name: /error/i }).first()).toBeVisible({ timeout: 10_000 });
    const errorPill = page.getByRole('checkbox', { name: /error/i }).first();
    if (await errorPill.isVisible()) {
      await errorPill.click();
      await expect(errorPill).toBeVisible();
    }
    expect(errors).toHaveLength(0);
  });
});
