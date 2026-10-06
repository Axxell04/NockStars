import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env') });

// Integration tests must never run against the development database.
//
// The setup file deletes the whole cart/order/catalog set before every test,
// and the suites themselves write through getDb(), which reads DATABASE_URL.
// Redirecting DATABASE_URL here makes both sides agree on one target and keeps
// the destructive cleanup away from development data. Fail closed instead of
// falling back: a missing test database is a configuration error, not a
// licence to use the real one.
if (!process.env.TEST_DATABASE_URL) {
	throw new Error(
		'TEST_DATABASE_URL is not set. Integration tests refuse to run against DATABASE_URL. ' +
			'Point TEST_DATABASE_URL at a disposable database (see .env.example).'
	);
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: 'node',
		include: ['src/**/*.integration.test.ts', 'src/**/*.integration.test.js'],
		setupFiles: ['src/test/integration-setup.ts'],
		testTimeout: 30000,
		// The shared setup wipes the whole catalog/cart/order set before every
		// test. Files running in parallel wipe each other's fixtures mid-test,
		// which surfaces as foreign-key violations and rows that vanish between
		// the insert and the assertion. Integration files must run one at a time.
		fileParallelism: false,
		resolve: {
			alias: {
				$lib: path.resolve(__dirname, './src/lib'),
				'$lib/server': path.resolve(__dirname, './src/lib/server'),
				'$lib/test': path.resolve(__dirname, './src/test')
			}
		}
	}
});
