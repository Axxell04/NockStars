import * as table from '$lib/server/db/schema';
import { generateId } from '$lib/server/functions';
import { getDb } from '$lib/server/db';
import { eq, inArray } from 'drizzle-orm';
import { lineKey } from '$lib/order-content';

type GetOrderOptions = {
	page?: number;
	limit?: number;
	completed?: boolean;
	cod?: string | null;
};

export async function checkOrderExists(cod: string) {
	const [order] = await getDb().select().from(table.order).where(eq(table.order.id, cod)).execute();
	if (order) return true;
	return false;
}

export async function getOrderById(id: string) {
	const [order] = await getDb().select().from(table.order).where(eq(table.order.id, id)).execute();
	return order ?? null;
}

/**
 * Primary image URL per order line, keyed by `lineKey()`.
 *
 * Preference is the variant's first image (by sortOrder), falling back to
 * the product's first image — a deleted or imageless variant still shows
 * its product. Images are presentational only: names, prices and variant
 * params always come from the order snapshots, never from live rows, so a
 * changed product photo can never rewrite the purchase record.
 * Two batched queries, no N+1. Lines without any image resolve to null.
 */
export async function getOrderLineImages(
	lines: { productId: string; variantId?: string | null }[]
): Promise<Record<string, string | null>> {
	const images: Record<string, string | null> = {};
	const isPresent = (id: unknown): id is string => typeof id === 'string' && id !== '';
	const variantIds = [...new Set(lines.map((line) => line.variantId).filter(isPresent))];
	const productIds = [...new Set(lines.map((line) => line.productId).filter(isPresent))];
	if (productIds.length === 0) return images;

	const variantImgs =
		variantIds.length > 0
			? await getDb()
					.select()
					.from(table.variantImg)
					.where(inArray(table.variantImg.variantId, variantIds))
					.orderBy(table.variantImg.sortOrder)
					.execute()
			: [];
	const variantPrimary = new Map<string, string>();
	for (const img of variantImgs) {
		if (!variantPrimary.has(img.variantId)) variantPrimary.set(img.variantId, img.url);
	}

	const productImgs = await getDb()
		.select()
		.from(table.img)
		.where(inArray(table.img.productId, productIds))
		.execute();
	const productPrimary = new Map<string, string>();
	for (const img of productImgs) {
		if (!productPrimary.has(img.productId)) productPrimary.set(img.productId, img.url);
	}

	for (const line of lines) {
		const variantUrl = isPresent(line.variantId) ? variantPrimary.get(line.variantId) : undefined;
		images[lineKey(line)] = variantUrl ?? productPrimary.get(line.productId) ?? null;
	}
	return images;
}

export async function getOrderWithItems(cod: string) {
	const [order] = await getDb().select().from(table.order).where(eq(table.order.id, cod)).execute();

	if (!order) {
		return null;
	}

	// Get order items with product and variant details
	const orderItems = await getDb()
		.select()
		.from(table.orderItem)
		.where(eq(table.orderItem.orderId, cod))
		.execute();

	const enrichedItems = [];

	for (const item of orderItems) {
		const [product] = await getDb()
			.select()
			.from(table.product)
			.where(eq(table.product.id, item.productId))
			.execute();

		// Get product images
		let productImages: table.Img[] = [];
		if (product) {
			productImages = await getDb()
				.select()
				.from(table.img)
				.where(eq(table.img.productId, product.id))
				.execute();
		}

		let variant = null;
		if (item.variantId) {
			const [variantRow] = await getDb()
				.select()
				.from(table.productVariant)
				.where(eq(table.productVariant.id, item.variantId))
				.execute();
			variant = variantRow;
		}

		enrichedItems.push({
			...item,
			product: product ? { ...product, images: productImages } : null,
			variant
		});
	}

	return {
		...order,
		items: enrichedItems
	};
}

export async function createOrder(content: object, clientName: string) {
	const orderId = generateId(10);
	const order: table.OrderInsert = {
		id: orderId,
		content,
		clientName,
		completed: false,
		revenueId: null,
		createdAt: new Date()
	};

	await getDb().insert(table.order).values(order).execute();
	return orderId;
}

