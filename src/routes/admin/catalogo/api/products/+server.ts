import { getProductsByCatalog, getProductsWithoutCatalog } from '$lib/server/catalog';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const catalogId = event.url.searchParams.get('catalogId');

	try {
		// Absent catalogId is a valid request on this admin-only endpoint:
		// it means "products with no catalog membership" (the Sin catálogo view).
		const products = catalogId
			? await getProductsByCatalog(catalogId)
			: await getProductsWithoutCatalog();
		return new Response(JSON.stringify({ products }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Failed to load products:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
