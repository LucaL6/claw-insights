import { expect, test } from '@playwright/test';

test.describe('P2: Theme Switch (T9)', () => {
  test('dark theme sets data-theme="dark" on html', async ({ page }) => {
    await page.goto('/#?theme=dark');
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('light theme sets data-theme="light" on html', async ({ page }) => {
    await page.goto('/#?theme=light');
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('light');
  });

  test('switching theme does not cause page errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/#?theme=light');
    await expect(page.getByText('Claw Insights')).toBeVisible({ timeout: 5000 });
    await page.goto('/#?theme=dark');
    await expect(page.getByText('Claw Insights')).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe('P2: Internationalization (T10)', () => {
  test('lang=en shows English text', async ({ page }) => {
    await page.goto('/#?lang=en');
    await expect(page.getByText('Claw Insights')).toBeVisible({ timeout: 5000 });
    // Use exact match to avoid matching tooltip text containing "sessions"
    await expect(page.getByText('Metrics', { exact: true })).toBeVisible();
  });

  test('lang=zh shows Chinese text', async ({ page }) => {
    await page.goto('/#?lang=zh');
    await expect(page.getByText('Claw Insights')).toBeVisible({ timeout: 5000 });
    // "指标" is the Chinese translation for "Metrics"
    await expect(page.getByText('指标', { exact: true })).toBeVisible();
  });

  test('switching language via toggle does not cause errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/#?lang=en');
    await expect(page.getByText('Metrics', { exact: true })).toBeVisible({ timeout: 5000 });
    // Click the language toggle button (🌐) to switch to zh
    await page.getByRole('button', { name: '🌐' }).click();
    await expect(page.getByText('指标', { exact: true })).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe('P2: Responsive Layout (T11)', () => {
  test('narrow viewport (375px) renders without crashing', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await expect(page.getByText('Claw Insights')).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });

  test('narrow viewport still shows key elements', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.getByText('Claw Insights')).toBeVisible({ timeout: 5000 });
    // Wait for charts to render (canvas elements are created async by Chart.js)
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10000 });
  });

  test('tablet viewport (768px) renders without errors', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await expect(page.getByText('Claw Insights')).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });
});
