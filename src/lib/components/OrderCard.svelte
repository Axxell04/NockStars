<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { Order, OrderPagination } from '$lib/interfaces/order';
	import { lineKey, toOrderLines, type OrderLine } from '$lib/order-content';
	import { scale, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { enhance } from '$app/forms';

	interface Props {
		order: Order;
		orderSelected?: Order;
		selectThisOrder: (order: Order | undefined) => void;
		setOrderPagination: (newOrderPagination: OrderPagination) => void;
		updateOrderPaginationContent: (orderId: string, newLines: OrderLine[]) => void;
	}

	let {
		order,
		orderSelected,
		selectThisOrder,
		setOrderPagination,
		updateOrderPaginationContent
	}: Props = $props();

	let isSelected = $derived(order.id === orderSelected?.id);
	let orderLines = $derived(toOrderLines(order.content));
	// `$state.raw`, not `$state`: toOrderLines() returns a raw array, and a plain
	// `$state` would re-proxy it on every assignment so `previous !== orderLines`
	// could never become false — the auto-submit effect below would loop until
	// `effect_update_depth_exceeded`. Referencing `orderLines` here would also
	// trigger `state_referenced_locally`, so previous starts empty and the effect
	// syncs it on its first run.
	let previousOrderLines = $state.raw<OrderLine[]>([]);
	let totalValue = $derived(orderLines.reduce((pv, cv) => pv + cv.amount * cv.unitPrice, 0));

	let selectedLine: OrderLine | undefined = $state();

	// HTML Elements
	let btnEditOrder: HTMLButtonElement | undefined = $state();
	let btnDeleteOrder: HTMLButtonElement | undefined = $state();

	// Visible Elements
	let confirmationDeleteIsVisible = $state(false);
	let confirmationEditIsVisible = $state(false);

	// Toggle Visible Elements
	function toggleConfirmationDeleteIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			confirmationDeleteIsVisible = visible;
		} else {
			confirmationDeleteIsVisible = !confirmationDeleteIsVisible;
		}
	}

	function toggleConfirmationEditIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			confirmationEditIsVisible = visible;
		} else {
			confirmationEditIsVisible = !confirmationEditIsVisible;
		}
	}

	// Seletion Functions
	function selectThisLine(line: OrderLine | undefined) {
		if (typeof line !== 'undefined') {
			selectedLine = { ...line };
		} else {
			selectedLine = undefined;
		}
	}

	function capitalize(value: string): string {
		return value.charAt(0).toUpperCase() + value.slice(1);
	}

	// Chip labels for a line's variant snapshots. Empty when the line carries
	// no variant (legacy shape or variant-less product): the row then renders
	// exactly as before instead of showing placeholder chips.
	function lineChips(line: OrderLine): string[] {
		const chips: string[] = [];
		if (line.size) chips.push(`Talla ${line.size}`);
		if (line.color) chips.push(line.color);
		if (line.cut) chips.push(capitalize(line.cut));
		return chips;
	}

	// Operation Functions
	function addSelectedLineAmount() {
		if (typeof selectedLine !== 'undefined') {
			selectedLine = {
				...selectedLine,
				amount: selectedLine.amount + 1
			};
		}
	}

	function subtractSelectedLineAmount() {
		if (typeof selectedLine !== 'undefined') {
			if (selectedLine.amount > 0) {
				selectedLine = {
					...selectedLine,
					amount: selectedLine.amount - 1
				};
			}
		}
	}

	// Request Functions
	function sendEditOrder() {
		if (typeof btnEditOrder !== 'undefined' && typeof selectedLine !== 'undefined') {
			let updatedLines = orderLines.map((line) => {
				if (selectedLine && lineKey(line) === lineKey(selectedLine)) {
					return { ...selectedLine };
				}
				return line;
			});

			if (
				updatedLines.length === 1 &&
				updatedLines[0].amount === 0 &&
				typeof btnDeleteOrder !== 'undefined'
			) {
				btnDeleteOrder.click();
			} else {
				previousOrderLines = [...orderLines];
				updateOrderPaginationContent(order.id, updatedLines);
			}
		}
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
		if (!isSelected && (confirmationDeleteIsVisible || confirmationEditIsVisible)) {
			toggleConfirmationDeleteIsVisible(false);
			toggleConfirmationEditIsVisible(false);
			selectThisLine(undefined);
		}
	});

	$effect(() => {
		if (confirmationDeleteIsVisible) {
			toggleConfirmationEditIsVisible(false);
			selectThisLine(undefined);
		}
	});

	$effect(() => {
		if (confirmationEditIsVisible) {
			toggleConfirmationDeleteIsVisible(false);
		}
	});

	$effect(() => {
		if (!confirmationEditIsVisible && typeof selectedLine !== 'undefined') {
			selectThisLine(undefined);
		}
	});

	$effect(() => {
		if (previousOrderLines !== orderLines) {
			previousOrderLines = orderLines;
			if (confirmationEditIsVisible && typeof btnEditOrder !== 'undefined') {
				btnEditOrder.click();
			}
		}
	});
