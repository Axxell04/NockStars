import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { checkOrderExists, getOrderWithItems } from '$lib/server/order';
import { getOrderStatusMessages } from '$lib/server/order-status';
import { orderShipping } from '$lib/order-content';
import {
	buildOrderStatusValues,
	isTemplateConfigured,
	renderOrderStatusTemplate
} from '$lib/order-status-template';

export const load: PageServerLoad = async (event) => {
	const cod = event.params.cod;
	if (!cod || cod.length !== 10) {
		return {
			message: 'El código del pedido es incorrecto',
			order: null,
			statusMessage: null
		};
	} else if (!(await checkOrderExists(cod))) {
		return {
			message: 'El pedido ingresado no ha sido encontrado',
			order: null,
			statusMessage: null
		};
	}

	if (event.locals.user) {
		return redirect(307, `/admin/pedidos?cod=${cod}`);
	} else {
		const order = await getOrderWithItems(cod);

		// Rendered here so the raw template never reaches the browser, and an
		// unconfigured template means no block at all rather than a blank one.
		let statusMessage: string | null = null;
		if (order) {
			const messages = await getOrderStatusMessages();
			const template = order.completed ? messages.completedMessage : messages.pendingMessage;
			if (isTemplateConfigured(template)) {
				const values = buildOrderStatusValues({
					id: order.id,
					clientName: order.clientName,
					completed: order.completed,
					createdAt: order.createdAt,
					items: order.items,
					shippingFee: orderShipping(order.content)
				});
				statusMessage = renderOrderStatusTemplate(template, values);
			}
		}

		return {
			order,
			statusMessage
		};
	}
};
