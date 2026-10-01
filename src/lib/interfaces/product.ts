export interface Product {
	id: string;
	name: string;
	price: number;
	stock: number;
	/**
	 * Sum of the variant stocks when the product has variants, or null when it
	 * has none — then `stock` itself is the sellable amount. Optional because
	 * only the admin product-list payload carries it.
	 */
	variantStockTotal?: number | null;
	createdAt?: Date | undefined;
}

export interface Img {
	id: string;
	url: string;
	productId: string;
}

export interface ProductComplete {
	product: Product;
	imgs: Img[];
}

export interface ProductPagination {
	products: ProductComplete[];
	totalPages: number;
	currentPage: number;
}