</script>

<div class="flex flex-row place-items-center">
	<div
		class="card-thread flex flex-col gap-3 self-start rounded-2xl p-3 {confirmationEditIsVisible
			? 'rounded-l-md'
			: ''}"
		tabindex="0"
		onkeydown={() => {}}
		role="button"
	>
		<div class="flex flex-row place-content-between place-items-center gap-2">
			<div class="flex flex-row place-items-center gap-2">
				<Icon icon="akar-icons:shopping-bag" class="text-text-secondary text-2xl" />
				<span class="text-text-primary text-lg font-semibold">
					{orderLines.length}
				</span>
			</div>
			{#if order.completed}
				<span
					class="text-text-muted rounded-full border border-white/10 px-2 py-0.5 text-xs font-medium"
				>
					Completada
				</span>
			{:else}
				<span
					class="border-brand-400/30 bg-brand-400/10 text-brand-400 rounded-full border px-2 py-0.5 text-xs font-medium"
				>
					Pendiente
				</span>
			{/if}
		</div>
		<div class="flex min-w-0 flex-row place-items-center gap-2">
			<Icon icon="solar:user-linear" class="text-text-secondary flex-shrink-0 text-2xl" />
			<span class="text-text-primary truncate text-lg">
				{order.clientName}
			</span>
		</div>
		<div class="">
			<div class="flex flex-col gap-2">
				{#each orderLines as line}
					<div
						class="flex min-w-0 flex-col gap-1 rounded-lg border px-2 py-1.5 transition-colors duration-150 {selectedLine &&
						lineKey(selectedLine) === lineKey(line)
							? 'border-brand-400/40 bg-brand-400/10'
							: 'bg-surface-2/60 border-white/5'} place-content-between place-items-center"
						onclick={() => {
							if (confirmationEditIsVisible) {
								selectThisLine(line);
							}
						}}
						role="button"
						tabindex="0"
						onkeydown={() => {}}
					>
						<div
							class="flex w-full min-w-0 flex-row place-content-between place-items-center gap-2"
						>
							<div class="flex min-w-0 flex-row place-items-center gap-2">
								<span class="text-text-primary truncate text-sm">
									{line.name}
								</span>
								<span class="text-text-secondary flex-shrink-0 text-sm">
									({line.amount})
								</span>
							</div>
							<span class="text-text-primary flex-shrink-0 text-sm font-semibold">
								$ {(line.unitPrice * line.amount).toFixed(2)}
							</span>
						</div>
						{#if line.size ?? line.color ?? line.cut}
							<div class="flex w-full flex-wrap gap-1">
								{#each lineChips(line) as chip}
									<span
										class="bg-surface-0/60 text-text-secondary rounded-md border border-white/8 px-1.5 py-px text-xs"
									>
										{chip}
									</span>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
				<div
					class="bg-surface-2 mt-1 flex flex-row place-content-between place-items-center gap-1 rounded-lg px-2 py-1 text-sm"
				>
					<span class="text-text-secondary">Total</span>
					<span class="text-text-primary font-semibold">
						$ {totalValue.toFixed(2)}
					</span>
				</div>
			</div>
		</div>
		<div class="text-text-muted flex min-w-0 flex-row justify-center gap-2 text-xs">
			<span class="flex-shrink-0 font-bold">COD:</span>
			<span class="break-all">
				{order.id}
			</span>
		</div>
		<span class="text-text-muted place-self-center text-xs">
			{order.createdAt.toLocaleDateString('es-EC', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			})}
		</span>
		{#if !isSelected}
			<button
				in:scale={{ duration: 160, easing: cubicOut }}
				class="bg-surface-2/60 text-text-secondary hover:bg-surface-2 hover:text-text-primary flex w-full flex-col place-items-center rounded-full py-0.5 transition-[background-color,color,transform] duration-150 active:scale-95"
				onclick={() => selectThisOrder(order)}
				aria-label="Expandir pedido"
			>
				<Icon icon="mingcute:down-line" />
			</button>
		{:else}
			<form
				in:scale
				action=""
				method="post"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							if (result.data?.orderPagination) {
								setOrderPagination(result.data.orderPagination as OrderPagination);
							}
						}
					};
				}}
				class="flex flex-col gap-2"
			>
				<input type="hidden" name="total_value" id="total_value" value={totalValue.toFixed(2)} />
				<div
					class="bg-surface-2/60 flex flex-row place-content-around gap-2 rounded-full p-1 text-2xl"
				>
					<input type="hidden" name="order_id" value={order.id} />
					<button
						type="button"
						class="text-text-secondary hover:text-brand-400 rounded-full px-2 py-1 transition-[background-color,color,transform] duration-150 active:scale-90 {confirmationDeleteIsVisible
							? 'bg-brand-400 text-surface-0'
							: ''}"
						onclick={() => toggleConfirmationDeleteIsVisible(true)}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Eliminar pedido"
					>
						<Icon icon="famicons:trash" />
					</button>
					<button
						type="button"
						class="text-text-secondary hover:text-brand-400 rounded-full px-2 py-1 transition-[background-color,color,transform] duration-150 active:scale-90 {confirmationEditIsVisible
							? 'bg-brand-400 text-surface-0'
							: ''}"
						onclick={() => toggleConfirmationEditIsVisible(true)}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Editar pedido"
					>
						<Icon icon="mdi:edit-outline" />
					</button>
					<button
						formaction="?/update_order_state"
						class="text-text-secondary hover:text-brand-400 rounded-full px-2 py-1 transition-[background-color,color,transform] duration-150 active:scale-90"
						onfocus={(e) => cancelFocus(e)}
						aria-label={order.completed
							? 'Marcar pedido como pendiente'
							: 'Marcar pedido como completado'}
					>
						{#if order.completed}
							<Icon icon="solar:cart-cross-bold" class="text-3xl" />
						{:else}
							<Icon icon="solar:cart-check-bold" class="text-3xl" />
						{/if}
					</button>
				</div>
				{#if confirmationDeleteIsVisible}
					<div
						transition:scale={{ duration: 200, easing: cubicOut }}
						class="bg-surface-2/60 flex flex-row place-content-between gap-1 rounded-2xl p-1"
					>
						<button
							type="button"
							class="text-text-secondary hover:bg-surface-2 hover:text-text-primary grow rounded-xl px-2 py-1 text-sm transition-[background-color,color,transform] duration-150 active:scale-95"
							onclick={() => toggleConfirmationDeleteIsVisible(false)}
							onfocus={(e) => cancelFocus(e)}
						>
							Cancelar
						</button>
						<button
							formaction="?/delete_order"
							class="grow rounded-xl bg-red-500 p-1 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-red-600 active:scale-95"
							onfocus={(e) => cancelFocus(e)}
						>
							Confirmar
						</button>
					</div>
				{:else if confirmationEditIsVisible}
					<div
						transition:scale={{ duration: 200, easing: cubicOut }}
						class="bg-surface-2/60 flex flex-row place-content-between gap-1 rounded-2xl p-1"
					>
						<button
							type="button"
							class="text-text-secondary hover:bg-surface-2 hover:text-text-primary grow rounded-xl px-2 py-1 text-sm transition-[background-color,color,transform] duration-150 active:scale-95"
							onclick={() => toggleConfirmationEditIsVisible(false)}
							onfocus={(e) => cancelFocus(e)}
						>
							Cancelar
						</button>
						<button
							type="button"
							class="grow rounded-xl bg-red-500 p-1 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-red-600 active:scale-95"
							onclick={() => sendEditOrder()}
							onfocus={(e) => cancelFocus(e)}
						>
							Confirmar
						</button>

						{#if confirmationEditIsVisible}
							<input type="hidden" name="content" value={JSON.stringify(order.content)} />
						{/if}
					</div>
				{/if}

				<button bind:this={btnDeleteOrder} type="submit" formaction="?/delete_order" class="hidden">
					Delete Order
				</button>
				<button bind:this={btnEditOrder} type="submit" formaction="?/edit_order" class="hidden">
					Edit Order
				</button>
			</form>
		{/if}
	</div>

	{#if confirmationEditIsVisible && selectedLine}
		<div
			transition:slide={{ axis: 'x', duration: 200, easing: cubicOut }}
			class="bg-surface-1 flex flex-col gap-3 self-start rounded-r-2xl border border-l-0 border-white/8 p-3"
			tabindex="0"
			onkeydown={() => {}}
			role="button"
		>
			<span class="text-text-primary text-sm font-semibold">
				{selectedLine.name}
			</span>
			{#if selectedLine.size ?? selectedLine.color ?? selectedLine.cut}
				<div class="flex max-w-40 flex-wrap gap-1">
					{#each lineChips(selectedLine) as chip}
						<span
							class="bg-surface-0/60 text-text-secondary rounded-md border border-white/8 px-1.5 py-px text-xs"
						>
							{chip}
						</span>
					{/each}
				</div>
			{/if}
			<div class="flex flex-col place-items-center gap-2">
				<span class="text-text-secondary text-xs">Cantidad</span>
				<div class="flex flex-row place-items-center gap-2">
					<button
						class="text-text-secondary hover:border-brand-400/30 hover:text-brand-400 rounded-full border border-white/10 p-1.5 transition-[border-color,color,transform] duration-150 active:scale-90"
						onclick={() => subtractSelectedLineAmount()}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Reducir cantidad"
					>
						<Icon icon="octicon:dash-16" />
					</button>
					<span class="text-text-primary min-w-6 text-center text-lg font-semibold tabular-nums">
						{selectedLine.amount}
					</span>
					<button
						class="text-text-secondary hover:border-brand-400/30 hover:text-brand-400 rounded-full border border-white/10 p-1.5 transition-[border-color,color,transform] duration-150 active:scale-90"
						onclick={() => addSelectedLineAmount()}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Aumentar cantidad"
					>
						<Icon icon="ic:round-plus" />
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
