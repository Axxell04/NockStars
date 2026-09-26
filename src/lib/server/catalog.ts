import * as table from '$lib/server/db/schema';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { getDb } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';

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

export async function removeProductToCatalog(productId: string, catalogId: string) {
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

// Complementary Functions

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	const id = encodeBase32LowerCase(bytes);
	return id;
}
