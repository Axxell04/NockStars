import * as table from '$lib/server/db/schema';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { getDb } from '$lib/server/db';
import { v2 as cloudinary } from 'cloudinary';
import {
	CLOUDINARY_CLOUD_NAME,
	CLOUDINARY_API_KEY,
	CLOUDINARY_API_SECRET
} from '$env/static/private';
import {
	and,
	asc,
	count,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	like,
	lt,
	max,
	sql
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { addProductToCatalog } from './catalog';
import type {
	VariantComplete,
	ProductWithVariants,
	CreateVariantInput,
	UpdateVariantInput,
	ProductActionResult
} from '$lib/actions';
import { ProductErrorCode, success, failure } from '$lib/actions';
import { resolveImplicitVariant } from '$lib/variant';
import {
	MAX_PRODUCT_DESCRIPTION_LENGTH,
	MAX_SPEC_KEY_LENGTH,
	MAX_SPEC_ROWS,
	MAX_SPEC_VALUE_LENGTH,
	normalizeSpecs,
	type ProductSpecs
} from '$lib/product-specs';

cloudinary.config({
	cloud_name: CLOUDINARY_CLOUD_NAME,
	api_key: CLOUDINARY_API_KEY,
	api_secret: CLOUDINARY_API_SECRET
});

type GetProductsOptions = {
	page?: number;
	limit?: number;
	search?: string;
	catalogId?: string;
	/**
	 * 'active' (the default) hides soft-deleted products — that is the
	 * storefront contract, and the safe default for any new caller. Admin
	 * screens pass 'all' so deactivated rows stay listed, flagged, and
	 * reactivateable.
	 */
	visibility?: 'active' | 'all';
};

export type CreateProductOptions = {
	description?: string | null;
	specs?: ProductSpecs;
};

export async function createProduct(
	name: string,
	price: number,
	catalogId?: string,
	stock: number = 0,
	options: CreateProductOptions = {}
) {
	const productId = generateId();
	const product: table.Product = {
		id: productId,
		name: name,
		description: options.description ?? null,
		price: price,
		stock: stock,
		specs: options.specs ?? {},
		createdAt: new Date(),
		// New products are listed straight away.
		deactivatedAt: null
	};

	await getDb().insert(table.product).values(product).execute();

	if (catalogId) {
		await addProductToCatalog(productId, catalogId);
	}
	return productId;
}

export type ProductWrite = {
	description: string | null;
	specs: ProductSpecs;
};

/**
 * Validation boundary for the product description and the "ficha técnica" spec
 * rows submitted by the admin forms.
 *
 * The caps are rejected rather than applied silently: an admin who types a
 * 400-character value and gets a truncated sheet with no message has lost data,
 * and data loss that only shows up as a short cell is the exact failure mode the
 * sheet is meant to eliminate. `normalizeSpecs` still clamps, as a backstop for
 * any caller that bypasses this function.
 */
export function prepareProductWrite(input: {
	description?: string | null;
	specRows?: Array<[string, string]>;
}): ProductActionResult<ProductWrite> {
	const description = (input.description ?? '').trim();

	if (description.length > MAX_PRODUCT_DESCRIPTION_LENGTH) {
		return failure(
			ProductErrorCode.INVALID_PRODUCT_DATA,
			`La descripción no puede superar ${MAX_PRODUCT_DESCRIPTION_LENGTH} caracteres`
		);
	}

	const specRows = input.specRows ?? [];
	const filledRows = specRows.filter(([key, value]) => key.trim() !== '' || value.trim() !== '');

	if (filledRows.length > MAX_SPEC_ROWS) {
		return failure(
			ProductErrorCode.INVALID_PRODUCT_DATA,
			`La ficha técnica admite hasta ${MAX_SPEC_ROWS} atributos`
		);
	}

	if (specRows.some(([key]) => key.trim().length > MAX_SPEC_KEY_LENGTH)) {
		return failure(
			ProductErrorCode.INVALID_PRODUCT_DATA,
			`Los nombres de atributo no pueden superar ${MAX_SPEC_KEY_LENGTH} caracteres`
		);
	}

	if (specRows.some(([, value]) => value.trim().length > MAX_SPEC_VALUE_LENGTH)) {
		return failure(
			ProductErrorCode.INVALID_PRODUCT_DATA,
			`Los valores de atributo no pueden superar ${MAX_SPEC_VALUE_LENGTH} caracteres`
		);
	}

	return success({
		description: description === '' ? null : description,
		specs: normalizeSpecs(specRows)
	});
}

export function normalizeCloudinaryImageUrl(url: string): string {
	if (typeof url !== 'string' || !url.trim()) {
		throw new Error('Cloudinary image URL is required');
	}

	try {
		const parsed = new URL(url);
		const isCloudinaryHost = parsed.hostname.includes('cloudinary.com');
		if (parsed.protocol !== 'https:' || !isCloudinaryHost) {
			throw new Error('Only valid Cloudinary URLs are allowed');
		}
		return url;
	} catch {
		throw new Error('Only valid Cloudinary URLs are allowed');
	}
}

export async function bindImg(productId: string, url: string) {
	const normalizedUrl = normalizeCloudinaryImageUrl(url);
	const imgId = generateId();

	// Appends after the current last image, so the upload order the admin
	// picked is the order that gets stored (and survives a later reorder).
	const [last] = await getDb()
		.select({ sortOrder: max(table.img.sortOrder) })
		.from(table.img)
		.where(eq(table.img.productId, productId))
		.execute();

	await getDb()
		.insert(table.img)
		.values({
			id: imgId,
			url: normalizedUrl,
			productId: productId,
			sortOrder: (last?.sortOrder ?? -1) + 1
		})
		.execute();
}

/**
 * Rewrites the whole image order of a product from a list of ids.
 *
 * The payload must be exactly the product's image set — duplicated, missing or
 * foreign ids are rejected instead of silently scrambling the stored order.
 * Validation runs before the first write, so a bad payload writes nothing.
 */
export async function reorderImgs(productId: string, orderedIds: string[]) {
	const current = await getImgs(productId);
	const currentIds = new Set(current.map((img) => img.id));
	const uniqueIds = new Set(orderedIds);
	const isExactSet =
		uniqueIds.size === orderedIds.length &&
		currentIds.size === orderedIds.length &&
		orderedIds.every((id) => currentIds.has(id));

	if (!isExactSet) {
		throw new Error('Image order does not match this product images');
	}

	await getDb().transaction(async (tx) => {
		for (let i = 0; i < orderedIds.length; i++) {
			await tx
				.update(table.img)
				.set({ sortOrder: i })
				.where(and(eq(table.img.id, orderedIds[i]), eq(table.img.productId, productId)))
				.execute();
		}
	});
}

export async function getProducts(options: GetProductsOptions = {}) {
	const { page = 1, limit = 5, search, catalogId, visibility = 'active' } = options;
	const offset = (page - 1) * limit;
	const db = getDb();
	const pattern = search ? `%${search}%` : null;

	// Folds the visibility filter into each branch's own condition. The
	// product-table predicate applies to both the page query and its count, so
	// the totals agree with the rows the caller actually sees.
	const activeCondition = visibility === 'all' ? undefined : isNull(table.product.deactivatedAt);
	const withVisibility = (condition?: SQL): SQL | undefined => {
		if (!activeCondition) return condition;
		return condition ? and(condition, activeCondition) : activeCondition;
	};

	let productsQuery;
	let countQuery;

	if (pattern) {
		if (!catalogId) {
			productsQuery = db
				.select()
				.from(table.product)
				.where(withVisibility(like(table.product.name, pattern)))
				.limit(limit)
				.offset(offset)
				.orderBy(desc(table.product.createdAt));
			countQuery = db
				.select({ total: count() })
				.from(table.product)
				.where(withVisibility(like(table.product.name, pattern)));
		} else {
			productsQuery = db
				.select({
					id: table.product.id,
					name: table.product.name,
					description: table.product.description,
					price: table.product.price,
					stock: table.product.stock,
					specs: table.product.specs,
					createdAt: table.product.createdAt,
					deactivatedAt: table.product.deactivatedAt
				})
				.from(table.product)
				.innerJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId))
				.where(
					withVisibility(
						and(eq(table.productCatalog.catalogId, catalogId), like(table.product.name, pattern))
					)
				)
				.limit(limit)
				.offset(offset)
				.orderBy(desc(table.product.createdAt));
			countQuery = db
				.select({ total: count() })
				.from(table.product)
				.innerJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId))
				.where(
					withVisibility(
						and(eq(table.productCatalog.catalogId, catalogId), like(table.product.name, pattern))
					)
				);
		}
	} else if (!catalogId) {
		productsQuery = db
			.select()
			.from(table.product)
			.where(withVisibility())
			.limit(limit)
			.offset(offset)
			.orderBy(desc(table.product.createdAt));
		countQuery = db.select({ total: count() }).from(table.product).where(withVisibility());
	} else {
		productsQuery = db
			.select({
				id: table.product.id,
				name: table.product.name,
				description: table.product.description,
				price: table.product.price,
				stock: table.product.stock,
				specs: table.product.specs,
				createdAt: table.product.createdAt,
				deactivatedAt: table.product.deactivatedAt
			})
			.from(table.product)
			.innerJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId))
			.where(withVisibility(eq(table.productCatalog.catalogId, catalogId)))
			.limit(limit)
			.offset(offset)
			.orderBy(desc(table.product.createdAt));
		countQuery = db
			.select({ total: count() })
			.from(table.product)
			.innerJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId))
			.where(withVisibility(eq(table.productCatalog.catalogId, catalogId)));
	}

	const [products, countRows] = await Promise.all([productsQuery, countQuery]);
	const totalProducts = countRows[0].total;

	const imgsByProduct = await getImgsByProducts(products.map((product) => product.id));
	const listProducts = products.map((product) => ({
		product: product,
		imgs: imgsByProduct.get(product.id) ?? []
	}));

	const totalPages = Math.ceil(totalProducts / limit);

	return {
		products: listProducts,
		totalPages,
		currentPage: page
	};
}

