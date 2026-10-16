import type { BalanceSortKey } from '$lib/interfaces/balance';
import { currentPresetBounds, rangeInstants, resolveRange } from '$lib/server/balance-range';

/**
 * Shared paging/filter/sort contract for the three money lists (revenues,
 * costs, expenses).
 *
 * Page size lives here — not as a per-table default — so unifying it is a
 * one-line change and the three lists cannot drift apart again.
 */
export const BALANCE_PAGE_SIZE = 10;

/** Longest search query the list endpoints accept; longer input is truncated. */
const MAX_QUERY_LENGTH = 100;

export const DEFAULT_BALANCE_SORT: BalanceSortKey = 'date_desc';

/**
 * Whitelist of accepted sort keys. Sort values come from form data, so they
 * are mapped to a fixed column set here and never interpolated into SQL —
 * anything unknown falls back to the default.
 */
const SORT_WHITELIST: readonly BalanceSortKey[] = [
	'date_desc',
	'date_asc',
	'value_desc',
	'value_asc',
	'reason_asc'
];

export function resolveBalanceSort(value: unknown): BalanceSortKey {
	return SORT_WHITELIST.includes(value as BalanceSortKey)
		? (value as BalanceSortKey)
		: DEFAULT_BALANCE_SORT;
}

export interface BalanceListParams {
	/** Case-insensitive substring filter on `reason`; '' means no filter. */
	q: string;
	sort: BalanceSortKey;
}

/**
 * Reads the `q`/`sort` pair every management action threads through its form
 * data. Missing fields yield the defaults, which keeps all action contracts
 * backward-compatible with clients that do not send them yet.
 */
export function readBalanceListParams(formData: FormData): BalanceListParams {
	const rawQuery = formData.get('q');
	const q = typeof rawQuery === 'string' ? rawQuery.trim().slice(0, MAX_QUERY_LENGTH) : '';
	return { q, sort: resolveBalanceSort(formData.get('sort')) };
}

/**
 * Half-open instant bounds for the money-list queries: rows match when
 * `createdAt >= from AND createdAt < to`, composed with the `q` ilike filter
 * in the row query and the COUNT alike.
 */
export interface BalanceRangeFilter {
	/** Inclusive start instant. */
	from: Date;
	/** Exclusive end instant. */
	to: Date;
}

/**
 * Reads the `from`/`to` pair (inclusive 'YYYY-MM-DD' labels) every list action
 * threads through its form data. HTML form actions replace the page's query
 * string on submit, so `event.url.searchParams` does NOT carry the dashboard
 * range — it rides hidden inputs, exactly like `q`/`sort`.
 *
 * Validation reuses `resolveRange`, the dashboard's own resolver, so the
 * fail-safe is identical: missing, malformed, inverted or oversized values all
 * fall back to the current month to date. The returned bounds are the
 * half-open instants of that resolved range.
 */
export function readBalanceRange(formData: FormData): BalanceRangeFilter {
	const params = new URLSearchParams();
	for (const name of ['from', 'to'] as const) {
		const value = formData.get(name);
		if (typeof value === 'string') {
			params.set(name, value);
		}
	}
	return rangeInstants(resolveRange(params, currentPresetBounds()));
}
