/**
 * loginAs — drives the real login form with mocked API responses.
 *
 * This is the most reliable auth helper for Playwright because it goes through
 * the actual React login flow: fill form → mock API returns token → AuthContext
 * stores yami_token and sets user → Login.jsx redirects to /learn.
 * After this function resolves, the browser is on /learn and fully authenticated.
 *
 * All downstream API calls the app makes are also mocked so no real backend
 * (database / Redis) is needed.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'LEARNER' | 'ADMIN' | 'MANAGER'} role
 */
async function loginAs(page, role = 'LEARNER') {
  const USERS = {
    LEARNER: { id: 1, name: 'Test Learner', role: 'LEARNER', email: 'learner@test.com', language: 'EN', department: 'Sales' },
    ADMIN:   { id: 2, name: 'Test Admin',   role: 'ADMIN',   email: 'admin@test.com',   language: 'EN', department: 'Admin' },
    MANAGER: { id: 3, name: 'Test Manager', role: 'MANAGER', email: 'manager@test.com', language: 'EN', department: 'Sales' },
  };

  const mockUser  = USERS[role] || USERS.LEARNER;
  const mockToken = 'mock-jwt-token-' + role.toLowerCase();

  // ── API mocks (registered once; persist for all navigations on this page) ──

  await page.route('**/api/auth/login', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ token: mockToken, user: mockUser }) })
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) })
  );
  await page.route('**/api/auth/me/language', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  );

  await page.route('**/api/learner/dashboard', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({
        enrollments: [], streak: { currentStreak: 0, longestStreak: 0 },
        points: { totalPoints: 0, weeklyPoints: 0 }, retention: { score: 0 },
        risk: { riskLevel: 'LOW' }, recentBadges: [], recentActivity: [],
        totalHours: 0, coursesInProgress: 0, coursesCompleted: 0,
      }) })
  );
  await page.route('**/api/learner/certifications', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/learner/learning-path', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/learner/roleplays', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/learner/history*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ quizAttempts: [], watchSessions: [] }) })
  );

  await page.route('**/api/gamification/leaderboard*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/gamification/badges', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/gamification/my-stats', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ totalPoints: 0, weeklyPoints: 0, rank: 0, badgeCount: 0 }) })
  );

  await page.route('**/api/courses*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: [], total: 0 }) })
  );
  await page.route('**/api/ai/recommendations/*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ recommendations: [] }) })
  );
  await page.route('**/api/ai/ai-recommendations/*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/ai/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ gemini: 'ok', redis: 'ok', qdrant: 'ok' }) })
  );

  // Abort socket.io so it doesn't block networkidle
  await page.route('**/socket.io/**', (route) => route.abort());

  // ── Drive the real login form ──────────────────────────────────────────────
  // Navigate to login page (app redirects unauthenticated users there anyway)
  await page.goto('/login');
  await page.fill('input[type="email"]', mockUser.email);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Wait until the app redirects away from login (to /learn, /admin, or /manager)
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10000 });
}

module.exports = { loginAs };
