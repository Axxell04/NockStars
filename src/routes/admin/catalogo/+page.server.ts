import * as auth from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createCatalog, deleteCatalog, getCatalogs, updateCatalog } from '$lib/server/catalog';
import {
	createProduct,
	updateProduct,
	deleteProduct,
	getVariantsByProduct,
	updateVariant,
	deleteVariant
} from '$lib/server/product';
import type { UpdateVariantInput } from '$lib/actions';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	const catalogs = await getCatalogs();

	return {
		user: event.locals.user,
		catalogs: catalogs
	};
};

export const actions: Actions = {
	logout: async (event) => {
		if (!event.locals.session) {
			return fail(401);
		}
		await auth.invalidateSession(event.locals.session.id);
		auth.deleteSessionTokenCookie(event);

		redirect(302, '/login');
	},
	add_catalog: async (event) => {
		const formData = await event.request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;

		if (!name) {
			return fail(400, { message: 'Nombre inválido' });
		}

		try {
			await createCatalog(name, description);
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Error interno del servidor' });
		}

		const catalogs = await getCatalogs();

		return {
			catalogs: catalogs
		};
	},
	delete_catalog: async (event) => {
		const formData = await event.request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { message: 'Identificador inválido' });
		}

		try {
			await deleteCatalog(id);
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Error interno del servidor' });
		}

		const catalogs = await getCatalogs();
		return {
			catalogs: catalogs
		};
	},
	edit_catalog: async (event) => {
		const formData = await event.request.formData();
		const id = formData.get('id') as string;
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;

		if (!id) {
			return fail(400, { message: 'Identificador inválido' });
		}
		if (!name) {
			return fail(400, { message: 'Nombre inválido' });
		}

		try {
			await updateCatalog(id, name, description);
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Error interno del servidor' });
		}

		const catalogs = await getCatalogs();
		return {
			catalogs: catalogs
		};
	},
	// Product actions
	add_product: async (event) => {
		const formData = await event.request.formData();
		const name = formData.get('name') as string;
		const price = parseFloat(formData.get('price') as string);
		const catalogId = formData.get('catalogId') as string;
		const stock = parseInt(formData.get('stock') as string) || 0;

		if (!name || isNaN(price)) {
			return fail(400, { message: 'Datos de producto inválidos' });
		}

		try {
			const productId = await createProduct(name, price, catalogId, stock);
			return { success: true, productId };
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Error interno del servidor' });
		}
	},
	update_product: async (event) => {
		const formData = await event.request.formData();
		const productId = formData.get('productId') as string;
		const name = formData.get('name') as string;
		const price = parseFloat(formData.get('price') as string);
		const stock = parseInt(formData.get('stock') as string) || 0;

		if (!productId || !name || isNaN(price)) {
			return fail(400, { message: 'Datos de producto inválidos' });
		}

		try {
			await updateProduct({ product_id: productId, name, price, stock });
			return { success: true };
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Error interno del servidor' });
		}
	},
	delete_product: async (event) => {
		const formData = await event.request.formData();
		const productId = formData.get('productId') as string;

		if (!productId) {
			return fail(400, { message: 'Identificador de producto inválido' });
		}

		try {
			await deleteProduct(productId);
			return { success: true };
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Error interno del servidor' });
		}
	},
	// Variant actions
	update_variant: async (event) => {
		const formData = await event.request.formData();
		const variantId = formData.get('variantId') as string;
		const size = formData.get('size') as string;
		const color = formData.get('color') as string;
		const cut = formData.get('cut') as 'oversize' | 'recto';
		const descriptionRaw = formData.get('description') as string | null;
		const description =
			descriptionRaw === null ? undefined : descriptionRaw.trim() === '' ? null : descriptionRaw;
		const priceRaw = formData.get('priceOverride') as string | null;
		const priceOverride =
			priceRaw === null ? undefined : priceRaw.trim() === '' ? null : Number(priceRaw);
		const stockRaw = formData.get('stock') as string | null;
		const stock = stockRaw === null || stockRaw.trim() === '' ? undefined : Number(stockRaw);
		const sortRaw = formData.get('sortOrder') as string | null;
		const sortOrder = sortRaw === null || sortRaw.trim() === '' ? undefined : Number(sortRaw);

		if (!variantId) {
			return fail(400, { message: 'Identificador de variante inválido' });
		}
		// priceOverride is undefined (leave it), null (clear it) or a number —
		// Number.isFinite(null) is false, so null must be allowed explicitly.
		if (
			(stock !== undefined && !Number.isInteger(stock)) ||
			(sortOrder !== undefined && !Number.isInteger(sortOrder)) ||
			(priceOverride !== null && priceOverride !== undefined && !Number.isFinite(priceOverride))
		) {
			return fail(400, { message: 'Valores numéricos inválidos' });
		}

		const input: UpdateVariantInput = {};
		if (size) input.size = size;
		if (color) input.color = color;
		if (cut) input.cut = cut;
		if (description !== undefined) input.description = description;
		if (stock !== undefined) input.stock = stock;
		if (priceOverride !== undefined) input.priceOverride = priceOverride;
		if (sortOrder !== undefined) input.sortOrder = sortOrder;

		const result = await updateVariant(variantId, input);

		if (!result.success) {
			return fail(400, { message: result.error.message });
		}

		// Return updated variants list
		const variants = await getVariantsByProduct(result.data.productId);
		return { success: true, variants };
	},
	delete_variant: async (event) => {
		const formData = await event.request.formData();
		const variantId = formData.get('variantId') as string;
		const productId = formData.get('productId') as string;

		if (!variantId || !productId) {
			return fail(400, { message: 'Identificador de variante o producto inválido' });
		}

		const result = await deleteVariant(variantId);

		if (!result.success) {
			return fail(400, { message: result.error.message });
		}

		// Return updated variants list
		const variants = await getVariantsByProduct(productId);
		return { success: true, variants };
	}
};
