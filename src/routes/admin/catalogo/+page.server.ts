import * as auth from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createCatalog, deleteCatalog, getCatalogs, updateCatalog } from '$lib/server/catalog';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	const catalogs = await getCatalogs();

	return {
		user: event.locals.user,
		catalogs: catalogs
	};
};

export const actions: Actions = {
	logout: async (event) => {
		if (!event.locals.session) {
			return fail(401);
		}
		await auth.invalidateSession(event.locals.session.id);
		auth.deleteSessionTokenCookie(event);

		redirect(302, '/login');
	},
	add_catalog: async (event) => {
		const formData = await event.request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;

		if (!name) {
			return fail(400, { message: 'Invalid name' });
		}

		try {
			await createCatalog(name, description);
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Internal server error' });
		}

		const catalogs = await getCatalogs();

		return {
			catalogs: catalogs
		};
	},
	delete_catalog: async (event) => {
		const formData = await event.request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { message: 'Invalid id' });
		}

		try {
			await deleteCatalog(id);
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Internal server error' });
		}

		const catalogs = await getCatalogs();
		return {
			catalogs: catalogs
		};
	},
	edit_catalog: async (event) => {
		const formData = await event.request.formData();
		const id = formData.get('id') as string;
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;

		if (!id) {
			return fail(400, { message: 'Invalid id' });
		}
		if (!name) {
			return fail(400, { message: 'Invalid name' });
		}

		try {
			await updateCatalog(id, name, description);
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Internal server error' });
		}

		const catalogs = await getCatalogs();
		return {
			catalogs: catalogs
		};
	}
};
