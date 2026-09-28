import { dev } from '$app/environment';
import type { Product, ProductVariant } from '$lib/server/db/schema';
import type { VariantComplete } from '$lib/actions';
import { specEntries } from '$lib/product-specs';

/**
 * Renders a schema.org payload as a complete `<script type="application/ld+json">`
 * element, safe to inject with `{@html}`.
 *
 * ## Why this is not just `JSON.stringify`
 *
 * Svelte's text interpolation escapes `&` and `<`, which corrupts JSON, so
 * structured data has to reach the document as raw markup. Every `{@html}` is
 * therefore a place where escaping becomes the author's job, and for JSON-LD
 * that job is unforgiving: one `<` reaching the output can close the `<script>`
 * element early and turn the rest of the payload into live markup.
 *
 * `JSON.stringify` escapes for JSON, not for HTML. It leaves `<` and `/`
 * untouched, so a value carrying `</script>` serializes with the closing tag
 * intact and breaks straight out of the element.
 *
 * ## The invariant
 *
 * `<` is replaced with `\u003c`, its JSON escape. The payload stays valid
 * JSON-LD — `JSON.parse` and Google's parser both resolve it to the same
 * character — while the HTML parser can no longer see a tag boundary. It is the
 * only character that needs handling: every tag, and therefore every
 * `</script>`, starts with `<`.
 *
 * Route new structured data through this function instead of building the
 * string at the call site, so the escaping has exactly one implementation to
 * audit.
 */
export function renderJsonLdScript(data: unknown): string {
	const json = JSON.stringify(data);

	if (dev && json.includes('<')) {
		console.warn(
			'renderJsonLdScript: the payload contained a raw `<` before escaping. It is ' +
				'escaped, so it cannot inject markup, but structured data is not the place ' +
				'for user input. Check where this value comes from.'
		);
	}

	return `<script type="application/ld+json">${json.replace(/</g, '\\u003c')}</script>`;
}

export interface ProductJsonLdInput {
	product: Product;
	variant: (ProductVariant & { images?: { url: string; alt: string }[] }) | null;
	baseUrl: string;
}

export interface ProductWithVariantsJsonLdInput {
	product: Product;
	variants: VariantComplete[];
	selectedVariant: VariantComplete | null;
	baseUrl: string;
}

/**
 * Builds a schema.org Product JSON-LD object for a product detail page with variant offers.
 * Uses the selected variant for price, availability, and description in the main product,
 * and includes all variants as separate offers.
 */
export function buildProductWithVariantsJsonLd(input: ProductWithVariantsJsonLdInput): object {
	const { product, variants, selectedVariant, baseUrl } = input;

	// Use selected variant images if available. Product-level images are not
	// available to this builder (its input carries no `productImages`), so a
	// variant with no images yields no `image` key rather than an empty one.
	const selectedVariantImages = selectedVariant?.images?.map((img) => `${baseUrl}${img.url}`) ?? [];

	const mainDescription = selectedVariant?.description ?? product.description ?? product.name;

	// The "ficha técnica" attributes, as schema.org PropertyValue pairs. Reusing
	// `specEntries` keeps the labels and the ordering identical to the sheet the
	// visitor actually sees.
	const specProperties = specEntries(product.specs).map((entry) => ({
		'@type': 'PropertyValue',
		name: entry.label,
		value: entry.value
	}));

	// Build offers array - one per variant plus implicit if no explicit variants
	const offers = variants.map((variant) => {
		const variantPrice =
			variant.priceOverride !== null && variant.priceOverride !== undefined
				? Number(variant.priceOverride)
				: product.price;

		const variantStock = variant.stock;

		const variantAvailability =
			variantStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';

		return {
			'@type': 'Offer',
			url: `${baseUrl}/producto/${product.id}?variant=${variant.id}`,
			priceCurrency: 'USD',
			price: variantPrice.toFixed(2),
			availability: variantAvailability,
			sku: variant.id,
			name: `${variant.size} / ${variant.color} / ${variant.cut}`
		};
	});

	// If no explicit variants, include the implicit variant as a single offer
	if (variants.length === 0) {
		const implicitPrice = product.price;
		const implicitStock = product.stock;
		const implicitAvailability =
			implicitStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';

		offers.push({
			'@type': 'Offer',
			url: `${baseUrl}/producto/${product.id}`,
			priceCurrency: 'USD',
			price: implicitPrice.toFixed(2),
			availability: implicitAvailability,
			sku: product.id,
			name: 'Único'
		});
	}

	return {
		'@context': 'https://schema.org',
		'@type': 'Product',
		name: product.name,
		description: mainDescription,
		image: selectedVariantImages.length > 0 ? selectedVariantImages : undefined,
		additionalProperty: specProperties.length > 0 ? specProperties : undefined,
		offers,
		sku: selectedVariant?.id && selectedVariant.id !== 'implicit' ? selectedVariant.id : product.id
	};
}

/**
 * Builds a schema.org Product JSON-LD object for a product detail page (legacy single-variant version).
 * Uses the selected variant for price, availability, and description.
 */
export function buildProductJsonLd(input: ProductJsonLdInput): object {
	const { product, variant, baseUrl } = input;

	// Use variant images if available, otherwise fall back to product images
	// Note: product images would need to be passed separately if variant has none
	const images = variant?.images?.map((img) => `${baseUrl}${img.url}`) ?? [];

	const price =
		variant?.priceOverride !== null && variant?.priceOverride !== undefined
			? Number(variant.priceOverride)
			: product.price;

	const stock = variant?.id !== 'implicit' && variant !== null ? variant.stock : product.stock;

	const availability = stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';

	const description = variant?.description ?? product.name;

	return {
		'@context': 'https://schema.org',
		'@type': 'Product',
		name: product.name,
		description,
		image: images.length > 0 ? images : undefined,
		offers: {
			'@type': 'Offer',
			url: `${baseUrl}/producto/${product.id}${variant?.id && variant.id !== 'implicit' ? `?variant=${variant.id}` : ''}`,
			priceCurrency: 'USD',
			price: price.toFixed(2),
			availability
		},
		sku: variant?.id && variant.id !== 'implicit' ? variant.id : product.id
	};
}

/**
 * Renders a complete Product JSON-LD script tag for a product detail page with variant offers.
 */
export function renderProductWithVariantsJsonLd(input: ProductWithVariantsJsonLdInput): string {
	return renderJsonLdScript(buildProductWithVariantsJsonLd(input));
}

/**
 * Renders a complete Product JSON-LD script tag for a product detail page (legacy single-variant version).
 */
export function renderProductJsonLd(input: ProductJsonLdInput): string {
	return renderJsonLdScript(buildProductJsonLd(input));
}
