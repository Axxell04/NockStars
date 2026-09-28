import { describe, it, expect } from 'vitest';
import {
	MAX_SPEC_KEY_LENGTH,
	MAX_SPEC_ROWS,
	MAX_SPEC_VALUE_LENGTH,
	SPEC_LABELS,
	humanizeSpecKey,
	normalizeSpecs,
	parseSpecRows,
	specEntries,
	slugifySpecKey,
	toSpecRows,
	type ProductSpecs
} from '$lib/product-specs';

describe('slugifySpecKey', () => {
	it('lowercases and strips accents', () => {
		expect(slugifySpecKey('Composición')).toBe('composicion');
		expect(slugifySpecKey('GÉNERO')).toBe('genero');
	});

	it('collapses non-alphanumerics into single underscores', () => {
		expect(slugifySpecKey('  Tela   de  Algodón  ')).toBe('tela_de_algodon');
		expect(slugifySpecKey('peso (aprox.)')).toBe('peso_aprox');
	});

	it('trims leading and trailing underscores', () => {
		expect(slugifySpecKey('---material---')).toBe('material');
	});

	it('returns an empty string for input with no alphanumerics', () => {
		expect(slugifySpecKey('!!!')).toBe('');
		expect(slugifySpecKey('   ')).toBe('');
	});

	it('caps the key length and never ends on an underscore', () => {
		const long = slugifySpecKey('a'.repeat(MAX_SPEC_KEY_LENGTH + 20));
		expect(long.length).toBeLessThanOrEqual(MAX_SPEC_KEY_LENGTH);
		expect(long.endsWith('_')).toBe(false);
	});
});

describe('normalizeSpecs', () => {
	it('slugs keys and trims values', () => {
		expect(
			normalizeSpecs([
				['Material', '  Algodón peinado  '],
				['Peso', '180 g']
			])
		).toEqual({ material: 'Algodón peinado', peso: '180 g' });
	});

	it('drops rows with an empty key or an empty value', () => {
		expect(
			normalizeSpecs([
				['material', 'Algodón'],
				['', 'valor huérfano'],
				['peso', '   ']
			])
		).toEqual({ material: 'Algodón' });
	});

	it('lets a later duplicate key overwrite an earlier one', () => {
		expect(
			normalizeSpecs([
				['Material', 'Algodón'],
				['material', 'Lino']
			])
		).toEqual({ material: 'Lino' });
	});

	it('returns an empty object for no rows', () => {
		expect(normalizeSpecs([])).toEqual({});
	});

	it('caps the value length', () => {
		const specs = normalizeSpecs([['nota', 'x'.repeat(MAX_SPEC_VALUE_LENGTH + 50)]]);
		expect(specs.nota?.length).toBe(MAX_SPEC_VALUE_LENGTH);
	});

	it('caps the number of accepted rows', () => {
		const rows: Array<[string, string]> = Array.from({ length: MAX_SPEC_ROWS + 10 }, (_, i) => [
			`attr${i}`,
			`value${i}`
		]);
		const specs = normalizeSpecs(rows);
		expect(Object.keys(specs)).toHaveLength(MAX_SPEC_ROWS);
		expect(specs.attr0).toBe('value0');
		expect(specs[`attr${MAX_SPEC_ROWS + 9}`]).toBeUndefined();
	});

	it('does not let a duplicate consume a second row slot', () => {
		const rows: Array<[string, string]> = Array.from({ length: MAX_SPEC_ROWS }, (_, i) => [
			`attr${i}`,
			`value${i}`
		]);
		rows.push(['attr0', 'otro valor']);
		const specs = normalizeSpecs(rows);
		expect(Object.keys(specs)).toHaveLength(MAX_SPEC_ROWS);
		expect(specs.attr0).toBe('otro valor');
	});
});

describe('humanizeSpecKey', () => {
	it('returns the declared label for a known key', () => {
		expect(humanizeSpecKey('material')).toBe('Material');
		expect(humanizeSpecKey('composicion')).toBe('Composición');
		expect(humanizeSpecKey('sku')).toBe('SKU');
	});

	it('humanizes an unknown key', () => {
		expect(humanizeSpecKey('tela_algodon')).toBe('Tela algodon');
	});

	it('falls back to the key itself when there is nothing to humanize', () => {
		expect(humanizeSpecKey('')).toBe('');
	});
});

