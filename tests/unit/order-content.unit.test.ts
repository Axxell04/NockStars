import { describe, it, expect } from 'vitest';
import {
	lineKey,
	orderShipping,
	orderShippingInfo,
	setLineAmounts,
	setShippingWaived,
	toOrderLines,
	type OrderLine
} from '$lib/order-content';

// Legacy storage shape: PurchaseDetail[] (written by the old createOrder()).
const legacyContent = [
	{
		product: {
			product: { id: 'prod-1', name: 'Primer Diseno', price: 28.99, stock: 4 },
			imgs: [{ id: 'img-1', url: 'https://example.com/1.png', productId: 'prod-1' }]
		},
		amount: 2
	},
	{
		product: {
			product: { id: 'prod-2', name: 'Camisa Basica', price: 15, stock: 9 },
			imgs: []
		},
		amount: 1
	}
];

// Live storage shape: { items: [...] } (written by checkoutCart()).
const liveContent = {
	items: [
		{
			productId: 'prod-1',
			variantId: null,
			productNameSnapshot: 'Primer Diseno',
			variantSizeSnapshot: null,
			variantColorSnapshot: null,
			variantCutSnapshot: null,
			unitPriceSnapshot: 28.99,
			quantity: 2
		},
		{
			productId: 'prod-2',
			variantId: 'var-9',
			productNameSnapshot: 'Camisa Basica',
			variantSizeSnapshot: 'M',
			variantColorSnapshot: 'Rojo',
			variantCutSnapshot: 'recto',
			unitPriceSnapshot: 15,
			quantity: 1
		}
	]
};

describe('toOrderLines', () => {
	it('reads the legacy PurchaseDetail[] shape', () => {
		expect(toOrderLines(legacyContent)).toEqual([
			{
				productId: 'prod-1',
				variantId: null,
				name: 'Primer Diseno',
				amount: 2,
				unitPrice: 28.99,
				size: null,
				color: null,
				cut: null,
				imageUrls: null
			},
			{
				productId: 'prod-2',
				variantId: null,
				name: 'Camisa Basica',
				amount: 1,
				unitPrice: 15,
				size: null,
				color: null,
				cut: null,
				imageUrls: null
			}
		]);
	});

	it('reads the live { items } shape from its snapshot fields', () => {
		expect(toOrderLines(liveContent)).toEqual([
			{
				productId: 'prod-1',
				variantId: null,
				name: 'Primer Diseno',
				amount: 2,
				unitPrice: 28.99,
				size: null,
				color: null,
				cut: null,
				imageUrls: null
			},
			{
				productId: 'prod-2',
				variantId: 'var-9',
				name: 'Camisa Basica',
				amount: 1,
				unitPrice: 15,
				size: 'M',
				color: 'Rojo',
				cut: 'recto',
				imageUrls: null
			}
		]);
	});

	it('parses a JSON string containing either shape', () => {
		expect(toOrderLines(JSON.stringify(liveContent))).toEqual(toOrderLines(liveContent));
		expect(toOrderLines(JSON.stringify(legacyContent))).toEqual(toOrderLines(legacyContent));
	});

	it('never throws on hostile or odd input and yields an empty list', () => {
		const hostile: unknown[] = [
			null,
			undefined,
			42,
			'not json',
			{},
			'true',
			[1, 2, 3],
			{ items: 'nope' },
			{ items: [null, undefined, 'nonsense'] }
		];

		for (const input of hostile) {
			expect(() => toOrderLines(input)).not.toThrow();
			expect(toOrderLines(input)).toEqual([]);
		}
	});

	it('coerces defensively instead of throwing on partially malformed entries', () => {
		expect(toOrderLines({ items: [null, { productId: 'prod-1' }] })).toEqual([
			{
				productId: 'prod-1',
				variantId: null,
				name: '',
				amount: 0,
				unitPrice: 0,
				size: null,
				color: null,
				cut: null,
				imageUrls: null
			}
		]);
	});

	it('reads a snapshotted imageUrls list from live items', () => {
		const content = {
			items: [
				{
					productId: 'prod-1',
					variantId: null,
					productNameSnapshot: 'Primer Diseno',
					unitPriceSnapshot: 28.99,
					quantity: 2,
					imageUrls: ['https://example.com/1.png']
				}
			]
		};

		expect(toOrderLines(content)[0].imageUrls).toEqual(['https://example.com/1.png']);
	});

	it('keys lines by product + variant, so one product in two variants stays independent', () => {
		expect(lineKey({ productId: 'prod-1' })).toBe('prod-1::');
		expect(lineKey({ productId: 'prod-1', variantId: null })).toBe('prod-1::');
		expect(lineKey({ productId: 'prod-1', variantId: 'var-9' })).toBe('prod-1::var-9');

		const twoVariants = {
			items: [
				{
					productId: 'prod-1',
					variantId: 'var-a',
					productNameSnapshot: 'Camisa',
					variantSizeSnapshot: 'M',
					variantColorSnapshot: 'Rojo',
					variantCutSnapshot: 'recto',
					unitPriceSnapshot: 15,
					quantity: 2
				},
				{
					productId: 'prod-1',
					variantId: 'var-b',
					productNameSnapshot: 'Camisa',
					variantSizeSnapshot: 'L',
					variantColorSnapshot: 'Azul',
					variantCutSnapshot: 'oversize',
					unitPriceSnapshot: 15,
					quantity: 1
				}
			]
		};

		const updated = setLineAmounts(twoVariants, [
			{ productId: 'prod-1', variantId: 'var-a', amount: 5 }
		]) as typeof twoVariants;

		expect(updated.items[0].quantity).toBe(5);
		expect(updated.items[1].quantity).toBe(1);
		expect(toOrderLines(updated).map((line) => line.amount)).toEqual([5, 1]);
	});
});