type UpdateProductOptions = {
	product_id: string;
	name?: string;
	price?: number;
	stock?: number;
	description?: string | null;
	specs?: ProductSpecs;
	imgsDelete?: string[];
};

export async function updateProduct(options: UpdateProductOptions) {
	const { product_id, name, price, stock, description, specs, imgsDelete } = options;
	const updates: Partial<table.Product> = {};
	if (typeof name !== 'undefined') updates.name = name;
	if (typeof price !== 'undefined') updates.price = price;
	if (typeof stock !== 'undefined') updates.stock = stock;
	if (typeof description !== 'undefined') updates.description = description;
	if (typeof specs !== 'undefined') updates.specs = specs;

	if (Object.keys(updates).length > 0) {
		await getDb()
			.update(table.product)
			.set(updates)
			.where(eq(table.product.id, product_id))
			.execute();
	}

	if (typeof imgsDelete !== 'undefined') {
		if (imgsDelete.length > 0) {
			for (const imgId of imgsDelete) {
				await deleteImg(imgId);
			}
		}
	}
}

/**
 * Snapshots display image URLs onto the order lines of a product (or of one
 * variant of it) while the live `img`/`variant_img` rows still exist.
 *
 * Variant images win, product images are the fallback — the same rule
 * `getOrderLineDisplay` applies live. The snapshot is written to both
 * `order_item.image_urls` and the matching `order.content` items, so history
 * keeps showing photos once the product row and its Cloudinary assets are
 * gone. Idempotent: re-running refreshes the snapshot to the current images.
 */
