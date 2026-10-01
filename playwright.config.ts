import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './src/test/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			// `channel: 'chromium'` launches the full Chromium build instead of the
			// headless shell Playwright defaults to in headless mode, so the suite
			// runs against the browser the project installs.
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], channel: 'chromium' }
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] }
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] }
		}
	],
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 120000
	}
});
