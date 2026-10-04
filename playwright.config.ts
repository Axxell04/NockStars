import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Specs seed and clean up their own rows, and the admin suites sign in, so the
// worker process needs DATABASE_URL / ADMIN_USERNAME / ADMIN_PASS. Only the
// spawned `npm run dev` child loads .env by itself.
dotenv.config();

export default defineConfig({
	testDir: './src/test/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	// Each test drives a full page lifecycle against a dev server that compiles
	// on demand and a real database. Under two workers those requests queue, so
	// the checkout and multi-tab flows need well over Playwright's 30s default
	// even when nothing is wrong — they time out waiting, not failing.
	timeout: 60000,
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
			//
			// Firefox and WebKit projects are intentionally omitted: their browsers
			// are not installed locally and there is no CI to run them. Re-add them
			// once `npx playwright install firefox webkit` has been run somewhere
			// that can reach the Playwright CDN.
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], channel: 'chromium' }
		}
	],
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 120000
	}
});
