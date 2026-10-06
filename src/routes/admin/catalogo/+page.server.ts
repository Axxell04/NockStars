import * as auth from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createCatalog,
	deleteCatalog,
	getCatalogs,
	updateCatalog,
	getCatalogIdForProduct,
	getProductsByCatalog,
	getProductsWithoutCatalog
} from '$lib/server/catalog';
import {
	createProduct,
	deleteProduct,
	setProductActive,
	purgeInactiveProducts,
	setVariantActive,
	purgeInactiveVariants,
	getVariantsByProduct,
	updateVariant,
	deleteVariant
} from '$lib/server/product';
import type { UpdateVariantInput, VariantComplete } from '$lib/actions';
import type { ProductComplete } from '$lib/interfaces/product';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	const catalogs = await getCatalogs();

	// "Gestionar variantes" deep-links here with the product and tab in the
	// query string. Without resolving it the admin would land on Catálogos
	// with nothing selected, so build the selection server-side once.
	const searchParams = event.url.searchParams;
	const productId = searchParams.get('productId');
	const tab = searchParams.get('tab');

	let deepLink: null | {
		tab: 'variants';
		catalogId: string | null;
		product: ProductComplete | null;
		variants: VariantComplete[];
	} = null;

	if (productId && tab === 'variantes') {
		const catalogId = await getCatalogIdForProduct(productId);
		const candidates =
			catalogId !== null
				? await getProductsByCatalog(catalogId)
				: await getProductsWithoutCatalog();
		// A deleted or mistyped id still lands on the Variantes tab with its
		// empty state — better than silently showing nothing happened.
		const product = candidates.find((entry) => entry.product.id === productId) ?? null;
		// Admin list: deactivated variants stay listed so they can be toggled back.
		const variants = product ? await getVariantsByProduct(productId, { visibility: 'all' }) : [];

		deepLink = { tab: 'variants', catalogId, product, variants };
	}

	return {
		user: event.locals.user,
		catalogs: catalogs,
		deepLink
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
	set_product_active: async (event) => {
		const formData = await event.request.formData();
		const productId = formData.get('productId') as string;
		const active = formData.get('active') === 'true';

		if (!productId) {
			return fail(400, { message: 'Identificador de producto inválido' });
		}

		const result = await setProductActive(productId, active);
		if (!result.success) {
			return fail(400, { message: result.error.message });
		}

		return { success: true, active };
	},
	// Permanent removal, offered only once the product is inactive. The guards
	// live in deleteProduct: still referenced by an order or a cart comes back
	// as a failure instead of silently cascading those rows away.
	delete_product: async (event) => {
		const formData = await event.request.formData();
		const productId = formData.get('productId') as string;

		if (!productId) {
			return fail(400, { message: 'Identificador de producto inválido' });
		}

		const result = await deleteProduct(productId);
		if (!result.success) {
			return fail(400, { message: result.error.message });
		}

		return { success: true };
	},
	// Removes inactive products and variants once they have been out of the
	// catalogue for a while. Referenced ones come back as `skipped`: their rows
	// are what keeps the order history readable, so they are never forced out.
	purge_inactive_products: async () => {
		const { purged, skipped } = await purgeInactiveProducts();
		const { purged: purgedVariants, skipped: skippedVariants } = await purgeInactiveVariants();
		return {
			success: true,
			purged: purged.length,
			skipped: skipped.length,
			purgedVariants: purgedVariants.length,
			skippedVariants: skippedVariants.length
		};
	},
	// Variant actions
	set_variant_active: async (event) => {
		const formData = await event.request.formData();
		const variantId = formData.get('variantId') as string;
		const productId = formData.get('productId') as string;
		const active = formData.get('active') === 'true';

		if (!variantId || !productId) {
			return fail(400, { message: 'Identificador de variante o producto inválido' });
		}

		const result = await setVariantActive(variantId, active);
		if (!result.success) {
			return fail(400, { message: result.error.message });
		}

		// The modal refreshes its list from this payload, and the list is the
		// admin one: deactivated rows stay in it, flagged.
		const variants = await getVariantsByProduct(productId, { visibility: 'all' });
		return { success: true, active, variants };
	},
	update_variant: async (event) => {
		const formData = await event.request.formData();
		const variantId = formData.get('variantId') as string;
		const size = formData.get('size') as string;
		const color = formData.get('color') as string;
		const colorHex = (formData.get('colorHex') as string | null)?.trim() ?? '';
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
		if (colorHex !== '' && !/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
			return fail(400, { message: 'Color de muestra inválido' });
		}

		const input: UpdateVariantInput = {};
		if (size) input.size = size;
		if (color) input.color = color;
		if (colorHex) input.colorHex = colorHex;
		if (cut) input.cut = cut;
		if (description !== undefined) input.description = description;
		if (stock !== undefined) input.stock = stock;
		if (priceOverride !== undefined) input.priceOverride = priceOverride;
		if (sortOrder !== undefined) input.sortOrder = sortOrder;

		const result = await updateVariant(variantId, input);

		if (!result.success) {
			return fail(400, { message: result.error.message });
		}

		// Return updated variants list (admin view: inactive rows stay listed)
		const variants = await getVariantsByProduct(result.data.productId, {
			visibility: 'all'
		});
		return { success: true, variants };
	},
	// Still reachable: `VariantModal` rolls back a failed create through this
	// action, so it cannot be removed even though the table no longer posts to it.
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

		// Return updated variants list (admin view: inactive rows stay listed)
		const variants = await getVariantsByProduct(productId, { visibility: 'all' });
		return { success: true, variants };
	}
};
