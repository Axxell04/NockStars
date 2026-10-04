import { describe, expect, it } from 'vitest';
import { variantManagerUrl } from '$lib/admin-links';

describe('variantManagerUrl', () => {
	it('points at the Variantes tab of the admin catalogue for the product', () => {
		expect(variantManagerUrl('abc123')).toBe('/admin/catalogo?productId=abc123&tab=variantes');
	});

	it('encodes ids that are not URL-safe', () => {
		expect(variantManagerUrl('a b&c=d')).toBe(
			'/admin/catalogo?productId=a%20b%26c%3Dd&tab=variantes'
		);
	});
});
