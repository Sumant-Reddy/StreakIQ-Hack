const { test, expect } = require('@playwright/test');

test.describe('Auth flow', () => {
  test('shows login page', async ({ page }) => {
    await page.goto('/');
    // App should redirect unauthenticated users to /login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('body')).toContainText('YAMI Learn');
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    // Mock the login endpoint to return 401
    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid credentials' }),
      });
    });

    await page.goto('/login');

    // Fill in wrong credentials
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Expect an error message to appear (Login.jsx renders setError result in red div)
    await expect(page.locator('body')).toContainText(/invalid email or password|invalid|incorrect/i, { timeout: 8000 });
  });

  test('login redirects to dashboard', async ({ page }) => {
    // Intercept POST /api/auth/login and return a successful mock response
    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock',
          user: { id: 1, name: 'Test', role: 'LEARNER' },
        }),
      });
    });

    await page.goto('/login');

    await page.fill('input[type="email"]', 'learner@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // After successful login the app should navigate to the learner dashboard
    await expect(page).toHaveURL(/\/learn/, { timeout: 10000 });
  });
});