describe('setLineAmounts', () => {
	it('returns a new { items } reference, keeps the shape, and updates only matching quantities', () => {
		const updated = setLineAmounts(liveContent, [
			{ productId: 'prod-1', amount: 5 },
			{ productId: 'prod-absent', amount: 3 }
		]) as typeof liveContent;

		expect(updated).not.toBe(liveContent);
		expect(updated).toHaveProperty('items');
		expect(updated.items[0].quantity).toBe(5);
		expect(updated.items[1].quantity).toBe(1);
		expect(updated.items[1]).toBe(liveContent.items[1]);
	});

	it('returns a new legacy array with updated amounts', () => {
		const updated = setLineAmounts(legacyContent, [
			{ productId: 'prod-1', amount: 7 }
		]) as typeof legacyContent;

		expect(updated).not.toBe(legacyContent);
		expect(updated[0].amount).toBe(7);
		expect(updated[0].product.product.name).toBe('Primer Diseno');
		expect(updated[1].amount).toBe(1);
	});

	it('round-trips through toOrderLines with the new amounts', () => {
		const liveUpdated = setLineAmounts(liveContent, [
			{ productId: 'prod-1', amount: 5 },
			{ productId: 'prod-2', variantId: 'var-9', amount: 0 }
		]);
		const legacyUpdated = setLineAmounts(legacyContent, [{ productId: 'prod-2', amount: 4 }]);

		const liveLines: OrderLine[] = toOrderLines(liveUpdated);
		const legacyLines: OrderLine[] = toOrderLines(legacyUpdated);

		expect(liveLines.map((line) => line.amount)).toEqual([5, 0]);
		expect(legacyLines.map((line) => line.amount)).toEqual([2, 4]);
	});

	it('returns unknown or unparseable content unchanged', () => {
		const unparseable = 'not json';
		const unknownShape = { something: 'else' };

		expect(setLineAmounts(unparseable, [{ productId: 'prod-1', amount: 5 }])).toBe(unparseable);
		expect(setLineAmounts(unknownShape, [{ productId: 'prod-1', amount: 5 }])).toBe(unknownShape);
		expect(setLineAmounts(null, [{ productId: 'prod-1', amount: 5 }])).toBe(null);
	});

	it('spreads the shipping key through so the fee survives an admin edit', () => {
		const content = { ...liveContent, shipping: { city: null, fee: 6 } };
		const updated = setLineAmounts(content, [{ productId: 'prod-1', amount: 3 }]);

		expect(orderShipping(updated)).toBe(6);
	});
});

