import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getOrderWithItems } from '$lib/server/order';
import { getOrderStatusMessages } from '$lib/server/order-status';
import { orderShipping } from '$lib/order-content';
import {
	buildOrderStatusValues,
	isTemplateConfigured,
	renderOrderStatusTemplate
} from '$lib/order-status-template';

export const load: PageServerLoad = async (event) => {
	const cod = event.params.cod;

	// Single lookup: getOrderWithItems() returns null when the order row is
	// gone, so this doubles as the existence check. There is deliberately no
	// length guard here — live checkout mints ids as `ORD-<epoch>-<rand>`
	// (24 chars) while the dead createOrder() path used generateId(10), and an
	// earlier `cod.length !== 10` check rejected every real order.
	const order = await getOrderWithItems(cod);
	if (!order) {
		return {
			message: 'El pedido ingresado no ha sido encontrado',
			order: null,
			statusMessage: null
		};
	}

	if (event.locals.user) {
		return redirect(307, `/admin/finanzas?tab=pedidos&cod=${cod}`);
	}

	// Rendered here so the raw template never reaches the browser, and an
	// unconfigured template means no block at all rather than a blank one.
	const messages = await getOrderStatusMessages();
	const template = order.completed ? messages.completedMessage : messages.pendingMessage;
	const statusMessage = isTemplateConfigured(template)
		? renderOrderStatusTemplate(
				template,
				buildOrderStatusValues({
					id: order.id,
					clientName: order.clientName,
					completed: order.completed,
					createdAt: order.createdAt,
					items: order.items,
					shippingFee: orderShipping(order.content)
				})
			)
		: null;

	return {
		// Declared on both branches so `data.message` is always typed. The
		// template renders it in the `{:else}` arm instead of a hardcoded string.
		message: null,
		order,
		statusMessage
	};
};
