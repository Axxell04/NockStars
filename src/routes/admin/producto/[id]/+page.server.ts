import type { PageServerLoad, Actions } from './$types';
import {
	getProductWithVariants,
	getImgs,
	bindImg,
	reorderImgs,
	setProductActive as setProductActiveRecord,
	prepareProductWrite,
	updateProduct as updateProductRecord,
	deleteProduct as deleteProductRecord
} from '$lib/server/product';
import { parseSpecRows } from '$lib/product-specs';
import { redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user?.admin) {
		redirect(302, '/login');
	}

	const productId = params.id;
	// Admin views deactivated products too — they are still editable there.
	const product = await getProductWithVariants(productId, { includeInactive: true });

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

		const productWrite = prepareProductWrite({
			description: formData.get('description') as string | null,
			specRows: parseSpecRows(formData)
		});
		if (!productWrite.success) {
			return fail(400, { message: productWrite.error.message });
		}

		await updateProductRecord({ product_id: productId, name, price, stock, ...productWrite.data });

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

	setProductActive: async ({ request, params }) => {
		const formData = await request.formData();
		const active = formData.get('active') === 'true';

		const result = await setProductActiveRecord(params.id, active);
		if (!result.success) {
			return fail(400, { message: result.error.message });
		}

		return { success: true, active };
	},

	// Permanent removal, offered only once the product is inactive. The client
	// navigates to its return target on success: the editor has nothing left
	// to show once the row is gone.
	deleteProduct: async ({ params }) => {
		const result = await deleteProductRecord(params.id);
		if (!result.success) {
			return fail(400, { message: result.error.message });
		}

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
	},

	reorderImages: async ({ request, params }) => {
		const formData = await request.formData();
		const rawIds = formData.get('imageIds');

		let imageIds: unknown[] = [];
		if (rawIds) {
			try {
				const parsed = JSON.parse(String(rawIds));
				imageIds = Array.isArray(parsed) ? parsed : [];
			} catch {
				return fail(400, { message: 'Orden de imágenes inválido' });
			}
		}

		if (imageIds.length === 0 || !imageIds.every((id) => typeof id === 'string')) {
			return fail(400, { message: 'Orden de imágenes inválido' });
		}

		try {
			await reorderImgs(params.id, imageIds as string[]);
		} catch {
			return fail(400, { message: 'El orden no coincide con las imágenes del producto' });
		}

		return { success: true };
	}
};
