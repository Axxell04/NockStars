import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';

let _client: ReturnType<typeof postgres> | undefined;
let _db: ReturnType<typeof drizzle> | undefined;

export function getDb() {
	if (!_db) {
		if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
		_client = postgres(env.DATABASE_URL, {
			// Each serverless instance owns its pool, so postgres.js defaults are
			// too generous here: max 10 connections and no idle timeout means a
			// warm instance holds ten clients forever. The Supabase pooler allows
			// 15 clients in session mode, so a second instance exhausts it.
			max: 1,
			idle_timeout: 20,
			max_lifetime: 300,
			// Required by the transaction pooler, which cannot carry prepared
			// statements across transactions.
			prepare: false
		});
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
