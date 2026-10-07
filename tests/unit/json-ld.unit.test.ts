import { describe, expect, it } from 'vitest';
import type { Product as DbProduct, ProductVariant } from '$lib/server/db/schema';
import { buildProductJsonLd, buildProductWithVariantsJsonLd } from '$lib/json-ld';

const BASE_URL = 'https://nockstars.example';
const CLOUDINARY_URL =
	'https://res.cloudinary.com/demo/image/upload/v1710000000/murci/products/shirt';

function makeProduct(): DbProduct {
	return {
		id: 'prod-1',
		name: 'Camisa',
		price: 1000,
		stock: 4,
		description: null,
		createdAt: new Date('2026-01-01T00:00:00Z')
	} as unknown as DbProduct;
}

function makeVariant(images?: { url: string; alt: string }[]) {
	return {
		id: 'var-1',
		productId: 'prod-1',
		size: 'M',
		color: 'Rojo',
		cut: 'recto',
		colorHex: '#f00',
		description: null,
		priceOverride: null,
		stock: 4,
		sortOrder: 0,
		deactivatedAt: null,
		images
	} as unknown as ProductVariant & { images?: { url: string; alt: string }[] };
}

describe('buildProductJsonLd image URLs', () => {
	it('does not prefix an already-absolute Cloudinary url with the site origin', () => {
		const jsonLd = buildProductJsonLd({
			product: makeProduct(),
			variant: makeVariant([{ url: CLOUDINARY_URL, alt: 'Camisa' }]),
			baseUrl: BASE_URL
		}) as { image?: string[] };

		expect(jsonLd.image).toEqual([CLOUDINARY_URL]);
		expect(jsonLd.image?.[0]).not.toContain(`${BASE_URL}https://`);
	});

	it('still prefixes a site-relative url, so legacy rows keep working', () => {
		const jsonLd = buildProductJsonLd({
			product: makeProduct(),
			variant: makeVariant([{ url: '/imgs/legacy.webp', alt: 'Camisa' }]),
			baseUrl: BASE_URL
		}) as { image?: string[] };

		expect(jsonLd.image).toEqual([`${BASE_URL}/imgs/legacy.webp`]);
	});
});

describe('buildProductWithVariantsJsonLd image URLs', () => {
	it('does not prefix an already-absolute Cloudinary url with the site origin', () => {
		const selected = makeVariant([{ url: CLOUDINARY_URL, alt: 'Camisa' }]) as never;
		const jsonLd = buildProductWithVariantsJsonLd({
			product: makeProduct(),
			variants: [],
			selectedVariant: selected,
			baseUrl: BASE_URL
		}) as { image?: string[] };

		expect(jsonLd.image).toEqual([CLOUDINARY_URL]);
		expect(jsonLd.image?.[0]).not.toContain(`${BASE_URL}https://`);
	});
});
