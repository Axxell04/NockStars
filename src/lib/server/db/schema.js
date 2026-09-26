import {
	pgTable,
	text,
	integer,
	boolean,
	timestamp,
	doublePrecision,
	jsonb
} from 'drizzle-orm/pg-core';

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

export const product = pgTable('product', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	price: doublePrecision('price').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

export const img = pgTable('img', {
	id: text('id').primaryKey(),
	url: text('url').notNull(),
	productId: text('product_id')
		.notNull()
		.references(() => product.id)
});

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

export const order = pgTable('order', {
	id: text('id').primaryKey(),
	content: jsonb('content').notNull(),
	completed: boolean('completed').notNull().default(false),
	clientName: text('client_name').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
	revenueId: text('revenue_id').references(() => revenue.id)
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

export const Session = session.$inferSelect;

export const User = user.$inferSelect;

export const Product = product.$inferInsert;

export const Img = img.$inferInsert;

export const Catalog = catalog.$inferInsert;

export const ProductCatalog = productCatalog.$inferInsert;

export const Contact = contact.$inferInsert;

export const UserToken = user_token.$inferInsert;

export const Order = order.$inferInsert;

export const Revenue = revenue.$inferInsert;

export const Cost = cost.$inferInsert;

export const Expense = expense.$inferInsert;
