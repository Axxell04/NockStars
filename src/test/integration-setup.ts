// Integration test setup
import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '$lib/server/db/schema';

// Test database connection
let testDb: ReturnType<typeof drizzle> | null = null;
let sql: ReturnType<typeof postgres> | null = null;

export async function getTestDb() {
	if (!testDb) {
		// TEST_DATABASE_URL is required on purpose and must never fall back to
		// DATABASE_URL: `beforeEach` below deletes the whole catalog, order and
		// cart set, and DATABASE_URL is the database the application uses.
		// Falling back would wipe live development data on the first test.
		const databaseUrl = process.env.TEST_DATABASE_URL;
		if (!databaseUrl) {
			throw new Error('TEST_DATABASE_URL must be set for integration tests');
		}
		sql = postgres(databaseUrl, { max: 1 });
		testDb = drizzle(sql, { schema });
	}
	return testDb;
}

export async function cleanupTestDb() {
	if (sql) {
		await sql.end();
		sql = null;
		testDb = null;
	}
}

beforeAll(async () => {
	// Ensure test database is available
	await getTestDb();
});

afterAll(async () => {
	await cleanupTestDb();
});

beforeEach(async () => {
	const db = await getTestDb();
	// Clean up test data before each test
	await db.delete(schema.cartItem);
	await db.delete(schema.cart);
	await db.delete(schema.orderItem);
	await db.delete(schema.order);
	await db.delete(schema.variantImg);
	await db.delete(schema.productVariant);
	await db.delete(schema.productCatalog);
	// img before product: img.product_id references product.id.
	await db.delete(schema.img);
	await db.delete(schema.product);
	await db.delete(schema.catalog);
});

// Mock SvelteKit modules for integration tests
vi.mock('$app/state', () => ({
	page: {
		url: new URL('http://localhost:5173'),
		params: {}
	}
}));

vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn()
}));

vi.mock('$app/forms', () => ({
	enhance: vi.fn()
}));
