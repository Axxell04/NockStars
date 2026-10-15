export interface BalanceDetail {
	id: string;
	value: number;
	reason?: string | null;
	createdAt: Date;
}

export interface BalanceDetailPagination {
	balanceDetails: BalanceDetail[];
	totalPages: number;
	currentPage: number;
	/**
	 * Rows matching the active filter (search included), not just the current
	 * page. Lets the UI distinguish an empty list from a search with no hits
	 * without an extra round-trip.
	 */
	totalItems: number;
}

/**
 * Accepted list sort keys. The server whitelists these before mapping them to
 * a fixed column set — never interpolate an unvalidated value from form data.
 */
export type BalanceSortKey = 'date_desc' | 'date_asc' | 'value_desc' | 'value_asc' | 'reason_asc';

/**
 * Result of mutating a money row. `reason: 'order_linked'` means the
 * operation was refused because the row backs a completed order
 * (`order.revenueId` FK) — previously a silent no-op.
 */
export interface BalanceMutationResult {
	success: boolean;
	reason?: 'order_linked';
}
