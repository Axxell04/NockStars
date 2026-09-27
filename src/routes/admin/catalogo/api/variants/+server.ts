import { getVariantsByProduct } from '$lib/server/product';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const productId = event.url.searchParams.get('productId');

	if (!productId) {
		return new Response(JSON.stringify({ error: 'productId required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const variants = await getVariantsByProduct(productId);
		return new Response(JSON.stringify({ variants }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Failed to load variants:', error);
		return new Response(JSON.stringify({ error: 'Internal server error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
