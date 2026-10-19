/**
 * Adapters between the two storage shapes `order.content` has had and the flat
 * view model the admin UI renders.
 *
 * Storage shapes:
 * - Legacy: `PurchaseDetail[]`, written by `createOrder()` (now dead code).
 *   Element shape: `{ product: { product: { id, name, price }, imgs }, amount }`.
 * - Live: `{ items: [...] }`, written by `checkoutCart()` since 456ae47.
 *   Item shape: `{ productId, variantId, productNameSnapshot,
 *   variantSizeSnapshot, variantColorSnapshot, variantCutSnapshot,
 *   unitPriceSnapshot, quantity }` plus an optional `imageUrls` snapshot
 *   written when the product is deactivated or deleted.
 * - Live orders may also carry `shipping: { fee, waived?, city? }`: the flat
 *   fee charged at checkout, whether an admin waived it afterwards, and — in
 *   rows written before the exempt-city model was removed — the destination
 *   city, which nothing reads anymore. Legacy orders have no such key:
 *   `orderShipping()` reads them as 0.
 *
 * Lines are identified by product + variant, not by product alone: one order
 * can hold the same product in two variants, and matching by `productId`
 * would edit both. `lineKey()` is the single identity function for this.
 *
 * `content` stays in its own shape forever; translation happens explicitly in
 * both directions here. Normalizing the live shape into legacy entries on read
 * would fabricate data (e.g. `stock: 0`) and make admin edits rewrite `content`
 * into a different shape.
 *
 * Every function in this module is total: no input can make one throw, so a
 * malformed row can never 500 `/admin/finanzas?tab=pedidos` again.
 */

export interface OrderLine {
	productId: string;
	variantId: string | null;
	name: string;
	amount: number;
	unitPrice: number;
	size: string | null;
	color: string | null;
	cut: string | null;
	/**
	 * Display image URLs snapshotted at deactivation/deletion time. Null until
	 * then: live lookups serve the images while the product exists, and this
	 * array is what the display falls back to once the product row and its
	 * assets are gone.
	 */
	imageUrls: string[] | null;
}