async function snapshotOrderLineImages(productId: string, variantId?: string): Promise<void> {
	const productImgs = await getDb()
		.select()
		.from(table.img)
		.where(eq(table.img.productId, productId))
		.orderBy(asc(table.img.sortOrder))
		.execute();
	const productUrls = productImgs.map((img) => img.url);

	let urlsByLine = new Map<string, string[]>();

	const variantIds = variantId
		? [variantId]
		: (
				await getDb()
					.select({ id: table.productVariant.id })
					.from(table.productVariant)
					.where(eq(table.productVariant.productId, productId))
					.execute()
			).map((variant) => variant.id);

	if (variantIds.length > 0) {
		const variantImgs = await getDb()
			.select()
			.from(table.variantImg)
			.where(inArray(table.variantImg.variantId, variantIds))
			.orderBy(asc(table.variantImg.sortOrder))
			.execute();
		urlsByLine = new Map<string, string[]>();
		for (const img of variantImgs) {
			const urls = urlsByLine.get(img.variantId);
			if (urls) urls.push(img.url);
			else urlsByLine.set(img.variantId, [img.url]);
		}
	}

	const orderItems = await getDb()
		.select()
		.from(table.orderItem)
		.where(
			variantId
				? and(eq(table.orderItem.productId, productId), eq(table.orderItem.variantId, variantId))
				: eq(table.orderItem.productId, productId)
		)
		.execute();
	if (orderItems.length === 0) return;

	const urlsForLine = (pid: string, vid: string | null): string[] =>
		vid ? (urlsByLine.get(vid) ?? productUrls) : productUrls;

	for (const item of orderItems) {
		const pid = item.productId ?? productId;
		await getDb()
			.update(table.orderItem)
			.set({ imageUrls: urlsForLine(pid, item.variantId) })
			.where(eq(table.orderItem.id, item.id))
			.execute();
	}

	// Mirror the snapshot into `order.content`, the shape the admin UI renders.
	const orderIds = [...new Set(orderItems.map((item) => item.orderId))];
	for (const orderId of orderIds) {
		const [order] = await getDb()
			.select({ content: table.order.content })
			.from(table.order)
			.where(eq(table.order.id, orderId))
			.execute();
		if (!order || typeof order.content !== 'object' || order.content === null) continue;
		const live = order.content as Record<string, unknown>;
		if (!Array.isArray(live.items)) continue;

		const items = live.items.map((raw) => {
			if (typeof raw !== 'object' || raw === null) return raw;
			const item = raw as Record<string, unknown>;
			const pid = typeof item.productId === 'string' ? item.productId : '';
			if (pid !== productId) return item;
			if (variantId && item.variantId !== variantId) return item;
			const vid = typeof item.variantId === 'string' ? item.variantId : null;
			return { ...item, imageUrls: urlsForLine(pid, vid) };
		});

		await getDb()
			.update(table.order)
			.set({ content: { ...live, items } })
			.where(eq(table.order.id, orderId))
			.execute();
	}
}

