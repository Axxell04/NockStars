import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteOrder, getOrderById, getOrderLineDisplay, updateOrder } from '$lib/server/order';
import { createRevenue } from '$lib/server/revenue';
import { toOrderLines } from '$lib/order-content';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}
	const order = await getOrderById(event.params.id);
	if (!order) {
		throw error(404, 'Pedido no encontrado');
	}
	return {
		order,
		display: await getOrderLineDisplay(toOrderLines(order.content))
	};
};

export const actions: Actions = {
	edit_order: async (event) => {
		const formData = await event.request.formData();
		const orderId = formData.get('order_id') as string;
		const totalValue = parseFloat(formData.get('total_value') as string);
		let content: object;
		try {
			content = JSON.parse(formData.get('content') as string);
			if (!content || !orderId || !isNumber(totalValue)) {
				return fail(400, { message: 'Error en los parámetros de la petición' });
			}
		} catch {
			return fail(400, { message: 'Error en los parámetros de la petición' });
		}

		await updateOrder(orderId, content, undefined, undefined, totalValue);

		return { ok: true };
	},
	delete_order: async (event) => {
		const formData = await event.request.formData();
		const orderId = formData.get('order_id') as string;

		if (!orderId) {
			return fail(400, { message: 'Error en los parámetros de la petición' });
		}

		try {
			await deleteOrder(orderId);
		} catch (err) {
			console.log(err);
			return fail(500, { message: 'A ocurrido un error en el servidor' });
		}

		return { ok: true };
	},
	update_order_state: async (event) => {
		const formData = await event.request.formData();
		const orderId = formData.get('order_id') as string;
		const totalValue = parseFloat(formData.get('total_value') as string);

		if (!orderId || !isNumber(totalValue)) {
			return fail(400, { message: 'Error en los parámetros de la petición' });
		}

		const order = await getOrderById(orderId);
		if (!order) {
			return fail(404, { message: 'Pedido no encontrado' });
		}

		try {
			if (!order.completed) {
				const revenueId = await createRevenue(
					parseFloat(totalValue.toFixed(2)),
					'Orden completada'
				);
				await updateOrder(orderId, undefined, true, revenueId);
			} else {
				await updateOrder(orderId, undefined, false, null);
			}
		} catch {
			return fail(500, { message: 'A ocurrido un error en el servidor' });
		}

		return { ok: true };
	}
};

function isNumber(value: unknown): value is number {
	return typeof value === 'number' && !isNaN(value) && value > 0;
}
