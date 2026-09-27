import { getDb } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hash } from '@node-rs/argon2';
import { encodeBase32LowerCase, encodeBase32UpperCase } from '@oslojs/encoding';
import { eq } from 'drizzle-orm';

export async function createUser(username: string, password: string) {
	const userId = generateId();
	const passwordHash = await hash(password, {
		// recommended minimum parameters
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1
	});

	try {
		await getDb()
			.insert(table.user)
			.values({ id: userId, username, passwordHash, admin: false })
			.execute();
	} catch (e) {
		console.error('An error occurred while creating the account:', e);
	}
}

export async function getUsers() {
	const users = await getDb()
		.select({ id: table.user.id, username: table.user.username, admin: table.user.admin })
		.from(table.user)
		.execute();

	return users;
}

export async function deleteUser(id: string) {
	await getDb().delete(table.session).where(eq(table.session.userId, id)).execute();
	await getDb().delete(table.user).where(eq(table.user.id, id)).execute();
}

export async function updatePrivileges(id: string, admin: boolean) {
	await getDb().update(table.user).set({ admin: admin }).where(eq(table.user.id, id)).execute();
}

export async function generateUserToken() {
	const id = generateId();
	const text = generateToken();
	const userToken: table.UserTokenInsert = {
		id,
		text,
		active: true
	};

	await getDb().insert(table.user_token).values(userToken).execute();
}

export async function getUserTokens() {
	const userTokens = (await getDb().select().from(table.user_token).execute()).toReversed();
	return userTokens;
}

export async function getUserToken(id: string) {
	const [res] = await getDb()
		.select()
		.from(table.user_token)
		.where(eq(table.user_token.id, id))
		.execute();
	return res;
}

export async function checkUserToken(token: string) {
	const [userToken] = await getDb()
		.select()
		.from(table.user_token)
		.where(eq(table.user_token.text, token.toUpperCase()))
		.execute();
	if (typeof userToken === 'undefined') {
		return undefined;
	}

	if (userToken.active) {
		return true;
	} else {
		return false;
	}
}

export async function useUserToken(token: string) {
	await getDb()
		.update(table.user_token)
		.set({ active: false })
		.where(eq(table.user_token.text, token))
		.execute();
}

export async function deleteUserToken(id: string) {
	await getDb().delete(table.user_token).where(eq(table.user_token.id, id));
}

function generateId() {
	// ID with 120 bits of entropy, or about the same as UUID v4.
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	const id = encodeBase32LowerCase(bytes);
	return id;
}

function generateToken() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	const name = encodeBase32UpperCase(bytes);
	return name;
}
