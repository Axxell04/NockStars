import type { PageServerLoad, Actions } from './$types';
import { createProduct, bindImg } from '$lib/server/product';
import { getCatalogs } from '$lib/server/catalog';
import { redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user?.admin) {
		redirect(302, '/login');
	}

	const catalogs = await getCatalogs();

	return { catalogs };
};

export const actions: Actions = {
	createProduct: async ({ request }) => {
		const formData = await request.formData();

		const name = formData.get('name') as string;
		const price = Number(formData.get('price'));
		const stock = Number(formData.get('stock') ?? 0);
		const catalogId = formData.get('catalogId') as string | null;
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

		if (!name || !Number.isFinite(price) || price <= 0) {
			return fail(400, { message: 'Nombre y precio son obligatorios' });
		}

		const productId = await createProduct(name, price, catalogId || undefined, stock);

		if (Array.isArray(imageUrls)) {
			for (const url of imageUrls) {
				if (typeof url !== 'string') {
					return fail(400, { message: 'URL de imagen inválida' });
				}
				await bindImg(productId, url);
			}
		}

		return { success: true, productId };
	}
};
