import { describe, it, expect } from 'vitest';
import {
	ORDER_STATUS_PLACEHOLDERS,
	buildOrderStatusValues,
	isTemplateConfigured,
	renderOrderStatusTemplate
} from '$lib/order-status-template';
import { formatOrderDate, orderLinesTotal } from '$lib/order-content';

const facts = {
	id: 'a1b2c3d4e5',
	clientName: 'María',
	completed: false,
	createdAt: new Date(Date.UTC(2026, 0, 15, 17, 30)),
	// 2 × 2500 and 1 × 1500: lines 2 and 3, but 3 units.
	items: [
		{ unitPriceSnapshot: 2500, quantity: 2 },
		{ unitPriceSnapshot: 1500, quantity: 1 }
	],
	shippingFee: 500
};

describe('renderOrderStatusTemplate', () => {
	it('substitutes every recognised placeholder', () => {
		const values = buildOrderStatusValues(facts);
		expect(renderOrderStatusTemplate('Hola {cliente}, total {total}.', values)).toBe(
			'Hola María, total 7000.00 $.'
		);
	});

	it('substitutes a repeated token everywhere it appears', () => {
		expect(
			renderOrderStatusTemplate('{cliente} y otra vez {cliente}', { '{cliente}': 'Ana' })
		).toBe('Ana y otra vez Ana');
	});

	it('keeps an unrecognised token verbatim so the typo stays visible', () => {
		expect(renderOrderStatusTemplate('Hola {clinte}', { '{cliente}': 'Ana' })).toBe(
			'Hola {clinte}'
		);
	});

	it('leaves non-placeholder braces alone', () => {
		expect(renderOrderStatusTemplate('valor {0} y {a1}', {})).toBe('valor {0} y {a1}');
	});

	it('renders an empty template as empty', () => {
		expect(renderOrderStatusTemplate('', buildOrderStatusValues(facts))).toBe('');
	});

	it('renders a present-but-empty value as empty rather than keeping the token', () => {
		expect(renderOrderStatusTemplate('Hola {cliente}', { '{cliente}': '' })).toBe('Hola ');
	});
});

describe('isTemplateConfigured', () => {
	it('treats an empty template as not configured', () => {
		expect(isTemplateConfigured('')).toBe(false);
	});

	it('treats a whitespace-only template as not configured', () => {
		expect(isTemplateConfigured('   \n\t')).toBe(false);
	});

	it('treats a template holding only an unconfigured placeholder as configured', () => {
		expect(isTemplateConfigured('{cliente}')).toBe(true);
	});
});

describe('buildOrderStatusValues', () => {
	it('reports Pendiente for an uncompleted order and Completado for a completed one', () => {
		expect(buildOrderStatusValues(facts)['{estado}']).toBe('Pendiente');
		expect(buildOrderStatusValues({ ...facts, completed: true })['{estado}']).toBe('Completado');
	});

	it('adds the shipping fee to the total', () => {
		// lines 2500×2 + 1500×1 = 6500, plus 500 shipping.
		expect(buildOrderStatusValues(facts)['{total}']).toBe('7000.00 $');
		expect(buildOrderStatusValues(facts)['{envio}']).toBe('500.00 $');
	});

	it('counts distinct lines as items but sums quantity as unidades', () => {
		const values = buildOrderStatusValues(facts);
		expect(values['{items}']).toBe('2');
		expect(values['{unidades}']).toBe('3');
	});

	it('passes through the order code and client name', () => {
		const values = buildOrderStatusValues(facts);
		expect(values['{codigo}']).toBe('a1b2c3d4e5');
		expect(values['{cliente}']).toBe('María');
	});

	it('formats the date with the same helper the order header uses', () => {
		expect(buildOrderStatusValues(facts)['{fecha}']).toBe(formatOrderDate(facts.createdAt));
	});

	it('handles an order with no lines and no shipping', () => {
		const values = buildOrderStatusValues({ ...facts, items: [], shippingFee: 0 });
		expect(values['{total}']).toBe('0.00 $');
		expect(values['{envio}']).toBe('0.00 $');
		expect(values['{items}']).toBe('0');
		expect(values['{unidades}']).toBe('0');
	});
});

describe('orderLinesTotal', () => {
	it('sums unit price times quantity', () => {
		expect(orderLinesTotal(facts.items)).toBe(6500);
	});

	it('reads malformed rows as 0 instead of NaN', () => {
		expect(orderLinesTotal([{ unitPriceSnapshot: 'garbage', quantity: null }])).toBe(0);
	});
});

describe('ORDER_STATUS_PLACEHOLDERS', () => {
	it('covers exactly the tokens the builder produces', () => {
		const built = Object.keys(buildOrderStatusValues(facts));
		expect([...ORDER_STATUS_PLACEHOLDERS].sort()).toEqual(built.sort());
	});
});
