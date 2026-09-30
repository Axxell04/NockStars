<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { Order, OrderPagination } from '$lib/interfaces/order';
	import { toOrderLines, type OrderLine } from '$lib/order-content';
	import { scale, slide } from 'svelte/transition';
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
				if (line.productId === selectedLine?.productId) {
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
		class="flex flex-col gap-4 p-2 {confirmationEditIsVisible
			? 'rounded-l-md'
			: 'rounded-md'} card self-start bg-stone-800"
		tabindex="0"
		onkeydown={() => {}}
		role="button"
	>
		<div class="flex flex-row place-content-between place-items-center gap-2">
			<div class="flex flex-row place-content-between place-items-center gap-2 px-1 text-xl">
				<Icon icon="akar-icons:shopping-bag" class="text-3xl" />
				<span class="translate-y-1">
					{orderLines.length}
				</span>
			</div>
			<div class="flex min-w-0 flex-row place-items-center gap-2 text-xl">
				<Icon icon="solar:user-linear" class="flex-shrink-0 text-3xl" />
				<span class="truncate">
					{order.clientName}
				</span>
			</div>
		</div>
		<div class="">
			<div class="flex flex-col gap-2">
				{#each orderLines as line}
					<div
						class="flex flex-row gap-1 {selectedLine?.productId === line.productId
							? 'bg-stone-700/60'
							: 'bg-stone-700/20'} min-w-0 place-content-between place-items-center rounded-sm px-2"
						onclick={() => {
							if (confirmationEditIsVisible) {
								selectThisLine(line);
							}
						}}
						role="button"
						tabindex="0"
						onkeydown={() => {}}
					>
						<div class="flex min-w-0 flex-row place-items-center gap-2">
							<span class="truncate">
								{line.name}
							</span>
							<span class="flex-shrink-0">
								({line.amount})
							</span>
						</div>
						<span class="flex-shrink-0 font-semibold">
							$ {(line.unitPrice * line.amount).toFixed(2)}
						</span>
					</div>
				{/each}
				<div
					class="mt-1 flex flex-row place-content-between place-items-center gap-1 rounded-sm bg-stone-700/40 px-2"
				>
					<span> Total </span>
					<span class="font-semibold">
						$ {totalValue.toFixed(2)}
					</span>
				</div>
			</div>
		</div>
		<div class="flex min-w-0 flex-row justify-center gap-3">
			<span class="flex-shrink-0 font-bold"> COD: </span>
			<span class="break-all">
				{order.id}
			</span>
		</div>
		<span class="place-self-center">
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
				in:scale
				class="flex w-full flex-col place-items-center rounded-full bg-stone-700/20"
				onclick={() => selectThisOrder(order)}
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
				<div class="flex flex-row place-content-around gap-2 rounded-full bg-stone-700/20 text-3xl">
					<input type="hidden" name="order_id" value={order.id} />
					<button
						type="button"
						class="rounded-full px-1 focus:text-red-500 {confirmationDeleteIsVisible
							? 'bg-red-400 text-stone-800/90'
							: ''}"
						onclick={() => toggleConfirmationDeleteIsVisible(true)}
						onfocus={(e) => cancelFocus(e)}
					>
						<Icon icon="famicons:trash" />
					</button>
					<button
						type="button"
						class="rounded-full px-1 focus:text-red-500 {confirmationEditIsVisible
							? 'bg-red-400 text-stone-800/90'
							: ''}"
						onclick={() => toggleConfirmationEditIsVisible(true)}
						onfocus={(e) => cancelFocus(e)}
					>
						<Icon icon="mdi:edit-outline" />
					</button>
					<button
						formaction="?/update_order_state"
						class="focus:text-red-500"
						onfocus={(e) => cancelFocus(e)}
					>
						{#if order.completed}
							<Icon icon="solar:cart-cross-bold" class="text-4xl" />
						{:else}
							<Icon icon="solar:cart-check-bold" class="text-4xl" />
						{/if}
					</button>
				</div>
				{#if confirmationDeleteIsVisible}
					<div
						transition:scale={{ duration: 200 }}
						class="flex flex-row place-content-between gap-1 rounded-full bg-stone-700/20 p-1"
					>
						<button
							type="button"
							class="grow focus:text-red-500"
							style="font-family: 'PT Sans';"
							onclick={() => toggleConfirmationDeleteIsVisible(false)}
							onfocus={(e) => cancelFocus(e)}
						>
							Cancelar
						</button>
						<button
							formaction="?/delete_order"
							class="grow rounded-full bg-red-400 p-1 text-stone-900 focus:bg-red-500"
							style="font-family: 'PT Sans';"
							onfocus={(e) => cancelFocus(e)}
						>
							Confirmar
						</button>
					</div>
				{:else if confirmationEditIsVisible}
					<div
						transition:scale={{ duration: 200 }}
						class="flex flex-row place-content-between gap-1 rounded-full bg-stone-700/20 p-1"
					>
						<button
							type="button"
							class="grow focus:text-red-500"
							style="font-family: 'PT Sans';"
							onclick={() => toggleConfirmationEditIsVisible(false)}
							onfocus={(e) => cancelFocus(e)}
						>
							Cancelar
						</button>
						<button
							type="button"
							class="grow rounded-full bg-red-400 p-1 text-stone-900 focus:bg-red-500"
							style="font-family: 'PT Sans';"
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
			transition:slide={{ axis: 'x' }}
			class="card flex flex-col gap-4 self-start rounded-r-md bg-stone-800 p-2"
			tabindex="0"
			onkeydown={() => {}}
			role="button"
		>
			<span>
				{selectedLine.name}
			</span>
			<div class="flex flex-col place-items-center gap-3">
				<span> Cantidad </span>
				<div class="flex flex-row place-items-center gap-2 text-lg">
					<button
						class="rounded-full border p-1 hover:text-red-500 focus:text-red-500"
						onclick={() => subtractSelectedLineAmount()}
						onfocus={(e) => cancelFocus(e)}
					>
						<Icon icon="octicon:dash-16" />
					</button>
					<span>
						{selectedLine.amount}
					</span>
					<button
						class="rounded-full border p-1 hover:text-red-500 focus:text-red-500"
						onclick={() => addSelectedLineAmount()}
						onfocus={(e) => cancelFocus(e)}
					>
						<Icon icon="ic:round-plus" />
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.card:hover {
		box-shadow: oklch(70.4% 0.191 22.216) 0px 0px 5px;
	}
</style>
