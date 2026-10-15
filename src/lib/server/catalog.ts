import * as table from '$lib/server/db/schema';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { getDb } from '$lib/server/db';
import { and, asc, eq, desc, inArray, isNull, ne, or, sql } from 'drizzle-orm';

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
 * Moves a product into `catalogId`, replacing any membership it had. The
 * delete + insert run in one transaction: a crash between two separate
 * statements would leave the product with no catalog at all, which is worse
 * than the duplicate-row risk the plain insert would have had.
 */
export async function moveProductToCatalog(productId: string, catalogId: string) {
	await getDb().transaction(async (tx) => {
		await tx
			.delete(table.productCatalog)
			.where(eq(table.productCatalog.productId, productId))
			.execute();
		await tx
			.insert(table.productCatalog)
			.values({ id: generateId(), productId, catalogId })
			.execute();
	});
}

/**
 * Sums `product_variant.stock` per product for the given ids in a single
 * query. A product id missing from the result has no variants at all — which
 * is distinct from a product whose variants sum to 0 — so callers must fall
 * back to the base stock instead of treating the miss as a zero.
 *
 * Only active variants count: a deactivated variant's stock is not sellable,
 * so including it would advertise units the storefront will not offer.
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
		.where(
			and(
				inArray(table.productVariant.productId, productIds),
				isNull(table.productVariant.deactivatedAt)
			)
		)
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
			createdAt: table.product.createdAt,
			deactivatedAt: table.product.deactivatedAt
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
			.orderBy(asc(table.img.sortOrder))
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
			createdAt: table.product.createdAt,
			deactivatedAt: table.product.deactivatedAt
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
			.orderBy(asc(table.img.sortOrder))
			.execute();

		listProducts.push({
			product: { ...product, variantStockTotal: variantStockTotals.get(product.id) ?? null },
			imgs
		});
	}

	return listProducts;
}

/**
 * Products that do NOT belong to `excludeCatalogId`, each with the catalog it
 * currently sits in (null = none), its thumbnail and its sellable stock. This
 * is the candidate list for "assign an existing product": picking one of these
 * means adding it to the target catalog, and the origin name lets the admin
 * see what the move displaces.
 */
export async function getAssignableProducts(excludeCatalogId: string) {
	const rows = await getDb()
		.select({
			id: table.product.id,
			name: table.product.name,
			price: table.product.price,
			stock: table.product.stock,
			deactivatedAt: table.product.deactivatedAt,
			currentCatalogId: table.productCatalog.catalogId,
			currentCatalogName: table.catalog.name
		})
		.from(table.product)
		.leftJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId))
		.leftJoin(table.catalog, eq(table.productCatalog.catalogId, table.catalog.id))
		.where(
			or(
				isNull(table.productCatalog.catalogId),
				ne(table.productCatalog.catalogId, excludeCatalogId)
			)
		)
		.orderBy(desc(table.product.createdAt))
		.execute();

	// A product with several memberships would appear once per membership; the
	// codebase treats one catalog per product as the rule, so keep the first
	// row and collapse any duplicates instead of listing them twice.
	const seen = new Set<string>();
	const uniqueRows = rows.filter((row) => {
		if (seen.has(row.id)) return false;
		seen.add(row.id);
		return true;
	});

	// One batched query for every thumbnail instead of one per product: the
	// candidate list can be long, and the N+1 pattern in getProductsByCatalog
	// exists only because those lists are paginated short. Ordered by
	// sortOrder so the first row per product is the one the admin picked first.
	const ids = uniqueRows.map((row) => row.id);
	const variantStockTotals = await getVariantStockTotals(ids);
	const imgs =
		ids.length === 0
			? []
			: await getDb()
					.select({ productId: table.img.productId, url: table.img.url })
					.from(table.img)
					.where(inArray(table.img.productId, ids))
					.orderBy(asc(table.img.sortOrder))
					.execute();

	const thumbnailByProduct = new Map<string, string>();
	for (const img of imgs) {
		// `set` WOULD overwrite an existing key; the `has` guard is what keeps
		// the first row per product, and the asc(sortOrder) above is what makes
		// that first row the admin's primary image.
		if (!thumbnailByProduct.has(img.productId)) {
			thumbnailByProduct.set(img.productId, img.url);
		}
	}

	return uniqueRows.map((row) => ({
		...row,
		thumbnailUrl: thumbnailByProduct.get(row.id) ?? null,
		variantStockTotal: variantStockTotals.get(row.id) ?? null
	}));
}

/** Catalog a product belongs to, or null when it has no membership at all. */
export async function getCatalogIdForProduct(productId: string): Promise<string | null> {
	// A product has at most one membership in practice, so the first row is
	// the whole answer — no need to aggregate or deduplicate here.
	const [row] = await getDb()
		.select()
		.from(table.productCatalog)
		.where(eq(table.productCatalog.productId, productId))
		.execute();

	return row?.catalogId ?? null;
}

// Complementary Functions

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	const id = encodeBase32LowerCase(bytes);
	return id;
}
