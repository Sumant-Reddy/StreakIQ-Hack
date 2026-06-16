const { test, expect } = require('@playwright/test');
const { loginAs } = require('./helpers/auth');

test.describe('Roleplay feature', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'LEARNER');
  });

  test('roleplay scenario select page loads', async ({ page }) => {
    await page.goto('/learn/roleplay');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2')).toContainText('AI Mock Customer Roleplay', { timeout: 10000 });
  });

  test('scenario cards are displayed', async ({ page }) => {
    await page.goto('/learn/roleplay');
    await page.waitForLoadState('networkidle');

    // Expect all four scenario cards to be visible
    const scenarios = ['Anniversary', 'Engagement', 'Upgrade', 'Gifting'];
    for (const scenario of scenarios) {
      await expect(page.locator(`text=${scenario}`).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('roleplay shows connecting state on start', async ({ page }) => {
    await page.goto('/learn/roleplay');
    await page.waitForLoadState('networkidle');

    // Click the Anniversary scenario card to start a session
    await page.locator('text=Anniversary').first().click();

    // Immediately after clicking, a connecting/loading indicator should be visible
    // (not an immediate error — the socket connection attempt should be in progress)
    const loadingIndicator = page.locator(
      '[data-testid="connecting"], [aria-label*="connect" i], text=/connecting|loading/i'
    ).first();
    await expect(loadingIndicator).toBeVisible({ timeout: 8000 });
  });

  test('offline mode fallback shows pre-built response', async ({ page }) => {
    // Block socket.io connections to simulate offline mode
    await page.route('**/socket.io/**', (route) => route.abort());

    await page.goto('/learn/roleplay');
    await page.waitForLoadState('networkidle');

    // Start the Anniversary scenario
    await page.locator('text=Anniversary').first().click();

    // After socket fails, the offline/fallback mode should kick in and display
    // a pre-built customer greeting within a reasonable timeout
    const greeting = page.locator(
      '[data-testid="customer-message"], .customer-message, text=/hello|hi|welcome|namaste|good (morning|afternoon|evening)/i'
    ).first();
    await expect(greeting).toBeVisible({ timeout: 15000 });
  });
});
