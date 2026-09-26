export interface Order {
	id: string;
	content: unknown;
	completed: boolean;
	clientName: string;
	createdAt: Date;
	revenueId?: string | null;
}

export interface OrderPagination {
	orders: Order[];
	totalPages: number;
	currentPage: number;
}
