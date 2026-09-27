import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCartBySession } from '$lib/server/cart';
import type { CartItemWithProduct } from '$lib/actions';
import { getDb } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const cartSessionId = event.cookies.get('cart_session_id');
	let cartItems: CartItemWithProduct[] = [];

	if (cartSessionId) {
		const cart = await getCartBySession(cartSessionId);
		if (cart) {
			cartItems = cart.items;
		}
	}

	// SEO
	const seo = {
		title: 'Carrito — NockStars',
		description: 'Revisa tu carrito de compras y finaliza tu pedido.',
		type: 'website' as const
	};

	return {
		cartItems,
		seo
	};
};

export const actions: Actions = {
	updateQuantity: async (event) => {
		const formData = await event.request.formData();
		const cartItemId = formData.get('cartItemId') as string;
		const quantity = parseInt(formData.get('quantity') as string) || 0;
		const version = parseInt(formData.get('version') as string) || 1;

		const cartSessionId = event.cookies.get('cart_session_id');
		if (!cartSessionId) {
			return fail(400, { message: 'No hay sesión de carrito activa' });
		}

		const { updateCartItem } = await import('$lib/server/cart');

		const result = await updateCartItem(cartItemId, { cartItemId, quantity, version });

		if (!result.success) {
			return fail(400, { message: result.error.message, details: result.error.details });
		}

		return {
			success: true,
			cartItems: result.data.items
		};
	},

	removeFromCart: async (event) => {
		const formData = await event.request.formData();
		const cartItemId = formData.get('cartItemId') as string;

		const cartSessionId = event.cookies.get('cart_session_id');
		if (!cartSessionId) {
			return fail(400, { message: 'No hay sesión de carrito activa' });
		}

		const { removeCartItem } = await import('$lib/server/cart');

		const result = await removeCartItem(cartItemId);

		if (!result.success) {
			return fail(400, { message: result.error.message });
		}

		return {
			success: true,
			cartItems: result.data.items
		};
	},

	clearCart: async (event) => {
		const cartSessionId = event.cookies.get('cart_session_id');
		if (!cartSessionId) {
			return { success: true, cartItems: [] };
		}

		const { getDb } = await import('$lib/server/db');
		const table = await import('$lib/server/db/schema');
		const { eq } = await import('drizzle-orm');

		// Get cart ID
		const [cartRow] = await getDb()
			.select({ id: table.cart.id })
			.from(table.cart)
			.where(eq(table.cart.sessionId, cartSessionId))
			.execute();

		if (cartRow) {
			await getDb().delete(table.cartItem).where(eq(table.cartItem.cartId, cartRow.id)).execute();
		}

		return {
			success: true,
			cartItems: []
		};
	},

	send_cart: async (event) => {
		const formData = await event.request.formData();
		const clientName = formData.get('client-name') as string;
		const cartSessionId = event.cookies.get('cart_session_id');

		if (!clientName || clientName.trim() === '') {
			return fail(400, { message: 'El nombre del cliente es obligatorio' });
		}

		if (!cartSessionId) {
			return fail(400, { message: 'No hay sesión de carrito activa' });
		}

		// Get cart ID
		const [cartRow] = await getDb()
			.select({ id: table.cart.id })
			.from(table.cart)
			.where(eq(table.cart.sessionId, cartSessionId))
			.execute();

		if (!cartRow) {
			return fail(400, { message: 'Carrito no encontrado' });
		}

		const cartId = cartRow.id;

		// Process checkout
		const { checkoutCart } = await import('$lib/server/cart');
		const result = await checkoutCart(cartId);

		if (!result.success) {
			return fail(400, { message: result.error.message, details: result.error.details });
		}

		const orderId = result.data.orderId;

		// Update order with client name
		await getDb()
			.update(table.order)
			.set({ clientName: clientName.trim() })
			.where(eq(table.order.id, orderId))
			.execute();

		// Clear cart cookie
		event.cookies.delete('cart_session_id', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: event.url.protocol === 'https:'
		});

		// Return order code for WhatsApp redirect
		return {
			success: true,
			cod: orderId
		};
	}
};
