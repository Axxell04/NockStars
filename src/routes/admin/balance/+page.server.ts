import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Legacy /admin/balance now lives at /admin/finanzas (Dashboard | Movimientos
 * | Pedidos tabs). Temporary redirect keeping every query param — from/to,
 * preset and tab all stay valid on the unified route.
 */
export const load: PageServerLoad = async ({ url }) => {
	throw redirect(307, `/admin/finanzas${url.search}`);
};
