import { createContact, deleteContact, getContacts, updateContact } from '$lib/server/contact';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	const contacts = await getContacts();

	return {
		contacts: contacts
	};
};

export const actions: Actions = {
	create_contact: async (event) => {
		const formData = await event.request.formData();
		const icon = formData.get('icon') as string;
		const text = formData.get('text') as string;
		const url = formData.get('url') as string;

		if (!icon || !text || !url) {
			return fail(400, { message: 'Errores en los parámetros de la petición' });
		}

		try {
			await createContact(icon.toLowerCase(), text, url);
		} catch (error) {
			console.log(error);
			return fail(500, { messsage: 'A ocurrido un error en el servidor' });
		}

		const contacts = await getContacts();

		return {
			contacts: contacts
		};
	},
	edit_contact: async (event) => {
		const formData = await event.request.formData();
		const id = formData.get('id_contact') as string;
		const icon = formData.get('icon') as string;
		const text = formData.get('text') as string;
		const url = formData.get('url') as string;

		if (!icon || !text || !url || !id) {
			return fail(400, { message: 'Errores en los parámetros de la petición' });
		}

		try {
			await updateContact(id, icon.toLowerCase(), text, url);
		} catch (error) {
			console.log(error);
			return fail(500, { messsage: 'A ocurrido un error en el servidor' });
		}

		const contacts = await getContacts();

		return {
			contacts: contacts
		};
	},
	delete_contact: async (event) => {
		const formData = await event.request.formData();
		const id = formData.get('id_contact') as string;

		if (!id) {
			return fail(400, { message: 'Errores en los parámetros de la petición' });
		}

		try {
			await deleteContact(id);
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'A ocurrido un error en el servidor' });
		}

		const contacts = await getContacts();

		return {
			contacts: contacts
		};
	}
};
