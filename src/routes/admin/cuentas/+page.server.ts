import {
	deleteUser,
	deleteUserToken,
	generateUserToken,
	getUserTokens,
	getUsers,
	updatePrivileges
} from '$lib/server/user';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}
	if (!event.locals.user?.admin) {
		return redirect(302, '/admin');
	}

	const user = event.locals.user;
	const userTokens = await getUserTokens();
	const users = await getUsers();

	return {
		userTokens,
		users,
		user
	};
};

export const actions: Actions = {
	get_user_tokens: async (event) => {
		if (!event.locals.user?.admin) {
			return fail(401, { message: 'No tiene los permisos suficientes' });
		}

		const userTokens = await getUserTokens();
		return {
			userTokens
		};
	},
	get_users: async (event) => {
		if (!event.locals.user?.admin) {
			return fail(401, { message: 'No tiene los permisos suficientes' });
		}
		const users = await getUsers();
		return {
			users
		};
	},
	generate_user_token: async (event) => {
		if (!event.locals.user?.admin) {
			return fail(401, { message: 'No tiene los permisos suficientes' });
		}

		try {
			await generateUserToken();
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'A ocurrido un error en el servidor' });
		}

		const userTokens = await getUserTokens();
		return {
			userTokens
		};
	},
	update_user: async (event) => {
		if (!event.locals.user?.admin) {
			return fail(401, { message: 'No tiene los permisos suficientes' });
		}

		const formData = await event.request.formData();
		const userId = formData.get('user_id') as string;
		let admin: boolean | undefined;

		try {
			admin = JSON.parse(formData.get('admin') as string);
			if (typeof admin === 'undefined') {
				return fail(400, { message: 'Error en los parámetros de la petición' });
			}
		} catch {
			return fail(400, { message: 'Error en los parámetros de la petición' });
		}

		try {
			await updatePrivileges(userId, admin);
		} catch (error) {
			console.log(error);
		}

		const users = await getUsers();
		return {
			users
		};
	},
	delete_user: async (event) => {
		const formData = await event.request.formData();
		const userId = formData.get('user_id') as string;

		try {
			await deleteUser(userId);
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'A ocurrido un error en el servidor' });
		}

		const users = await getUsers();
		return {
			users
		};
	},
	delete_user_token: async (event) => {
		const formData = await event.request.formData();
		const tokenId = formData.get('token_id') as string;

		try {
			await deleteUserToken(tokenId);
		} catch (error) {
			console.log(error);
			fail(500, { message: 'A ocurrido un error en el servidor' });
		}

		const userTokens = await getUserTokens();
		return {
			userTokens
		};
	}
};
