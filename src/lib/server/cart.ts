import * as table from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { eq, and, sql } from 'drizzle-orm';
import type {
	Cart,
	CartWithItems,
	CartItemWithProduct,
	AddToCartInput,
	UpdateQuantityInput,
	LegacyCartItem,
	OrderItemInput,
	CartActionResult,
	VariantComplete,
	ProductVariant,
	VariantImage
} from '$lib/actions';
import { CartErrorCode, success, failure } from '$lib/actions';
import { effectivePrice, effectiveStock, resolveImplicitVariant } from '$lib/variant';

/**
 * Server-side cart operations
 * Pure TypeScript modules, no Svelte dependencies, unit-testable
 */

// ============================================================================
// Cart Creation & Retrieval
// ============================================================================

/**
 * Creates a new cart for a session
 */
export async function createCart(sessionId: string): Promise<Cart> {
	const cartId = crypto.randomUUID();
	const cart: table.Cart = {
		id: cartId,
		sessionId: sessionId,
		createdAt: new Date(),
		updatedAt: new Date()
	};

	await getDb().insert(table.cart).values(cart).execute();
	return cart;
}

/**
 * Gets a cart by session ID with all items and product/variant details
 */
export async function getCartBySession(sessionId: string): Promise<CartWithItems | null> {
	const [cart] = await getDb()
		.select()
		.from(table.cart)
		.where(eq(table.cart.sessionId, sessionId))
		.execute();

	if (!cart) {
		return null;
	}

	const items = await getCartItemsWithDetails(cart.id);
	return { ...cart, items };
}

/**
 * Gets cart items with full product and variant details
 */
async function getCartItemsWithDetails(cartId: string): Promise<CartItemWithProduct[]> {
	const items = await getDb()
		.select()
		.from(table.cartItem)
		.where(eq(table.cartItem.cartId, cartId))
		.orderBy(table.cartItem.addedAt)
		.execute();

	const enrichedItems: CartItemWithProduct[] = [];

	for (const item of items) {
		const [product] = await getDb()
			.select()
			.from(table.product)
			.where(eq(table.product.id, item.productId))
			.execute();

		if (!product) {
			// Product was deleted - skip or handle as needed
			continue;
		}

		let variant: (ProductVariant & { images: VariantImage[] }) | null = null;

		if (item.variantId) {
			const [variantRow] = await getDb()
				.select()
				.from(table.productVariant)
				.where(eq(table.productVariant.id, item.variantId))
				.execute();

			if (variantRow) {
				const images = await getDb()
					.select()
					.from(table.variantImg)
					.where(eq(table.variantImg.variantId, variantRow.id))
					.orderBy(table.variantImg.sortOrder)
					.execute();

				variant = { ...variantRow, images };
			}
		}

		enrichedItems.push({
			...item,
			product,
			variant
		});
	}

	return enrichedItems;
}

// ============================================================================
// Cart Item Operations
// ============================================================================

/**
 * Adds an item to the cart (upsert if same product+variant exists)
 * Validates stock, snapshots price, handles optimistic locking
 */
