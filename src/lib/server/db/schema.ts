import {
	pgTable,
	text,
	integer,
	boolean,
	timestamp,
	doublePrecision,
	jsonb,
	uuid,
	decimal,
	pgEnum,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
// Relative (not `$lib`) so drizzle-kit can resolve it when generating migrations.
import type { ProductSpecs } from '../../product-specs';

// USUARIO

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	age: integer('age'),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	admin: boolean('admin').notNull().default(false)
});

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
});

export const user_token = pgTable('user_token', {
	id: text('id').primaryKey(),
	text: text('text').notNull(),
	active: boolean('active').notNull().default(true)
});

// NEGOCIO

export const cutTypeEnum = pgEnum('cut_type', ['oversize', 'recto']);

export const product = pgTable('product', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description'),
	price: doublePrecision('price').notNull(),
	stock: integer('stock').notNull().default(0),
	// Arbitrary admin-defined attributes for the "ficha técnica". The default is
	// explicit SQL rather than `.default({})` because `createProduct` builds a
	// full `Product` literal: an implicit default would let a row land without
	// specs and the sheet would render silently empty.
	specs: jsonb('specs')
		.$type<ProductSpecs>()
		.notNull()
		.default(sql`'{}'::jsonb`),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

export const img = pgTable(
	'img',
	{
		id: text('id').primaryKey(),
		url: text('url').notNull(),
		productId: text('product_id')
			.notNull()
			.references(() => product.id),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(table) => ({
		// Deliberately not unique: reordering rewrites every row of a product in
		// place, and a unique constraint would reject intermediate values.
		productIdSortOrderIdx: index('img_product_id_sort_order_idx').on(
			table.productId,
			table.sortOrder
		)
	})
);

export const catalog = pgTable('catalog', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description'),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

export const productCatalog = pgTable('product_catalog', {
	id: text('id').primaryKey(),
	productId: text('product_id')
		.notNull()
		.references(() => product.id),
	catalogId: text('catalog_id')
		.notNull()
		.references(() => catalog.id)
});

export const productVariant = pgTable(
	'product_variant',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		productId: text('product_id')
			.notNull()
			.references(() => product.id, { onDelete: 'cascade' }),
		size: text('size').notNull(),
		color: text('color').notNull(),
		colorHex: text('color_hex'),
		cut: cutTypeEnum('cut').notNull(),
		description: text('description'),
		stock: integer('stock').notNull().default(0),
		priceOverride: decimal('price_override', { precision: 10, scale: 2 }),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => ({
		uniqueProductSizeColorCut: uniqueIndex('product_variant_unique_product_size_color_cut').on(
			table.productId,
			table.size,
			table.color,
			table.cut
		)
	})
);

export const variantImg = pgTable(
	'variant_img',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		variantId: uuid('variant_id')
			.notNull()
			.references(() => productVariant.id, { onDelete: 'cascade' }),
		url: text('url').notNull(),
		alt: text('alt').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => ({
		uniqueVariantSortOrder: uniqueIndex('variant_img_unique_variant_sort_order').on(
			table.variantId,
			table.sortOrder
		)
	})
);

export const cart = pgTable('cart', {
	id: uuid('id').primaryKey().defaultRandom(),
	sessionId: uuid('session_id').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

export const cartItem = pgTable('cart_item', {
	id: uuid('id').primaryKey().defaultRandom(),
	cartId: uuid('cart_id')
		.notNull()
		.references(() => cart.id, { onDelete: 'cascade' }),
	productId: text('product_id')
		.notNull()
		.references(() => product.id, { onDelete: 'cascade' }),
	variantId: uuid('variant_id').references(() => productVariant.id, { onDelete: 'set null' }),
	quantity: integer('quantity').notNull(),
	unitPriceSnapshot: decimal('unit_price_snapshot', { precision: 10, scale: 2 }).notNull(),
	version: integer('version').notNull().default(1),
	addedAt: timestamp('added_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

export const order = pgTable('order', {
	id: text('id').primaryKey(),
	content: jsonb('content').notNull(),
	completed: boolean('completed').notNull().default(false),
	clientName: text('client_name').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
	revenueId: text('revenue_id').references(() => revenue.id)
});

export const orderItem = pgTable('order_item', {
	id: uuid('id').primaryKey().defaultRandom(),
	orderId: text('order_id')
		.notNull()
		.references(() => order.id, { onDelete: 'cascade' }),
	productId: text('product_id')
		.notNull()
		.references(() => product.id, { onDelete: 'cascade' }),
	variantId: uuid('variant_id').references(() => productVariant.id, { onDelete: 'set null' }),
	productNameSnapshot: text('product_name_snapshot').notNull(),
	variantSizeSnapshot: text('variant_size_snapshot'),
	variantColorSnapshot: text('variant_color_snapshot'),
	variantCutSnapshot: text('variant_cut_snapshot'),
	unitPriceSnapshot: decimal('unit_price_snapshot', { precision: 10, scale: 2 }).notNull(),
	quantity: integer('quantity').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

// BALANCE
export const revenue = pgTable('revenue', {
	id: text('id').primaryKey(),
	value: doublePrecision('value').notNull(),
	reason: text('reason'),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull()
});

export const cost = pgTable('cost', {
	id: text('id').primaryKey(),
	value: doublePrecision('value').notNull(),
	reason: text('reason'),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull()
});

export const expense = pgTable('expense', {
	id: text('id').primaryKey(),
	value: doublePrecision('value').notNull(),
	reason: text('reason'),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull()
});

// CONTACTO
export const contact = pgTable('contact', {
	id: text('id').primaryKey(),
	icon: text('icon').notNull(),
	text: text('text').notNull(),
	url: text('url').notNull()
});

export type Session = typeof session.$inferSelect;

export type User = typeof user.$inferSelect;

export type Product = typeof product.$inferSelect;
export type ProductInsert = typeof product.$inferInsert;

export type Img = typeof img.$inferSelect;
export type ImgInsert = typeof img.$inferInsert;

export type Catalog = typeof catalog.$inferSelect;
export type CatalogInsert = typeof catalog.$inferInsert;

export type ProductCatalog = typeof productCatalog.$inferSelect;
export type ProductCatalogInsert = typeof productCatalog.$inferInsert;

export type Contact = typeof contact.$inferSelect;
export type ContactInsert = typeof contact.$inferInsert;

export type UserToken = typeof user_token.$inferSelect;
export type UserTokenInsert = typeof user_token.$inferInsert;

export type Order = typeof order.$inferSelect;
export type OrderInsert = typeof order.$inferInsert;

export type OrderItem = typeof orderItem.$inferSelect;
export type OrderItemInsert = typeof orderItem.$inferInsert;

export type Revenue = typeof revenue.$inferSelect;
export type RevenueInsert = typeof revenue.$inferInsert;

export type Cost = typeof cost.$inferSelect;
export type CostInsert = typeof cost.$inferInsert;

export type Expense = typeof expense.$inferSelect;
export type ExpenseInsert = typeof expense.$inferInsert;

export type ProductVariant = typeof productVariant.$inferSelect;
export type ProductVariantInsert = typeof productVariant.$inferInsert;

export type VariantImg = typeof variantImg.$inferSelect;
export type VariantImgInsert = typeof variantImg.$inferInsert;

export type Cart = typeof cart.$inferSelect;
export type CartInsert = typeof cart.$inferInsert;

export type CartItem = typeof cartItem.$inferSelect;
export type CartItemInsert = typeof cartItem.$inferInsert;
