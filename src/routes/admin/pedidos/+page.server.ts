import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Legacy /admin/pedidos now lives at /admin/finanzas?tab=pedidos. Temporary
 * redirect preserving every query param (?cod= deep links included) and
 * adding the tab param that selects the orders pane.
 */
export const load: PageServerLoad = async ({ url }) => {
	const params = new URLSearchParams(url.search);
	params.set('tab', 'pedidos');
	throw redirect(307, `/admin/finanzas?${params.toString()}`);
};
