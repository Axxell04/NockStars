<script lang="ts">
	import { enhance } from '$app/forms';
	import { fade, scale } from 'svelte/transition';
	import type { PageProps } from './$types';
	import type { BalanceDetail, BalanceDetailPagination } from '$lib/interfaces/balance';
	import Icon from '@iconify/svelte';
	import BalanceDetailCard from '$lib/components/BalanceDetailCard.svelte';
	import FinanceKpiCard from '$lib/components/FinanceKpiCard.svelte';
	import FinanceRanking from '$lib/components/FinanceRanking.svelte';
	import FinanceTrendChart from '$lib/components/FinanceTrendChart.svelte';
	import { cancelFocus } from '$lib/focus';

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
			display:
				salesMetric === 'units' ? `${product.units} unid.` : `$ ${product.revenue.toFixed(2)}`
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

	let balanceDetailPagination: BalanceDetailPagination | undefined = $state();
	let balanceDetails: BalanceDetail[] | undefined = $derived(
		balanceDetailPagination?.balanceDetails
	);

	let balanceDetailSelected: BalanceDetail | undefined = $state();

	let gotoPage: number | undefined = $state();

	// View State
	let viewState: ViewState = $state('resume');

	// HTML Elements
	let selectStateElement: HTMLButtonElement | undefined = $state();
	let btnRefreshTotals: HTMLButtonElement | undefined = $state();

	let selectStateElementHeight: number = $state(9);

	// Visible Elements
	let gotoPageListIsVisible = $state(false);
	let stateListIsVisible = $state(false);
	let addPanelIsVisible = $state(false);

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

	function toggleAddPanelIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			addPanelIsVisible = visible;
		} else {
			addPanelIsVisible = !addPanelIsVisible;
		}
	}

	// Setter Functions
	function setBalanceDetailPagination(
		newBalanceDetailPagination: BalanceDetailPagination | undefined
	) {
		balanceDetailPagination = newBalanceDetailPagination;
	}

	function refreshBalanceDetails() {
		if (typeof balanceDetailPagination === 'undefined') {
			return;
		}
		const newBalanceDetails = balanceDetailPagination.balanceDetails;
		balanceDetailPagination.balanceDetails = [];
		setTimeout(() => {
			if (typeof balanceDetailPagination === 'undefined') {
				return;
			}
			balanceDetailPagination.balanceDetails = newBalanceDetails;
		}, 200);
	}

	function selectThisBalanceDetail(balanceDetail: BalanceDetail | undefined) {
		balanceDetailSelected = balanceDetail;
	}

	// Request Functions
	function refreshTotals() {
		if (typeof btnRefreshTotals !== 'undefined' && viewState === 'resume') {
			btnRefreshTotals.click();
		}
	}

	function createListPages(totalPages: number) {
		let list = [];
		for (let index = 1; index <= totalPages; index++) {
			list.push(index);
		}

		return list;
	}

	$effect(() => {
		if (typeof selectStateElement !== 'undefined' && stateListIsVisible) {
			selectStateElementHeight = selectStateElement.clientHeight;
		}
	});

	$effect(() => {
		if (viewState === 'resume') {
			refreshTotals();
		}
	});
</script>

