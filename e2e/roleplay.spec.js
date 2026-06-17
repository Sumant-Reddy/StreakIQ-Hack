const { test, expect } = require('@playwright/test');
const { loginAs } = require('./helpers/auth');

test.describe('Roleplay feature', () => {
  test.beforeEach(async ({ page }) => {
    // loginAs drives the login form and lands on /learn
    await loginAs(page, 'LEARNER');
  });

  test('roleplay page loads with correct title', async ({ page }) => {
    await page.goto('/learn/roleplay');
    // Layout title="AI Mock Customer Roleplay"
    await expect(page.locator('h1')).toContainText('AI Mock Customer Roleplay', { timeout: 10000 });
  });

  test('all four scenario cards are displayed', async ({ page }) => {
    await page.goto('/learn/roleplay');

    const scenarios = ['Anniversary Gift Seeker', 'First-time Engagement Ring Buyer', 'Solitaire Upgrade Customer', 'Corporate Gifting Client'];
    for (const scenario of scenarios) {
      await expect(page.getByText(scenario).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('offline fallback shows pre-built greeting after starting a scenario', async ({ page }) => {
    // socket.io is already aborted by loginAs, so clicking a scenario activates offline mode
    await page.goto('/learn/roleplay');

    // Click the Anniversary scenario card
    await page.getByText('Anniversary Gift Seeker').first().click();

    // After socket fails / offline mode activates, a customer greeting appears
    // The opening line for anniversary scenario is known from BUILT_IN_RESPONSES
    await expect(page.getByText("Good morning! I'm looking for a special diamond ring").first())
      .toBeVisible({ timeout: 10000 });
  });

  test('connection status shows Offline badge when socket is aborted', async ({ page }) => {
    await page.goto('/learn/roleplay');
    await page.getByText('Anniversary Gift Seeker').first().click();

    // After offline mode kicks in, the status badge shows "Practice Offline"
    await expect(page.getByText('Practice Offline').first()).toBeVisible({ timeout: 10000 });
  });
});