/**
 * Toggles the soft-delete flag of a product.
 *
 * Deactivating is what the admin "eliminar" flow does first: the storefront
 * stops listing the product and the backoffice keeps it flagged as inactive.
 * It also purges the product's cart lines (they can never be purchased again)
 * and snapshots the display images of its order lines, so a later hard delete
 * loses nothing the history needs.
 */
export async function setProductActive(
	productId: string,
	active: boolean
): Promise<ProductActionResult<void>> {
	const [product] = await getDb()
		.select({ id: table.product.id })
		.from(table.product)
		.where(eq(table.product.id, productId))
		.execute();

	if (!product) {
		return failure(ProductErrorCode.NOT_FOUND, 'Producto no encontrado');
	}

	await getDb()
		.update(table.product)
		.set({ deactivatedAt: active ? null : new Date() })
		.where(eq(table.product.id, productId))
		.execute();

	if (!active) {
		await getDb().delete(table.cartItem).where(eq(table.cartItem.productId, productId)).execute();
		await snapshotOrderLineImages(productId);
	}

	return success(undefined);
}

/**
 * Permanently deletes a deactivated product.
 *
 * Order lines no longer block the delete: they keep their name/price/variant
 * snapshots (and now their image snapshots), and the `ON DELETE SET NULL`
 * foreign key nulls their dangling ids when the product row goes. Cart lines
 * for the product are purged — a hard-deleted product can never be purchased.
 *
 * Cloudinary assets are destroyed only when no order line references the
 * product: with references, the snapshotted image URLs are the only photos
 * the history will ever get again, so the assets must outlive the row.
 */
export async function deleteProduct(id: string): Promise<ProductActionResult<void>> {
	const [product] = await getDb()
		.select({ id: table.product.id, deactivatedAt: table.product.deactivatedAt })
		.from(table.product)
		.where(eq(table.product.id, id))
		.execute();

	if (!product) {
		return failure(ProductErrorCode.NOT_FOUND, 'Producto no encontrado');
	}

	if (!product.deactivatedAt) {
		return failure(
			ProductErrorCode.NOT_INACTIVE,
			'Desactivalo antes de eliminarlo permanentemente'
		);
	}

	// Order history is what decides asset destruction. The check runs before
	// any snapshot or delete: it is the only moment the dangling ids are still
	// queryable as live references.
	const [orderRef] = await getDb()
		.select({ id: table.orderItem.id })
		.from(table.orderItem)
		.where(eq(table.orderItem.productId, id))
		.limit(1)
		.execute();
	const hadOrders = Boolean(orderRef);

	// Final snapshot while the live image rows still exist (covers products
	// deactivated before snapshots existed).
	if (hadOrders) {
		await snapshotOrderLineImages(id);
	}

	// Cart lines for a hard-deleted product can never be purchased.
	await getDb().delete(table.cartItem).where(eq(table.cartItem.productId, id)).execute();

	const imgs = await getImgs(id);
	for (const img of imgs) {
		if (hadOrders) {
			// Keep the Cloudinary asset: order lines still point at its URL.
			await getDb().delete(table.img).where(eq(table.img.id, img.id)).execute();
		} else {
			await deleteImg(img.id, img);
		}
	}

	// Variant rows cascade away with the product, but their Cloudinary assets
	// do not — resolve them explicitly, honoring the same order-history rule.
	const variants = await getDb()
		.select({ id: table.productVariant.id })
		.from(table.productVariant)
		.where(eq(table.productVariant.productId, id))
		.execute();
	for (const v of variants) {
		if (hadOrders) {
			await getDb().delete(table.variantImg).where(eq(table.variantImg.variantId, v.id)).execute();
		} else {
			await destroyVariantImgs(v.id);
		}
	}

	await getDb()
		.delete(table.productCatalog)
		.where(eq(table.productCatalog.productId, id))
		.execute();

	// `ON DELETE SET NULL` nulls the remaining order_item references.
	await getDb().delete(table.product).where(eq(table.product.id, id)).execute();

	return success(undefined);
}

/**
 * Deletes inactive products older than `olderThanDays`, one by one through the
 * guarded `deleteProduct`.
 *
 * Referenced products are purged too: order lines keep their snapshots and
 * cart lines are removed, so nothing blocks the delete once the product has
 * been inactive long enough.
 */
export async function purgeInactiveProducts(
	options: { olderThanDays?: number } = {}
): Promise<{ purged: string[]; skipped: string[] }> {
	const olderThanDays = options.olderThanDays ?? 30;
	const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);

	const candidates = await getDb()
		.select({ id: table.product.id })
		.from(table.product)
		.where(and(isNotNull(table.product.deactivatedAt), lt(table.product.deactivatedAt, cutoff)))
		.execute();

	const purged: string[] = [];
	const skipped: string[] = [];
	for (const candidate of candidates) {
		const result = await deleteProduct(candidate.id);
		if (result.success) {
			purged.push(candidate.id);
		} else {
			skipped.push(candidate.id);
		}
	}

	return { purged, skipped };
}

