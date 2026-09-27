import * as auth from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createCatalog, deleteCatalog, getCatalogs, updateCatalog } from '$lib/server/catalog';
import {
	createProduct,
	updateProduct,
	deleteProduct,
	getVariantsByProduct,
	createVariant,
	updateVariant,
	deleteVariant
} from '$lib/server/product';
import type { CreateVariantInput, UpdateVariantInput } from '$lib/actions';

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
			return fail(400, { message: 'Invalid name' });
		}

		try {
			await createCatalog(name, description);
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Internal server error' });
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
			return fail(400, { message: 'Invalid id' });
		}

		try {
			await deleteCatalog(id);
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Internal server error' });
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
			return fail(400, { message: 'Invalid id' });
		}
		if (!name) {
			return fail(400, { message: 'Invalid name' });
		}

		try {
			await updateCatalog(id, name, description);
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Internal server error' });
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
			return fail(400, { message: 'Invalid product data' });
		}

		try {
			const productId = await createProduct(name, price, catalogId, stock);
			return { success: true, productId };
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Internal server error' });
		}
	},
	update_product: async (event) => {
		const formData = await event.request.formData();
		const productId = formData.get('productId') as string;
		const name = formData.get('name') as string;
		const price = parseFloat(formData.get('price') as string);
		const stock = parseInt(formData.get('stock') as string) || 0;

		if (!productId || !name || isNaN(price)) {
			return fail(400, { message: 'Invalid product data' });
		}

		try {
			await updateProduct({ product_id: productId, name, price, stock });
			return { success: true };
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Internal server error' });
		}
	},
	delete_product: async (event) => {
		const formData = await event.request.formData();
		const productId = formData.get('productId') as string;

		if (!productId) {
			return fail(400, { message: 'Invalid product id' });
		}

		try {
			await deleteProduct(productId);
			return { success: true };
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Internal server error' });
		}
	},
	// Variant actions
	add_variant: async (event) => {
		const formData = await event.request.formData();
		const productId = formData.get('productId') as string;
		const size = formData.get('size') as string;
		const color = formData.get('color') as string;
		const cut = formData.get('cut') as 'oversize' | 'recto';
		const description = formData.get('description') as string;
		const stock = parseInt(formData.get('stock') as string) || 0;
		const priceOverride = formData.get('priceOverride') as string;
		const sortOrder = parseInt(formData.get('sortOrder') as string) || 0;

		if (!productId || !size || !color || !cut) {
			return fail(400, { message: 'Invalid variant data' });
		}

		const input: CreateVariantInput = {
			productId,
			size,
			color,
			cut,
			description: description || undefined,
			stock,
			priceOverride: priceOverride ? parseFloat(priceOverride) : undefined,
			sortOrder
		};

		const result = await createVariant(input);

		if (!result.success) {
			return fail(400, { message: result.error.message });
		}

		// Return updated variants list
		const variants = await getVariantsByProduct(productId);
		return { success: true, variants };
	},
	update_variant: async (event) => {
		const formData = await event.request.formData();
		const variantId = formData.get('variantId') as string;
		const size = formData.get('size') as string;
		const color = formData.get('color') as string;
		const cut = formData.get('cut') as 'oversize' | 'recto';
		const description = formData.get('description') as string;
		const stock = formData.get('stock') ? parseInt(formData.get('stock') as string) : undefined;
		const priceOverride = formData.get('priceOverride')
			? parseFloat(formData.get('priceOverride') as string)
			: undefined;
		const sortOrder = formData.get('sortOrder')
			? parseInt(formData.get('sortOrder') as string)
			: undefined;

		if (!variantId) {
			return fail(400, { message: 'Invalid variant id' });
		}

		const input: UpdateVariantInput = {};
		if (size) input.size = size;
		if (color) input.color = color;
		if (cut) input.cut = cut;
		if (description) input.description = description;
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
			return fail(400, { message: 'Invalid variant or product id' });
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
