import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Legacy /admin/pedido/[id] now lives at /admin/finanzas/pedidos/[id]
 * (temporary redirect, query params preserved).
 */
export const load: PageServerLoad = async (event) => {
	throw redirect(307, `/admin/finanzas/pedidos/${event.params.id}${event.url.search}`);
};
