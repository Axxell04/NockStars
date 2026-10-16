import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createRevenue,
	deleteRevenue,
	getRevenues,
	getTotalRevenue,
	updateRevenue
} from '$lib/server/revenue';
import { createCost, deleteCost, getCosts, getTotalCost, updateCost } from '$lib/server/cost';
import {
	createExpense,
	deleteExpense,
	getExpenses,
	getTotalExpense,
	updateExpense
} from '$lib/server/expense';
import type { BalanceDetailPagination } from '$lib/interfaces/balance';
import { requireUser } from '$lib/server/guard';
import {
	BALANCE_PAGE_SIZE,
	DEFAULT_BALANCE_SORT,
	readBalanceListParams,
	readBalanceRange,
	type BalanceListParams,
	type BalanceRangeFilter
} from '$lib/server/balance-list';
import {
	currentPresetBounds,
	dayIndexLabel,
	rangeInstants,
	resolveRange
} from '$lib/server/balance-range';
import {
	getCartAbandonment,
	getDailyCostSeries,
	getDailyExpenseSeries,
	getDailyRevenueSeries,
	getPeriodComparison,
	getTopProductsBySales,
	getTopProductsByViews
} from '$lib/server/finance-analytics';
import type { FinanceDashboard } from '$lib/interfaces/analytics';

const RANKING_LIMIT = 5;

export const load: PageServerLoad = async (event) => {
	requireUser(event.locals);

	// The AGENTS.md "cookie-backed state, never searchParams" rule is scoped to
	// the storefront root page; this admin analytics filter is intentionally
	// URL-param based — shareable and SSR-friendly.
	const bounds = currentPresetBounds();
	const range = resolveRange(event.url.searchParams, bounds);
	const { from, to } = rangeInstants(range);

	// The cookie view seeds the client (reload must come back to the same
	// view), so a crafted/legacy value is validated here: only the four known
	// states reach the client, anything else falls back to 'resume'.
	const viewState: ViewState = isViewState(event.locals.balanceViewSatate)
		? event.locals.balanceViewSatate
		: 'resume';

	// product_view_daily (migration 0011) may not be applied yet, so this one
	// ranking degrades to an "unavailable" card instead of failing the page.
	// Every other analytics query runs on long-existing tables: if they throw,
	// that is a real bug and must surface — no blanket catch here.
	const topProductsByViews = getTopProductsByViews(from, to, RANKING_LIMIT).catch((error) => {
		console.error('getTopProductsByViews failed (is migration 0011 applied?)', error);
		return null;
	});

	const [
		totalRevenue,
		totalCost,
		totalExpense,
		comparison,
		revenueSeries,
		costSeries,
		expenseSeries,
		topProductsBySales,
		cartAbandonment,
		views,
		balanceDetailPagination
	] = await Promise.all([
		getTotalRevenue(),
		getTotalCost(),
		getTotalExpense(),
		getPeriodComparison(from, to),
		getDailyRevenueSeries(from, to),
		getDailyCostSeries(from, to),
		getDailyExpenseSeries(from, to),
		getTopProductsBySales(from, to, RANKING_LIMIT),
		getCartAbandonment(from, to),
		topProductsByViews,
		// Initial list for the cookie view under the resolved range. `load`
		// can only offer the clean defaults for search/sort (the URL carries
		// neither); the client's applied pair is re-applied through the action
		// handlers. Returns undefined for 'resume' — that view has no list.
		loadBalancePagination(viewState, 1, { q: '', sort: DEFAULT_BALANCE_SORT }, { from, to })
	]);

	const dashboard: FinanceDashboard = {
		range: {
			from: dayIndexLabel(range.fromDay),
			to: dayIndexLabel(range.toDayExclusive - 1),
			preset: range.preset,
			presetHrefs: {
				month: '/admin/balance',
				lastMonth: `/admin/balance?from=${dayIndexLabel(bounds.previousMonthFrom)}&to=${dayIndexLabel(bounds.currentMonthFrom - 1)}`,
				last7: `/admin/balance?from=${dayIndexLabel(bounds.last7From)}&to=${dayIndexLabel(bounds.today)}`
			}
		},
		comparison,
		revenueSeries,
		costSeries,
		expenseSeries,
		topProductsBySales,
		topProductsByViews: views,
		cartAbandonment
	};

	return {
		totalRevenue,
		totalCost,
		totalExpense,
		dashboard,
		balanceDetailPagination,
		viewState
	};
};

/**
 * Fetchers for the three list views, keyed by `balance_view_state`. Each maps
 * its table-specific rows onto the shared `BalanceDetailPagination` contract,
 * scoped to the half-open range [range.from, range.to) resolved by the caller.
 */
