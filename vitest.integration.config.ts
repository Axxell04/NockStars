import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: 'node',
		include: ['src/**/*.integration.test.ts', 'src/**/*.integration.test.js'],
		setupFiles: ['src/test/integration-setup.ts'],
		testTimeout: 30000,
		resolve: {
			alias: {
				$lib: path.resolve(__dirname, './src/lib'),
				'$lib/server': path.resolve(__dirname, './src/lib/server'),
				'$lib/test': path.resolve(__dirname, './src/test')
			}
		}
	}
});
