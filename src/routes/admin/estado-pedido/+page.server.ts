import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getOrderStatusMessages, setOrderStatusMessages } from '$lib/server/order-status';

// Generous for a status message, but bounded: this string is stored and echoed
// back to clients, so an unbounded textarea would let one admin row bloat the
// order page indefinitely.
const MAX_TEMPLATE_LENGTH = 2000;

async function snapshot() {
	return { messages: await getOrderStatusMessages() };
}

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	return snapshot();
};

/** Reads one template field, validating length. Returns an error string or the value. */
function readTemplate(formData: FormData, field: 'pendingMessage' | 'completedMessage') {
	const raw = formData.get(field);
	const value = typeof raw === 'string' ? raw : '';

	// An empty field is a valid "show nothing for this status" instruction, not
	// an error, so only the upper bound is enforced.
	if (value.length > MAX_TEMPLATE_LENGTH) {
		return {
			error: `El mensaje de "${field === 'pendingMessage' ? 'Pendiente' : 'Completado'}" no puede superar los ${MAX_TEMPLATE_LENGTH} caracteres`
		} as const;
	}

	return { value } as const;
}

export const actions: Actions = {
	save: async (event) => {
		const formData = await event.request.formData();

		const pending = readTemplate(formData, 'pendingMessage');
		if ('error' in pending) {
			return fail(400, { message: pending.error });
		}

		const completed = readTemplate(formData, 'completedMessage');
		if ('error' in completed) {
			return fail(400, { message: completed.error });
		}

		try {
			await setOrderStatusMessages({
				pendingMessage: pending.value,
				completedMessage: completed.value
			});
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Ha ocurrido un error en el servidor' });
		}

		return snapshot();
	}
};