describe('specEntries', () => {
	const specs: ProductSpecs = {
		referencia: 'NS-001',
		zapatilla: 'si',
		material: 'Algodón',
		composicion: '100% algodón',
		altura: '30 cm',
		en_blanco: '   '
	};

	it('returns [] for null, undefined and empty input', () => {
		expect(specEntries(null)).toEqual([]);
		expect(specEntries(undefined)).toEqual([]);
		expect(specEntries({})).toEqual([]);
	});

	it('puts known keys first in declared order, then the rest alphabetically', () => {
		expect(specEntries(specs).map((entry) => entry.key)).toEqual([
			'material',
			'composicion',
			'referencia',
			'altura',
			'zapatilla'
		]);
	});

	it('uses declared labels for known keys and humanized ones otherwise', () => {
		const entries = specEntries(specs);
		expect(entries.find((entry) => entry.key === 'composicion')?.label).toBe('Composición');
		expect(entries.find((entry) => entry.key === 'altura')?.label).toBe('Altura');
	});

	it('drops entries whose value is empty or whitespace only', () => {
		expect(specEntries(specs).some((entry) => entry.key === 'en_blanco')).toBe(false);
	});

	it('stringifies numeric values and drops non-scalar ones', () => {
		// A jsonb column can hold anything; the type says string, reality may not.
		const stored = {
			talla_numero: 42,
			metadata: { nested: true },
			etiquetas: [],
			vacio: null
		} as unknown as ProductSpecs;
		expect(specEntries(stored)).toEqual([
			{ key: 'talla_numero', label: 'Talla numero', value: '42' }
		]);
	});
});

describe('parseSpecRows', () => {
	it('reads repeated specKey/specValue fields positionally', () => {
		const formData = new FormData();
		formData.append('specKey', 'material');
		formData.append('specKey', 'peso');
		formData.append('specValue', 'Algodón');
		formData.append('specValue', '180 g');

		expect(parseSpecRows(formData)).toEqual([
			['material', 'Algodón'],
			['peso', '180 g']
		]);
	});

	it('returns positional rows for unbalanced fields instead of throwing', () => {
		const formData = new FormData();
		formData.append('specKey', 'material');
		formData.append('specKey', 'peso');

		expect(parseSpecRows(formData)).toEqual([
			['material', ''],
			['peso', '']
		]);
	});

	it('returns [] when the form carries no spec fields', () => {
		expect(parseSpecRows(new FormData())).toEqual([]);
	});

	it('never returns a File as a value', () => {
		const formData = new FormData();
		formData.append('specKey', 'material');
		formData.append('specValue', new File(['x'], 'not-a-value.txt'));

		expect(parseSpecRows(formData)).toEqual([['material', '']]);
	});

	it('round-trips through normalizeSpecs', () => {
		const formData = new FormData();
		formData.append('specKey', 'Material');
		formData.append('specValue', 'Algodón');
		formData.append('specKey', '');
		formData.append('specValue', 'huérfano');

		expect(normalizeSpecs(parseSpecRows(formData))).toEqual({ material: 'Algodón' });
	});
});

describe('toSpecRows', () => {
	it('returns editable rows in the storefront display order', () => {
		expect(toSpecRows({ peso: '180 g', material: 'Algodón' })).toEqual([
			{ key: 'material', value: 'Algodón' },
			{ key: 'peso', value: '180 g' }
		]);
	});

	it('returns [] for an empty sheet so the form starts with a blank row', () => {
		expect(toSpecRows({})).toEqual([]);
		expect(toSpecRows(null)).toEqual([]);
	});
});

describe('SPEC_LABELS', () => {
	it('declares the keys an admin is most likely to reach for', () => {
		expect(Object.keys(SPEC_LABELS)).toContain('material');
		expect(Object.keys(SPEC_LABELS)).toContain('composicion');
		expect(Object.keys(SPEC_LABELS)).toContain('cuidados');
	});

	it('declares only slug-shaped keys, so a typed label resolves back to one', () => {
		for (const key of Object.keys(SPEC_LABELS)) {
			expect(slugifySpecKey(key)).toBe(key);
		}
	});
});
