export interface Product {
	id: string;
	name: string;
	price: number;
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
