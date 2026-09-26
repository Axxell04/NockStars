import type { ProductComplete } from './product';

export interface Catalog {
	id: string;
	name: string;
	description?: string | null;
	createdAd?: Date;
}

export interface CatalogComplete {
	catalog: Catalog;
	products: ProductComplete[];
}