export async function addCartItem(
	cartId: string,
	input: AddToCartInput
): Promise<CartActionResult<CartWithItems>> {
	const { productId, variantId, quantity } = input;

	if (quantity <= 0) {
		return failure(CartErrorCode.OUT_OF_STOCK, 'Quantity must be greater than 0');
	}

	// Validate product exists
	const [product] = await getDb()
		.select()
		.from(table.product)
		.where(eq(table.product.id, productId))
		.execute();

	if (!product) {
		return failure(CartErrorCode.NOT_FOUND, 'Product not found');
	}

	// Validate variant if provided
	let variant: VariantComplete | null = null;

	if (variantId) {
		const [variantRow] = await getDb()
			.select()
			.from(table.productVariant)
			.where(
				and(eq(table.productVariant.id, variantId), eq(table.productVariant.productId, productId))
			)
			.execute();

		if (!variantRow) {
			return failure(CartErrorCode.INVALID_VARIANT, 'Variant does not belong to this product');
		}

		const images = await getDb()
			.select()
			.from(table.variantImg)
			.where(eq(table.variantImg.variantId, variantRow.id))
			.orderBy(table.variantImg.sortOrder)
			.execute();

		variant = { ...variantRow, images };
	} else {
		variant = resolveImplicitVariant(product);
	}

	// Check stock
	const availableStock = effectiveStock(variant, product);
	if (quantity > availableStock) {
		return failure(CartErrorCode.OUT_OF_STOCK, `Only ${availableStock} items available`);
	}

	// Snapshot price
	const unitPriceSnapshot = effectivePrice(variant, product);

	// Try to find existing cart item for same product+variant
	const existingConditions = [
		eq(table.cartItem.cartId, cartId),
		eq(table.cartItem.productId, productId)
	];

	if (variantId) {
		existingConditions.push(eq(table.cartItem.variantId, variantId));
	} else {
		existingConditions.push(sql`${table.cartItem.variantId} IS NULL`);
	}

	const [existingItem] = await getDb()
		.select()
		.from(table.cartItem)
		.where(and(...existingConditions))
		.execute();

	if (existingItem) {
		// Update existing item quantity
		const newQuantity = existingItem.quantity + quantity;

		if (newQuantity > availableStock) {
			return failure(
				CartErrorCode.OUT_OF_STOCK,
				`Only ${availableStock} items available (already have ${existingItem.quantity} in cart)`
			);
		}

		await getDb()
			.update(table.cartItem)
			.set({
				quantity: newQuantity,
				unitPriceSnapshot: unitPriceSnapshot.toFixed(2),
				version: existingItem.version + 1
			})
			.where(eq(table.cartItem.id, existingItem.id))
			.execute();
	} else {
		// Create new cart item
		const cartItemId = crypto.randomUUID();
		const cartItem: table.CartItem = {
			id: cartItemId,
			cartId,
			productId,
			variantId: variantId ?? null,
			quantity,
			unitPriceSnapshot: unitPriceSnapshot.toFixed(2),
			version: 1,
			addedAt: new Date()
		};

		await getDb().insert(table.cartItem).values(cartItem).execute();
	}

	// Return updated cart
	const cart = await getCartBySession(
		(
			await getDb()
				.select({ sessionId: table.cart.sessionId })
				.from(table.cart)
				.where(eq(table.cart.id, cartId))
				.execute()
		)[0]?.sessionId ?? ''
	);

	if (!cart) {
		return failure(CartErrorCode.NOT_FOUND, 'Cart not found after update');
	}

	return success(cart);
}

/**
 * Updates cart item quantity with optimistic locking
 * Validates version, stock, updates quantity, increments version
 */
export async function updateCartItem(
	cartItemId: string,
	input: UpdateQuantityInput
): Promise<CartActionResult<CartWithItems>> {
	const { quantity, version } = input;

	if (quantity < 0) {
		return failure(CartErrorCode.OUT_OF_STOCK, 'Quantity cannot be negative');
	}

	// Get existing cart item with version check
	const [existingItem] = await getDb()
		.select()
		.from(table.cartItem)
		.where(eq(table.cartItem.id, cartItemId))
		.execute();

	if (!existingItem) {
		return failure(CartErrorCode.NOT_FOUND, 'Cart item not found');
	}

	// Optimistic locking: verify version
	if (existingItem.version !== version) {
		return failure(
			CartErrorCode.VERSION_CONFLICT,
			'Cart item was modified by another request. Please refresh and try again.',
			{ currentVersion: existingItem.version, providedVersion: version }
		);
	}

	// Get product and variant for stock validation
	const [product] = await getDb()
		.select()
		.from(table.product)
		.where(eq(table.product.id, existingItem.productId))
		.execute();

	if (!product) {
		return failure(CartErrorCode.NOT_FOUND, 'Product not found');
	}

	let variant: VariantComplete | null = null;

	if (existingItem.variantId) {
		const [variantRow] = await getDb()
			.select()
			.from(table.productVariant)
			.where(eq(table.productVariant.id, existingItem.variantId))
			.execute();

		if (variantRow) {
			const images = await getDb()
				.select()
				.from(table.variantImg)
				.where(eq(table.variantImg.variantId, variantRow.id))
				.orderBy(table.variantImg.sortOrder)
				.execute();

			variant = { ...variantRow, images };
		}
	} else {
		variant = resolveImplicitVariant(product);
	}

	// Check stock
	const availableStock = effectiveStock(variant, product);
	if (quantity > availableStock) {
		return failure(CartErrorCode.OUT_OF_STOCK, `Only ${availableStock} items available`);
	}

	if (quantity === 0) {
		// Remove item if quantity is 0
		await getDb().delete(table.cartItem).where(eq(table.cartItem.id, cartItemId)).execute();
	} else {
		// Update quantity and increment version
		const unitPriceSnapshot = effectivePrice(variant, product);

		await getDb()
			.update(table.cartItem)
			.set({
				quantity,
				unitPriceSnapshot: unitPriceSnapshot.toFixed(2),
				version: existingItem.version + 1
			})
			.where(eq(table.cartItem.id, cartItemId))
			.execute();
	}

	// Return updated cart
	const [cartRow] = await getDb()
		.select({ sessionId: table.cart.sessionId })
		.from(table.cart)
		.where(eq(table.cart.id, existingItem.cartId))
		.execute();

	const cart = cartRow ? await getCartBySession(cartRow.sessionId) : null;

	if (!cart) {
		return failure(CartErrorCode.NOT_FOUND, 'Cart not found after update');
	}

	return success(cart);
}

