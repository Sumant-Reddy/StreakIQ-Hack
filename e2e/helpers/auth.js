/**
 * loginAs - mocks the auth API and sets localStorage so the app
 * treats the browser session as authenticated.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'LEARNER' | 'ADMIN' | 'TRAINER'} role
 */
async function loginAs(page, role = 'LEARNER') {
  const mockUser = {
    LEARNER: { id: 1, name: 'Test Learner', role: 'LEARNER', email: 'learner@test.com' },
    ADMIN:   { id: 2, name: 'Test Admin',   role: 'ADMIN',   email: 'admin@test.com'  },
    TRAINER: { id: 3, name: 'Test Trainer', role: 'TRAINER', email: 'trainer@test.com' },
  }[role];

  const mockToken = 'mock-jwt-token-' + role.toLowerCase();

  // Intercept any login API call so the app receives a valid-looking response
  await page.route('**/api/auth/login', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: mockToken, user: mockUser }),
    });
  });

  // Navigate to the app root first so we are on the right origin
  await page.goto('/');

  // Inject auth data into localStorage directly so the app boots as authenticated
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    { token: mockToken, user: mockUser }
  );
}

module.exports = { loginAs };
