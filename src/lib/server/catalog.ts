import * as table from '$lib/server/db/schema';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { getDb } from '$lib/server/db';
import { and, eq, desc, inArray, isNull, sql } from 'drizzle-orm';

export async function createCatalog(name: string, description?: string) {
	const productId = generateId();
	const catalog: table.Catalog = {
		id: productId,
		name: name,
		description: description ?? '',
		createdAt: new Date()
	};

	await getDb().insert(table.catalog).values(catalog).execute();
}

export async function getCatalogs() {
	const catalogs = await getDb().select().from(table.catalog).execute();
	return catalogs;
}

export async function updateCatalog(id: string, name: string, description: string) {
	await getDb()
		.update(table.catalog)
		.set({ name: name, description: description })
		.where(eq(table.catalog.id, id))
		.execute();
}

export async function deleteCatalog(id: string) {
	await getDb()
		.delete(table.productCatalog)
		.where(eq(table.productCatalog.catalogId, id))
		.execute();
	await getDb().delete(table.catalog).where(eq(table.catalog.id, id));
}

export async function validateCatalog(id: string) {
	const exist = (
		await getDb().select().from(table.catalog).where(eq(table.catalog.id, id)).execute()
	).length;
	if (!exist) {
		return false;
	}
	return true;
}

// ProductCatalog Functions
export async function addProductToCatalog(productId: string, catalogId: string) {
	const id = generateId();
	const productCatalog: table.ProductCatalog = {
		id: id,
		productId: productId,
		catalogId: catalogId
	};
	await getDb().insert(table.productCatalog).values(productCatalog).execute();
}

export async function removeProductFromCatalog(productId: string, catalogId: string) {
	await getDb()
		.delete(table.productCatalog)
		.where(
			and(
				eq(table.productCatalog.productId, productId),
				eq(table.productCatalog.catalogId, catalogId)
			)
		)
		.execute();
}

/**
 * Sums `product_variant.stock` per product for the given ids in a single
 * query. A product id missing from the result has no variants at all — which
 * is distinct from a product whose variants sum to 0 — so callers must fall
 * back to the base stock instead of treating the miss as a zero.
 */
async function getVariantStockTotals(productIds: string[]): Promise<Map<string, number>> {
	// `inArray` with an empty array is a SQL footgun, and there is nothing to
	// sum anyway: skip the query entirely.
	if (productIds.length === 0) {
		return new Map();
	}

	const rows = await getDb()
		.select({
			productId: table.productVariant.productId,
			total: sql<number>`sum(${table.productVariant.stock})`
		})
		.from(table.productVariant)
		.where(inArray(table.productVariant.productId, productIds))
		.groupBy(table.productVariant.productId)
		.execute();

	// Postgres `sum` over integers returns bigint, which drivers may hand
	// back as a string — normalize to a real number.
	return new Map(rows.map((row) => [row.productId, Number(row.total)]));
}

export async function getProductsByCatalog(catalogId: string) {
	const products = await getDb()
		.select({
			id: table.product.id,
			name: table.product.name,
			price: table.product.price,
			stock: table.product.stock,
			createdAt: table.product.createdAt
		})
		.from(table.product)
		.innerJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId))
		.where(eq(table.productCatalog.catalogId, catalogId))
		.orderBy(desc(table.product.createdAt))
		.execute();

	const variantStockTotals = await getVariantStockTotals(products.map((product) => product.id));

	const listProducts: {
		product: (typeof products)[0] & { variantStockTotal: number | null };
		imgs: table.Img[];
	}[] = [];

	for (const product of products) {
		const imgs = await getDb()
			.select()
			.from(table.img)
			.where(eq(table.img.productId, product.id))
			.execute();

		listProducts.push({
			product: { ...product, variantStockTotal: variantStockTotals.get(product.id) ?? null },
			imgs
		});
	}

	return listProducts;
}

export async function getProductsWithoutCatalog() {
	// LEFT JOIN + IS NULL selects products that have no row in product_catalog,
	// i.e. products with no catalog membership at all.
	const products = await getDb()
		.select({
			id: table.product.id,
			name: table.product.name,
			price: table.product.price,
			stock: table.product.stock,
			createdAt: table.product.createdAt
		})
		.from(table.product)
		.leftJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId))
		.where(isNull(table.productCatalog.catalogId))
		.orderBy(desc(table.product.createdAt))
		.execute();

	const variantStockTotals = await getVariantStockTotals(products.map((product) => product.id));

	const listProducts: {
		product: (typeof products)[0] & { variantStockTotal: number | null };
		imgs: table.Img[];
	}[] = [];

	for (const product of products) {
		const imgs = await getDb()
			.select()
			.from(table.img)
			.where(eq(table.img.productId, product.id))
			.execute();

		listProducts.push({
			product: { ...product, variantStockTotal: variantStockTotals.get(product.id) ?? null },
			imgs
		});
	}

	return listProducts;
}

// Complementary Functions

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	const id = encodeBase32LowerCase(bytes);
	return id;
}
