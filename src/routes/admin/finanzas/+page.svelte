<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import type { ActionResult } from '@sveltejs/kit';
	import type { PageProps } from './$types';
	import type {
		BalanceDetail,
		BalanceDetailPagination,
		BalanceSortKey
	} from '$lib/interfaces/balance';
	import type { Order, OrderPagination } from '$lib/interfaces/order';
	import Icon from '@iconify/svelte';
	import BalanceDetailCard from '$lib/components/BalanceDetailCard.svelte';
	import FinanceKpiCard from '$lib/components/FinanceKpiCard.svelte';
	import FinanceRanking from '$lib/components/FinanceRanking.svelte';
	import FinanceTrendChart from '$lib/components/FinanceTrendChart.svelte';
	import OrderCard from '$lib/components/OrderCard.svelte';
	import { cancelFocus } from '$lib/focus';
	import { toast } from '$lib/toast.svelte.js';
	import { formatCurrency } from '$lib/format';
	import { actionFailureMessage } from '$lib/action-result';

	let { data }: PageProps = $props();
	let totalRevenue = $state(data.totalRevenue);
	let totalCost = $state(data.totalCost);
	let totalExpense = $state(data.totalExpense);
	let profits = $derived(totalRevenue - (totalCost + totalExpense));

	// Dashboard zone — range-scoped analytics. Never mirrored into local
	// $state: it is read-only here, so it reads `data` directly and stays
	// correct across same-route filter navigations.
	function deltaOf(current: number, previous: number): number | null {
		// Never divide by zero; a non-positive base has no honest Δ%.
		return previous > 0 ? ((current - previous) / previous) * 100 : null;
	}

	let kpis = $derived.by(() => {
		const { current, previous } = data.dashboard.comparison;
		return [
			{
				label: 'Ingresos',
				value: current.revenue,
				deltaPercent: deltaOf(current.revenue, previous.revenue)
			},
			{ label: 'Costos', value: current.cost, deltaPercent: deltaOf(current.cost, previous.cost) },
			{
				label: 'Gastos',
				value: current.expense,
				deltaPercent: deltaOf(current.expense, previous.expense)
			},
			{
				label: 'Ganancia',
				value: current.revenue - (current.cost + current.expense),
				deltaPercent: deltaOf(
					current.revenue - (current.cost + current.expense),
					previous.revenue - (previous.cost + previous.expense)
				)
			}
		];
	});

	// The three daily series share the same zero-filled day axis by
	// construction, so zipping by index is exact.
	let trendPoints = $derived(
		data.dashboard.revenueSeries.map((point, index) => ({
			day: point.day,
			revenue: point.value,
			outflow:
				(data.dashboard.costSeries[index]?.value ?? 0) +
				(data.dashboard.expenseSeries[index]?.value ?? 0)
		}))
	);

	let salesMetric = $state<'units' | 'revenue'>('units');

	let salesRows = $derived(
		data.dashboard.topProductsBySales.map((product) => ({
			name: product.productName,
			metric: salesMetric === 'units' ? product.units : product.revenue,
			display: salesMetric === 'units' ? `${product.units} unid.` : formatCurrency(product.revenue)
		}))
	);

	let viewRows = $derived(
		(data.dashboard.topProductsByViews ?? []).map((product) => ({
			name: product.productName,
			metric: product.views,
			display: `${product.views} vistas`
		}))
	);

	type ViewState = 'resume' | 'revenue' | 'cost' | 'expense';

	// Bootstrap pattern (AGENTS.md): `load` seeds the range-filtered list for
	// the cookie view, so a reload comes back to exactly what was on screen.
	// `data` only re-seeds on remount; every later change flows through the
	// action handlers' setBalanceDetailPagination. Deliberately $state, not
	// $derived — this binding is locally assigned.
	let balanceDetailPagination: BalanceDetailPagination | undefined = $state(
		data.balanceDetailPagination
	);
	let balanceDetails: BalanceDetail[] | undefined = $derived(
		balanceDetailPagination?.balanceDetails
	);

	// Batch delete — selection mode state. `selectedIds` is cleared inside
	// setBalanceDetailPagination (a replaced list is a different set of rows)
	// and on view switches, so an id can never survive into a list that does
	// not contain the row it was picked from.
	let selectionModeIsVisible = $state(false);
	let selectedIds: string[] = $state([]);
	let confirmationDeleteManyIsVisible = $state(false);

	let allVisibleSelected = $derived(
		balanceDetails !== undefined &&
			balanceDetails.length > 0 &&
			balanceDetails.every((balanceDetail) => selectedIds.includes(balanceDetail.id))
	);

	let balanceDetailSelected: BalanceDetail | undefined = $state();

	// View State — seeded from the server-validated cookie view (an unknown
	// cookie value already fell back to 'resume' in load).
	let viewState: ViewState = $state(data.viewState);

	// Orders pane — same bootstrap pattern: `load` seeds the range-scoped
	// page for the cookie view, every later change flows through the
	// orders_* action handlers' setOrderPagination. `ordersViewState` drives
	// the orders toggle; `viewState` above belongs to the balance dropdown —
	// the two dropdowns coexist in the shared bar and must not share state.
	let orderPagination: OrderPagination = $state(data.orderPagination);
	let orders: Order[] = $derived(orderPagination.orders);
	let ordersViewState: 'pending' | 'completed' = $state(data.ordersViewState);

	// ORDER COD — a `cod` param narrows the pane to that single order ("Hecho"
	// is the explicit exit back to the period list).
	let cod = $derived(page.url.searchParams.get('cod'));

	// Tab — seeded once from the URL-resolved `?tab` (fail-safe dashboard in
	// load), same bootstrap philosophy as viewState. Switching is pure client
	// state: no load rerun, so the applied search/sort/range and any batch
	// selection survive. Deliberately $state, not $derived — locally assigned.
	let activeTab: 'dashboard' | 'movimientos' | 'pedidos' = $state(data.tab);

	const VIEW_OPTIONS: { value: ViewState; label: string }[] = [
		{ value: 'resume', label: 'Resumen' },
		{ value: 'revenue', label: 'Ingresos' },
		{ value: 'cost', label: 'Costos' },
		{ value: 'expense', label: 'Gastos' }
	];

	const SORT_OPTIONS: { value: BalanceSortKey; label: string }[] = [
		{ value: 'date_desc', label: 'Más recientes' },
		{ value: 'date_asc', label: 'Más antiguos' },
		{ value: 'value_desc', label: 'Valor: mayor a menor' },
		{ value: 'value_asc', label: 'Valor: menor a mayor' },
		{ value: 'reason_asc', label: 'Motivo: A a Z' }
	];

	// Search/sort — `searchQuery`/`sortOption` mirror what the user sees; the
	// `applied*` pair is what the server last filtered by. The search form
	// posts the live values; every other management form (pagination, view,
	// add, and each card's edit/delete) carries the applied pair plus the
	// active date range as hidden inputs, so a submitted search survives
	// paging, view switches and mutations — and every refetch stays inside
	// the dashboard's range. Server-side, `readBalanceListParams` and
	// `readBalanceRange` re-validate all of it; nothing from the form is
	// trusted as-is.
	let searchQuery = $state('');
	let sortOption: BalanceSortKey = $state('date_desc');
	let appliedQuery = $state('');
	let appliedSort: BalanceSortKey = $state('date_desc');

	// The range the current list was fetched with, compared against `data` by
	// the sync effect below. Plain lets on purpose: nothing renders from them,
	// and non-reactive writes cannot re-trigger the effect that writes them.
	let appliedRangeFrom = data.dashboard.range.from;
	let appliedRangeTo = data.dashboard.range.to;

	// Same plain-let tracker contract for the orders pane: the range and cod
	// the current orderPagination was fetched with, seeded from `data` at the
	// same moment the list itself was seeded. The cod tracker reads the URL
	// directly rather than the `cod` derived — same value at init, without
	// referencing local reactive state in a plain initializer.
	let ordersAppliedRangeFrom = data.dashboard.range.from;
	let ordersAppliedRangeTo = data.dashboard.range.to;
	let ordersAppliedCod = page.url.searchParams.get('cod');

	// HTML Elements
	let selectStateElement: HTMLButtonElement | undefined = $state();
	let btnRefreshTotals: HTMLButtonElement | undefined = $state();
	let searchFormElement: HTMLFormElement | undefined = $state();
	let viewListElement: HTMLDivElement | undefined = $state();
	let gotoListElement: HTMLDivElement | undefined = $state();
	let gotoTriggerElement: HTMLButtonElement | undefined = $state();

	let selectStateElementHeight: number = $state(9);

	// Orders dropdown element refs — independent from the balance ones above:
	// both dropdown pairs live in the shared bar, on different tabs, and can
	// never render at the same time, but their open state must not alias.
	let ordersSelectStateElement: HTMLButtonElement | undefined = $state();
	let ordersViewListElement: HTMLDivElement | undefined = $state();
	let ordersGotoListElement: HTMLDivElement | undefined = $state();
	let ordersGotoTriggerElement: HTMLButtonElement | undefined = $state();

	let ordersSelectStateElementHeight: number = $state(9);

	// The page number picked in the orders goto listbox — the option click
	// sets it right before the implicit form submit (kept from the old
	// /admin/pedidos page, whose goto listbox styles assume plain numbers).
	let ordersGotoPage: number | undefined = $state();

	// Visible Elements
	let gotoPageListIsVisible = $state(false);
	let stateListIsVisible = $state(false);
	let addPanelIsVisible = $state(false);

	// Orders visible flags
	let ordersStateListIsVisible = $state(false);
	let ordersGotoPageListIsVisible = $state(false);

	// Toggle Visible Elements
	function toggleGotoPageListIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			gotoPageListIsVisible = visible;
		} else {
			gotoPageListIsVisible = !gotoPageListIsVisible;
		}
	}

	function toggleStateListIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			stateListIsVisible = visible;
		} else {
			stateListIsVisible = !stateListIsVisible;
		}
	}

	function toggleOrdersGotoPageListIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			ordersGotoPageListIsVisible = visible;
		} else {
			ordersGotoPageListIsVisible = !ordersGotoPageListIsVisible;
		}
	}

	function toggleOrdersStateListIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			ordersStateListIsVisible = visible;
		} else {
			ordersStateListIsVisible = !ordersStateListIsVisible;
		}
	}

	function toggleAddPanelIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			addPanelIsVisible = visible;
		} else {
			addPanelIsVisible = !addPanelIsVisible;
		}
	}

	function toggleSelectionModeIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			selectionModeIsVisible = visible;
		} else {
			selectionModeIsVisible = !selectionModeIsVisible;
		}
		// Leaving selection mode always drops the checked ids: they name rows
		// in a list the user is no longer selecting from.
		if (!selectionModeIsVisible) {
			selectedIds = [];
			confirmationDeleteManyIsVisible = false;
		}
	}

	function toggleConfirmationDeleteManyIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			confirmationDeleteManyIsVisible = visible;
		} else {
			confirmationDeleteManyIsVisible = !confirmationDeleteManyIsVisible;
		}
	}

	function toggleBalanceDetailSelection(balanceDetail: BalanceDetail) {
		selectedIds = selectedIds.includes(balanceDetail.id)
			? selectedIds.filter((id) => id !== balanceDetail.id)
			: [...selectedIds, balanceDetail.id];
	}

	function toggleSelectAllVisible() {
		selectedIds = allVisibleSelected ? [] : (balanceDetails?.map((detail) => detail.id) ?? []);
	}

	// Tab switching only flips local state and rewrites the URL's tab param
	// via replaceState — NOT goto: no load rerun is the whole point, so the
	// applied search/sort/range and any batch selection survive the switch.
	// The cod param is left untouched: switching tabs is not an order lookup.
	function selectTab(next: 'dashboard' | 'movimientos' | 'pedidos') {
		activeTab = next;
		const url = new URL(window.location.href);
		if (next === 'dashboard') {
			url.searchParams.delete('tab');
		} else {
			url.searchParams.set('tab', next);
		}
		history.replaceState(null, '', url);
		// A dropdown left open would remount open on the next tab switch.
		toggleStateListIsVisible(false);
		toggleGotoPageListIsVisible(false);
		toggleOrdersStateListIsVisible(false);
		toggleOrdersGotoPageListIsVisible(false);
	}

	/**
	 * Keeps range navigation on the active tab: the preset hrefs and the
	 * custom-range form action are server-built without the tab param, so it
	 * is appended here (client-side) instead of threading it through every
	 * server URL builder. Plain string handling so it also runs during SSR.
	 */
	function withTab(href: string): string {
		if (activeTab === 'dashboard') {
			return href;
		}
		const queryAt = href.indexOf('?');
		const path = queryAt === -1 ? href : href.slice(0, queryAt);
		const params = new URLSearchParams(queryAt === -1 ? '' : href.slice(queryAt + 1));
		params.set('tab', activeTab);
		return `${path}?${params.toString()}`;
	}

	// Setter Functions
	function setBalanceDetailPagination(
		newBalanceDetailPagination: BalanceDetailPagination | undefined
	) {
		balanceDetailPagination = newBalanceDetailPagination;
		// Every list mutation funnels through here, so this is the one place
		// that can guarantee no selection outlives the rows it was made on.
		selectedIds = [];
		confirmationDeleteManyIsVisible = false;
	}

	function selectThisBalanceDetail(balanceDetail: BalanceDetail | undefined) {
		balanceDetailSelected = balanceDetail;
	}

	// Orders setter — plain assignment only: unlike setBalanceDetailPagination
	// (which also clears batch selection — a different concern, untouched),
	// the orders list carries no selection state to reset.
	function setOrderPagination(newOrderPagination: OrderPagination) {
		orderPagination = newOrderPagination;
	}

	/**
	 * Page numbers for the orders goto listbox. Plain, no ellipsis: its
	 * listbox styles assume every entry renders as a bare number (the
	 * balance listbox keeps the windowed `createListPages` instead).
	 */
	function createOrdersListPages(totalPages: number): number[] {
		const list: number[] = [];
		for (let index = 1; index <= totalPages; index++) {
			list.push(index);
		}
		return list;
	}

	// "Hecho" — surgical cod exit: drop only the cod param so the tab and the
	// date range survive, then navigate fully. The full reload is deliberate:
	// remount re-seeds every $state binding from the fresh server payload.
	function dismissOrderFilter() {
		const url = new URL(window.location.href);
		url.searchParams.delete('cod');
		window.location.href = url.href;
	}

	// Closing when focus leaves an orders list keeps it from lingering over
	// the page — same contract as the balance listboxes. Moving onto the
	// trigger is exempt: its click handler owns the toggle.
	function onOrdersViewListFocusout(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next === ordersSelectStateElement) {
			return;
		}
		if (!(next instanceof Node) || !ordersViewListElement?.contains(next)) {
			toggleOrdersStateListIsVisible(false);
		}
	}

	function onOrdersGotoListFocusout(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next === ordersGotoTriggerElement) {
			return;
		}
		if (!(next instanceof Node) || !ordersGotoListElement?.contains(next)) {
			toggleOrdersGotoPageListIsVisible(false);
		}
	}

	// Request Functions
	function refreshTotals() {
		if (typeof btnRefreshTotals !== 'undefined' && viewState === 'resume') {
			btnRefreshTotals.click();
		}
	}

	/**
	 * Page numbers around the current one, plus first/last when they fall
	 * outside the window; `null` renders as an ellipsis gap. Keeps the goto
	 * listbox bounded (~5 entries) no matter how long the list grows.
	 */
	function createListPages(totalPages: number, currentPage: number): (number | null)[] {
		const windowRadius = 2;
		const start = Math.max(1, currentPage - windowRadius);
		const end = Math.min(totalPages, currentPage + windowRadius);
		const pages: (number | null)[] = [];

		if (start > 1) {
			pages.push(1);
			if (start > 2) {
				pages.push(null);
			}
		}
		for (let page = start; page <= end; page++) {
			pages.push(page);
		}
		if (end < totalPages) {
			if (end < totalPages - 1) {
				pages.push(null);
			}
			pages.push(totalPages);
		}

		return pages;
	}

	// View dropdown — listbox semantics with real focus movement (roving
	// focus follows aria-selected on open; arrows/Home/End move between
	// options; Escape closes and returns focus to the trigger). Selection
	// itself rides the option button's type="submit" name/value pair, so the
	// submitted view never depends on how fast Svelte flushes viewState.
	async function openViewList() {
		toggleStateListIsVisible(true);
		await tick();
		viewListElement?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.focus();
	}

	function closeViewList() {
		toggleStateListIsVisible(false);
		selectStateElement?.focus();
	}

	function selectView(next: ViewState) {
		viewState = next;
		// A view switch swaps every row: drop the selection with it.
		toggleSelectionModeIsVisible(false);
		closeViewList();
	}

	function onViewTriggerClick() {
		if (stateListIsVisible) {
			toggleStateListIsVisible(false);
		} else {
			void openViewList();
		}
	}

	async function onViewTriggerKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
			return;
		}
		event.preventDefault();
		await openViewList();
	}

	// Shared roving-focus handler for both listboxes (the view dropdown and
	// the goto-page dropdown). Focus lives on the option buttons themselves,
	// so Enter/Space activate natively and no aria-activedescendant bookkeeping
	// is needed.
	function handleListboxKeydown(event: KeyboardEvent, close: () => void) {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
			return;
		}
		event.preventDefault();

		const container = event.currentTarget as HTMLElement;
		const options = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'));
		if (options.length === 0) {
			return;
		}
		const currentIndex = options.findIndex((option) => option === document.activeElement);
		let nextIndex: number;
		if (event.key === 'ArrowDown') {
			nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, options.length - 1);
		} else if (event.key === 'ArrowUp') {
			nextIndex = currentIndex < 0 ? options.length - 1 : Math.max(currentIndex - 1, 0);
		} else if (event.key === 'Home') {
			nextIndex = 0;
		} else {
			nextIndex = options.length - 1;
		}
		options[nextIndex]?.focus();
	}

	// Closing when focus leaves the list keeps a dropdown from lingering over
	// the page. Moving onto the trigger is exempt: its click handler owns the
	// toggle, and closing here would re-open it on the next click.
	function onViewListFocusout(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next === selectStateElement) {
			return;
		}
		if (!(next instanceof Node) || !viewListElement?.contains(next)) {
			toggleStateListIsVisible(false);
		}
	}

	function onGotoListFocusout(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next === gotoTriggerElement) {
			return;
		}
		if (!(next instanceof Node) || !gotoListElement?.contains(next)) {
			toggleGotoPageListIsVisible(false);
		}
	}

	function selectGotoPage() {
		toggleGotoPageListIsVisible(false);
		gotoTriggerElement?.focus();
	}

	// Search — clearing waits for the emptied value to reach the DOM before
	// re-submitting, otherwise the form would serialize the previous query.
	async function clearSearch() {
		searchQuery = '';
		await tick();
		searchFormElement?.requestSubmit();
	}

	function emptyStateMessage(): string {
		// The default range IS month-to-date, so a month-scoped list with no
		// rows and no search is a genuinely empty list; any other range simply
		// has no movements inside it — say so instead of blaming the table.
		if (data.dashboard.range.preset !== 'month') {
			return 'Sin movimientos en este rango.';
		}
		if (viewState === 'revenue') {
			return 'Todavía no hay ingresos. Usa «Añadir» para registrar el primero.';
		}
		if (viewState === 'cost') {
			return 'Todavía no hay costos. Usa «Añadir» para registrar el primero.';
		}
		return 'Todavía no hay gastos. Usa «Añadir» para registrar el primero.';
	}

	function toastActionFailure(result: ActionResult, fallback: string) {
		const failure = actionFailureMessage(result, fallback);
		if (failure) {
			toast(failure);
		}
	}

	$effect(() => {
		if (typeof selectStateElement !== 'undefined' && stateListIsVisible) {
			selectStateElementHeight = selectStateElement.clientHeight;
		}
	});

	$effect(() => {
		if (typeof ordersSelectStateElement !== 'undefined' && ordersStateListIsVisible) {
			ordersSelectStateElementHeight = ordersSelectStateElement.clientHeight;
		}
	});

	$effect(() => {
		if (viewState === 'resume') {
			refreshTotals();
		}
	});

	// Re-frame the viewport whenever the rendered orders list is replaced —
	// but only while the Pedidos tab is the visible pane: a range-driven
	// refresh triggered from another tab must not yank the viewport. The
	// presence check is a dependency, NOT page validation — `currentPage` is
	// never verified anywhere in this codebase.
	$effect(() => {
		if (activeTab === 'pedidos' && orderPagination.orders) {
			scrollTo({ behavior: 'smooth', top: 170 });
		}
	});

	// Same-route navigations (the preset links and the custom-range GET form)
	// update `data` WITHOUT remounting this component, so the seeded list
	// would keep the previous range's rows while the dashboard above already
	// shows the new range. Re-submitting the search form — which carries the
	// applied q/sort plus the current range as hidden inputs — refetches the
	// list under the new range without losing the search. Keyed on the range
	// values only: `invalidateAll` after a mutation re-runs `load` with the
	// same URL range, so it must not re-trigger here and clobber the applied
	// filters with load's q=''/default-sort bootstrap. Convergence: the
	// tracker writes are plain (non-reactive) lets, so they cannot loop this
	// effect, and the comparison fails on the next run.
	$effect(() => {
		const rangeFrom = data.dashboard.range.from;
		const rangeTo = data.dashboard.range.to;
		if (rangeFrom === appliedRangeFrom && rangeTo === appliedRangeTo) {
			return;
		}
		if (viewState === 'resume') {
			// The resume view has no list (and no toolbar) to sync.
			appliedRangeFrom = rangeFrom;
			appliedRangeTo = rangeTo;
			return;
		}
		if (typeof searchFormElement !== 'undefined') {
			appliedRangeFrom = rangeFrom;
			appliedRangeTo = rangeTo;
			searchFormElement.requestSubmit();
			return;
		}
		// Toolbar not mounted (range picked while the Movimientos tab is
		// hidden): the tracker stays stale ON PURPOSE — searchFormElement is
		// an effect dependency, so the deferred sync fires the moment the tab
		// switch mounts the toolbar and refetches the list under that range,
		// applied filters intact.
	});

	// Same-route range navigations update `data` WITHOUT remounting, so the
	// seeded orders state must follow the server result (new range => page 1,
	// or a preset click that dropped ?cod => the period list replaces the single
	// order). Keyed on range + cod only: `invalidateAll` after a mutation re-runs
	// load with the same range/cod and must NOT clobber client-side pagination.
	// Trackers are plain (non-reactive) lets, so they cannot loop this effect.
	$effect(() => {
		const rangeFrom = data.dashboard.range.from;
		const rangeTo = data.dashboard.range.to;
		const currentCod = cod;
		if (
			rangeFrom === ordersAppliedRangeFrom &&
			rangeTo === ordersAppliedRangeTo &&
			currentCod === ordersAppliedCod
		) {
			return;
		}
		ordersAppliedRangeFrom = rangeFrom;
		ordersAppliedRangeTo = rangeTo;
		ordersAppliedCod = currentCod;
		orderPagination = data.orderPagination;
	});
