import type { Handle } from '@sveltejs/kit';
import * as auth from '$lib/server/auth.js';
import { validateCatalog } from '$lib/server/catalog';

const handleAuth: Handle = async ({ event, resolve }) => {
	const orderViewState = event.cookies.get('order_view_state');
	if (orderViewState) {
		event.locals.orderViewState = orderViewState;
	} else {
		event.locals.orderViewState = 'pending';
	}

	const balanceViewState = event.cookies.get('balance_view_state');
	if (balanceViewState) {
		event.locals.balanceViewSatate = balanceViewState;
	} else {
		event.locals.balanceViewSatate = 'resume';
	}

	const catalogId = event.cookies.get('catalog-id');
	const sessionToken = event.cookies.get(auth.sessionCookieName);

	const [catalogValid, authResult] = await Promise.all([
		catalogId ? validateCatalog(catalogId) : Promise.resolve(false),
		sessionToken ? auth.validateSessionToken(sessionToken) : Promise.resolve(null)
	]);

	if (catalogId) {
		if (catalogValid) {
			event.locals.catalogId = catalogId;
		} else {
			event.cookies.delete('catalog-id', {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: event.url.protocol === 'https:'
			});
			event.locals.catalogId = '';
		}
	} else {
		event.locals.catalogId = '';
	}

	if (!authResult) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = authResult;
	if (session) {
		auth.setSessionTokenCookie(event, sessionToken as string, session.expiresAt);
	} else {
		auth.deleteSessionTokenCookie(event);
	}

	event.locals.user = user;
	event.locals.session = session;

	return resolve(event);
};

export const handle: Handle = handleAuth;
