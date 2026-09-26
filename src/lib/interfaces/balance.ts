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