/** Identity of a line: product + variant. Legacy lines carry `variantId: null`. */
export function lineKey(line: { productId: string; variantId?: string | null }): string {
	return `${line.productId}::${line.variantId ?? ''}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toText(value: unknown): string {
	if (typeof value === 'string') return value;
	if (value === null || value === undefined) return '';
	return String(value);
}

function toNumber(value: unknown): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function textOrNull(value: unknown): string | null {
	const text = toText(value);
	return text === '' ? null : text;
}

/** Parses a snapshotted image URL list; anything else becomes null. */
function imageUrlsOrNull(value: unknown): string[] | null {
	if (!Array.isArray(value)) return null;
	const urls = value.filter((entry): entry is string => typeof entry === 'string' && entry !== '');
	return urls.length > 0 ? urls : null;
}

/** Parses a JSON string (recursively, one level at a time); anything else passes through. */
function parseJsonStrings(content: unknown): unknown {
	if (typeof content !== 'string') return content;
	try {
		return parseJsonStrings(JSON.parse(content));
	} catch {
		return undefined;
	}
}

/** Maps one legacy `PurchaseDetail` entry, or `undefined` when it is malformed. */
function legacyEntryToLine(entry: unknown): OrderLine | undefined {
	if (!isRecord(entry)) return undefined;
	const productComplete = entry.product;
	if (!isRecord(productComplete)) return undefined;
	const product = productComplete.product;
	if (!isRecord(product)) return undefined;
	const productId = toText(product.id);
	if (productId === '') return undefined;
	return {
		productId,
		variantId: null,
		name: toText(product.name),
		amount: toNumber(entry.amount),
		unitPrice: toNumber(product.price),
		size: null,
		color: null,
		cut: null,
		imageUrls: null
	};
}

/** Maps one live `items` entry, or `undefined` when it is malformed. */
function itemToLine(item: unknown): OrderLine | undefined {
	if (!isRecord(item)) return undefined;
	const productId = toText(item.productId);
	if (productId === '') return undefined;
	return {
		productId,
		variantId: textOrNull(item.variantId),
		name: toText(item.productNameSnapshot),
		amount: toNumber(item.quantity),
		unitPrice: toNumber(item.unitPriceSnapshot),
		size: textOrNull(item.variantSizeSnapshot),
		color: textOrNull(item.variantColorSnapshot),
		cut: textOrNull(item.variantCutSnapshot),
		imageUrls: imageUrlsOrNull(item.imageUrls)
	};
}

/** Reads either storage shape into the flat view model the admin UI renders. */
export function toOrderLines(content: unknown): OrderLine[] {
	const normalized = parseJsonStrings(content);

	if (Array.isArray(normalized)) {
		const lines: OrderLine[] = [];
		for (const entry of normalized) {
			const line = legacyEntryToLine(entry);
			if (line) lines.push(line);
		}
		return lines;
	}

	if (isRecord(normalized) && Array.isArray(normalized.items)) {
		const lines: OrderLine[] = [];
		for (const item of normalized.items) {
			const line = itemToLine(item);
			if (line) lines.push(line);
		}
		return lines;
	}

	return [];
}

/**
 * Reads the raw `shipping` record: the fee recorded at checkout and whether an
 * admin waived it. Anything malformed reads as `{ fee: 0, waived: false }`.
 */
export function orderShippingInfo(content: unknown): { fee: number; waived: boolean } {
	if (typeof content === 'string') {
		let parsed: unknown;
		try {
			parsed = JSON.parse(content);
		} catch {
			return { fee: 0, waived: false };
		}
		return orderShippingInfo(parsed);
	}

	if (!isRecord(content)) return { fee: 0, waived: false };
	const shipping = content.shipping;
	if (!isRecord(shipping)) return { fee: 0, waived: false };
	return { fee: toNumber(shipping.fee), waived: shipping.waived === true };
}

/**
 * Shipping fee actually charged for the order: 0 once an admin waived it, the
 * recorded fee otherwise, and 0 for orders without a shipping record (legacy
 * shape, or a fee of 0). Total like the rest of this module: no input can make
 * it throw.
 */
export function orderShipping(content: unknown): number {
	const info = orderShippingInfo(content);
	return info.waived ? 0 : info.fee;
}

/**
 * Lines subtotal from the enriched `order.items` rows returned by
 * `getOrderWithItems()`: unit price × quantity, summed.
 *
 * This is the arithmetic the storefront header and total block both display, and
 * the same arithmetic `{total}` renders from the status-message template. One
 * function so the number a client reads and the number a template prints cannot
 * drift apart. Malformed rows read as 0 rather than NaN, matching the rest of
 * this module.
 */
export function orderLinesTotal(
	items: { unitPriceSnapshot: unknown; quantity: unknown }[]
): number {
	return items.reduce(
		(acc, item) => acc + toNumber(item.unitPriceSnapshot) * toNumber(item.quantity),
		0
	);
}

/**
 * Locale/date options for every date shown on the client-facing order page,
 * shared by the order header and by the `{fecha}` template placeholder so the
 * two always agree. Admin surfaces use their own format and are unaffected.
 */
export const ORDER_DATE_FORMAT: Intl.DateTimeFormatOptions = {
	year: 'numeric',
	month: 'long',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit'
};

export const ORDER_DATE_LOCALE = 'es-ES';

/** Formats an order timestamp for a client-facing surface. */
export function formatOrderDate(date: Date): string {
	return date.toLocaleDateString(ORDER_DATE_LOCALE, ORDER_DATE_FORMAT);
}

/**
 * Returns a NEW content value with `shipping.waived` set to `waived`, keeping
 * every other key (items, the original fee, snapshots) intact so the waiver is
 * reversible and auditable. Unrecognized shapes (legacy arrays, malformed
 * JSON, orders without a shipping record) come back unchanged — the caller
 * decides what a no-op means. String input parses into the live object shape,
 * the same direction `setLineAmounts()` writes.
 */
export function setShippingWaived(content: unknown, waived: boolean): unknown {
	if (typeof content === 'string') {
		let parsed: unknown;
		try {
			parsed = JSON.parse(content);
		} catch {
			return content;
		}
		return setShippingWaived(parsed, waived);
	}

	if (isRecord(content) && isRecord(content.shipping)) {
		return { ...content, shipping: { ...content.shipping, waived } };
	}

	return content;
}

/**
 * Applies new amounts back into `content`, PRESERVING its original shape.
 *
 * When the shape is recognized the return value is always a NEW object/array
 * reference: the auto-submit `$effect` in OrderCard detects edits by reference
 * identity (`previous !== current`), so returning the given reference would
 * silently break the edit flow. Unrecognized shapes are returned unchanged.
 */
export function setLineAmounts(
	content: unknown,
	lines: { productId: string; variantId?: string | null; amount: number }[]
): unknown {
	const amounts = new Map<string, number>();
	if (Array.isArray(lines)) {
		for (const line of lines) {
			if (line && typeof line.productId === 'string') {
				amounts.set(lineKey(line), toNumber(line.amount));
			}
		}
	}

	if (typeof content === 'string') {
		let parsed: unknown;
		try {
			parsed = JSON.parse(content);
		} catch {
			return content;
		}
		return setLineAmounts(parsed, lines);
	}

	if (Array.isArray(content)) {
		return content.map((entry) => {
			const line = legacyEntryToLine(entry);
			if (!line || !amounts.has(lineKey(line))) return entry;
			return { ...entry, amount: amounts.get(lineKey(line)) };
		});
	}

	if (isRecord(content) && Array.isArray(content.items)) {
		const items = content.items.map((item) => {
			if (!isRecord(item)) return item;
			const productId = toText(item.productId);
			if (productId === '') return item;
			const key = lineKey({ productId, variantId: textOrNull(item.variantId) });
			if (!amounts.has(key)) return item;
			return { ...item, quantity: amounts.get(key) ?? item.quantity };
		});
		return { ...content, items };
	}

	return content;
}