describe('orderShipping', () => {
	it('reads the fee recorded on a live order', () => {
		expect(orderShipping({ ...liveContent, shipping: { city: 'Quito', fee: 6 } })).toBe(6);
	});

	it('returns 0 for orders without a shipping record', () => {
		expect(orderShipping(liveContent)).toBe(0);
		expect(orderShipping(legacyContent)).toBe(0);
		expect(orderShipping(null)).toBe(0);
		expect(orderShipping(undefined)).toBe(0);
		expect(orderShipping(42)).toBe(0);
	});

	it('treats a malformed shipping record as 0', () => {
		expect(orderShipping({ items: [], shipping: 'yes' })).toBe(0);
		expect(orderShipping({ items: [], shipping: { fee: 'six' } })).toBe(0);
		expect(orderShipping({ items: [], shipping: { fee: '6' } })).toBe(6);
		expect(orderShipping('not json')).toBe(0);
	});

	it('parses a JSON-stringified content blob', () => {
		expect(orderShipping(JSON.stringify({ items: [], shipping: { fee: 6 } }))).toBe(6);
	});

	it('drops the fee to 0 once an admin waived it', () => {
		expect(orderShipping({ ...liveContent, shipping: { fee: 6, waived: true } })).toBe(0);
		expect(orderShipping(JSON.stringify({ items: [], shipping: { fee: 6, waived: true } }))).toBe(
			0
		);
	});

	it('keeps charging a fee whose waived flag is anything but true', () => {
		expect(orderShipping({ items: [], shipping: { fee: 6, waived: false } })).toBe(6);
		expect(orderShipping({ items: [], shipping: { fee: 6, waived: 'yes' } })).toBe(6);
		expect(orderShipping({ items: [], shipping: { fee: 6 } })).toBe(6);
	});
});

describe('orderShippingInfo', () => {
	it('reports the recorded fee and the waiver flag', () => {
		expect(orderShippingInfo({ items: [], shipping: { fee: 6 } })).toEqual({
			fee: 6,
			waived: false
		});
		expect(orderShippingInfo({ items: [], shipping: { fee: 6, waived: true } })).toEqual({
			fee: 6,
			waived: true
		});
	});

	it('still exposes the original fee once waived, for the admin restore UI', () => {
		const info = orderShippingInfo({ ...liveContent, shipping: { fee: 6, waived: true } });

		expect(info.fee).toBe(6);
		expect(info.waived).toBe(true);
	});

	it('reads missing or malformed records as { fee: 0, waived: false }', () => {
		expect(orderShippingInfo(liveContent)).toEqual({ fee: 0, waived: false });
		expect(orderShippingInfo(legacyContent)).toEqual({ fee: 0, waived: false });
		expect(orderShippingInfo(null)).toEqual({ fee: 0, waived: false });
		expect(orderShippingInfo(42)).toEqual({ fee: 0, waived: false });
		expect(orderShippingInfo({ items: [], shipping: 'yes' })).toEqual({ fee: 0, waived: false });
		expect(orderShippingInfo('not json')).toEqual({ fee: 0, waived: false });
	});
});

describe('setShippingWaived', () => {
	it('flips the flag while preserving items and the original fee', () => {
		const content = { ...liveContent, shipping: { fee: 6 } };
		const waived = setShippingWaived(content, true) as typeof content;

		expect(waived.shipping).toEqual({ fee: 6, waived: true });
		expect(waived.items).toEqual(content.items);

		const restored = setShippingWaived(waived, false) as typeof waived;
		expect(restored.shipping).toEqual({ fee: 6, waived: false });
	});

	it('returns a NEW reference so the OrderCard edit effect detects it', () => {
		const content = { ...liveContent, shipping: { fee: 6 } };

		expect(setShippingWaived(content, true)).not.toBe(content);
	});

	it('keeps any extra keys on the shipping record (e.g. legacy city)', () => {
		const content = { ...liveContent, shipping: { city: 'Quito', fee: 6 } };

		expect(setShippingWaived(content, true)).toEqual({
			...content,
			shipping: { city: 'Quito', fee: 6, waived: true }
		});
	});

	it('parses a JSON-stringified content blob into the live shape', () => {
		const next = setShippingWaived(JSON.stringify({ items: [], shipping: { fee: 6 } }), true);

		expect(next).toEqual({ items: [], shipping: { fee: 6, waived: true } });
	});

	it('returns unrecognizable shapes unchanged', () => {
		const unparseable = 'not json';
		const unknownShape = { something: 'else' };

		expect(setShippingWaived(unparseable, true)).toBe(unparseable);
		expect(setShippingWaived(unknownShape, true)).toBe(unknownShape);
		expect(setShippingWaived(null, true)).toBe(null);
		expect(setShippingWaived(legacyContent, true)).toBe(legacyContent);
	});
});
