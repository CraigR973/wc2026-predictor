import { test, expect } from '@playwright/test';

// Positive case: prod bundle built WITH VITE_API_URL must load without errors.
test('prod bundle loads without page errors when VITE_API_URL is set', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  expect(
    pageErrors,
    `Unexpected page errors in prod bundle: ${pageErrors.join(', ')}`,
  ).toHaveLength(0);

  // Page must render something — not a blank screen
  const bodyHTML = await page.locator('body').innerHTML();
  expect(bodyHTML.trim().length, 'Page body should not be empty').toBeGreaterThan(0);
});
