import { config } from 'dotenv';
import { hash } from '@node-rs/argon2';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as table from '../src/lib/server/db/schema.ts';

// Cargar variables de entorno desde el archivo .env
config();

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle(client);

async function createAdmin(username: string, password: string) {
	if (!validateUsername(username)) {
		throw new Error('Invalid username (min 3, max 31 characters, alphanumeric only)');
	}
	if (!validatePassword(password)) {
		throw new Error('Invalid password (min 6, max 255 characters)');
	}

	const userId = generateUserId();
	const passwordHash = await hash(password, {
		// recommended minimum parameters
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	});

	try {
		await db.insert(table.user).values({ id: userId, username, passwordHash, admin: true });
		console.log('Admin account created successfully');
	} catch (e) {
		console.error('An error occurred while creating the admin account:', e);
	}
}

function generateUserId() {
	// ID with 120 bits of entropy, or about the same as UUID v4.
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	const id = encodeBase32LowerCase(bytes);
	return id;
}

function validateUsername(username: unknown): username is string {
	return (
		typeof username === 'string' &&
		username.length >= 3 &&
		username.length <= 31 &&
		/^[a-zA-Z0-9_-]+$/.test(username)
	);
}

function validatePassword(password: unknown): password is string {
	return typeof password === 'string' && password.length >= 6 && password.length <= 255;
}

if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASS) {
	throw new Error('No se encuentran las credenciales de administrador');
}

const usernameList = process.env.ADMIN_USERNAME.split(',');
const passList = process.env.ADMIN_PASS.split(',');

async function main() {
	for (const username of usernameList) {
		await createAdmin(username, passList[usernameList.indexOf(username)]);
	}
	await client.end();
}

main().catch((e) => {
	console.error('An error occurred:', e);
	process.exit(1);
});

// // Ejecutar el script
// const username = process.argv[2];
// const password = process.argv[3];

// if (!username || !password) {
//     console.error('Usage: ts-node createAdmin.ts <username> <password>');
//     process.exit(1);
// }
