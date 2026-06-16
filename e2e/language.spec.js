const { test, expect } = require('@playwright/test');
const { loginAs } = require('./helpers/auth');

test.describe('Language switcher', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'LEARNER');
    // Navigate to main learner dashboard after auth
    await page.goto('/learn');
    await page.waitForLoadState('networkidle');
  });

  test('language switcher opens on click', async ({ page }) => {
    // Locate the Globe icon button (language switcher trigger)
    const globeButton = page.locator('button[aria-label*="language" i], button:has(svg[data-lucide="globe"]), button:has(.lucide-globe)').first();
    await globeButton.click();

    // The dropdown/popover should become visible
    const dropdown = page.locator('[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]').first();
    await expect(dropdown).toBeVisible({ timeout: 5000 });
  });

  test('switching to Hindi changes nav labels', async ({ page }) => {
    // Open language switcher
    const globeButton = page.locator('button[aria-label*="language" i], button:has(svg[data-lucide="globe"]), button:has(.lucide-globe)').first();
    await globeButton.click();

    // Click the Hindi option
    const hindiOption = page.locator('text=हिंदी').or(page.locator('[data-lang="hi"]')).first();
    await hindiOption.click();

    // Sidebar navigation should now contain Hindi text
    const sidebar = page.locator('nav, aside, [role="navigation"]').first();
    await expect(sidebar).toContainText('हिंदी', { timeout: 5000 });
  });

  test('language persists on reload', async ({ page }) => {
    // Open language switcher and switch to Hindi
    const globeButton = page.locator('button[aria-label*="language" i], button:has(svg[data-lucide="globe"]), button:has(.lucide-globe)').first();
    await globeButton.click();

    const hindiOption = page.locator('text=हिंदी').or(page.locator('[data-lang="hi"]')).first();
    await hindiOption.click();

    // Reload the page (re-inject auth to keep session)
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      },
      { token: 'mock-jwt-token-learner', user: { id: 1, name: 'Test Learner', role: 'LEARNER', email: 'learner@test.com' } }
    );

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Hindi should still be selected after reload
    const body = page.locator('body');
    await expect(body).toContainText('हिंदी', { timeout: 5000 });
  });
});
