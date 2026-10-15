import * as table from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { and, desc, eq, gte, isNotNull, lt, lte, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type {
	CartAbandonment,
	FinanceDailyPoint,
	FinanceTotals,
	PeriodComparison,
	TopProductSales,
	TopProductViews
} from '$lib/interfaces/analytics';

/**
 * Finance & traffic analytics. Every function here aggregates in SQL
 * (`sum`/`count` + `GROUP BY`); none of them fetch rows to reduce in JS.
 *
 * Ranges are half-open: [from, to), matching `createdAt < to` semantics used
 * throughout the money tables.
 */

// Day-level bucketing happens in America/Guayaquil (Ecuador, UTC-5, no DST —
// the timezone behind the admin UI's `es-EC` date formatting). Truncation is
// done in SQL so it never depends on the Node process timezone.
const REPORT_TIMEZONE = 'America/Guayaquil';

// The JS mirror of the SQL truncation above, used only to walk the day
// boundaries of a range when filling sparse series. Ecuador has no DST, so a
// fixed offset is exact.
const GUAYAQUIL_UTC_OFFSET_MS = -5 * 60 * 60 * 1000;
const MS_PER_DAY = 86_400_000;

// The three money tables share the same value/createdAt shape, so one query
// builder serves all of them instead of three near-identical copies.
type MoneyTable = typeof table.revenue | typeof table.cost | typeof table.expense;

/** Day index (days since epoch) of an instant as seen from Guayaquil. */
function reportDayIndex(timestamp: Date): number {
	return Math.floor((timestamp.getTime() + GUAYAQUIL_UTC_OFFSET_MS) / MS_PER_DAY);
}

/** 'YYYY-MM-DD' label of a report day index. */
function formatReportDay(dayIndex: number): string {
	return new Date(dayIndex * MS_PER_DAY).toISOString().slice(0, 10);
}

function dayExpr(moneyTable: MoneyTable): SQL<string> {
	// `sql.raw` is safe here: REPORT_TIMEZONE is a hardcoded module constant,
	// and `sql.literal` only exists on newer drizzle-orm versions.
	return sql<string>`to_char((${moneyTable.createdAt} AT TIME ZONE ${sql.raw(`'${REPORT_TIMEZONE}'`)})::date, 'YYYY-MM-DD')`;
}

function rangeCondition(moneyTable: MoneyTable, from: Date, to: Date) {
	return and(gte(moneyTable.createdAt, from), lt(moneyTable.createdAt, to));
}

/** Sum of one money table's `value` over [from, to), computed in SQL. */
async function sumValueInRange(moneyTable: MoneyTable, from: Date, to: Date): Promise<number> {
	const [row] = await getDb()
		.select({ total: sql<string>`coalesce(sum(${moneyTable.value}), 0)` })
		.from(moneyTable)
		.where(rangeCondition(moneyTable, from, to))
		.execute();

	return Number(row?.total ?? 0);
}

/**
 * Totals of the three money tables over [from, to).
 */
export async function getRangeTotals(from: Date, to: Date): Promise<FinanceTotals> {
	const [revenue, cost, expense] = await Promise.all([
		sumValueInRange(table.revenue, from, to),
		sumValueInRange(table.cost, from, to),
		sumValueInRange(table.expense, from, to)
	]);

	return { revenue, cost, expense };
}

/**
 * One money table's daily totals over [from, to). Days without rows are filled
 * with 0 on the server so charts always receive a continuous series. The day
 * buckets come from SQL (`AT TIME ZONE`), and the zero-fill walks the exact
 * same Guayaquil day boundaries in JS — the two can never drift because both
 * use the same fixed UTC-5 offset.
 */
async function getDailySeries(
	moneyTable: MoneyTable,
	from: Date,
	to: Date
): Promise<FinanceDailyPoint[]> {
	const expr = dayExpr(moneyTable);
	const rows = await getDb()
		.select({
			day: expr,
			value: sql<string>`coalesce(sum(${moneyTable.value}), 0)`
		})
		.from(moneyTable)
		.where(rangeCondition(moneyTable, from, to))
		.groupBy(expr)
		.execute();

	const valueByDay = new Map(rows.map((row) => [row.day, Number(row.value)]));

	const points: FinanceDailyPoint[] = [];
	const firstDay = reportDayIndex(from);
	// `to` is exclusive, so its day only belongs to the series when it is not
	// exactly midnight — hence the -1ms before bucketing.
	const lastDay = reportDayIndex(new Date(to.getTime() - 1));
	for (let day = firstDay; day <= lastDay; day++) {
		const label = formatReportDay(day);
		points.push({ day: label, value: valueByDay.get(label) ?? 0 });
	}

	return points;
}

export async function getDailyRevenueSeries(from: Date, to: Date): Promise<FinanceDailyPoint[]> {
	return getDailySeries(table.revenue, from, to);
}

export async function getDailyCostSeries(from: Date, to: Date): Promise<FinanceDailyPoint[]> {
	return getDailySeries(table.cost, from, to);
}

export async function getDailyExpenseSeries(from: Date, to: Date): Promise<FinanceDailyPoint[]> {
	return getDailySeries(table.expense, from, to);
}

/**
 * Totals for [from, to) and for the immediately preceding period of equal
 * length ([from - duration, from)). Returns raw totals; the client derives
 * Δ% from them.
 */
export async function getPeriodComparison(from: Date, to: Date): Promise<PeriodComparison> {
	const durationMs = to.getTime() - from.getTime();
	const previousFrom = new Date(from.getTime() - durationMs);

	const [current, previous] = await Promise.all([
		getRangeTotals(from, to),
		getRangeTotals(previousFrom, from)
	]);

	return { current, previous };
}

/**
 * Top products by sales in [from, to): units sold and revenue generated
 * (quantity × unitPriceSnapshot) per product, from COMPLETED orders.
 *
 * Attribution rule: sales land on the ORDER's `createdAt` day, not on the
 * completion moment — the `order` table stores no `completedAt`, and its
 * `completed` flag can be toggled back and forth, so completion time is not a
 * stable anchor. Lines whose product was hard-deleted (`product_id` SET NULL)
 * are excluded: they cannot be attributed to a product anymore. The product
 * name prefers the live `product.name` row and falls back to the order-line
 * snapshot.
 */
export async function getTopProductsBySales(
	from: Date,
	to: Date,
	limit: number = 10
): Promise<TopProductSales[]> {
	const revenueExpr = sql<string>`sum(${table.orderItem.quantity} * ${table.orderItem.unitPriceSnapshot})`;
	const rows = await getDb()
		.select({
			productId: table.orderItem.productId,
			productName: sql<string>`coalesce(${table.product.name}, ${table.orderItem.productNameSnapshot})`,
			units: sql<string>`coalesce(sum(${table.orderItem.quantity}), 0)`,
			revenue: sql<string>`coalesce(${revenueExpr}, 0)`
		})
		.from(table.orderItem)
		.innerJoin(table.order, eq(table.orderItem.orderId, table.order.id))
		.leftJoin(table.product, eq(table.orderItem.productId, table.product.id))
		.where(
			and(
				eq(table.order.completed, true),
				gte(table.order.createdAt, from),
				lt(table.order.createdAt, to),
				isNotNull(table.orderItem.productId)
			)
		)
		.groupBy(table.orderItem.productId, table.product.name, table.orderItem.productNameSnapshot)
		.orderBy(desc(revenueExpr))
		.limit(limit)
		.execute();

	return rows.map((row) => ({
		productId: row.productId as string,
		productName: row.productName,
		units: Number(row.units),
		revenue: Number(row.revenue)
	}));
}

/**
 * Top products by page views in [from, to), from the daily counter table
 * written by `recordProductView`. The `day` column is a plain date bucketed in
 * America/Guayaquil, so it compares directly against the range's day labels.
 * Counter rows cascade with their product, hence the inner join.
 */
export async function getTopProductsByViews(
	from: Date,
	to: Date,
	limit: number = 10
): Promise<TopProductViews[]> {
	const fromDay = formatReportDay(reportDayIndex(from));
	const toDay = formatReportDay(reportDayIndex(new Date(to.getTime() - 1)));
	const viewsExpr = sql<string>`sum(${table.productViewDaily.count})`;
	const rows = await getDb()
		.select({
			productId: table.productViewDaily.productId,
			productName: table.product.name,
			views: sql<string>`coalesce(${viewsExpr}, 0)`
		})
		.from(table.productViewDaily)
		.innerJoin(table.product, eq(table.productViewDaily.productId, table.product.id))
		.where(and(gte(table.productViewDaily.day, fromDay), lte(table.productViewDaily.day, toDay)))
		.groupBy(table.productViewDaily.productId, table.product.name)
		.orderBy(desc(viewsExpr))
		.limit(limit)
		.execute();

	return rows.map((row) => ({
		productId: row.productId,
		productName: row.productName,
		views: Number(row.views)
	}));
}

/**
 * Cart abandonment over [from, to) — the most honest metric the schema can
 * support. SEMANTICS: it counts `cart_item` rows whose `addedAt` falls in the
 * range AND that still exist in the database, plus the distinct carts they
 * belong to and their snapshot value (quantity × unitPriceSnapshot).
 *
 * WHY: `checkoutCart` (src/lib/server/cart.ts) DELETES every `cart_item` of a
 * cart when it converts, and orders keep no `cart_id` — so a converted
 * addition leaves no trace at all. Conversely, a row that still exists was
 * never checked out. "Still present" is therefore the only defensible
 * "did not convert" signal available.
 *
 * LIMITATIONS (all inherent to the current schema, not to this query):
 * - History is NOT durable. The pg_cron job in
 *   drizzle/0001_pg_cron_abandoned_cart_cleanup.sql deletes items of carts
 *   older than 30 days (and `cart.updated_at` is never refreshed after
 *   creation, so the horizon is really "cart created > 30 days ago").
 *   Product deactivation also purges that product's cart lines. Ranges older
 *   than the cleanup horizon therefore undercount, potentially down to zero.
 * - A true abandonment RATE (abandoned / total) is impossible: the converted
 *   numerator counterpart was destroyed at checkout and never linked.
 * - Carts still open — a visitor who intends to return tomorrow — are counted
 *   as abandoned; no inactivity cutoff can be applied because `cart.updated_at`
 *   does not track activity.
 */
export async function getCartAbandonment(from: Date, to: Date): Promise<CartAbandonment> {
	const [row] = await getDb()
		.select({
			items: sql<string>`count(*)`,
			carts: sql<string>`count(distinct ${table.cartItem.cartId})`,
			value: sql<string>`coalesce(sum(${table.cartItem.quantity} * ${table.cartItem.unitPriceSnapshot}), 0)`
		})
		.from(table.cartItem)
		.where(and(gte(table.cartItem.addedAt, from), lt(table.cartItem.addedAt, to)))
		.execute();

	return {
		items: Number(row?.items ?? 0),
		carts: Number(row?.carts ?? 0),
		value: Number(row?.value ?? 0)
	};
}
