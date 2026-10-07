import { describe, it, expect } from 'vitest';
import { lineKey, setLineAmounts, toOrderLines, type OrderLine } from '$lib/order-content';

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
});
