import { test, expect } from '@playwright/test';
import { seedAuth, blockSupabase, catchAllApi, ADMIN_PLAYER } from './helpers';

const SYNC_STATUS = {
  last_sync_at: '2026-05-16T10:00:00Z',
  last_sync_action: 'result_auto_fetched',
  next_run_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  recent_errors: [],
};

const RESULT_WITH_OVERRIDE = {
  match_id: 'm1',
  match_number: 1,
  status: 'completed',
  kickoff_utc: '2026-06-15T20:00:00Z',
  home_team: 'Brazil',
  away_team: 'Argentina',
  actual_home_score: 2,
  actual_away_score: 1,
  extra_time: false,
  penalties: false,
  result_source: 'override',
  result_entered_at: '2026-06-15T22:15:00Z',
};

test.describe('Admin override', () => {
  test('admin can trigger a manual sync (override)', async ({ page }) => {
    await seedAuth(page, ADMIN_PLAYER);
    await blockSupabase(page);
    await catchAllApi(page);

    await page.route('**/api/v1/admin/sync/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SYNC_STATUS),
      }),
    );

    let triggerCalled = false;
    await page.route('**/api/v1/admin/sync/trigger', (route) => {
      triggerCalled = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...SYNC_STATUS, last_sync_action: 'sync_triggered' }),
      });
    });

    await page.goto('/admin/sync');
    await expect(page.getByRole('heading', { name: /sync status/i })).toBeVisible();

    await page.getByRole('button', { name: /sync now/i }).click();

    await expect.poll(() => triggerCalled, { timeout: 5000 }).toBe(true);
    await expect(page.getByText('Sync triggered successfully')).toBeVisible();
  });

  test('admin results page shows override-tagged results', async ({ page }) => {
    await seedAuth(page, ADMIN_PLAYER);
    await blockSupabase(page);
    await catchAllApi(page);

    await page.route('**/api/v1/admin/results', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([RESULT_WITH_OVERRIDE]),
      }),
    );

    await page.goto('/admin/results');

    await expect(page.getByText('Brazil')).toBeVisible();
    await expect(page.getByText('Override')).toBeVisible();
  });

  test('non-admin is redirected away from admin pages', async ({ page }) => {
    await seedAuth(page); // regular player
    await blockSupabase(page);
    await catchAllApi(page);

    await page.goto('/admin/sync');

    // ProtectedRoute with requireAdmin redirects non-admins to /
    await expect(page).toHaveURL('/');
  });
});