<div in:fade class="flex max-h-full max-w-full flex-col gap-2 px-5 py-5">
	<section class="sticky top-0 z-40 w-full">
		<div
			class="glass text-brand-400 relative flex flex-wrap place-content-between place-items-center gap-3 rounded-2xl border border-white/4 p-4 text-center font-normal"
		>
			<div
				class="via-brand-400/20 absolute top-0 right-1/4 left-1/4 h-[1px] bg-gradient-to-r from-transparent to-transparent"
			></div>
			<div class="flex flex-row place-items-center gap-3">
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
									refreshBalanceDetails();
								} else {
									setBalanceDetailPagination(undefined);
								}
							}
						};
					}}
					class="relative flex flex-col place-content-center"
				>
					<input type="text" hidden name="view_state" value={viewState} />
					<button
						bind:this={selectStateElement}
						type="button"
						class="bg-surface-2/80 text-text-primary hover:border-brand-400/20 hover:bg-surface-2 flex items-center gap-2 rounded-xl border border-white/6 px-4 py-2 text-sm font-medium transition-all duration-300"
						onclick={() => toggleStateListIsVisible()}
						onfocus={(e) => cancelFocus(e)}
						aria-haspopup="listbox"
						aria-expanded={stateListIsVisible}
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
							transition:scale
							class="bg-surface-1/95 shadow-depth absolute z-50 flex max-h-60 w-48 flex-col place-self-center overflow-y-auto rounded-xl border border-white/8 backdrop-blur-xl"
							style="top: {selectStateElementHeight}px;"
							role="listbox"
						>
							<ul class="py-1">
								<li>
									<button
										class="w-full px-4 py-2.5 text-left text-sm transition-all {viewState ===
										'resume'
											? 'text-brand-400 bg-brand-400/10'
											: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:pl-5'}"
										onclick={() => {
											viewState = 'resume';
											toggleStateListIsVisible(false);
										}}
									>
										Resumen
									</button>
								</li>
								<li>
									<button
										class="w-full px-4 py-2.5 text-left text-sm transition-all {viewState ===
										'revenue'
											? 'text-brand-400 bg-brand-400/10'
											: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:pl-5'}"
										onclick={() => {
											viewState = 'revenue';
											toggleStateListIsVisible(false);
										}}
									>
										Ingresos
									</button>
								</li>
								<li>
									<button
										class="w-full px-4 py-2.5 text-left text-sm transition-all {viewState === 'cost'
											? 'text-brand-400 bg-brand-400/10'
											: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:pl-5'}"
										onclick={() => {
											viewState = 'cost';
											toggleStateListIsVisible(false);
										}}
									>
										Costos
									</button>
								</li>
								<li>
									<button
										class="w-full px-4 py-2.5 text-left text-sm transition-all {viewState ===
										'expense'
											? 'text-brand-400 bg-brand-400/10'
											: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:pl-5'}"
										onclick={() => {
											viewState = 'expense';
											toggleStateListIsVisible(false);
										}}
									>
										Gastos
									</button>
								</li>
							</ul>
						</div>
					{/if}
				</form>
				{#if typeof balanceDetailPagination !== 'undefined' && viewState !== 'resume'}
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
										gotoPage = undefined;
									}
								}
							};
						}}
						class="relative flex flex-col place-content-center"
					>
						<input type="number" hidden name="goto_page" value={gotoPage} />
						<input type="hidden" name="view_state" value={viewState} />
						<button
							type="button"
							class="bg-surface-2/80 text-text-primary hover:bg-surface-2 hover:border-brand-400/20 h-9 w-12 rounded-xl border border-white/6 text-sm font-semibold transition-all duration-300"
							onclick={() => toggleGotoPageListIsVisible()}
							onfocus={(e) => cancelFocus(e)}
							aria-label="Ir a página"
							aria-haspopup="listbox"
							aria-expanded={gotoPageListIsVisible}
						>
							{balanceDetailPagination.currentPage}
						</button>
						{#if gotoPageListIsVisible}
							<div
								transition:scale
								class="bg-surface-1/95 shadow-depth absolute top-9 z-50 flex max-h-48 w-16 flex-col place-self-center overflow-y-auto rounded-xl border border-white/8 backdrop-blur-xl"
								role="listbox"
							>
								<ul class="py-1">
									{#each createListPages(balanceDetailPagination.totalPages) as page}
										<li>
											<button
												class="w-full px-3 py-2 text-center text-sm transition-all {page ===
												balanceDetailPagination.currentPage
													? 'text-brand-400 bg-brand-400/10'
													: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'}"
												onclick={() => {
													gotoPage = page;
													toggleGotoPageListIsVisible(false);
												}}
												onfocus={(e) => cancelFocus(e)}
											>
												{page}
											</button>
										</li>
									{/each}
								</ul>
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
				{/if}
			</div>
		</div>
	</section>
	<section class="flex flex-col gap-3" aria-label="Panel del periodo">
		<div
			class="glass relative flex flex-wrap place-content-between place-items-center gap-3 rounded-2xl border border-white/4 p-4"
		>
			<nav class="flex flex-row flex-wrap place-items-center gap-2" aria-label="Rango de fechas">
				<a
					href={data.dashboard.range.presetHrefs.month}
					aria-current={data.dashboard.range.preset === 'month' ? 'page' : undefined}
					class="rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-300 {data
						.dashboard.range.preset === 'month'
						? 'border-brand-400/20 bg-brand-400/10 text-brand-400'
						: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary border-white/6'}"
				>
					Mes actual
				</a>
				<a
					href={data.dashboard.range.presetHrefs.lastMonth}
					aria-current={data.dashboard.range.preset === 'last-month' ? 'page' : undefined}
					class="rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-300 {data
						.dashboard.range.preset === 'last-month'
						? 'border-brand-400/20 bg-brand-400/10 text-brand-400'
						: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary border-white/6'}"
				>
					Mes pasado
				</a>
				<a
					href={data.dashboard.range.presetHrefs.last7}
					aria-current={data.dashboard.range.preset === 'last-7-days' ? 'page' : undefined}
					class="rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-300 {data
						.dashboard.range.preset === 'last-7-days'
						? 'border-brand-400/20 bg-brand-400/10 text-brand-400'
						: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary border-white/6'}"
				>
					Últimos 7 días
				</a>
				<form method="get" action="/admin/balance" class="flex flex-row flex-wrap items-end gap-2">
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
			<a
				href="/admin/pedidos"
				class="text-text-secondary hover:text-brand-400 hover:bg-surface-2 flex flex-row place-items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200"
			>
				<span> Ver pedidos </span>
				<Icon icon="mdi:arrow-right" class="text-base" />
			</a>
		</div>
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
					<div class="bg-surface-2/80 flex flex-row rounded-xl border border-white/6 p-0.5 text-xs">
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
							$ {data.dashboard.cartAbandonment.value.toFixed(2)}
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
	<section class="flex flex-col place-items-center">
		{#if typeof balanceDetails !== 'undefined' && viewState !== 'resume'}
			<div class="flex flex-col gap-2">
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
				{:else}
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
										refreshBalanceDetails();
										formElement.reset();
										toggleAddPanelIsVisible(false);
									}
								}
							};
						}}
						class="glass flex flex-col gap-3 rounded-2xl border border-white/4 p-4"
					>
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
			</div>
		{:else if viewState === 'resume'}
			<div class="flex flex-row place-content-center place-items-center gap-3 text-center">
				<span class="text-text-secondary"> Ganancias: </span>
				<span class="text-brand-400 font-bold tabular-nums">
					$ {profits.toFixed(2)}
				</span>
			</div>
		{/if}
	</section>
	<section class="flex flex-wrap justify-center gap-3 p-2">
		<!-- {#key Date.now()} -->
		{#if typeof balanceDetails !== 'undefined' && viewState !== 'resume'}
			{#each balanceDetails as balanceDetail (balanceDetail.id)}
				<div
					transition:scale={{
						delay: 100 * (balanceDetails.indexOf(balanceDetail) + 1),
						duration: 200
					}}
				>
					<BalanceDetailCard
						{balanceDetail}
						{selectThisBalanceDetail}
						{balanceDetailSelected}
						{setBalanceDetailPagination}
					/>
				</div>
			{/each}
		{/if}
		<!-- {/key} -->
		{#if viewState === 'resume'}
			<div
				transition:scale={{ delay: 100, duration: 200 }}
				class="card-thread flex flex-col place-items-center gap-4 self-start p-4"
			>
				<span class="text-text-secondary text-sm"> Ingresos </span>
				<span class="text-brand-400 text-xl font-bold tabular-nums">
					$ {totalRevenue.toFixed(2)}
				</span>
			</div>
			<div
				transition:scale={{ delay: 200, duration: 200 }}
				class="card-thread flex flex-col place-items-center gap-4 self-start p-4"
			>
				<span class="text-text-secondary text-sm"> Costos </span>
				<span class="text-brand-400 text-xl font-bold tabular-nums">
					$ {totalCost.toFixed(2)}
				</span>
			</div>
			<div
				transition:scale={{ delay: 300, duration: 200 }}
				class="card-thread flex flex-col place-items-center gap-4 self-start p-4"
			>
				<span class="text-text-secondary text-sm"> Gastos </span>
				<span class="text-brand-400 text-xl font-bold tabular-nums">
					$ {totalExpense.toFixed(2)}
				</span>
			</div>
		{/if}
	</section>
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
