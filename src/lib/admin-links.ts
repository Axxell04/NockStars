/**
 * Deep link into the Variantes tab of the admin catalogue for a product.
 * Built in one place so every "Gestionar variantes" entry point lands on
 * the same URL the catalogo page resolves from its query string.
 */
export function variantManagerUrl(productId: string): string {
	return `/admin/catalogo?productId=${encodeURIComponent(productId)}&tab=variantes`;
}
