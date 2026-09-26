import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';

let _client: ReturnType<typeof postgres> | undefined;
let _db: ReturnType<typeof drizzle> | undefined;

export function getDb() {
	if (!_db) {
		if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
		_client = postgres(env.DATABASE_URL, { prepare: false });
		_db = drizzle(_client);
	}
	return _db;
}

export function getClient() {
	if (!_client) {
		getDb();
	}
	return _client!;
}
