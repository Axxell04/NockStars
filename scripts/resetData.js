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

async function resetData() {
	try {
		await db.delete(table.user_token);
		await db.delete(table.order);
		await db.delete(table.revenue);
		await db.delete(table.productCatalog);
		await db.delete(table.img);
		await db.delete(table.product);
		await db.delete(table.expense);
		await db.delete(table.cost);
		await db.delete(table.contact);
		await db.delete(table.catalog);
		await db.delete(table.user).where(eq(table.user.admin, false));

		fs.rmSync('uploads/imgs', { recursive: true, force: true });
	} catch (error) {
		// console.log(error)
		throw new Error(`Error al realizar la restauración de datos: ${error}`);
	} finally {
		await client.end();
	}
}

resetData().catch((e) => {
	console.error(e);
	process.exit(1);
});
