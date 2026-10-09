import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',timeout:90000,expect:{timeout:15000},fullyParallel:false,workers:1,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:4173',browserName:'chromium',viewport:{width:1440,height:1000},trace:'retain-on-failure'},
  webServer:{command:'npm run dev -- --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI,timeout:30000},
});