/**
 * Removes a cart item completely
 */
export async function removeCartItem(cartItemId: string): Promise<CartActionResult<CartWithItems>> {
	const [existingItem] = await getDb()
		.select()
		.from(table.cartItem)
		.where(eq(table.cartItem.id, cartItemId))
		.execute();

	if (!existingItem) {
		return failure(CartErrorCode.NOT_FOUND, 'Cart item not found');
	}

	await getDb().delete(table.cartItem).where(eq(table.cartItem.id, cartItemId)).execute();

	const [cartRow] = await getDb()
		.select({ sessionId: table.cart.sessionId })
		.from(table.cart)
		.where(eq(table.cart.id, existingItem.cartId))
		.execute();

	const cart = cartRow ? await getCartBySession(cartRow.sessionId) : null;

	if (!cart) {
		return failure(CartErrorCode.NOT_FOUND, 'Cart not found after update');
	}

	return success(cart);
}

// ============================================================================
// Legacy Cart Migration
// ============================================================================

/**
 * Migrates legacy cart items (from cookie-based storage) to the new cart system
 * Resolves variantIds from product data using size/color/cut
 */
export async function migrateLegacyCart(
	legacyItems: LegacyCartItem[],
	sessionId: string
): Promise<CartWithItems> {
	// Create new cart
	const cart = await createCart(sessionId);

	for (const legacyItem of legacyItems) {
		const { productId, variantId, quantity, size, color, cut } = legacyItem;

		if (quantity <= 0) continue;

		// Validate product exists
		const [product] = await getDb()
			.select()
			.from(table.product)
			.where(eq(table.product.id, productId))
			.execute();

		if (!product) continue;

		let resolvedVariantId: string | null = variantId ?? null;

		// If no variantId but has size/color/cut, resolve the variant
		if (!resolvedVariantId && size && color && cut) {
			const [variant] = await getDb()
				.select()
				.from(table.productVariant)
				.where(
					and(
						eq(table.productVariant.productId, productId),
						eq(table.productVariant.size, size),
						eq(table.productVariant.color, color),
						eq(table.productVariant.cut, cut)
					)
				)
				.execute();

			if (variant) {
				resolvedVariantId = variant.id;
			}
		}

		// Validate variant belongs to product
		if (resolvedVariantId) {
			const [variant] = await getDb()
				.select()
				.from(table.productVariant)
				.where(
					and(
						eq(table.productVariant.id, resolvedVariantId),
						eq(table.productVariant.productId, productId)
					)
				)
				.execute();

			if (!variant) {
				resolvedVariantId = null;
			}
		}

		// Determine variant for pricing
		let variant: VariantComplete | null = null;
		if (resolvedVariantId) {
			const [variantRow] = await getDb()
				.select()
				.from(table.productVariant)
				.where(eq(table.productVariant.id, resolvedVariantId))
				.execute();

			if (variantRow) {
				const images = await getDb()
					.select()
					.from(table.variantImg)
					.where(eq(table.variantImg.variantId, variantRow.id))
					.orderBy(table.variantImg.sortOrder)
					.execute();

				variant = { ...variantRow, images };
			}
		} else {
			variant = resolveImplicitVariant(product);
		}

		// Check stock
		const availableStock = effectiveStock(variant, product);
		const finalQuantity = Math.min(quantity, availableStock);

		if (finalQuantity <= 0) continue;

		// Snapshot price
		const unitPriceSnapshot = effectivePrice(variant, product);

		// Insert cart item
		const cartItemId = crypto.randomUUID();
		const cartItem: table.CartItem = {
			id: cartItemId,
			cartId: cart.id,
			productId,
			variantId: resolvedVariantId,
			quantity: finalQuantity,
			unitPriceSnapshot: unitPriceSnapshot.toFixed(2),
			version: 1,
			addedAt: new Date()
		};

		await getDb().insert(table.cartItem).values(cartItem).execute();
	}

	// Return migrated cart
	const migratedCart = await getCartBySession(sessionId);
	return migratedCart!;
}

