import { getAssignableProducts } from '$lib/server/catalog';
import type { RequestHandler } from './$types';

// Candidate list for "assign an existing product to a catalog": every product
// outside the given catalog, tagged with the catalog it currently sits in.
export const GET: RequestHandler = async (event) => {
	const catalogId = event.url.searchParams.get('catalogId');

	if (!catalogId) {
		return new Response(JSON.stringify({ error: 'catalogId required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const products = await getAssignableProducts(catalogId);
		return new Response(JSON.stringify({ products }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Failed to load assignable products:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
