import postgres from 'postgres';
import { config } from 'dotenv';
import * as table from '../src/lib/server/db/schema.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import fs from 'fs';

// Cargar variables de entorno desde el archivo .env
config();

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle(client);

function reviver(key, value) {
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
		return new Date(value);
	}
	return value;
}

async function restore() {
	if (!fs.existsSync('backups/data.json')) {
		throw new Error('No se encontraron respaldos');
	}
	const data = JSON.parse(fs.readFileSync('backups/data.json', 'utf-8'), reviver);

	try {
		if (data.user.length) await db.insert(table.user).values(data.user);
		if (data.catalog.length) await db.insert(table.catalog).values(data.catalog);
		if (data.contact.length) await db.insert(table.contact).values(data.contact);
		if (data.cost.length) await db.insert(table.cost).values(data.cost);
		if (data.expense.length) await db.insert(table.expense).values(data.expense);
		if (data.product.length) await db.insert(table.product).values(data.product);
		if (data.img.length) await db.insert(table.img).values(data.img);
		if (data.productCatalog.length)
			await db.insert(table.productCatalog).values(data.productCatalog);
		if (data.revenue.length) await db.insert(table.revenue).values(data.revenue);
		if (data.order.length) await db.insert(table.order).values(data.order);
		if (data.user_token.length) await db.insert(table.user_token).values(data.user_token);
	} catch (error) {
		// console.log(error)
		throw new Error(`Error al realizar la restauración de datos: ${error}`);
	} finally {
		await client.end();
	}
}

restore().catch((e) => {
	console.error(e);
	process.exit(1);
});