export async function getImgs(productId: string) {
	const imgs = await getDb()
		.select()
		.from(table.img)
		.where(eq(table.img.productId, productId))
		.orderBy(asc(table.img.sortOrder))
		.execute();
	return imgs;
}

/**
 * Fetches the images of many products in a single query, grouped by productId
 * in the requested order — replaces one round trip per product on list loads.
 */
async function getImgsByProducts(productIds: string[]): Promise<Map<string, table.Img[]>> {
	const grouped = new Map<string, table.Img[]>();
	if (productIds.length === 0) {
		return grouped;
	}

	for (const id of productIds) {
		grouped.set(id, []);
	}

	const rows = await getDb()
		.select()
		.from(table.img)
		.where(inArray(table.img.productId, productIds))
		.orderBy(asc(table.img.sortOrder))
		.execute();

	for (const img of rows) {
		grouped.get(img.productId)?.push(img);
	}
	return grouped;
}

// Complementary Functions

export async function deleteImg(id: string, img?: table.Img) {
	if (typeof img === 'undefined') {
		const imgs = await getDb().select().from(table.img).where(eq(table.img.id, id)).execute();
		if (imgs.length === 0) {
			return;
		}
		img = imgs[0];
	}
	if (!img) {
		return;
	}
	try {
		const publicId = extractPublicId(img.url);
		await cloudinary.uploader.destroy(publicId);
	} catch {
		// Cloudinary destroy failed — DB record still deleted (REQ-IMG-011)
	}
	await getDb().delete(table.img).where(eq(table.img.id, id)).execute();
}

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	const id = encodeBase32LowerCase(bytes);
	return id;
}

