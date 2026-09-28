import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

// Cargar variables de entorno
config();

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle(client);

async function resetDatabase() {
	console.log('🔄 Reseteando base de datos...');

	// 1. Obtener todas las tablas del schema public
	const tables = await client`
		SELECT tablename FROM pg_tables WHERE schemaname = 'public'
	`;

	console.log(`📋 Tablas encontradas: ${tables.length}`);

	// 2. Deshabilitar triggers y constraints temporalmente
	await client`SET session_replication_role = 'replica'`;

	// 3. Borrar todas las tablas (CASCADE para FKs)
	for (const { tablename } of tables) {
		if (tablename === '_drizzle_migrations' || tablename.startsWith('_')) continue;
		console.log(`  🗑️  DROP TABLE ${tablename} CASCADE`);
		await client.unsafe(`DROP TABLE IF EXISTS "${tablename}" CASCADE`);
	}

	// 4. Borrar el schema de tracking de drizzle. migrate() decide por timestamp
	// en drizzle.__drizzle_migrations, así que si sobrevive, la segunda corrida
	// saltea todas las migraciones y queda una base vacía con "éxito".
	await client.unsafe(`DROP SCHEMA IF EXISTS drizzle CASCADE`);

	// 5. Borrar tipos enum personalizados
	const enums = await client`
		SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
	`;
	for (const { typname } of enums) {
		console.log(`  🗑️  DROP TYPE ${typname}`);
		await client.unsafe(`DROP TYPE IF EXISTS "${typname}" CASCADE`);
	}

	// 6. Borrar funciones personalizadas
	const functions = await client`
		SELECT proname FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
	`;
	for (const { proname } of functions) {
		console.log(`  🗑️  DROP FUNCTION ${proname}`);
		await client.unsafe(`DROP FUNCTION IF EXISTS "${proname}" CASCADE`);
	}

	// 7. Rehabilitar constraints
	await client`SET session_replication_role = 'origin'`;

	console.log('✅ Base de datos limpiada');

	// 8. Ejecutar migraciones de drizzle
	console.log('📦 Aplicando migraciones...');
	await migrate(db, { migrationsFolder: './drizzle' });

	console.log('✅ Migraciones aplicadas correctamente');
	await client.end();
	process.exit(0);
}

resetDatabase().catch((e) => {
	console.error('❌ Error:', e);
	client.end();
	process.exit(1);
});
