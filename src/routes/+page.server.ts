import { getProducts } from '$lib/server/product';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCatalogs } from '$lib/server/catalog';
import { getCartBySession, migrateLegacyCart } from '$lib/server/cart';
import type { CartItemWithProduct } from '$lib/actions';

export const load: PageServerLoad = async (event) => {
	const catalogId = event.locals.catalogId;

	// Check for v2 cart cookie (cart_session_id)
	let cartSessionId = event.cookies.get('cart_session_id');
	let cartItems: CartItemWithProduct[] = [];

	if (cartSessionId) {
		// Load existing cart from database
		const cart = await getCartBySession(cartSessionId);
		if (cart) {
			cartItems = cart.items;
		}
	} else {
		// Check for v1 cart cookie (cart) - migrate if present
		const legacyCartCookie = event.cookies.get('cart');
		if (legacyCartCookie) {
			try {
				let legacyItems: Array<{
					productId: string;
					variantId?: string;
					quantity: number;
					size?: string;
					color?: string;
					cut?: 'oversize' | 'recto';
				}>;

				try {
					legacyItems = JSON.parse(legacyCartCookie);
				} catch (parseError) {
					// Malformed v1 JSON - log error and treat as empty
					console.error('Cart migration failed: malformed v1 cookie JSON', parseError);
					throw parseError;
				}

				if (!Array.isArray(legacyItems)) {
					console.error('Cart migration failed: v1 cookie is not an array');
					throw new Error('Invalid cart format');
				}

				if (legacyItems.length > 0) {
					// Generate new session ID for v2 cart
					const newSessionId = crypto.randomUUID();
					const migratedCart = await migrateLegacyCart(legacyItems, newSessionId);

					// Set new v2 cookie
					event.cookies.set('cart_session_id', newSessionId, {
						path: '/',
						httpOnly: true,
						sameSite: 'lax',
						secure: event.url.protocol === 'https:',
						maxAge: 60 * 60 * 24 * 30 // 30 days
					});

					// Delete v1 cookie
					event.cookies.delete('cart', {
						path: '/',
						httpOnly: true,
						sameSite: 'lax',
						secure: event.url.protocol === 'https:'
					});

					cartItems = migratedCart.items;
					cartSessionId = newSessionId;
				}
			} catch (error) {
				console.error('Cart migration failed:', error);
				// Clear corrupted v1 cookie and start fresh
				event.cookies.delete('cart', {
					path: '/',
					httpOnly: true,
					sameSite: 'lax',
					secure: event.url.protocol === 'https:'
				});
			}
		}
	}

	const [pagination, catalogs] = await Promise.all([getProducts({ catalogId }), getCatalogs()]);

	return {
		pagination: pagination,
		catalogId: catalogId,
		catalogs: catalogs,
		cartItems: cartItems,
		seo: {
			title: 'NockStars — Tienda de Camisetas',
			description:
				'NockStars es tu tienda online de camisetas personalizadas. Catálogo exclusivo, pedidos por encargo y envíos a todo el país.',
			type: 'website'
		}
	};
};

export const actions: Actions = {
	prev_page: async (event) => {
		const formData = await event.request.formData();
		let totalPages = 0;
		let currentPage = 0;
		const catalogId = event.locals.catalogId;
		const searchValue = formData.get('search-value') as string;

		try {
			totalPages = parseInt(formData.get('total_pages') as string);
			currentPage = parseInt(formData.get('current_page') as string);
			if (isNaN(totalPages) || isNaN(currentPage)) {
				return fail(400, { message: 'Invalid pagination params' });
			}
		} catch {
			return fail(400, { message: 'Invalid pagination params' });
		}

		if (currentPage <= 1) {
			return fail(404, { message: 'Page not found' });
		}
		const nextPage = currentPage - 1;
		const pagination = await getProducts({ page: nextPage, catalogId, search: searchValue });

		return {
			pagination: pagination
		};
	},
	next_page: async (event) => {
		const formData = await event.request.formData();
		let totalPages = 0;
		let currentPage = 0;
		const catalogId = event.locals.catalogId;
		const searchValue = formData.get('search-value') as string;

		try {
			totalPages = parseInt(formData.get('total_pages') as string);
			currentPage = parseInt(formData.get('current_page') as string);
			if (isNaN(totalPages) || isNaN(currentPage)) {
				return fail(400, { message: 'Invalid pagination params' });
			}
		} catch {
			return fail(400, { message: 'Invalid pagination params' });
		}

		if (currentPage >= totalPages) {
			return fail(404, { message: 'Page not found' });
		}
		const nextPage = currentPage + 1;
		const pagination = await getProducts({ page: nextPage, catalogId, search: searchValue });

		return {
			pagination: pagination
		};
	},
	search: async (event) => {
		const formData = await event.request.formData();
		const value = formData.get('value') as string;
		const catalogId = event.locals.catalogId;
		const pagination = await getProducts({ catalogId, search: value });

		return {
			pagination
		};
	},
	goto_page: async (event) => {
		const formData = await event.request.formData();
		let gotoPage = 0;
		const catalogId = event.locals.catalogId;
		const searchValue = formData.get('search-value') as string;

		try {
			gotoPage = parseInt(formData.get('goto_page') as string);
			if (isNaN(gotoPage)) {
				return fail(400, { message: 'Invalid pagination params' });
			}
		} catch {
			return fail(400, { message: 'Invalid pagination params' });
		}

		const pagination = await getProducts({ page: gotoPage, catalogId, search: searchValue });

		return {
			pagination: pagination
		};
	},
	set_catalog: async (event) => {
		const formData = await event.request.formData();
		const catalogId = formData.get('catalog_id') as string;

		if (catalogId) {
			event.cookies.set('catalog-id', catalogId, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: event.url.protocol === 'https:'
			});
		} else {
			event.cookies.delete('catalog-id', {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: event.url.protocol === 'https:'
			});
		}
		const pagination = await getProducts({ catalogId });

		return {
			pagination: pagination
		};
	},
	update_cart: async (event) => {
		const formData = await event.request.formData();
		const cart = formData.get('cart') as string;

		event.cookies.set('cart', cart, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: event.url.protocol === 'https:'
		});
	}
};
