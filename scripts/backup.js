import postgres from 'postgres';
import { config } from 'dotenv';
import * as table from '../src/lib/server/db/schema.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import fs from 'fs';
import { eq, not } from 'drizzle-orm';

// Cargar variables de entorno desde el archivo .env
config();

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle(client);

async function backup() {
	const data = {
		user: await db
			.select()
			.from(table.user)
			.where(not(eq(table.user.admin, true))),
		catalog: await db.select().from(table.catalog),
		contact: await db.select().from(table.contact),
		cost: await db.select().from(table.cost),
		expense: await db.select().from(table.expense),
		product: await db.select().from(table.product),
		img: await db.select().from(table.img),
		productCatalog: await db.select().from(table.productCatalog),
		revenue: await db.select().from(table.revenue),
		order: await db.select().from(table.order),
		user_token: await db.select().from(table.user_token)
		// session: await db.select().from(table.session),
	};
	if (!fs.existsSync('backups/')) {
		fs.mkdirSync('backups/');
	}
	fs.writeFileSync('backups/data.json', JSON.stringify(data, null, 2));
	await client.end();
}

backup().catch((e) => {
	console.error('Backup error:', e);
	process.exit(1);
});