const LIST_FETCHERS = {
	revenue: async (page: number, params: BalanceListParams, range: BalanceRangeFilter) => {
		const res = await getRevenues(
			page,
			BALANCE_PAGE_SIZE,
			params.q,
			params.sort,
			range.from,
			range.to
		);
		return {
			balanceDetails: res.revenues,
			totalPages: res.totalPages,
			currentPage: res.currentPage,
			totalItems: res.totalItems
		};
	},
	cost: async (page: number, params: BalanceListParams, range: BalanceRangeFilter) => {
		const res = await getCosts(
			page,
			BALANCE_PAGE_SIZE,
			params.q,
			params.sort,
			range.from,
			range.to
		);
		return {
			balanceDetails: res.costs,
			totalPages: res.totalPages,
			currentPage: res.currentPage,
			totalItems: res.totalItems
		};
	},
	expense: async (page: number, params: BalanceListParams, range: BalanceRangeFilter) => {
		const res = await getExpenses(
			page,
			BALANCE_PAGE_SIZE,
			params.q,
			params.sort,
			range.from,
			range.to
		);
		return {
			balanceDetails: res.expenses,
			totalPages: res.totalPages,
			currentPage: res.currentPage,
			totalItems: res.totalItems
		};
	}
} as const;

type BalanceListState = keyof typeof LIST_FETCHERS;

/** The four states the view dropdown (and its `balance_view_state` cookie) may hold. */
type ViewState = 'resume' | BalanceListState;

function isListState(viewState: string): viewState is BalanceListState {
	// `in` would also match Object.prototype keys ('toString' …) — a crafted
	// cookie must not resolve to a non-fetcher.
	return Object.hasOwn(LIST_FETCHERS, viewState);
}

function isViewState(value: string | undefined): value is ViewState {
	return value === 'resume' || (value !== undefined && isListState(value));
}

/**
 * Refetches the list behind `viewState`, applying the same filter/sort and
 * range params everywhere so an active search and the dashboard's date range
 * survive paging, view switches and mutations. Returns undefined for 'resume'
 * (no list), matching the contract every action already returns.
 */
async function loadBalancePagination(
	viewState: string | undefined,
	page: number,
	params: BalanceListParams,
	range: BalanceRangeFilter
): Promise<BalanceDetailPagination | undefined> {
	if (!viewState || !isListState(viewState)) {
		return undefined;
	}
	return LIST_FETCHERS[viewState](page, params, range);
}

