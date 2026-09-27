import { getProductsByCatalog } from '$lib/server/catalog';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const catalogId = event.url.searchParams.get('catalogId');

	if (!catalogId) {
		return new Response(JSON.stringify({ error: 'catalogId required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const products = await getProductsByCatalog(catalogId);
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
