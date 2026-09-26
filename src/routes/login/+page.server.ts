import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as auth from '$lib/server/auth';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { verify } from '@node-rs/argon2';
import { checkUserToken, createUser, useUserToken } from '$lib/server/user';

// Rate limiting: Map<IP, { count, resetAt }>
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const record = loginAttempts.get(ip);

	if (!record || now > record.resetAt) {
		loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
		return true;
	}

	if (record.count >= MAX_ATTEMPTS) {
		return false;
	}

	record.count++;
	return true;
}

// Generic login error to prevent user enumeration
const LOGIN_ERROR = 'Usuario o contraseña incorrectos';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/admin');
	}
	return {};
};

export const actions: Actions = {
	login: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username');
		const password = formData.get('password');

		// Rate limit check
		const ip = event.getClientAddress();
		if (!checkRateLimit(ip)) {
			return fail(429, {
				message: 'Demasiados intentos. Intentá de nuevo en 15 minutos.'
			});
		}

		if (!validateUsername(username)) {
			return fail(400, { message: LOGIN_ERROR });
		}

		if (!validatePassword(password)) {
			return fail(400, { message: LOGIN_ERROR });
		}

		const results = await getDb()
			.select()
			.from(table.user)
			.where(eq(table.user.username, username));
		const existingUser = results.at(0);

		if (!existingUser) {
			return fail(400, { message: LOGIN_ERROR });
		}

		const validPassword = await verify(existingUser.passwordHash, password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});

		if (!validPassword) {
			return fail(400, { message: LOGIN_ERROR });
		}

		// Reset rate limit on successful login
		loginAttempts.delete(ip);

		// Invalidate old sessions before creating new one
		await auth.invalidateAllUserSessions(existingUser.id);

		const sessionToken = auth.generateSessionToken();
		const session = await auth.createSession(sessionToken, existingUser.id);
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

		return redirect(302, '/admin');
	},
	register: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username');
		const password = formData.get('password');
		const confirmPassword = formData.get('confirm_password');
		const userToken = formData.get('user_token');

		if (!validateUsername(username)) {
			return fail(400, { message: 'Username inválido' });
		}
		if (!validatePassword(password) || !validatePassword(confirmPassword)) {
			return fail(400, { message: 'Contraseña inválida' });
		}
		if (!validateUserToken(userToken)) {
			return fail(400, { message: 'Token inválido' });
		}

		if (password !== confirmPassword) {
			return fail(400, { message: 'Las contraseñas no coinciden' });
		}

		try {
			const resToken = await checkUserToken(userToken);
			if (typeof resToken === 'undefined') {
				return fail(400, { message: 'El token de usuario no es válido' });
			} else if (!resToken) {
				return fail(400, { message: 'El token de usuario ya fue utilizado' });
			}
			await useUserToken(userToken);
			await createUser(username, password);
		} catch (error) {
			console.error('Registration error:', error);
			return fail(500, { message: 'Ocurrió un error en el servidor' });
		}
	}
};

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

function validateUserToken(userToken: unknown): userToken is string {
	return typeof userToken === 'string' && userToken.length > 0;
}