function extractPublicId(url: string): string {
	const uploadIndex = url.indexOf('/upload/');
	if (uploadIndex === -1) return url;
	const afterUpload = url.slice(uploadIndex + '/upload/'.length);
	const withoutVersion = afterUpload.replace(/^v\d+\//, '');
	return withoutVersion.replace(/\.[^/.]+$/, '');
}

// ============================================================================
// Product Variant Operations
// ============================================================================

/**
 * Gets a product with all its variants and images, plus the implicit variant.
 *
 * Soft-deleted products are a miss by default: that is what turns the public
 * product page into a 404. The admin detail page passes `includeInactive` so a
 * deactivated product stays reachable (and reactivatable) from the backoffice.
 */
export async function getProductWithVariants(
	productId: string,
	options: { includeInactive?: boolean } = {}
): Promise<ProductWithVariants | null> {
	const [product] = await getDb()
		.select()
		.from(table.product)
		.where(
			options.includeInactive
				? eq(table.product.id, productId)
				: and(eq(table.product.id, productId), isNull(table.product.deactivatedAt))
		)
		.execute();

	if (!product) {
		return null;
	}

	// Get product images
	const productImages = await getDb()
		.select()
		.from(table.img)
		.where(eq(table.img.productId, productId))
		.orderBy(asc(table.img.sortOrder))
		.execute();

	const variants = await getVariantsByProduct(productId, {
		visibility: options.includeInactive ? 'all' : 'active'
	});
	const implicitVariant = resolveImplicitVariant(product);

	return {
		...product,
		productImages,
		variants,
		implicitVariant
	};
}

type GetVariantsOptions = {
	/**
	 * 'active' (the default) hides soft-deleted variants — the storefront
	 * contract, and the safe default for any new caller. Admin screens pass
	 * 'all' so deactivated rows stay listed, flagged, and reactivateable.
	 */
	visibility?: 'active' | 'all';
};

/**
 * Gets all variants for a product with their images.
 *
 * Soft-deleted variants are hidden unless `visibility: 'all'` is passed, so
 * the storefront never offers one while the backoffice still lists it.
 */
export async function getVariantsByProduct(
	productId: string,
	options: GetVariantsOptions = {}
): Promise<VariantComplete[]> {
	const { visibility = 'active' } = options;
	const variantRows = await getDb()
		.select()
		.from(table.productVariant)
		.where(
			visibility === 'all'
				? eq(table.productVariant.productId, productId)
				: and(
						eq(table.productVariant.productId, productId),
						isNull(table.productVariant.deactivatedAt)
					)
		)
		.orderBy(table.productVariant.sortOrder, table.productVariant.createdAt)
		.execute();

	const variants: VariantComplete[] = [];

	for (const variant of variantRows) {
		const images = await getDb()
			.select()
			.from(table.variantImg)
			.where(eq(table.variantImg.variantId, variant.id))
			.orderBy(table.variantImg.sortOrder)
			.execute();

		variants.push({ ...variant, images });
	}

	return variants;
}

/**
 * Creates a new product variant
 */
export async function createVariant(
	input: CreateVariantInput
): Promise<ProductActionResult<VariantComplete>> {
	const {
		productId,
		size,
		color,
		colorHex,
		cut,
		description,
		stock,
		priceOverride,
		sortOrder = 0
	} = input;

	// Validate product exists
	const [product] = await getDb()
		.select()
		.from(table.product)
		.where(eq(table.product.id, productId))
		.execute();

	if (!product) {
		return failure(ProductErrorCode.NOT_FOUND, 'Producto no encontrado');
	}

	// Check for duplicate variant (unique constraint on productId+size+color+cut)
	const [existing] = await getDb()
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

	if (existing) {
		return failure(
			ProductErrorCode.INVALID_VARIANT_DATA,
			'Ya existe una variante con esta talla, color y corte'
		);
	}

	const variantId = crypto.randomUUID();
	const now = new Date();

	const variant: table.ProductVariant = {
		id: variantId,
		productId,
		size,
		color,
		colorHex: colorHex ?? null,
		cut,
		description: description ?? null,
		stock: stock ?? 0,
		priceOverride: priceOverride !== undefined ? priceOverride.toFixed(2) : null,
		sortOrder,
		createdAt: now,
		updatedAt: now,
		// New variants are listed straight away.
		deactivatedAt: null
	};

	await getDb().insert(table.productVariant).values(variant).execute();

	const createdVariant: VariantComplete = {
		...variant,
		images: []
	};

	return success(createdVariant);
}

/**
 * Updates a product variant
 */
export async function updateVariant(
	variantId: string,
	input: UpdateVariantInput
): Promise<ProductActionResult<VariantComplete>> {
	const { size, color, colorHex, cut, description, stock, priceOverride, sortOrder } = input;

	const [existingVariant] = await getDb()
		.select()
		.from(table.productVariant)
		.where(eq(table.productVariant.id, variantId))
		.execute();

	if (!existingVariant) {
		return failure(ProductErrorCode.VARIANT_NOT_FOUND, 'Variante no encontrada');
	}

	// Check for duplicate if size/color/cut are being changed
	if (size !== undefined || color !== undefined || cut !== undefined) {
		const newSize = size ?? existingVariant.size;
		const newColor = color ?? existingVariant.color;
		const newCut = cut ?? existingVariant.cut;

		const [duplicate] = await getDb()
			.select()
			.from(table.productVariant)
			.where(
				and(
					eq(table.productVariant.productId, existingVariant.productId),
					eq(table.productVariant.size, newSize),
					eq(table.productVariant.color, newColor),
					eq(table.productVariant.cut, newCut),
					sql`${table.productVariant.id} != ${variantId}`
				)
			)
			.execute();

		if (duplicate) {
			return failure(
				ProductErrorCode.INVALID_VARIANT_DATA,
				'Ya existe una variante con esta talla, color y corte'
			);
		}
	}

	const updates: Partial<table.ProductVariant> = {
		updatedAt: new Date()
	};

	if (size !== undefined) updates.size = size;
	if (color !== undefined) updates.color = color;
	if (colorHex !== undefined) updates.colorHex = colorHex;
	if (cut !== undefined) updates.cut = cut;
	if (description !== undefined) updates.description = description;
	if (stock !== undefined) updates.stock = stock;
	if (priceOverride !== undefined)
		updates.priceOverride = priceOverride !== null ? priceOverride.toFixed(2) : null;
	if (sortOrder !== undefined) updates.sortOrder = sortOrder;

	await getDb()
		.update(table.productVariant)
		.set(updates)
		.where(eq(table.productVariant.id, variantId))
		.execute();

	// Return updated variant with images
	const [updatedVariant] = await getDb()
		.select()
		.from(table.productVariant)
		.where(eq(table.productVariant.id, variantId))
		.execute();

	const images = await getDb()
		.select()
		.from(table.variantImg)
		.where(eq(table.variantImg.variantId, variantId))
		.orderBy(table.variantImg.sortOrder)
		.execute();

	return success({ ...updatedVariant!, images });
}

/**
 * Toggles the soft-delete flag of a variant.
 *
 * Deactivating is what the admin variant "eliminar" flow now does: the row
 * (and every order or cart line that points at it) survives, the storefront
 * stops offering it, and the backoffice keeps showing it flagged as inactive.
 *
 * Deactivation also demotes `sortOrder` to 999, so the variant sinks to the
 * bottom of every admin list ordered by `sortOrder, createdAt` and no longer
 * reads as a "main" variant. Reactivation keeps the demoted rank: no original
 * order is stored, and the edit form lets the admin re-rank if needed.
 */
export async function setVariantActive(
	variantId: string,
	active: boolean
): Promise<ProductActionResult<void>> {
	const [variant] = await getDb()
		.select({ id: table.productVariant.id, productId: table.productVariant.productId })
		.from(table.productVariant)
		.where(eq(table.productVariant.id, variantId))
		.execute();

	if (!variant) {
		return failure(ProductErrorCode.VARIANT_NOT_FOUND, 'Variante no encontrada');
	}

	await getDb()
		.update(table.productVariant)
		.set(active ? { deactivatedAt: null } : { deactivatedAt: new Date(), sortOrder: 999 })
		.where(eq(table.productVariant.id, variantId))
		.execute();

	if (!active) {
		// Same purge contract as product deactivation: cart lines for the
		// variant can never be purchased again, and order lines snapshot their
		// images while the variant assets still exist.
		await getDb().delete(table.cartItem).where(eq(table.cartItem.variantId, variantId)).execute();
		await snapshotOrderLineImages(variant.productId, variantId);
	}

	return success(undefined);
}

/**
 * Destroys the Cloudinary assets behind a variant's images.
 *
 * Best-effort by design: a failed destroy must never block the DB delete, so the
 * failure is swallowed here exactly like `deleteImg` does (REQ-IMG-011).
 */
async function destroyVariantImgs(variantId: string) {
	const imgs = await getVariantImgs(variantId);
	for (const img of imgs) {
		try {
			await cloudinary.uploader.destroy(extractPublicId(img.url));
		} catch {
			// Cloudinary destroy failed — DB records still deleted (REQ-IMG-011)
		}
	}
}

/**
 * Removes a single variant image row and its Cloudinary asset.
 *
 * Same contract as `deleteImg`: the asset destroy is best-effort, so a failed
 * destroy must never block the DB delete (REQ-IMG-011).
 */
export async function deleteVariantImg(id: string) {
	const [img] = await getDb()
		.select()
		.from(table.variantImg)
		.where(eq(table.variantImg.id, id))
		.execute();
	if (!img) return;

	try {
		await cloudinary.uploader.destroy(extractPublicId(img.url));
	} catch {
		// Cloudinary destroy failed — DB record still deleted (REQ-IMG-011)
	}
	await getDb().delete(table.variantImg).where(eq(table.variantImg.id, id)).execute();
}

/**
 * Returns the failure that blocks deleting a variant — still referenced by a
 * cart or an order while still active — or null when nothing blocks it.
 *
 * Shared by `deleteVariant` and `purgeInactiveVariants` so both paths agree on
 * which references protect a row. An INACTIVE variant is never blocked: cart
 * lines were purged at deactivation, order lines keep their snapshots, and the
 * `ON DELETE SET NULL` foreign key nulls any dangling reference.
 */
async function variantDeletionBlocker(
	variantId: string
): Promise<ProductActionResult<void> | null> {
	const [variant] = await getDb()
		.select({ deactivatedAt: table.productVariant.deactivatedAt })
		.from(table.productVariant)
		.where(eq(table.productVariant.id, variantId))
		.execute();

	if (variant?.deactivatedAt) {
		return null;
	}

	// Check referential integrity: cart_items
	const [cartItemRef] = await getDb()
		.select({ id: table.cartItem.id })
		.from(table.cartItem)
		.where(eq(table.cartItem.variantId, variantId))
		.limit(1)
		.execute();

	if (cartItemRef) {
		return failure(
			ProductErrorCode.REFERENTIAL_INTEGRITY,
			'No se puede eliminar la variante: está referenciada en un carrito'
		);
	}

	// Check referential integrity: order_items
	const [orderItemRef] = await getDb()
		.select({ id: table.orderItem.id })
		.from(table.orderItem)
		.where(eq(table.orderItem.variantId, variantId))
		.limit(1)
		.execute();

	if (orderItemRef) {
		return failure(
			ProductErrorCode.REFERENTIAL_INTEGRITY,
			'No se puede eliminar la variante: está referenciada en un pedido'
		);
	}

	return null;
}

/**
 * Hard-deletes a variant row: its `variant_img` rows and the variant itself.
 *
 * Cloudinary assets are destroyed only when no order line references the
 * variant — with references, the image snapshots written at deactivation are
 * the only photos history will ever get again, so the assets must outlive the
 * row. The FK `ON DELETE SET NULL` nulls the dangling variant ids.
 */
async function hardDeleteVariant(variantId: string): Promise<void> {
	const [orderRef] = await getDb()
		.select({ id: table.orderItem.id })
		.from(table.orderItem)
		.where(eq(table.orderItem.variantId, variantId))
		.limit(1)
		.execute();

	// Cart lines for a hard-deleted variant can never be purchased. Covers
	// lines that outlived deactivation (e.g. written after it).
	await getDb().delete(table.cartItem).where(eq(table.cartItem.variantId, variantId)).execute();

	if (!orderRef) {
		await destroyVariantImgs(variantId);
	}
	await getDb().delete(table.variantImg).where(eq(table.variantImg.variantId, variantId)).execute();

	await getDb()
		.delete(table.productVariant)
		.where(eq(table.productVariant.id, variantId))
		.execute();
}

/**
 * Deletes a product variant.
 *
 * Active variants are still protected by the reference guards (shared via
 * `variantDeletionBlocker`); inactive ones are deletable even when order
 * lines once referenced them — those lines keep their snapshots. The admin
 * UI gates permanent deletion behind the inactive state; the VariantModal
 * rollback path deletes just-created ACTIVE orphan rows, which no reference
 * protects, so it still works.
 */
export async function deleteVariant(variantId: string): Promise<ProductActionResult<void>> {
	const [variant] = await getDb()
		.select()
		.from(table.productVariant)
		.where(eq(table.productVariant.id, variantId))
		.execute();

	if (!variant) {
		return failure(ProductErrorCode.VARIANT_NOT_FOUND, 'Variante no encontrada');
	}

	const blocker = await variantDeletionBlocker(variantId);
	if (blocker) {
		return blocker;
	}

	await hardDeleteVariant(variantId);

	return success(undefined);
}

/**
 * Deletes inactive variants older than `olderThanDays`, one by one through the
 * guard `deleteVariant` shares via `variantDeletionBlocker`.
 *
 * Deactivated variants are never reference-blocked: their cart lines were
 * purged at deactivation and order lines keep their snapshots, so the age
 * gate is the only thing that keeps them around.
 */
export async function purgeInactiveVariants(
	options: { olderThanDays?: number } = {}
): Promise<{ purged: string[]; skipped: string[] }> {
	const olderThanDays = options.olderThanDays ?? 30;
	const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);

	const candidates = await getDb()
		.select({ id: table.productVariant.id })
		.from(table.productVariant)
		.where(
			and(
				isNotNull(table.productVariant.deactivatedAt),
				lt(table.productVariant.deactivatedAt, cutoff)
			)
		)
		.execute();

	const purged: string[] = [];
	const skipped: string[] = [];
	for (const candidate of candidates) {
		const blocker = await variantDeletionBlocker(candidate.id);
		if (blocker) {
			skipped.push(candidate.id);
			continue;
		}
		await hardDeleteVariant(candidate.id);
		purged.push(candidate.id);
	}

	return { purged, skipped };
}

