import { config } from 'dotenv';
import readline from 'node:readline/promises';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

// Cargar variables de entorno
config();

/**
 * Lee una variable de entorno obligatoria. El tipo de retorno es `string`
 * de verdad, así que no hace falta re-validarla dentro de cada función.
 */
function requiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is not set`);
	}
	return value;
}

const databaseUrl = requiredEnv('DATABASE_URL');
const force = process.argv.includes('--yes');

/**
 * Devuelve `host:port/path` sin credenciales, para poder confirmar qué se va a borrar.
 */
function describeTarget(url: string): string {
	try {
		const parsed = new URL(url);
		return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
	} catch {
		return '(DATABASE_URL no es una URL válida)';
	}
}

/**
 * Pedir confirmación explícita antes de una operación destructiva.
 * `--yes` para uso no interactivo; si no, hay que escribir la ruta de la base.
 */
async function confirmDestructive(target: string): Promise<void> {
	if (force) {
		console.log('⚠️  Confirmación omitida por --yes');
		return;
	}

	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		throw new Error(
			`Refusing to reset ${target} without confirmation. ` +
				`Run interactively and type the database path, or pass --yes: ` +
				`npm run db:reset -- --yes`
		);
	}

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const lastSegment = target.slice(target.lastIndexOf('/') + 1);
	// Si la URL no trae nombre de base, no pedimos una cadena vacía.
	const expected = lastSegment || target;
	const answer = await rl.question(`Escribí "${expected}" para confirmar el reset de ${target}: `);
	rl.close();

	if (answer.trim() !== expected) {
		throw new Error(`Confirmación incorrecta (esperaba "${expected}"). No se ejecutó nada.`);
	}
}

/**
 * `session_replication_role` es superuser-only. Si el rol no alcanza, seguimos
 * sin él: los DROP ... CASCADE no dependen de los triggers FK.
 */
async function disableReplicationRole(client: postgres.Sql): Promise<boolean> {
	try {
		await client`SET session_replication_role = 'replica'`;
		return true;
	} catch (error) {
		console.warn(
			'⚠️  No se pudo desactivar session_replication_role (rol sin superuser); se continúa igual.'
		);
		console.warn(`   ${String(error)}`);
		return false;
	}
}

async function resetDatabase(client: postgres.Sql): Promise<void> {
	// 1. Obtener todas las tablas del schema public
	const tables = await client`
		SELECT tablename FROM pg_tables WHERE schemaname = 'public'
	`;

	console.log(`📋 Tablas encontradas: ${tables.length}`);

	// 2. Deshabilitar triggers y constraints temporalmente.
	//    Requiere superuser; en roles normales (Neon, RDS) se omite y los
	//    DROP ... CASCADE siguen funcionando por sí solos.
	const replicationRoleDisabled = await disableReplicationRole(client);

	// 3. Borrar todas las tablas (CASCADE para FKs)
	for (const { tablename } of tables) {
		if (tablename.startsWith('_')) continue;
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
	if (replicationRoleDisabled) {
		await client`SET session_replication_role = 'origin'`;
	}

	console.log('✅ Base de datos limpiada');

	// 8. Ejecutar migraciones de drizzle
	console.log('📦 Aplicando migraciones...');
	await migrate(drizzle(client), { migrationsFolder: './drizzle' });

	console.log('✅ Migraciones aplicadas correctamente');
}

async function main(): Promise<void> {
	const target = describeTarget(databaseUrl);
	console.log(`🎯 Destino: ${target}`);

	// Guarda destructiva: sin confirmación explícita no se ejecuta nada.
	await confirmDestructive(target);

	console.log('🔄 Reseteando base de datos...');

	const client = postgres(databaseUrl, { prepare: false });

	try {
		await resetDatabase(client);
	} finally {
		await client.end();
	}
}

try {
	await main();
	console.log('🏁 Listo');
} catch (error) {
	console.error('❌ Error:', error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
