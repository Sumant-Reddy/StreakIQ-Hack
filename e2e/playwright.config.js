// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
  },
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30000,
  retries: 0,
});