// ============================================================================
// Checkout
// ============================================================================

/**
 * Processes checkout: creates order items with snapshots, decrements stock, clears cart
 */
export async function checkoutCart(
	cartId: string
): Promise<CartActionResult<{ orderId: string; items: OrderItemInput[] }>> {
	const cart = await getDb().select().from(table.cart).where(eq(table.cart.id, cartId)).execute();

	if (!cart.length) {
		return failure(CartErrorCode.NOT_FOUND, 'Cart not found');
	}

	const cartItems = await getCartItemsWithDetails(cartId);

	if (cartItems.length === 0) {
		return failure(CartErrorCode.CART_EMPTY, 'Cart is empty');
	}

	// Validate all items have stock
	for (const item of cartItems) {
		const variant = item.variant
			? { ...item.variant, images: item.variant.images }
			: resolveImplicitVariant(item.product);

		const availableStock = effectiveStock(variant, item.product);
		if (item.quantity > availableStock) {
			return failure(
				CartErrorCode.OUT_OF_STOCK,
				`Insufficient stock for ${item.product.name}. Available: ${availableStock}`
			);
		}
	}

	// Generate order ID
	const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

	// Create order
	const order: table.Order = {
		id: orderId,
		content: {
			items: cartItems.map((item) => ({
				productId: item.productId,
				variantId: item.variantId,
				productNameSnapshot: item.product.name,
				variantSizeSnapshot: item.variant?.size ?? null,
				variantColorSnapshot: item.variant?.color ?? null,
				variantCutSnapshot: item.variant?.cut ?? null,
				unitPriceSnapshot: Number(item.unitPriceSnapshot),
				quantity: item.quantity
			}))
		},
		clientName: 'Checkout',
		completed: false,
		revenueId: null,
		createdAt: new Date()
	};

	await getDb().insert(table.order).values(order).execute();

	// Create order items with snapshots
	const orderItems: OrderItemInput[] = [];

	for (const item of cartItems) {
		const variant = item.variant
			? { ...item.variant, images: item.variant.images }
			: resolveImplicitVariant(item.product);

		const orderItem: table.OrderItem = {
			id: crypto.randomUUID(),
			orderId,
			productId: item.productId,
			variantId: item.variantId ?? null,
			productNameSnapshot: item.product.name,
			variantSizeSnapshot: variant?.size ?? null,
			variantColorSnapshot: variant?.color ?? null,
			variantCutSnapshot: variant?.cut ?? null,
			unitPriceSnapshot: item.unitPriceSnapshot,
			quantity: item.quantity,
			createdAt: new Date()
		};

		await getDb().insert(table.orderItem).values(orderItem).execute();

		orderItems.push({
			productId: item.productId,
			variantId: item.variantId ?? undefined,
			productNameSnapshot: item.product.name,
			variantSizeSnapshot: variant?.size ?? undefined,
			variantColorSnapshot: variant?.color ?? undefined,
			variantCutSnapshot: variant?.cut ?? undefined,
			unitPriceSnapshot: Number(item.unitPriceSnapshot),
			quantity: item.quantity
		});

		// Decrement stock
		if (item.variantId) {
			// Decrement variant stock
			await getDb()
				.update(table.productVariant)
				.set({
					stock: sql`${table.productVariant.stock} - ${item.quantity}`,
					updatedAt: new Date()
				})
				.where(eq(table.productVariant.id, item.variantId))
				.execute();
		} else {
			// Decrement product stock (implicit variant)
			await getDb()
				.update(table.product)
				.set({
					stock: sql`${table.product.stock} - ${item.quantity}`
				})
				.where(eq(table.product.id, item.productId))
				.execute();
		}
	}

	// Clear cart items
	await getDb().delete(table.cartItem).where(eq(table.cartItem.cartId, cartId)).execute();

	return success({ orderId, items: orderItems });
}
