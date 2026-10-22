import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: true, retries: 0,
  use: { baseURL:'http://127.0.0.1:4173', timezoneId:'Asia/Shanghai', trace:'retain-on-failure' },
  projects: [
    {name:'mobile-chromium',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}},
    {name:'mobile-webkit',use:{...devices['iPhone 13'],defaultBrowserType:'webkit'}}
  ],
  webServer: {command:'npm run preview -- --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:true},
});
