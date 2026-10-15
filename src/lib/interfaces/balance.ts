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
}

/**
 * Result of mutating a money row. `reason: 'order_linked'` means the
 * operation was refused because the row backs a completed order
 * (`order.revenueId` FK) — previously a silent no-op.
 */
export interface BalanceMutationResult {
	success: boolean;
	reason?: 'order_linked';
}
