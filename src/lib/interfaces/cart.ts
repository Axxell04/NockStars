import type { ProductComplete } from './product';

export interface PurchaseDetail {
	product: ProductComplete;
	amount: number;
}
