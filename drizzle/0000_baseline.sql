-- Baseline migration: represents existing schema before product variants
-- This migration marks the current state of the database

-- The following tables already exist in the database:
-- user, session, user_token, product, img, catalog, product_catalog, order, revenue, cost, expense, contact

-- Create the drizzle migrations tracking table
CREATE TABLE IF NOT EXISTS "_drizzle_migrations" (
	"id" serial PRIMARY KEY,
	"hash" text NOT NULL,
	"created_at" bigint NOT NULL
);