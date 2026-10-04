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
 *   unitPriceSnapshot, quantity }`.
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
 * Both functions are total: no input can make them throw, so a malformed row
 * can never 500 `/admin/pedidos` again.
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
		cut: null
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
		cut: textOrNull(item.variantCutSnapshot)
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
