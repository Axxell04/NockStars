import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: 'jsdom',
		include: ['tests/unit/**/*.test.ts'],
		setupFiles: ['src/test/unit-setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/lib/**/*.ts', 'src/lib/**/*.js'],
			exclude: ['src/test/**', 'src/**/*.d.ts', 'src/**/*.svelte']
		},
		resolve: {
			alias: {
				$lib: path.resolve(__dirname, './src/lib'),
				'$lib/server': path.resolve(__dirname, './src/lib/server'),
				'$lib/test': path.resolve(__dirname, './src/test')
			}
		}
	}
});
