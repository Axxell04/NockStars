import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getShippingFee, setShippingFee } from '$lib/server/shipping';

async function snapshot() {
	return { fee: await getShippingFee() };
}

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	return snapshot();
};

export const actions: Actions = {
	set_fee: async (event) => {
		const formData = await event.request.formData();
		const raw = formData.get('fee');
		const fee = typeof raw === 'string' ? Number(raw) : NaN;

		if (!Number.isFinite(fee) || fee < 0) {
			return fail(400, { message: 'El envío debe ser un monto mayor o igual a 0' });
		}

		try {
			await setShippingFee(fee);
		} catch (error) {
			console.log(error);
			return fail(500, { message: 'Ha ocurrido un error en el servidor' });
		}

		return snapshot();
	}
};