</script>

<div in:fade class="flex max-h-full max-w-full flex-col gap-2 px-5 py-5">
	<!-- Every POST the list makes must carry the active dashboard range: an
		form action replaces the page query string on submit, so the URL's
		from/to never reach the server from here. Same contract as q/sort —
		seeded from `data` (URL-resolved) and re-validated by readBalanceRange. -->
	{#snippet rangeInputs()}
		<input type="hidden" name="from" value={data.dashboard.range.from} />
		<input type="hidden" name="to" value={data.dashboard.range.to} />
	{/snippet}
	<section class="sticky top-0 z-40 w-full">
		<div
			class="glass text-brand-400 relative flex flex-wrap place-content-between place-items-center gap-3 rounded-2xl border border-white/4 p-4 text-center font-normal"
		>
			<div
				class="via-brand-400/20 absolute top-0 right-1/4 left-1/4 h-[1px] bg-gradient-to-r from-transparent to-transparent"
			></div>
			<div
				class="flex flex-row flex-wrap place-items-center gap-1"
				role="group"
				aria-label="Sección de finanzas"
			>
				<button
					type="button"
					data-testid="tab-dashboard"
					aria-pressed={activeTab === 'dashboard'}
					onclick={() => selectTab('dashboard')}
					onfocus={(e) => cancelFocus(e)}
					class="rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-300 {activeTab ===
					'dashboard'
						? 'border-brand-400/20 bg-brand-400/10 text-brand-400'
						: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary border-white/6'}"
				>
					Dashboard
				</button>
				<button
					type="button"
					data-testid="tab-movimientos"
					aria-pressed={activeTab === 'movimientos'}
					onclick={() => selectTab('movimientos')}
					onfocus={(e) => cancelFocus(e)}
					class="rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-300 {activeTab ===
					'movimientos'
						? 'border-brand-400/20 bg-brand-400/10 text-brand-400'
						: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary border-white/6'}"
				>
					Movimientos
				</button>
				<button
					type="button"
					data-testid="tab-pedidos"
					aria-pressed={activeTab === 'pedidos'}
					onclick={() => selectTab('pedidos')}
					onfocus={(e) => cancelFocus(e)}
					class="rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-300 {activeTab ===
					'pedidos'
						? 'border-brand-400/20 bg-brand-400/10 text-brand-400'
						: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary border-white/6'}"
				>
					Pedidos
				</button>
			</div>
			<!-- Compact KPI strip: the same four range-scoped figures as the
				Dashboard cards, inlined so the bar stays informative on both
				tabs; the full FinanceKpiCard grid (with deltas) lives in the
				Dashboard tab. -->
			<div class="flex flex-row flex-wrap place-items-center gap-x-4 gap-y-1">
				{#each kpis as kpi (kpi.label)}
					<span class="flex flex-row items-baseline gap-1.5">
						<span class="text-text-muted text-xs">{kpi.label}</span>
						<span class="text-text-primary text-sm font-semibold tabular-nums">
							{formatCurrency(kpi.value)}
						</span>
					</span>
				{/each}
			</div>
			<nav class="flex flex-row flex-wrap place-items-center gap-2" aria-label="Rango de fechas">
				<a
					href={withTab(data.dashboard.range.presetHrefs.month)}
					aria-current={data.dashboard.range.preset === 'month' ? 'page' : undefined}
					class="rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-300 {data
						.dashboard.range.preset === 'month'
						? 'border-brand-400/20 bg-brand-400/10 text-brand-400'
						: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary border-white/6'}"
				>
					Mes actual
				</a>
				<a
					href={withTab(data.dashboard.range.presetHrefs.lastMonth)}
					aria-current={data.dashboard.range.preset === 'last-month' ? 'page' : undefined}
					class="rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-300 {data
						.dashboard.range.preset === 'last-month'
						? 'border-brand-400/20 bg-brand-400/10 text-brand-400'
						: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary border-white/6'}"
				>
					Mes pasado
				</a>
				<a
					href={withTab(data.dashboard.range.presetHrefs.last7)}
					aria-current={data.dashboard.range.preset === 'last-7-days' ? 'page' : undefined}
					class="rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-300 {data
						.dashboard.range.preset === 'last-7-days'
						? 'border-brand-400/20 bg-brand-400/10 text-brand-400'
						: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary border-white/6'}"
				>
					Últimos 7 días
				</a>
				<!-- Range navigation deliberately does NOT carry `cod`: choosing
					a period exits single-order view back to the period list —
					"Hecho" remains the explicit cod exit. -->
				<form
					method="get"
					action={withTab('/admin/finanzas')}
					class="flex flex-row flex-wrap items-end gap-2"
				>
					<!-- A GET form replaces the action's query string on submit, so
						the tab survives only through this hidden input; withTab()
						keeps the rendered action URL in sync for middle-clicks. -->
					{#if activeTab !== 'dashboard'}
						<input type="hidden" name="tab" value={activeTab} />
					{/if}
					<div class="flex flex-col gap-1">
						<label for="range-from" class="text-text-muted text-xs"> Desde </label>
						<input
							id="range-from"
							type="date"
							name="from"
							value={data.dashboard.range.from}
							required
							class="bg-surface-2 text-text-primary rounded-xl border border-white/6 px-3 py-2 text-sm [color-scheme:dark]"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="range-to" class="text-text-muted text-xs"> Hasta </label>
						<input
							id="range-to"
							type="date"
							name="to"
							value={data.dashboard.range.to}
							required
							class="bg-surface-2 text-text-primary rounded-xl border border-white/6 px-3 py-2 text-sm [color-scheme:dark]"
						/>
					</div>
					<button type="submit" class="btn-secondary rounded-xl px-3 py-2 text-sm">
						Aplicar
					</button>
				</form>
			</nav>
			{#if activeTab === 'movimientos'}
				<form
					action="?/set_view_state"
					method="post"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								if (result.data?.balanceDetailPagination) {
									setBalanceDetailPagination(
										result.data.balanceDetailPagination as BalanceDetailPagination
									);
								} else {
									setBalanceDetailPagination(undefined);
								}
							} else {
								toastActionFailure(result, 'No se pudo cambiar la vista');
							}
						};
					}}
					class="relative flex flex-col place-content-center"
				>
					<!-- The selected option submits this field (type="submit"
						name/value); a value={viewState} input here would serialize
						before the flush and send the previous view. -->
					<input type="hidden" name="q" value={appliedQuery} />
					<input type="hidden" name="sort" value={appliedSort} />
					{@render rangeInputs()}
					<button
						bind:this={selectStateElement}
						type="button"
						class="bg-surface-2/80 text-text-primary hover:border-brand-400/20 hover:bg-surface-2 flex items-center gap-2 rounded-xl border border-white/6 px-4 py-2 text-sm font-medium transition-all duration-300"
						onclick={onViewTriggerClick}
						onkeydown={onViewTriggerKeydown}
						onfocus={(e) => cancelFocus(e)}
						aria-haspopup="listbox"
						aria-expanded={stateListIsVisible}
						aria-controls={stateListIsVisible ? 'balance-view-listbox' : undefined}
					>
						{#if viewState === 'resume'}
							Resumen
						{:else if viewState === 'revenue'}
							Ingresos
						{:else if viewState === 'cost'}
							Costos
						{:else if viewState === 'expense'}
							Gastos
						{/if}
						<Icon
							icon="mdi:chevron-down"
							class="text-text-muted text-base transition-transform duration-300 {stateListIsVisible
								? 'rotate-180'
								: ''}"
						/>
					</button>
					{#if stateListIsVisible}
						<div
							bind:this={viewListElement}
							transition:scale
							class="bg-surface-1/95 shadow-depth absolute z-50 flex max-h-60 w-48 flex-col place-self-center overflow-y-auto rounded-xl border border-white/8 py-1 backdrop-blur-xl"
							style="top: {selectStateElementHeight}px;"
							role="listbox"
							id="balance-view-listbox"
							aria-label="Vista de movimientos"
							tabindex="-1"
							onkeydown={(event) => handleListboxKeydown(event, closeViewList)}
							onfocusout={onViewListFocusout}
						>
							{#each VIEW_OPTIONS as option (option.value)}
								<button
									type="submit"
									name="view_state"
									value={option.value}
									id="balance-view-option-{option.value}"
									role="option"
									aria-selected={viewState === option.value}
									class="w-full px-4 py-2.5 text-left text-sm transition-all {viewState ===
									option.value
										? 'text-brand-400 bg-brand-400/10'
										: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:pl-5'}"
									onclick={() => selectView(option.value)}
								>
									{option.label}
								</button>
							{/each}
						</div>
					{/if}
				</form>
			{:else if activeTab === 'pedidos' && !cod}
				<!-- Orders view toggle, moved from the old /admin/pedidos
					toolbar. The selected option submits the form (implicit
					submit riding this button's click — the mechanism that page
					has always used); the hidden `view_state` input carries the
					updated value. Hidden entirely when `cod` is active: only
					"Hecho" shows then. -->
				<form
					action="?/orders_set_view_state"
					method="post"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								if (result.data?.orderPagination) {
									setOrderPagination(result.data.orderPagination as OrderPagination);
								}
							} else {
								toastActionFailure(result, 'No se pudo cambiar la vista de pedidos');
							}
						};
					}}
					class="relative flex flex-col place-content-center"
				>
					<input type="hidden" name="view_state" value={ordersViewState} />
					<input type="hidden" name="cod" value={cod} />
					{@render rangeInputs()}
					<button
						bind:this={ordersSelectStateElement}
						type="button"
						class="bg-surface-2/80 text-text-primary hover:border-brand-400/20 hover:bg-surface-2 flex items-center gap-2 rounded-xl border border-white/6 px-4 py-2 text-sm font-medium transition-all duration-300"
						onclick={() => toggleOrdersStateListIsVisible()}
						onfocus={(e) => cancelFocus(e)}
						aria-haspopup="listbox"
						aria-expanded={ordersStateListIsVisible}
						aria-controls={ordersStateListIsVisible ? 'orders-view-listbox' : undefined}
					>
						{#if ordersViewState === 'pending'}
							Pendientes
						{:else if ordersViewState === 'completed'}
							Completados
						{/if}
						<Icon
							icon="mdi:chevron-down"
							class="text-text-muted text-base transition-transform duration-300 {ordersStateListIsVisible
								? 'rotate-180'
								: ''}"
						/>
					</button>
					{#if ordersStateListIsVisible}
						<div
							bind:this={ordersViewListElement}
							transition:scale
							class="bg-surface-1/95 shadow-depth absolute z-50 flex max-h-60 w-48 flex-col place-self-center overflow-y-auto rounded-xl border border-white/8 py-1 backdrop-blur-xl"
							style="top: {ordersSelectStateElementHeight}px;"
							role="listbox"
							id="orders-view-listbox"
							aria-label="Estado de los pedidos"
							tabindex="-1"
							onfocusout={onOrdersViewListFocusout}
						>
							<ul class="py-1">
								<li>
									<button
										type="submit"
										class="w-full px-4 py-2.5 text-left text-sm transition-all {ordersViewState ===
										'pending'
											? 'text-brand-400 bg-brand-400/10'
											: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:pl-5'}"
										onclick={() => {
											ordersViewState = 'pending';
											toggleOrdersStateListIsVisible(false);
										}}
									>
										Pendientes
									</button>
								</li>
								<li>
									<button
										type="submit"
										class="w-full px-4 py-2.5 text-left text-sm transition-all {ordersViewState ===
										'completed'
											? 'text-brand-400 bg-brand-400/10'
											: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:pl-5'}"
										onclick={() => {
											ordersViewState = 'completed';
											toggleOrdersStateListIsVisible(false);
										}}
									>
										Completados
									</button>
								</li>
							</ul>
						</div>
					{/if}
				</form>
			{/if}
		</div>
	</section>
	{#if activeTab === 'dashboard'}
		<section class="flex flex-col gap-3" aria-label="Panel del periodo">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{#each kpis as kpi (kpi.label)}
					<FinanceKpiCard label={kpi.label} value={kpi.value} deltaPercent={kpi.deltaPercent} />
				{/each}
			</div>
			<div class="card-thread flex flex-col gap-2 p-4">
				<span class="text-text-secondary text-sm font-medium"> Tendencia diaria </span>
				<FinanceTrendChart points={trendPoints} />
			</div>
			<div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
				<FinanceRanking
					title="Top vistas"
					rows={viewRows}
					unavailable={data.dashboard.topProductsByViews === null}
				/>
				<FinanceRanking title="Top vendidos" rows={salesRows}>
					{#snippet actions()}
						<div
							class="bg-surface-2/80 flex flex-row rounded-xl border border-white/6 p-0.5 text-xs"
						>
							<button
								type="button"
								aria-pressed={salesMetric === 'units'}
								onclick={() => (salesMetric = 'units')}
								class="rounded-lg px-2.5 py-1 transition-all duration-300 {salesMetric === 'units'
									? 'bg-brand-400/10 text-brand-400'
									: 'text-text-secondary hover:text-text-primary'}"
							>
								Unidades
							</button>
							<button
								type="button"
								aria-pressed={salesMetric === 'revenue'}
								onclick={() => (salesMetric = 'revenue')}
								class="rounded-lg px-2.5 py-1 transition-all duration-300 {salesMetric === 'revenue'
									? 'bg-brand-400/10 text-brand-400'
									: 'text-text-secondary hover:text-text-primary'}"
							>
								Ingresos
							</button>
						</div>
					{/snippet}
				</FinanceRanking>
				<div class="card-thread flex flex-col gap-3 p-4">
					<span class="text-text-secondary text-sm font-medium"> Abandono de carrito </span>
					<ul class="flex flex-col gap-2 text-sm">
						<li class="flex flex-row place-content-between place-items-center gap-3">
							<span class="text-text-primary"> Artículos sin convertir </span>
							<span class="text-text-secondary tabular-nums">
								{data.dashboard.cartAbandonment.items}
							</span>
						</li>
						<li class="flex flex-row place-content-between place-items-center gap-3">
							<span class="text-text-primary"> Carritos afectados </span>
							<span class="text-text-secondary tabular-nums">
								{data.dashboard.cartAbandonment.carts}
							</span>
						</li>
						<li class="flex flex-row place-content-between place-items-center gap-3">
							<span class="text-text-primary"> Valor estimado </span>
							<span class="text-text-secondary tabular-nums">
								{formatCurrency(data.dashboard.cartAbandonment.value)}
							</span>
						</li>
					</ul>
					<p class="text-text-secondary text-xs">
						Cuenta artículos agregados al carrito en este rango que siguen sin convertirse en una
						compra.
					</p>
				</div>
			</div>
		</section>
	{/if}
	{#if activeTab === 'movimientos'}
		<section class="flex flex-col place-items-center gap-2">
			{#if typeof balanceDetails !== 'undefined' && viewState !== 'resume'}
				<div class="flex flex-row flex-wrap place-content-center items-end gap-3">
					<form
						bind:this={searchFormElement}
						action="?/set_search"
						method="post"
						use:enhance={() => {
							return async ({ result, formData }) => {
								if (result.type === 'success') {
									if (result.data?.balanceDetailPagination) {
										setBalanceDetailPagination(
											result.data.balanceDetailPagination as BalanceDetailPagination
										);
									} else {
										setBalanceDetailPagination(undefined);
									}
									// The submitted values — not the live bindings — are what
									// the server filtered by, so they become the applied pair
									// that every other management form carries.
									const query = formData.get('q');
									appliedQuery = typeof query === 'string' ? query.trim() : '';
									const sortValue = formData.get('sort');
									// Server-side `resolveBalanceSort` whitelists this again
									// before it can reach SQL.
									appliedSort = (
										typeof sortValue === 'string' && sortValue ? sortValue : 'date_desc'
									) as BalanceSortKey;
								} else {
									toastActionFailure(result, 'No se pudo aplicar la búsqueda');
								}
							};
						}}
						class="flex flex-row flex-wrap items-end gap-2"
					>
						{@render rangeInputs()}
						<div class="flex flex-col gap-1">
							<label for="balance-search" class="text-text-muted text-xs"> Buscar </label>
							<input
								id="balance-search"
								type="search"
								name="q"
								bind:value={searchQuery}
								placeholder="Motivo del movimiento"
								autocomplete="off"
								class="bg-surface-2 text-text-primary rounded-xl border border-white/6 px-3 py-2 text-sm"
							/>
						</div>
						<div class="flex flex-col gap-1">
							<label for="balance-sort" class="text-text-muted text-xs"> Orden </label>
							<select
								id="balance-sort"
								name="sort"
								bind:value={sortOption}
								onchange={() => searchFormElement?.requestSubmit()}
								class="bg-surface-2 text-text-primary rounded-xl border border-white/6 px-3 py-2 text-sm [color-scheme:dark]"
							>
								{#each SORT_OPTIONS as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>
						<button type="submit" class="btn-secondary rounded-xl px-3 py-2 text-sm">
							Buscar
						</button>
					</form>
					{#if !addPanelIsVisible}
						<button
							in:scale
							class="text-text-secondary hover:text-brand-400 hover:border-brand-400/25 hover:bg-brand-400/5 flex flex-row place-items-center gap-1 rounded-xl border border-white/6 px-3 py-2 text-sm font-medium transition-all duration-300"
							onfocus={(e) => cancelFocus(e)}
							onclick={() => toggleAddPanelIsVisible(true)}
						>
							<Icon icon="material-symbols:add-rounded" class="text-xl" />
							<span> Añadir </span>
						</button>
					{/if}
					{#if balanceDetails.length > 0}
						{#if !selectionModeIsVisible}
							<button
								in:scale
								class="text-text-secondary hover:text-brand-400 hover:border-brand-400/25 hover:bg-brand-400/5 flex flex-row place-items-center gap-1 rounded-xl border border-white/6 px-3 py-2 text-sm font-medium transition-all duration-300"
								onfocus={(e) => cancelFocus(e)}
								onclick={() => toggleSelectionModeIsVisible(true)}
							>
								<Icon icon="material-symbols:checklist-rounded" class="text-xl" />
								<span> Seleccionar </span>
							</button>
						{:else}
							<button
								in:scale
								class="text-text-secondary hover:text-brand-400 hover:border-brand-400/25 hover:bg-brand-400/5 flex flex-row place-items-center gap-1 rounded-xl border border-white/6 px-3 py-2 text-sm font-medium transition-all duration-300"
								onfocus={(e) => cancelFocus(e)}
								onclick={() => toggleSelectionModeIsVisible(false)}
							>
								Cancelar
							</button>
						{/if}
					{/if}
				</div>
				{#if addPanelIsVisible}
					<form
						action="?/add_balance"
						method="post"
						use:enhance={() => {
							return async ({ result, formElement }) => {
								if (result.type === 'success') {
									if (result.data?.balanceDetailPagination) {
										setBalanceDetailPagination(
											result.data.balanceDetailPagination as BalanceDetailPagination
										);
										formElement.reset();
										toggleAddPanelIsVisible(false);
									}
									// A new row changes the range-scoped dashboard above.
									await invalidateAll();
								} else {
									toastActionFailure(result, 'No se pudo añadir el movimiento');
								}
							};
						}}
						class="glass flex flex-col gap-3 rounded-2xl border border-white/4 p-4"
					>
						<input type="hidden" name="q" value={appliedQuery} />
						<input type="hidden" name="sort" value={appliedSort} />
						{@render rangeInputs()}
						<div in:scale class="flex flex-row gap-2">
							<button
								type="button"
								class="text-text-secondary hover:text-brand-400 hover:border-brand-400/25 hover:bg-brand-400/5 grow rounded-xl border border-white/6 px-3 py-2 text-sm font-medium transition-all duration-300"
								onfocus={(e) => cancelFocus(e)}
								onclick={() => toggleAddPanelIsVisible(false)}
							>
								Cancelar
							</button>
							<button class="btn-primary grow rounded-xl" onfocus={(e) => cancelFocus(e)}>
								Confirmar
							</button>
						</div>
						<div class="flex flex-col place-items-center gap-2 text-center">
							<div class="flex w-full max-w-xs flex-col gap-1">
								<span class="text-text-secondary text-sm"> Motivo </span>
								<input
									type="text"
									name="reason"
									id="reason"
									class="input-thread"
									required
									autocomplete="off"
								/>
							</div>
							<div class="flex w-full max-w-xs flex-col gap-1">
								<span class="text-text-secondary text-sm"> Valor </span>
								<input
									type="number"
									step="0.01"
									name="value"
									id="value"
									class="input-thread"
									required
									autocomplete="off"
								/>
							</div>
						</div>
					</form>
				{/if}
			{:else if viewState === 'resume'}
				<div class="flex flex-row place-content-center place-items-center gap-3 text-center">
					<span class="text-text-secondary"> Ganancias: </span>
					<span class="text-brand-400 font-bold tabular-nums">
						{formatCurrency(profits)}
					</span>
				</div>
			{/if}
		</section>
		{#if typeof balanceDetailPagination !== 'undefined' && viewState !== 'resume' && balanceDetailPagination.totalItems > 0}
			<div class="flex flex-row flex-wrap place-content-center items-center gap-3">
				<form
					action="?/prev_page"
					method="post"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								if (result.data?.balanceDetailPagination) {
									setBalanceDetailPagination(
										result.data.balanceDetailPagination as BalanceDetailPagination
									);
								}
							} else {
								toastActionFailure(result, 'No se pudo actualizar la lista');
							}
						};
					}}
					class="flex flex-col place-content-center"
				>
					<input
						type="number"
						hidden
						name="current_page"
						value={balanceDetailPagination.currentPage}
					/>
					<input
						type="number"
						hidden
						name="total_pages"
						value={balanceDetailPagination.totalPages}
					/>
					<input type="hidden" name="view_state" value={viewState} />
					<input type="hidden" name="q" value={appliedQuery} />
					<input type="hidden" name="sort" value={appliedSort} />
					{@render rangeInputs()}
					{#if balanceDetailPagination.currentPage > 1}
						<button
							class="text-text-secondary hover:text-brand-400 hover:bg-surface-2 flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 hover:border hover:border-white/8"
							onfocus={(e) => cancelFocus(e)}
							aria-label="Página anterior"
						>
							<Icon icon="icon-park-outline:left-c" class="text-lg" />
						</button>
					{:else}
						<button
							class="text-text-muted/30 flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-xl transition-all duration-300"
							disabled
							aria-label="Página anterior"
						>
							<Icon icon="icon-park-outline:left-c" class="text-lg" />
						</button>
					{/if}
				</form>
				<form
					action="?/goto_page"
					method="post"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								if (result.data?.balanceDetailPagination) {
									setBalanceDetailPagination(
										result.data.balanceDetailPagination as BalanceDetailPagination
									);
								}
							} else {
								toastActionFailure(result, 'No se pudo actualizar la lista');
							}
						};
					}}
					class="relative flex flex-col place-content-center"
				>
					<input type="hidden" name="view_state" value={viewState} />
					<input type="hidden" name="q" value={appliedQuery} />
					<input type="hidden" name="sort" value={appliedSort} />
					{@render rangeInputs()}
					<button
						bind:this={gotoTriggerElement}
						type="button"
						class="bg-surface-2/80 text-text-primary hover:bg-surface-2 hover:border-brand-400/20 h-9 w-12 rounded-xl border border-white/6 text-sm font-semibold transition-all duration-300"
						onclick={() => toggleGotoPageListIsVisible()}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Ir a página"
						aria-haspopup="listbox"
						aria-expanded={gotoPageListIsVisible}
						aria-controls={gotoPageListIsVisible ? 'balance-goto-listbox' : undefined}
					>
						{balanceDetailPagination.currentPage}
					</button>
					{#if gotoPageListIsVisible}
						<div
							bind:this={gotoListElement}
							transition:scale
							class="bg-surface-1/95 shadow-depth absolute top-9 z-50 flex max-h-48 w-16 flex-col place-self-center overflow-y-auto rounded-xl border border-white/8 py-1 backdrop-blur-xl"
							role="listbox"
							id="balance-goto-listbox"
							aria-label="Ir a página"
							tabindex="-1"
							onkeydown={(event) => handleListboxKeydown(event, selectGotoPage)}
							onfocusout={onGotoListFocusout}
						>
							{#each createListPages(balanceDetailPagination.totalPages, balanceDetailPagination.currentPage) as entry, index (index)}
								{#if entry === null}
									<div aria-hidden="true" class="text-text-muted px-3 py-2 text-center text-sm">
										…
									</div>
								{:else}
									<!-- The page number rides this button's submitter
									value; a hidden goto_page input would serialize a
									stale value instead. -->
									<button
										type="submit"
										name="goto_page"
										value={entry}
										role="option"
										aria-selected={entry === balanceDetailPagination.currentPage}
										aria-label="Página {entry}"
										class="w-full px-3 py-2 text-center text-sm transition-all {entry ===
										balanceDetailPagination.currentPage
											? 'text-brand-400 bg-brand-400/10'
											: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'}"
										onclick={selectGotoPage}
										onfocus={(e) => cancelFocus(e)}
									>
										{entry}
									</button>
								{/if}
							{/each}
						</div>
					{/if}
				</form>
				<form
					action="?/next_page"
					method="post"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								if (result.data?.balanceDetailPagination) {
									setBalanceDetailPagination(
										result.data.balanceDetailPagination as BalanceDetailPagination
									);
								}
							} else {
								toastActionFailure(result, 'No se pudo actualizar la lista');
							}
						};
					}}
					class="flex flex-col place-content-center"
				>
					<input
						type="number"
						hidden
						name="current_page"
						value={balanceDetailPagination.currentPage}
					/>
					<input
						type="number"
						hidden
						name="total_pages"
						value={balanceDetailPagination.totalPages}
					/>
					<input type="hidden" name="view_state" value={viewState} />
					<input type="hidden" name="q" value={appliedQuery} />
					<input type="hidden" name="sort" value={appliedSort} />
					{@render rangeInputs()}
					{#if balanceDetailPagination.currentPage < balanceDetailPagination.totalPages}
						<button
							class="text-text-secondary hover:text-brand-400 hover:bg-surface-2 flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 hover:border hover:border-white/8"
							onfocus={(e) => cancelFocus(e)}
							aria-label="Página siguiente"
						>
							<Icon icon="icon-park-outline:right-c" class="text-lg" />
						</button>
					{:else}
						<button
							class="text-text-muted/30 flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-xl transition-all duration-300"
							disabled
							aria-label="Página siguiente"
						>
							<Icon icon="icon-park-outline:right-c" class="text-lg" />
						</button>
					{/if}
				</form>
			</div>
		{/if}
		<section class="flex flex-wrap justify-center gap-3 p-2">
			{#if typeof balanceDetails !== 'undefined' && viewState !== 'resume'}
				{#if balanceDetails.length === 0 && balanceDetailPagination?.totalItems === 0}
					<!-- totalItems comes from the same filtered COUNT as the rows,
					so both being zero is a genuinely empty (or filtered-to-empty)
					list, never a transient loading window. -->
					<div
						role="status"
						class="card-thread flex flex-col place-items-center gap-3 p-6 text-center"
					>
						{#if appliedQuery !== ''}
							<p class="text-text-secondary text-sm">
								Sin movimientos que coincidan con «{appliedQuery}».
							</p>
							<button
								type="button"
								onclick={clearSearch}
								class="btn-secondary rounded-xl px-3 py-2 text-sm"
							>
								Limpiar búsqueda
							</button>
						{:else}
							<p class="text-text-secondary text-sm">{emptyStateMessage()}</p>
						{/if}
					</div>
				{:else}
					{#if selectionModeIsVisible && balanceDetails.length > 0}
						<form
							action="?/delete_many_balance"
							method="post"
							use:enhance={() => {
								return async ({ result }) => {
									if (result.type === 'success') {
										if (result.data?.balanceDetailPagination) {
											setBalanceDetailPagination(
												result.data.balanceDetailPagination as BalanceDetailPagination
											);
										}
										// The batch is done: leave selection mode (this also
										// clears the ids the replaced list no longer holds).
										toggleSelectionModeIsVisible(false);
										const deletedCount = result.data?.deletedCount;
										if (typeof deletedCount === 'number' && deletedCount > 0) {
											toast(`${deletedCount} movimientos eliminados`);
										}
										// Order-linked refusals are announced like the cards
										// do — a partial no-op would read as silent success.
										const notice = result.data?.notice;
										if (typeof notice === 'string' && notice.length > 0) {
											toast(notice);
										}
										// Removed rows changed the range-scoped dashboard above.
										await invalidateAll();
									} else {
										// Keep the confirmation open so the failure can be
										// retried without re-selecting everything.
										toastActionFailure(result, 'No se pudieron eliminar los movimientos');
									}
								};
							}}
							class="card-thread flex w-full flex-row flex-wrap place-content-between items-center gap-3 p-3"
						>
							<input type="hidden" name="q" value={appliedQuery} />
							<input type="hidden" name="sort" value={appliedSort} />
							{@render rangeInputs()}
							{#each selectedIds as selectedId (selectedId)}
								<input type="hidden" name="balance_ids" value={selectedId} />
							{/each}
							<label
								class="text-text-secondary flex cursor-pointer flex-row place-items-center gap-2 text-sm"
							>
								<input
									type="checkbox"
									aria-label="Seleccionar todos los movimientos"
									checked={allVisibleSelected}
									onchange={toggleSelectAllVisible}
									class="h-4 w-4 accent-red-500"
								/>
								<span> Seleccionar todo </span>
							</label>
							{#if !confirmationDeleteManyIsVisible}
								<button
									type="button"
									disabled={selectedIds.length === 0}
									onclick={() => toggleConfirmationDeleteManyIsVisible(true)}
									onfocus={(e) => cancelFocus(e)}
									class="rounded-full bg-red-400 px-4 py-1.5 text-sm font-semibold text-stone-900 transition-all duration-300 focus:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
								>
									Eliminar ({selectedIds.length})
								</button>
							{:else}
								<div
									transition:scale={{ duration: 200 }}
									class="flex flex-row place-content-between gap-1 rounded-full bg-stone-700/20 p-1"
								>
									<button
										type="button"
										class="grow focus:text-red-500"
										style="font-family: 'PT Sans';"
										onclick={() => toggleConfirmationDeleteManyIsVisible(false)}
										onfocus={(e) => cancelFocus(e)}
									>
										Cancelar
									</button>
									<button
										type="submit"
										class="grow rounded-full bg-red-400 px-4 text-stone-900 focus:bg-red-500"
										style="font-family: 'PT Sans';"
										onfocus={(e) => cancelFocus(e)}
									>
										Confirmar
									</button>
								</div>
							{/if}
						</form>
					{/if}
					{#each balanceDetails as balanceDetail (balanceDetail.id)}
						<div
							transition:scale={{
								delay: 100 * (balanceDetails.indexOf(balanceDetail) + 1),
								duration: 200
							}}
							class="flex flex-row items-center gap-2"
						>
							{#if selectionModeIsVisible}
								<input
									type="checkbox"
									aria-label="Seleccionar movimiento {balanceDetail.reason ?? ''}"
									checked={selectedIds.includes(balanceDetail.id)}
									onchange={() => toggleBalanceDetailSelection(balanceDetail)}
									class="h-4 w-4 shrink-0 accent-red-500"
								/>
							{/if}
							<BalanceDetailCard
								{balanceDetail}
								{selectThisBalanceDetail}
								{balanceDetailSelected}
								{setBalanceDetailPagination}
								listParams={{
									q: appliedQuery,
									sort: appliedSort,
									rangeFrom: data.dashboard.range.from,
									rangeTo: data.dashboard.range.to
								}}
							/>
						</div>
					{/each}
				{/if}
			{/if}
			{#if viewState === 'resume'}
				<div
					transition:scale={{ delay: 100, duration: 200 }}
					class="card-thread flex flex-col place-items-center gap-4 self-start p-4"
				>
					<span class="text-text-secondary text-sm"> Ingresos </span>
					<span class="text-brand-400 text-xl font-bold tabular-nums">
						{formatCurrency(totalRevenue)}
					</span>
				</div>
				<div
					transition:scale={{ delay: 200, duration: 200 }}
					class="card-thread flex flex-col place-items-center gap-4 self-start p-4"
				>
					<span class="text-text-secondary text-sm"> Costos </span>
					<span class="text-brand-400 text-xl font-bold tabular-nums">
						{formatCurrency(totalCost)}
					</span>
				</div>
				<div
					transition:scale={{ delay: 300, duration: 200 }}
					class="card-thread flex flex-col place-items-center gap-4 self-start p-4"
				>
					<span class="text-text-secondary text-sm"> Gastos </span>
					<span class="text-brand-400 text-xl font-bold tabular-nums">
						{formatCurrency(totalExpense)}
					</span>
				</div>
			{/if}
		</section>
	{/if}
	{#if activeTab === 'pedidos'}
		<!-- "Hecho": the explicit exit from a ?cod= single-order lookup. It
			keeps the tab and the date range (dismissOrderFilter removes only
			the cod param) and navigates fully so remount reseeds the state. -->
		{#if cod}
			<div class="flex flex-row place-content-center">
				<button
					type="button"
					onclick={dismissOrderFilter}
					onfocus={(e) => cancelFocus(e)}
					class="text-text-secondary hover:text-brand-400 hover:border-brand-400/25 hover:bg-brand-400/5 rounded-xl border border-white/6 px-3 py-2 text-sm font-medium transition-all duration-300 active:scale-90"
				>
					Hecho
				</button>
			</div>
		{/if}
		<!-- Pagination rides the list, not the bar (same layout as the
			Movimientos toolbar): hidden during a ?cod= lookup, which shows a
			single order and has no pages to walk. -->
		{#if !cod}
			<div class="flex flex-row flex-wrap place-content-center items-center gap-3">
				<form
					action="?/orders_prev_page"
					method="post"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								if (result.data?.orderPagination) {
									setOrderPagination(result.data.orderPagination as OrderPagination);
								}
							} else {
								toastActionFailure(result, 'No se pudo actualizar la lista');
							}
						};
					}}
					class="flex flex-col place-content-center"
				>
					<input type="number" hidden name="current_page" value={orderPagination.currentPage} />
					<input type="number" hidden name="total_pages" value={orderPagination.totalPages} />
					<input type="hidden" name="view_state" value={ordersViewState} />
					{@render rangeInputs()}
					{#if orderPagination.currentPage > 1}
						<button
							class="text-text-secondary hover:text-brand-400 hover:bg-surface-2 flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 hover:border hover:border-white/8"
							onfocus={(e) => cancelFocus(e)}
							aria-label="Página anterior"
						>
							<Icon icon="icon-park-outline:left-c" class="text-lg" />
						</button>
					{:else}
						<button
							class="text-text-muted/30 flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-xl transition-all duration-300"
							disabled
							aria-label="Página anterior"
						>
							<Icon icon="icon-park-outline:left-c" class="text-lg" />
						</button>
					{/if}
				</form>
				<form
					action="?/orders_goto_page"
					method="post"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								if (result.data?.orderPagination) {
									setOrderPagination(result.data.orderPagination as OrderPagination);
								}
							} else {
								toastActionFailure(result, 'No se pudo actualizar la lista');
							}
						};
					}}
					class="relative flex flex-col place-content-center"
				>
					<input type="number" hidden name="goto_page" value={ordersGotoPage} />
					<input type="number" hidden name="total_pages" value={orderPagination.totalPages} />
					<input type="hidden" name="view_state" value={ordersViewState} />
					{@render rangeInputs()}
					<button
						bind:this={ordersGotoTriggerElement}
						type="button"
						class="bg-surface-2/80 text-text-primary hover:bg-surface-2 hover:border-brand-400/20 h-9 w-12 rounded-xl border border-white/6 text-sm font-semibold transition-all duration-300"
						onclick={() => toggleOrdersGotoPageListIsVisible()}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Ir a página"
						aria-haspopup="listbox"
						aria-expanded={ordersGotoPageListIsVisible}
						aria-controls={ordersGotoPageListIsVisible ? 'orders-goto-listbox' : undefined}
					>
						{orderPagination.currentPage}
					</button>
					{#if ordersGotoPageListIsVisible}
						<div
							bind:this={ordersGotoListElement}
							transition:scale
							class="bg-surface-1/95 shadow-depth absolute top-9 z-50 flex max-h-48 w-16 flex-col place-self-center overflow-y-auto rounded-xl border border-white/8 py-1 backdrop-blur-xl"
							role="listbox"
							id="orders-goto-listbox"
							aria-label="Ir a página"
							tabindex="-1"
							onfocusout={onOrdersGotoListFocusout}
						>
							<ul class="py-1">
								{#each createOrdersListPages(orderPagination.totalPages) as pageNumber (pageNumber)}
									<li>
										<button
											class="w-full px-3 py-2 text-center text-sm transition-all {pageNumber ===
											orderPagination.currentPage
												? 'text-brand-400 bg-brand-400/10'
												: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'}"
											onclick={() => {
												ordersGotoPage = pageNumber;
												toggleOrdersGotoPageListIsVisible(false);
											}}
											onfocus={(e) => cancelFocus(e)}
										>
											{pageNumber}
										</button>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</form>
				<form
					action="?/orders_next_page"
					method="post"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								if (result.data?.orderPagination) {
									setOrderPagination(result.data.orderPagination as OrderPagination);
								}
							} else {
								toastActionFailure(result, 'No se pudo actualizar la lista');
							}
						};
					}}
					class="flex flex-col place-content-center"
				>
					<input type="number" hidden name="current_page" value={orderPagination.currentPage} />
					<input type="number" hidden name="total_pages" value={orderPagination.totalPages} />
					<input type="hidden" name="view_state" value={ordersViewState} />
					{@render rangeInputs()}
					{#if orderPagination.currentPage < orderPagination.totalPages}
						<button
							class="text-text-secondary hover:text-brand-400 hover:bg-surface-2 flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 hover:border hover:border-white/8"
							onfocus={(e) => cancelFocus(e)}
							aria-label="Página siguiente"
						>
							<Icon icon="icon-park-outline:right-c" class="text-lg" />
						</button>
					{:else}
						<button
							class="text-text-muted/30 flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-xl transition-all duration-300"
							disabled
							aria-label="Página siguiente"
						>
							<Icon icon="icon-park-outline:right-c" class="text-lg" />
						</button>
					{/if}
				</form>
			</div>
		{/if}
		<section class="flex flex-wrap justify-center gap-3 p-2">
			{#each orders as order (order.id)}
				<div transition:scale={{ delay: 100 * (orders.indexOf(order) + 1), duration: 200 }}>
					<OrderCard {order} />
				</div>
			{/each}
		</section>
	{/if}
</div>

<form
	action="?/refresh_totals"
	method="post"
	use:enhance={() => {
		return async ({ result }) => {
			if (result.type === 'success') {
				if (
					typeof result.data !== 'undefined' &&
					'totalRevenue' in result.data &&
					'totalCost' in result.data &&
					'totalExpense' in result.data
				) {
					totalRevenue = result.data.totalRevenue as number;
					totalCost = result.data.totalCost as number;
					totalExpense = result.data.totalExpense as number;
				}
			}
		};
	}}
>
	<button bind:this={btnRefreshTotals} type="submit" class="hidden"> Refresh Totals </button>
</form>