/**
 * Gets variant images ordered by sort_order
 */
export async function getVariantImgs(variantId: string): Promise<table.VariantImg[]> {
	return getDb()
		.select()
		.from(table.variantImg)
		.where(eq(table.variantImg.variantId, variantId))
		.orderBy(table.variantImg.sortOrder)
		.execute();
}

/**
 * Binds an image URL to a variant (creates variant_img record)
 */
export async function bindVariantImg(
	variantId: string,
	url: string,
	alt: string = '',
	sortOrder?: number
) {
	// When omitted, append after the last image: sort_order must stay unique per
	// variant (unique index variant_img_unique_variant_sort_order), so reusing 0
	// would collide on the second insert.
	let order = sortOrder;
	if (order === undefined) {
		const existing = await getVariantImgs(variantId);
		order = existing.reduce((max, img) => Math.max(max, img.sortOrder), -1) + 1;
	}

	const imgId = crypto.randomUUID();
	const now = new Date();

	const variantImg: table.VariantImg = {
		id: imgId,
		variantId,
		url,
		alt,
		sortOrder: order,
		createdAt: now
	};

	await getDb().insert(table.variantImg).values(variantImg).execute();
}

/**
 * Rewrites the whole image order of a variant from a list of ids.
 *
 * Same contract as `reorderImgs`: the payload must be exactly the variant's
 * image set — duplicated, missing or foreign ids are rejected before the first
 * write, so a bad payload leaves the stored order untouched.
 *
 * Unlike `img`, `variant_img` carries `variant_img_unique_variant_sort_order`,
 * so `reorderImgs`' in-place rewrite would trip the index on the very first
 * swap (moving a row onto a position its neighbour still holds). Two passes
 * inside one transaction avoid that: park every row on a distinct negative
 * position first, then write the final 0..n-1. Stored orders are never
 * negative — `bindVariantImg` appends from max + 1 and reorders write 0..n-1 —
 * so the parked values cannot collide with a row left behind.
 */
export async function reorderVariantImgs(variantId: string, orderedIds: string[]) {
	const current = await getVariantImgs(variantId);
	const currentIds = new Set(current.map((img) => img.id));
	const uniqueIds = new Set(orderedIds);
	const isExactSet =
		uniqueIds.size === orderedIds.length &&
		currentIds.size === orderedIds.length &&
		orderedIds.every((id) => currentIds.has(id));

	if (!isExactSet) {
		throw new Error('Image order does not match this variant images');
	}

	await getDb().transaction(async (tx) => {
		for (let i = 0; i < orderedIds.length; i++) {
			await tx
				.update(table.variantImg)
				.set({ sortOrder: -(i + 1) })
				.where(
					and(eq(table.variantImg.id, orderedIds[i]), eq(table.variantImg.variantId, variantId))
				)
				.execute();
		}
		for (let i = 0; i < orderedIds.length; i++) {
			await tx
				.update(table.variantImg)
				.set({ sortOrder: i })
				.where(
					and(eq(table.variantImg.id, orderedIds[i]), eq(table.variantImg.variantId, variantId))
				)
				.execute();
		}
	});
}