/**
 * Clamps a requested page into the range the database actually has results for.
 *
 * `page` arrives from form data on every pagination action, so it is caller
 * controlled. Unclamped, `page = -5` produces a negative SQL offset and
 * `page = 99` against three pages of orders produces an empty phantom page that
 * still reports `currentPage: 99`.
 *
 * The row count is the only authority on how many pages exist. Neither the
 * caller nor the `total_pages` hidden input can be trusted: that input is
 * attacker controlled form data, which is exactly what the action-level checks
 * in the route are for. This clamp is the layer below them, so a caller that
 * forgets to validate still cannot produce an invalid offset.
 *
 * Exported for testing. This must stay pure.
 */
export function clampPage(page: number, totalPages: number): number {
	// With no rows there is no page 0, but page 1 is still the only sane target
	// and keeps the offset at zero.
	const lastPage = Math.max(totalPages, 1);
	return Math.min(Math.max(page, 1), lastPage);
}

export async function getOrders(options: GetOrderOptions = {}) {
	const { limit = 10, completed, cod, page = 1 } = options;

	// Counted before the page query because the count is what makes the clamp
	// possible. Two independent reads, so their relative order costs nothing.
	const totalOrders =
		typeof completed === 'undefined'
			? (await getDb().select().from(table.order).execute()).length
			: (
					await getDb()
						.select()
						.from(table.order)
						.where(eq(table.order.completed, completed))
						.execute()
				).length;
	const totalPages = Math.ceil(totalOrders / limit);

	// `cod` is a single-order lookup rather than a page of results: it ignores
	// paging entirely and reports page 0. That is why the clamp below must not
	// run for it — 0 is a deliberate answer here, not an out-of-range request.
	if (cod) {
		const orders = await getDb()
			.select()
			.from(table.order)
			.where(eq(table.order.id, cod))
			.execute();
		return {
			orders: orders,
			totalPages,
			currentPage: 0
		};
	}

	const currentPage = clampPage(page, totalPages);
	const offset = (currentPage - 1) * limit;
	const orders =
		typeof completed === 'undefined'
			? await getDb()
					.select()
					.from(table.order)
					.limit(limit)
					.offset(offset)
					.orderBy(table.order.createdAt)
					.execute()
			: await getDb()
					.select()
					.from(table.order)
					.where(eq(table.order.completed, completed))
					.limit(limit)
					.offset(offset)
					.orderBy(table.order.createdAt)
					.execute();

	return {
		orders: orders,
		totalPages,
		currentPage
	};
}

export async function updateOrder(
	id: string,
	content?: object,
	completed?: boolean,
	revenueId?: string | null,
	totalValue?: number | undefined
) {
	if (typeof completed !== 'undefined' && typeof revenueId === 'string') {
		await getDb()
			.update(table.order)
			.set({ completed, revenueId })
			.where(eq(table.order.id, id))
			.execute();
	} else if (typeof completed !== 'undefined' && revenueId === null) {
		const [order] = await getDb().select().from(table.order).where(eq(table.order.id, id));
		await getDb()
			.update(table.order)
			.set({ completed, revenueId })
			.where(eq(table.order.id, id))
			.execute();
		if (order.revenueId) {
			await getDb().delete(table.revenue).where(eq(table.revenue.id, order.revenueId));
		}
	} else if (typeof content !== 'undefined' && typeof completed !== 'undefined') {
		await getDb()
			.update(table.order)
			.set({ content, completed })
			.where(eq(table.order.id, id))
			.execute();
	} else if (typeof content !== 'undefined' && typeof totalValue !== 'undefined') {
		const [order] = await getDb()
			.select()
			.from(table.order)
			.where(eq(table.order.id, id))
			.execute();
		if (order.revenueId) {
			await getDb()
				.update(table.revenue)
				.set({ value: totalValue })
				.where(eq(table.revenue.id, order.revenueId))
				.execute();
		}
		await getDb().update(table.order).set({ content }).where(eq(table.order.id, id)).execute();
	} else if (typeof completed !== 'undefined') {
		await getDb().update(table.order).set({ completed }).where(eq(table.order.id, id)).execute();
	}
}

export async function deleteOrder(id: string) {
	const [order] = await getDb().select().from(table.order).where(eq(table.order.id, id)).execute();
	if (order.revenueId) {
		await getDb().delete(table.revenue).where(eq(table.order.revenueId, order.revenueId));
	}
	await getDb().delete(table.order).where(eq(table.order.id, id));
}
