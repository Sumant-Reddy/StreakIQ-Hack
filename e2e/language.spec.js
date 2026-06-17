const { test, expect } = require('@playwright/test');
const { loginAs } = require('./helpers/auth');

test.describe('Language switcher', () => {
  test.beforeEach(async ({ page }) => {
    // loginAs drives the login form and lands on /learn
    await loginAs(page, 'LEARNER');
  });

  test('language switcher button is visible with current language label', async ({ page }) => {
    const langBtn = page.locator('button:has-text("English")').first();
    await expect(langBtn).toBeVisible({ timeout: 8000 });
  });

  test('language switcher opens on click and shows all 7 languages', async ({ page }) => {
    await page.locator('button:has-text("English")').first().click();

    // All 7 language options should become visible
    await expect(page.locator('button:has-text("हिंदी")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("தமிழ்")')).toBeVisible();
    await expect(page.locator('button:has-text("ಕನ್ನಡ")')).toBeVisible();
    await expect(page.locator('button:has-text("తెలుగు")')).toBeVisible();
    await expect(page.locator('button:has-text("मराठी")')).toBeVisible();
    await expect(page.locator('button:has-text("বাংলা")')).toBeVisible();
  });

  test('switching to Hindi changes the language button label', async ({ page }) => {
    await page.locator('button:has-text("English")').first().click();
    await page.locator('button:has-text("हिंदी")').first().click();

    // Language button now shows हिंदी
    await expect(page.locator('button:has-text("हिंदी")').first()).toBeVisible({ timeout: 5000 });
  });

  test('switching to Hindi changes nav labels to Hindi', async ({ page }) => {
    await page.locator('button:has-text("English")').first().click();
    await page.locator('button:has-text("हिंदी")').first().click();

    // Sidebar nav should show Hindi label for Dashboard
    await expect(page.locator('text=डैशबोर्ड').first()).toBeVisible({ timeout: 5000 });
  });

  test('language persists in localStorage after switching', async ({ page }) => {
    await page.locator('button:has-text("English")').first().click();
    await page.locator('button:has-text("हिंदी")').first().click();

    const storedLang = await page.evaluate(() => localStorage.getItem('yami_lang'));
    expect(storedLang).toBe('hi');
  });
});
