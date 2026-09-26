import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// Hosts extra ademas de localhost, separados por coma (ej. un tunel ngrok).
	// Se lee del shell o de .env / .env.local. Sin la variable, queda cerrado.
	// Un punto inicial acepta el dominio y todos sus subdominios.
	const allowedHosts = (loadEnv(mode, '.', '').DEV_ALLOWED_HOSTS ?? '')
		.split(',')
		.map((host) => host.trim())
		.filter(Boolean);

	return {
		plugins: [sveltekit(), tailwindcss()],
		server: { allowedHosts },
		ssr: {
			noExternal: ['fs'] // Excluir 'fs' del empaquetado para el cliente
		},
		optimizeDeps: {
			exclude: ['fs'] // Excluir 'fs' durante la optimización de dependencias
		}
	};
});
