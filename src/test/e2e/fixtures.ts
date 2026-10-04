import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import type { Page } from '@playwright/test';
import * as schema from '$lib/server/db/schema';

/**
 * Scoped fixtures for the e2e suite.
 *
 * Playwright's `webServer` runs `npm run dev`, so the suite talks to the
 * development database. Every row created here carries an `e2e-` prefixed id
 * and is removed by the caller in a `finally` block, which keeps repeated runs
 * idempotent without ever touching catalogue data the project created.
 *
 * Connections are opened and closed per call rather than cached: a long-lived
 * handle would keep the Playwright worker's event loop alive after the tests.
 */

type TestDb = PostgresJsDatabase<typeof schema>;

async function withDb<T>(run: (db: TestDb) => Promise<T>): Promise<T> {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error('DATABASE_URL is not set — playwright.config.ts must load .env');
	}
	const client = postgres(url, { max: 1 });
	try {
		return await run(drizzle(client, { schema }));
	} finally {
		await client.end();
	}
}

export type SeededProduct = {
	id: string;
	variantId: string;
};

/**
 * Creates a product with a single M / Red / recto variant, matching the shape
 * the legacy `cart` cookie in the migration tests carries. Stock is generous
 * because add-to-cart never decrements it — only checkout does.
 */
export async function seedTestProduct(options: { name?: string } = {}): Promise<SeededProduct> {
	const id = `e2e-${randomUUID()}`;
	const variantId = randomUUID();

	await withDb(async (db) => {
		await db.transaction(async (tx) => {
			await tx.insert(schema.product).values({
				id,
				name: options.name ?? 'Test Product',
				price: 10,
				stock: 100
			});
			await tx.insert(schema.productVariant).values({
				id: variantId,
				productId: id,
				size: 'M',
				color: 'Red',
				cut: 'recto',
				stock: 100
			});
		});
	});

	return { id, variantId };
}

/**
 * Removes a seeded product. `product_catalog` and `img` reference the product
 * with ON DELETE no action, so they have to go first; variant, cart and
 * order-item rows cascade from the product itself.
 */
export async function cleanupTestProduct(productId: string): Promise<void> {
	await withDb(async (db) => {
		await db.delete(schema.productCatalog).where(eq(schema.productCatalog.productId, productId));
		await db.delete(schema.img).where(eq(schema.img.productId, productId));
		await db.delete(schema.product).where(eq(schema.product.id, productId));
	});
}

/**
 * Signs in through the real login form so the session cookie is the one the
 * app issues. Admin suites must run serially: `login` calls
 * `invalidateAllUserSessions`, so a second login would evict the first test's
 * session mid-flight.
 *
 * `ADMIN_USERNAME` / `ADMIN_PASS` may hold comma-separated lists (see
 * scripts/createAdmin.ts); only the first entry is used.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
	const username = process.env.ADMIN_USERNAME?.split(',')[0]?.trim();
	const password = process.env.ADMIN_PASS?.split(',')[0]?.trim();
	if (!username || !password) {
		throw new Error('ADMIN_USERNAME and ADMIN_PASS must be set to log in as admin');
	}

	await page.goto('/login');
	await page.fill('input[name="username"]', username);
	await page.fill('input[name="password"]', password);
	await page.click('button[type="submit"]');
	await page.waitForURL('**/admin');
}
