import * as table from '$lib/server/db/schema';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { getDb } from '$lib/server/db';
import { v2 as cloudinary } from 'cloudinary';
import {
	CLOUDINARY_CLOUD_NAME,
	CLOUDINARY_API_KEY,
	CLOUDINARY_API_SECRET
} from '$env/static/private';
import { and, desc, eq, like, sql } from 'drizzle-orm';
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
};

export async function createProduct(
	name: string,
	price: number,
	catalogId?: string,
	stock: number = 0
) {
	const productId = generateId();
	const product: table.Product = {
		id: productId,
		name: name,
		price: price,
		stock: stock,
		createdAt: new Date()
	};

	await getDb().insert(table.product).values(product).execute();

	if (catalogId) {
		await addProductToCatalog(productId, catalogId);
	}
	return productId;
}

export async function bindImg(productId: string, url: string) {
	const imgId = generateId();

	await getDb()
		.insert(table.img)
		.values({
			id: imgId,
			url: url,
			productId: productId
		})
		.execute();
}

export async function getProducts(options: GetProductsOptions = {}) {
	const { page = 1, limit = 5, search, catalogId } = options;
	const offset = (page - 1) * limit;
	let products: table.Product[];

	if (search) {
		const searchPattern = `%${search}%`;
		products = !catalogId
			? await getDb()
					.select()
					.from(table.product)
					.where(like(table.product.name, searchPattern))
					.limit(limit)
					.offset(offset)
					.orderBy(desc(table.product.createdAt))
					.execute()
			: await getDb()
					.select({
						id: table.product.id,
						name: table.product.name,
						price: table.product.price,
						stock: table.product.stock,
						createdAt: table.product.createdAt
					})
					.from(table.product)
					.innerJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId))
					.where(
						and(
							eq(table.productCatalog.catalogId, catalogId ?? ''),
							like(table.product.name, searchPattern)
						)
					)
					.limit(limit)
					.offset(offset)
					.orderBy(desc(table.product.createdAt))
					.execute();
	} else {
		products = !catalogId
			? await getDb()
					.select()
					.from(table.product)
					.limit(limit)
					.offset(offset)
					.orderBy(desc(table.product.createdAt))
					.execute()
			: await getDb()
					.select({
						id: table.product.id,
						name: table.product.name,
						price: table.product.price,
						stock: table.product.stock,
						createdAt: table.product.createdAt
					})
					.from(table.product)
					.innerJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId))
					.where(eq(table.productCatalog.catalogId, catalogId ?? ''))
					.limit(limit)
					.offset(offset)
					.orderBy(desc(table.product.createdAt))
					.execute();
	}

	const listProducts: { product: table.Product; imgs: table.Img[] }[] = [];

	for (const product of products) {
		const imgs = await getImgs(product.id);
		listProducts.push({
			product: product,
			imgs: imgs
		});
	}

	let totalProducts: number;
	if (search) {
		const searchPattern = `%${search}%`;
		totalProducts = !catalogId
			? (
					await getDb()
						.select()
						.from(table.product)
						.where(like(table.product.name, searchPattern))
						.execute()
				).length
			: (
					await getDb()
						.select({
							id: table.product.id,
							name: table.product.name,
							price: table.product.price,
							createdAt: table.product.createdAt
						})
						.from(table.product)
						.innerJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId))
						.where(
							and(
								eq(table.productCatalog.catalogId, catalogId ?? ''),
								like(table.product.name, searchPattern)
							)
						)
						.execute()
				).length;
	} else {
		totalProducts = !catalogId
			? (await getDb().select().from(table.product).execute()).length
			: (
					await getDb()
						.select({
							id: table.product.id,
							name: table.product.name,
							price: table.product.price,
							createdAt: table.product.createdAt
						})
						.from(table.product)
						.innerJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId))
						.where(eq(table.productCatalog.catalogId, catalogId ?? ''))
						.execute()
				).length;
	}

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
	imgsDelete?: string[];
};