export const actions: Actions = {
	set_view_state: async (event) => {
		requireUser(event.locals);
		const formData = await event.request.formData();
		const viewState = formData.get('view_state') as string;

		if (!viewState) {
			return fail(400, { message: 'Error en los parámetros de la petición' });
		}

		event.cookies.set('balance_view_state', viewState, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: event.url.protocol === 'https:'
		});

		// Switching views restarts at page 1 and keeps the active search/sort
		// and the dashboard's date range.
		const balanceDetailPagination = await loadBalancePagination(
			viewState,
			1,
			readBalanceListParams(formData),
			readBalanceRange(formData)
		);

		return {
			balanceDetailPagination
		};
	},
	set_search: async (event) => {
		requireUser(event.locals);
		const formData = await event.request.formData();

		// Search/sort always refetches from page 1: a narrower filter can
		// invalidate the current page entirely.
		const balanceDetailPagination = await loadBalancePagination(
			event.locals.balanceViewSatate,
			1,
			readBalanceListParams(formData),
			readBalanceRange(formData)
		);

		return {
			balanceDetailPagination
		};
	},
	add_balance: async (event) => {
		requireUser(event.locals);
		const formData = await event.request.formData();
		const reason = formData.get('reason') as string;
		const value = parseFloat(formData.get('value') as string);

		if (!reason || !isNumber(value)) {
			return fail(400, { message: 'Error en los parámetros de la petición' });
		}

		const viewState = event.locals.balanceViewSatate;
		const params = readBalanceListParams(formData);
		const range = readBalanceRange(formData);
		let balanceDetailPagination: BalanceDetailPagination | undefined;
		try {
			if (viewState === 'revenue') {
				await createRevenue(value, reason);
			} else if (viewState === 'cost') {
				await createCost(value, reason);
			} else if (viewState === 'expense') {
				await createExpense(value, reason);
			}
			balanceDetailPagination = await loadBalancePagination(viewState, 1, params, range);
		} catch {
			return fail(500, { message: 'A ocurrido un error en el servidor' });
		}

		return {
			balanceDetailPagination
		};
	},
	delete_balance: async (event) => {
		requireUser(event.locals);
		const formData = await event.request.formData();
		const balanceId = formData.get('balance_id') as string;

		if (!balanceId) {
			return fail(400, { message: 'Error en los parámetros de la petición' });
		}

		const viewState = event.locals.balanceViewSatate;
		const params = readBalanceListParams(formData);
		const range = readBalanceRange(formData);
		let balanceDetailPagination: BalanceDetailPagination | undefined;
		let notice: string | undefined;

		try {
			if (viewState === 'revenue') {
				const result = await deleteRevenue(balanceId);
				// Order-linked revenue is protected from deletion; surface the
				// refusal instead of the old silent no-op.
				if (!result.success) {
					notice = 'Este movimiento está vinculado a una orden y no puede eliminarse';
				}
			} else if (viewState === 'cost') {
				await deleteCost(balanceId);
			} else if (viewState === 'expense') {
				await deleteExpense(balanceId);
			}
			balanceDetailPagination = await loadBalancePagination(viewState, 1, params, range);
		} catch {
			return fail(500, { message: 'A ocurrido un error en el servidor' });
		}

		return notice ? { balanceDetailPagination, notice } : { balanceDetailPagination };
	},
	edit_balance: async (event) => {
		requireUser(event.locals);
		const formData = await event.request.formData();
		const balanceId = formData.get('balance_id') as string;
		const newReason = formData.get('new_reason') as string;
		const newValue = parseFloat(formData.get('new_value') as string);

		if (!balanceId || !newReason || !isNumber(newValue)) {
			return fail(400, { message: 'Error en los parámetros de la petición' });
		}

		const viewState = event.locals.balanceViewSatate;
		const params = readBalanceListParams(formData);
		const range = readBalanceRange(formData);
		let balanceDetailPagination: BalanceDetailPagination | undefined;
		let notice: string | undefined;

		try {
			if (viewState === 'revenue') {
				const result = await updateRevenue(balanceId, newValue, newReason);
				// Same protection as deletion: order-linked revenue cannot be
				// rewritten. Reported explicitly (see delete_balance).
				if (!result.success) {
					notice = 'Este movimiento está vinculado a una orden y no puede editarse';
				}
			} else if (viewState === 'cost') {
				await updateCost(balanceId, newValue, newReason);
			} else if (viewState === 'expense') {
				await updateExpense(balanceId, newValue, newReason);
			}
			balanceDetailPagination = await loadBalancePagination(viewState, 1, params, range);
		} catch {
			return fail(500, { message: 'A ocurrido un error en el servidor' });
		}

		return notice ? { balanceDetailPagination, notice } : { balanceDetailPagination };
	},
	refresh_totals: async (event) => {
		requireUser(event.locals);
		const totalRevenue = await getTotalRevenue();
		const totalCost = await getTotalCost();
		const totalExpense = await getTotalExpense();

		return {
			totalRevenue,
			totalCost,
			totalExpense
		};
	},
	prev_page: async (event) => {
		requireUser(event.locals);
		const formData = await event.request.formData();
		let totalPages = 0;
		let currentPage = 0;

		try {
			totalPages = parseInt(formData.get('total_pages') as string);
			currentPage = parseInt(formData.get('current_page') as string);
			if (isNaN(totalPages) || isNaN(currentPage)) {
				return fail(400, { message: 'Invalid pagination params' });
			}
		} catch {
			return fail(400, { message: 'Invalid pagination params' });
		}

		if (currentPage <= 1) {
			return fail(404, { message: 'Page not found' });
		}

		const viewState = event.locals.balanceViewSatate;
		const prevPage = currentPage - 1;
		const balanceDetailPagination = await loadBalancePagination(
			viewState,
			prevPage,
			readBalanceListParams(formData),
			readBalanceRange(formData)
		);

		return {
			balanceDetailPagination
		};
	},
	next_page: async (event) => {
		requireUser(event.locals);
		const formData = await event.request.formData();
		let totalPages = 0;
		let currentPage = 0;

		try {
			totalPages = parseInt(formData.get('total_pages') as string);
			currentPage = parseInt(formData.get('current_page') as string);
			if (isNaN(totalPages) || isNaN(currentPage)) {
				return fail(400, { message: 'Invalid pagination params' });
			}
		} catch {
			return fail(400, { message: 'Invalid pagination params' });
		}

		if (currentPage >= totalPages) {
			return fail(404, { message: 'Page not found' });
		}

		const viewState = event.locals.balanceViewSatate;
		const nextPage = currentPage + 1;
		const balanceDetailPagination = await loadBalancePagination(
			viewState,
			nextPage,
			readBalanceListParams(formData),
			readBalanceRange(formData)
		);

		return {
			balanceDetailPagination
		};
	},
	goto_page: async (event) => {
		requireUser(event.locals);
		const formData = await event.request.formData();
		let gotoPage = 0;

		try {
			gotoPage = parseInt(formData.get('goto_page') as string);
			// Page 0 or negative would produce a negative SQL OFFSET.
			if (isNaN(gotoPage) || gotoPage < 1) {
				return fail(400, { message: 'Invalid pagination params' });
			}
		} catch {
			return fail(400, { message: 'Invalid pagination params' });
		}

		const viewState = event.locals.balanceViewSatate;
		const balanceDetailPagination = await loadBalancePagination(
			viewState,
			gotoPage,
			readBalanceListParams(formData),
			readBalanceRange(formData)
		);

		return {
			balanceDetailPagination
		};
	}
};

function isNumber(value: unknown): value is number {
	return typeof value === 'number' && !isNaN(value) && value > 0;
}
