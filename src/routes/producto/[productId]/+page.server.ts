import { getProductWithVariants } from '$lib/server/product';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { effectivePrice, effectiveStock, getDefaultVariant } from '$lib/variant';
import type { VariantComplete } from '$lib/actions';

export const load: PageServerLoad = async (event) => {
	const productId = event.params.productId;
	const variantParam = event.url.searchParams.get('variant');

	// Get product with variants
	const productData = await getProductWithVariants(productId);

	if (!productData) {
		return fail(404, { message: 'Producto no encontrado' });
	}

	// Select variant
	let selectedVariant: VariantComplete | null = null;

	if (variantParam) {
		// Validate variant belongs to this product
		const variant = productData.variants.find((v) => v.id === variantParam);
		if (!variant) {
			return fail(400, { message: 'Variante no válida para este producto' });
		}
		selectedVariant = variant;
	} else {
		// Default to first available variant (stock > 0) or first variant or implicit
		selectedVariant = getDefaultVariant(productData);
	}

	// Compute effective price and stock for selected variant
	const price = effectivePrice(selectedVariant, productData);
	const stock = effectiveStock(selectedVariant, productData);

	// SEO data
	const seo = {
		title: `${selectedVariant?.description ?? productData.name} — NockStars`,
		description: selectedVariant?.description ?? productData.name,
		type: 'website' as const
	};

	return {
		product: productData,
		variants: productData.variants,
		selectedVariant,
		implicitVariant: productData.implicitVariant,
		price,
		stock,
		seo
	};
};

export const actions: Actions = {
	addToCart: async (event) => {
		const formData = await event.request.formData();
		const productId = formData.get('productId') as string;
		const variantId = formData.get('variantId') as string | null;
		const quantity = parseInt(formData.get('quantity') as string) || 1;

		// Get cart session ID from cookies
		let cartSessionId = event.cookies.get('cart_session_id');

		if (!cartSessionId) {
			// Create new cart session
			cartSessionId = crypto.randomUUID();
			event.cookies.set('cart_session_id', cartSessionId, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: event.url.protocol === 'https:',
				maxAge: 60 * 60 * 24 * 30 // 30 days
			});
		}

		// Import here to avoid circular dependency
		const { addCartItem, createCart, getCartBySession } = await import('$lib/server/cart');

		// Ensure cart exists
		let cart = await getCartBySession(cartSessionId);
		if (!cart) {
			await createCart(cartSessionId);
			cart = await getCartBySession(cartSessionId);
		}

		if (!cart) {
			return fail(500, { message: 'Error creating cart' });
		}

		const result = await addCartItem(cart.id, {
			productId,
			variantId: variantId ?? undefined,
			quantity
		});

		if (!result.success) {
			// Surface the machine-readable code and details (e.g. available
			// stock) so the client can distinguish an over-stock rejection
			// from a generic failure.
			return fail(400, {
				message: result.error.message,
				code: result.error.code,
				details: result.error.details
			});
		}

		return {
			success: true,
			cartItems: result.data.items
		};
	}
};
