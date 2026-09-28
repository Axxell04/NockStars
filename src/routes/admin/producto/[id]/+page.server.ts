import type { PageServerLoad, Actions } from './$types';
import {
	getProductWithVariants,
	getImgs,
	bindImg,
	deleteProduct as deleteProductRecord,
	updateProduct as updateProductRecord
} from '$lib/server/product';
import { redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user?.admin) {
		redirect(302, '/login');
	}

	const productId = params.id;
	const product = await getProductWithVariants(productId);

	if (!product) {
		redirect(302, '/admin/catalogo');
	}

	const productImages = await getImgs(productId);

	return {
		product: {
			...product,
			productImages
		}
	};
};

export const actions: Actions = {
	updateProduct: async ({ request, params }) => {
		const formData = await request.formData();
		const productId = params.id;

		const name = formData.get('name') as string;
		const price = parseFloat(formData.get('price') as string);
		const stock = parseInt(formData.get('stock') as string) || 0;

		if (!name || !price) {
			return fail(400, { message: 'Nombre y precio son obligatorios' });
		}

		await updateProductRecord({ product_id: productId, name, price, stock });

		return { success: true };
	},

	deleteImage: async ({ request }) => {
		const formData = await request.formData();
		const imageId = formData.get('imageId') as string;

		if (!imageId) {
			return fail(400, { message: 'ID de imagen requerido' });
		}

		const { deleteImg } = await import('$lib/server/product');
		await deleteImg(imageId);

		return { success: true };
	},

	deleteProduct: async ({ params }) => {
		const productId = params.id;
		await deleteProductRecord(productId);
		return { success: true };
	},

	uploadImage: async ({ request, params }) => {
		const formData = await request.formData();
		const productId = params.id;
		const rawImageUrls = formData.get('imageUrls');

		let imageUrls: unknown[] = [];
		if (rawImageUrls) {
			try {
				const parsed = JSON.parse(String(rawImageUrls));
				imageUrls = Array.isArray(parsed) ? parsed : [];
			} catch {
				return fail(400, { message: 'URL de imagen inválida' });
			}
		}

		if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
			return fail(400, { message: 'Archivo requerido' });
		}

		for (const url of imageUrls) {
			if (typeof url !== 'string') {
				return fail(400, { message: 'URL de imagen inválida' });
			}
			await bindImg(productId, url);
		}

		return { success: true };
	}
};
