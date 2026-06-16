const { test, expect } = require('@playwright/test');
const { loginAs } = require('./helpers/auth');

test.describe('Certifications', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'LEARNER');
  });

  test('certifications page loads', async ({ page }) => {
    await page.goto('/learn/certifications');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2')).toContainText('My Certifications', { timeout: 10000 });
  });

  test('shows empty state when no certs', async ({ page }) => {
    // Mock the certifications API to return an empty array
    await page.route('**/api/learner/certifications', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/learn/certifications');
    await page.waitForLoadState('networkidle');

    // An empty-state message should be visible when there are no certifications
    const emptyState = page.locator(
      '[data-testid="empty-state"], text=/no certifications|no badges|complete.*course|earn.*first/i'
    ).first();
    await expect(emptyState).toBeVisible({ timeout: 10000 });
  });
});
