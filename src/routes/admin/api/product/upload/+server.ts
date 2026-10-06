import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bindImg, createProduct, getProducts } from '$lib/server/product';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Acción no autorizada' });
	}

	const formData = await request.formData();
	const phase = formData.get('phase') as string;
	const catalogId = locals.catalogId;
	if (!phase) return json({ success: false, message: "Parámetro 'phase' no encontrado" });

	if (phase === '1') {
		const name = formData.get('name') as string;
		const price = parseFloat(formData.get('price') as string);

		try {
			const productId = await createProduct(name, price, catalogId);
			return json({ success: true, productId });
		} catch {
			return json({ success: false, message: 'Internal server error' });
		}
	} else if (phase === '2') {
		const url = formData.get('url') as string;
		const productId = formData.get('product-id') as string;
		if (!url) return json({ success: false, message: "Parámetro 'url' no encontrado" });
		await bindImg(productId, url);
		return json({ success: true });
	} else if (phase === '3') {
		const pagination = await getProducts({ visibility: 'all', catalogId });
		return json({ success: true, pagination: pagination });
	}
	return json({ success: false, message: "Parámetro 'phase' es incorrecto" });
};
