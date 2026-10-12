import { formatOrderDate, orderLinesTotal } from './order-content';

// Order-status message templates.
//
// A template is plain text with `{placeholder}` tokens. This module is
// deliberately free of server imports: the storefront renders the final string
// on the server, while the admin editor needs the exact same substitution to
// show a live preview, and the unit tests need it without a database.

/**
 * Tokens a template may use, in the order the admin editor lists them.
 *
 * `{items}` is the number of distinct lines in the order (one product-variant
 * per line); `{unidades}` is the sum of their quantities. They differ as soon
 * as a line has quantity > 1.
 */
export const ORDER_STATUS_PLACEHOLDERS = [
	'{cliente}',
	'{estado}',
	'{codigo}',
	'{fecha}',
	'{total}',
	'{envio}',
	'{items}',
	'{unidades}'
] as const;

export type OrderStatusPlaceholder = (typeof ORDER_STATUS_PLACEHOLDERS)[number];

/** The values substituted into a template. Keys are the bare token names. */
export type OrderStatusValues = Record<OrderStatusPlaceholder, string>;

/** Human descriptions shown next to each token in the admin editor. */
export const ORDER_STATUS_PLACEHOLDER_HINTS: Record<OrderStatusPlaceholder, string> = {
	'{cliente}': 'Nombre del cliente',
	'{estado}': 'Pendiente o Completado',
	'{codigo}': 'Código del pedido (10 caracteres)',
	'{fecha}': 'Fecha en que se creó el pedido',
	'{total}': 'Total del pedido, envío incluido',
	'{envio}': 'Costo de envío cobrado',
	'{items}': 'Cantidad de líneas de producto',
	'{unidades}': 'Suma de unidades de todas las líneas'
};

/**
 * Substitute `{placeholder}` tokens into a template.
 *
 * Unrecognised tokens are left verbatim rather than blanked: an admin who typos
 * `{clinte}` must see `{clinte}` in the preview, not a silently missing value.
 * Repeated tokens are all substituted.
 */
export function renderOrderStatusTemplate(
	template: string,
	values: Partial<OrderStatusValues>
): string {
	return template.replace(/\{([a-z]+)\}/g, (match, name: string) => {
		const key = `{${name}}` as OrderStatusPlaceholder;
		const value = values[key];
		// An empty-but-present value renders empty; an absent value keeps the
		// token so the typo stays visible.
		return value === undefined ? match : value;
	});
}

/**
 * True when a template has any non-whitespace content, i.e. the admin actually
 * configured it and it should render on the storefront page.
 *
 * This checks the raw template, not the rendered output: `Hola {cliente}`
 * counts as configured even though the token needs substitution, while `''`
 * and `'   '` do not.
 */
export function isTemplateConfigured(template: string): boolean {
	return template.trim().length > 0;
}

/**
 * The order facts a template may reference, in the minimal shape the builder
 * needs. Deliberately structural rather than the Drizzle row type so this stays
 * importable from the admin editor and the unit tests without a database.
 */
export interface OrderStatusOrderFacts {
	id: string;
	clientName: string;
	completed: boolean;
	createdAt: Date;
	items: { unitPriceSnapshot: unknown; quantity: unknown }[];
	/** Fee actually charged, i.e. after any admin waiver. */
	shippingFee: number;
}

/**
 * Format a whole-peso amount the way the order page prints it (`1500.00 $`).
 * Kept in one place so a template's `{total}` matches the total block below it.
 */
function formatAmount(value: number): string {
	return `${value.toFixed(2)} $`;
}

/**
 * Turn one order's facts into the substitution map for its status template.
 *
 * `{estado}` is rendered from the `completed` flag, which is also what selects
 * which of the two templates applies — so a template that echoes `{estado}`
 * always agrees with the one that was picked.
 *
 * `shippingFee` is passed in already resolved by the caller (via
 * `orderShipping()`, which honours an admin waiver) so this stays free of the
 * `content` blob's two storage shapes.
 */
export function buildOrderStatusValues(order: OrderStatusOrderFacts): OrderStatusValues {
	const linesTotal = orderLinesTotal(order.items);
	const units = order.items.reduce(
		(acc, item) => acc + (Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0),
		0
	);

	return {
		'{cliente}': order.clientName,
		'{estado}': order.completed ? 'Completado' : 'Pendiente',
		'{codigo}': order.id,
		'{fecha}': formatOrderDate(order.createdAt),
		'{total}': formatAmount(linesTotal + order.shippingFee),
		'{envio}': formatAmount(order.shippingFee),
		'{items}': String(order.items.length),
		'{unidades}': String(units)
	};
}
