import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getOrders } from '$lib/server/order';
import type { OrderPagination } from '$lib/interfaces/order';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}
	const cod = event.url.searchParams.get('cod');

	// Read from the cookie-backed local rather than hardcoding `false`: the
	// set_view_state action writes `order_view_state` and hooks.server.ts copies
	// it into locals, so ignoring it here reset the toggle on every reload.
	const completed = event.locals.orderViewState === 'completed';

	const orderPagination = (await getOrders({ completed, cod })) as OrderPagination;

	return {
		orderPagination,
		// Handed to the page so the toggle label matches the list it loaded.
		// The page used to seed this as 'pending' and auto-submit the form on
		// mount, which rewrote the cookie to 'pending' and clobbered the choice.
		viewState: completed ? 'completed' : 'pending'
	};
};

export const actions: Actions = {
	set_view_state: async (event) => {
		const formData = await event.request.formData();
		const viewState = formData.get('view_state') as string;
		const cod = formData.get('cod') as string;

		if (!viewState) {
			return fail(400, { message: 'Error en los parámetros de la petición' });
		}

		event.cookies.set('order_view_state', viewState, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: event.url.protocol === 'https:'
		});

		const completed = viewState ? (viewState === 'completed' ? true : false) : false;
		const orderPagination = await getOrders({ completed, cod });

		return {
			orderPagination
		};
	},
	prev_page: async (event) => {
		const formData = await event.request.formData();
		let totalPages = 0;
		let currentPage = 0;
		const completed = event.locals.orderViewState === 'completed';

		try {
			totalPages = parseInt(formData.get('total_pages') as string);
			currentPage = parseInt(formData.get('current_page') as string);
			if (isNaN(totalPages) || isNaN(currentPage)) {
				return fail(400, { message: 'Invalid pagination params' });
			}
		} catch {
			return fail(400, { message: 'Invalid pagination params' });
		}

		if (currentPage <= 1) {
			return fail(404, { message: 'Page not found' });
		}
		const nextPage = currentPage - 1;
		const orderPagination = await getOrders({ page: nextPage, completed });

		return {
			orderPagination
		};
	},
	next_page: async (event) => {
		const formData = await event.request.formData();
		let totalPages = 0;
		let currentPage = 0;
		const completed = event.locals.orderViewState === 'completed';

		try {
			totalPages = parseInt(formData.get('total_pages') as string);
			currentPage = parseInt(formData.get('current_page') as string);
			if (isNaN(totalPages) || isNaN(currentPage)) {
				return fail(400, { message: 'Invalid pagination params' });
			}
		} catch {
			return fail(400, { message: 'Invalid pagination params' });
		}

		if (currentPage >= totalPages) {
			return fail(404, { message: 'Page not found' });
		}
		const nextPage = currentPage + 1;
		const orderPagination = await getOrders({ page: nextPage, completed });

		return {
			orderPagination
		};
	},
	goto_page: async (event) => {
		const formData = await event.request.formData();
		let totalPages = 0;
		let gotoPage = 0;
		const completed = event.locals.orderViewState === 'completed';

		try {
			totalPages = parseInt(formData.get('total_pages') as string);
			gotoPage = parseInt(formData.get('goto_page') as string);
			if (isNaN(totalPages) || isNaN(gotoPage)) {
				return fail(400, { message: 'Invalid pagination params' });
			}
		} catch {
			return fail(400, { message: 'Invalid pagination params' });
		}

		// Rejects out-of-range navigation early so the UI gets a real 404 instead
		// of silently landing on another page. Note this bound is checked against
		// the client-supplied `total_pages`, so it is a UX guard, not a security
		// boundary: clampPage inside getOrders is what guarantees a valid offset.
		if (gotoPage < 1 || gotoPage > totalPages) {
			return fail(404, { message: 'Page not found' });
		}

		const orderPagination = await getOrders({ page: gotoPage, completed });

		return {
			orderPagination
		};
	}
};
