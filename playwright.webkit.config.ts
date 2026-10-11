import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// The optional executable override supports the cloud's local WebKit libraries.
// On macOS, Playwright uses its installed WebKit without an override.
export default defineConfig(base, {
  projects: [{ name: 'webkit', use: {
    browserName: 'webkit',
    ...(process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } }
      : {}),
  } }],
  outputDir: 'test-results/webkit',
  reporter: [['list'], ['html', { outputFolder: 'test-results/webkit-html', open: 'never' }]],
});
