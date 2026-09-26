<script lang="ts">
	import { enhance } from '$app/forms';
	import { fade, scale } from 'svelte/transition';
	import type { PageProps } from './$types';
	import type { BalanceDetail, BalanceDetailPagination } from '$lib/interfaces/balance';
	import Icon from '@iconify/svelte';
	import BalanceDetailCard from '$lib/components/BalanceDetailCard.svelte';

	let { data }: PageProps = $props();
	let totalRevenue = $state(data.totalRevenue);
	let totalCost = $state(data.totalCost);
	let totalExpense = $state(data.totalExpense);
	let profits = $derived(totalRevenue - (totalCost + totalExpense));

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

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
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
					<!-- <OrderCard {order} {selectThisOrder} {orderSelected} {setOrderPagination} {updateOrderPaginationContent} /> -->
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
