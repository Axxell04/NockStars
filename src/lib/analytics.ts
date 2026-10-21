/**
 * GA4 event helpers — thin wrapper around window.gtag.
 * All events follow GA4 recommended ecommerce parameter names.
 * Safe to call during SSR (guarded by `browser` check).
 */

import { browser } from '$app/environment';

function gtag(...args: unknown[]) {
	if (!browser) return;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(window as any).gtag?.(...args);
}

/** Push a raw event (for non-standard events) */
export function trackEvent(eventName: string, params: Record<string, unknown> = {}) {
	gtag('event', eventName, params);
}

/** view_item_list — fired when a product grid renders */
export function trackViewItemList(params: {
	item_list_name: string;
	items: Array<{
		item_id: string;
		item_name: string;
		price: number;
		item_category?: string;
		item_variant?: string;
		quantity?: number;
	}>;
}) {
	trackEvent('view_item_list', {
		item_list_name: params.item_list_name,
		items: params.items.map((i) => ({
			item_id: i.item_id,
			item_name: i.item_name,
			price: i.price,
			item_category: i.item_category,
			item_variant: i.item_variant,
			quantity: i.quantity ?? 1,
			currency: 'ARS'
		}))
	});
}

/** select_item — fired when user clicks a product card */
export function trackSelectItem(params: {
	item_list_name: string;
	item_id: string;
	item_name: string;
	price: number;
	item_category?: string;
	item_variant?: string;
}) {
	trackEvent('select_item', {
		item_list_name: params.item_list_name,
		items: [
			{
				item_id: params.item_id,
				item_name: params.item_name,
				price: params.price,
				item_category: params.item_category,
				item_variant: params.item_variant,
				quantity: 1,
				currency: 'ARS'
			}
		]
	});
}

/** view_item — fired on product detail page load */
export function trackViewItem(params: {
	item_id: string;
	item_name: string;
	price: number;
	item_category?: string;
	item_variant?: string;
	currency?: string;
}) {
	trackEvent('view_item', {
		currency: params.currency ?? 'ARS',
		value: params.price,
		items: [
			{
				item_id: params.item_id,
				item_name: params.item_name,
				price: params.price,
				item_category: params.item_category,
				item_variant: params.item_variant,
				quantity: 1
			}
		]
	});
}
