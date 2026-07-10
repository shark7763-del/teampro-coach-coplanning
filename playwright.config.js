const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:5188',
    trace: 'retain-on-failure',
    serviceWorkers: 'block'
  },
  webServer: {
    command: 'npx http-server . -p 5188 -c-1',
    url: 'http://127.0.0.1:5188/index.html',
    reuseExistingServer: false,
    timeout: 30000
  }
});