export async function updateProduct(options: UpdateProductOptions) {
	const { product_id, name, price, stock, imgsDelete } = options;
	const updates: Partial<table.Product> = {};
	if (typeof name !== 'undefined') updates.name = name;
	if (typeof price !== 'undefined') updates.price = price;
	if (typeof stock !== 'undefined') updates.stock = stock;

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

export async function deleteProduct(id: string) {
	const imgs = await getImgs(id);
	for (const img of imgs) {
		await deleteImg(img.id);
	}
	// await getDb().delete(table.img).where(eq(table.img.productId, id)).execute();
	await getDb().delete(table.product).where(eq(table.product.id, id)).execute();
}

export async function getImgs(productId: string) {
	const imgs = await getDb()
		.select()
		.from(table.img)
		.where(eq(table.img.productId, productId))
		.execute();
	return imgs;
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
 * Gets a product with all its variants and images, plus the implicit variant
 */
export async function getProductWithVariants(
	productId: string
): Promise<ProductWithVariants | null> {
	const [product] = await getDb()
		.select()
		.from(table.product)
		.where(eq(table.product.id, productId))
		.execute();

	if (!product) {
		return null;
	}

	// Get product images
	const productImages = await getDb()
		.select()
		.from(table.img)
		.where(eq(table.img.productId, productId))
		.execute();

	const variants = await getVariantsByProduct(productId);
	const implicitVariant = resolveImplicitVariant(product);

	return {
		...product,
		productImages,
		variants,
		implicitVariant
	};
}

/**
 * Gets all variants for a product with their images
 */
export async function getVariantsByProduct(productId: string): Promise<VariantComplete[]> {
	const variantRows = await getDb()
		.select()
		.from(table.productVariant)
		.where(eq(table.productVariant.productId, productId))
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
	const { productId, size, color, cut, description, stock, priceOverride, sortOrder = 0 } = input;

	// Validate product exists
	const [product] = await getDb()
		.select()
		.from(table.product)
		.where(eq(table.product.id, productId))
		.execute();

	if (!product) {
		return failure(ProductErrorCode.NOT_FOUND, 'Product not found');
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
			'Variant with this size/color/cut already exists'
		);
	}

	const variantId = crypto.randomUUID();
	const now = new Date();

	const variant: table.ProductVariant = {
		id: variantId,
		productId,
		size,
		color,
		cut,
		description: description ?? null,
		stock: stock ?? 0,
		priceOverride: priceOverride !== undefined ? priceOverride.toFixed(2) : null,
		sortOrder,
		createdAt: now,
		updatedAt: now
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
	const { size, color, cut, description, stock, priceOverride, sortOrder } = input;

	const [existingVariant] = await getDb()
		.select()
		.from(table.productVariant)
		.where(eq(table.productVariant.id, variantId))
		.execute();

	if (!existingVariant) {
		return failure(ProductErrorCode.VARIANT_NOT_FOUND, 'Variant not found');
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
				'Variant with this size/color/cut already exists'
			);
		}
	}

	const updates: Partial<table.ProductVariant> = {
		updatedAt: new Date()
	};

	if (size !== undefined) updates.size = size;
	if (color !== undefined) updates.color = color;
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
 * Deletes a product variant (checks referential integrity)
 */
export async function deleteVariant(variantId: string): Promise<ProductActionResult<void>> {
	const [variant] = await getDb()
		.select()
		.from(table.productVariant)
		.where(eq(table.productVariant.id, variantId))
		.execute();

	if (!variant) {
		return failure(ProductErrorCode.VARIANT_NOT_FOUND, 'Variant not found');
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
			'Cannot delete variant: referenced by cart items'
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
			'Cannot delete variant: referenced by order items'
		);
	}

	// Delete variant images first (cascade should handle this, but explicit is safer)
	await getDb().delete(table.variantImg).where(eq(table.variantImg.variantId, variantId)).execute();

	// Delete variant
	await getDb()
		.delete(table.productVariant)
		.where(eq(table.productVariant.id, variantId))
		.execute();

	return success(undefined);
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
	sortOrder: number = 0
) {
	const imgId = crypto.randomUUID();
	const now = new Date();

	const variantImg: table.VariantImg = {
		id: imgId,
		variantId,
		url,
		alt,
		sortOrder,
		createdAt: now
	};

	await getDb().insert(table.variantImg).values(variantImg).execute();
}
