<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { fade, scale, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { lineKey, setLineAmounts, toOrderLines, type OrderLine } from '$lib/order-content';

	let { data }: PageProps = $props();

	// `data.order` is the live source: every successful mutation refreshes it
	// through `invalidateAll()`, so everything below derives from it. The only
	// local fork is `contentOverride`, which holds the edited content between
	// the optimistic update and the server round-trip.
	let order = $derived(data.order);
	let contentOverride: unknown = $state(undefined);
	let effectiveContent = $derived(contentOverride ?? order.content);
	let orderLines = $derived(toOrderLines(effectiveContent));
	// `$state.raw`, not `$state`: toOrderLines() returns a raw array, and a plain
	// `$state` would re-proxy it on every assignment so `previous !== orderLines`
	// could never become false — the auto-submit effect below would loop until
	// `effect_update_depth_exceeded`.
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
				contentOverride = setLineAmounts(effectiveContent, updatedLines);
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

<div in:fade class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-5">
	<a
		href="/admin/pedidos"
		class="text-text-secondary hover:bg-surface-2 hover:text-text-primary self-start rounded-lg px-3 py-2 text-left transition-colors"
	>
		<Icon icon="mdi:arrow-left" class="mr-1 inline" />
		Volver a pedidos
	</a>

	<!-- Order summary -->
	<section class="card-thread rounded-2xl p-4 sm:p-6">
		<div class="flex flex-wrap place-content-between place-items-center gap-3">
			<div class="flex min-w-0 flex-row place-items-center gap-3">
				<Icon icon="akar-icons:shopping-bag" class="text-text-secondary flex-shrink-0 text-3xl" />
				<h1 class="text-text-primary truncate text-2xl font-bold">
					{order.clientName}
				</h1>
			</div>
			{#if order.completed}
				<span
					class="text-text-muted rounded-full border border-white/10 px-2.5 py-1 text-xs font-medium"
				>
					Completada
				</span>
			{:else}
				<span
					class="border-brand-400/30 bg-brand-400/10 text-brand-400 rounded-full border px-2.5 py-1 text-xs font-medium"
				>
					Pendiente
				</span>
			{/if}
		</div>
		<div class="text-text-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
			<span class="break-all">COD: {order.id}</span>
			<span>
				{order.createdAt.toLocaleDateString('es-EC', {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					hour: '2-digit',
					minute: '2-digit'
				})}
			</span>
		</div>
		<div
			class="mt-3 flex flex-row place-content-between place-items-center border-t border-white/5 pt-3"
		>
			<span class="text-text-secondary">Total</span>
			<span class="text-text-primary text-xl font-bold">$ {totalValue.toFixed(2)}</span>
		</div>
	</section>

	<!-- Order lines -->
	<section class="flex flex-col gap-2">
		{#each orderLines as line}
			<div
				class="flex min-w-0 flex-col gap-1 rounded-xl border px-3 py-2 transition-colors duration-150 {selectedLine &&
				lineKey(selectedLine) === lineKey(line)
					? 'border-brand-400/40 bg-brand-400/10'
					: 'bg-surface-1 border-white/5'} place-content-between place-items-center"
				onclick={() => {
					if (confirmationEditIsVisible) {
						selectThisLine(line);
					}
				}}
				role="button"
				tabindex="0"
				onkeydown={() => {}}
			>
				<div class="flex w-full min-w-0 flex-row place-content-between place-items-center gap-2">
					<div class="flex min-w-0 flex-row place-items-center gap-2">
						<span class="text-text-primary truncate">
							{line.name}
						</span>
						<span class="text-text-secondary flex-shrink-0">
							({line.amount})
						</span>
					</div>
					<span class="text-text-primary flex-shrink-0 font-semibold">
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
	</section>

	<!-- Order management -->
	<section class="bg-surface-1 rounded-2xl border border-white/8 p-4">
		<form
			action=""
			method="post"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						if (confirmationDeleteIsVisible) {
							await goto('/admin/pedidos');
						} else {
							if (typeof contentOverride !== 'undefined') {
								contentOverride = undefined;
								toggleConfirmationEditIsVisible(false);
								selectThisLine(undefined);
							}
							await invalidateAll();
						}
					}
				};
			}}
			class="flex flex-col gap-3"
		>
			<input type="hidden" name="total_value" id="total_value" value={totalValue.toFixed(2)} />
			<input type="hidden" name="order_id" value={order.id} />
			{#if confirmationEditIsVisible}
				<input type="hidden" name="content" value={JSON.stringify(effectiveContent)} />
			{/if}

			<div class="flex flex-col gap-2 sm:flex-row">
				<button
					type="button"
					class="text-text-secondary hover:border-brand-400/30 hover:text-brand-400 flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium transition-[border-color,color,transform] duration-150 active:scale-[0.97] {confirmationDeleteIsVisible
						? 'border-brand-400/40 bg-brand-400/10 text-brand-400'
						: ''}"
					onclick={() => toggleConfirmationDeleteIsVisible(true)}
					onfocus={(e) => cancelFocus(e)}
				>
					<Icon icon="famicons:trash" class="text-lg" />
					Eliminar
				</button>
				<button
					type="button"
					class="text-text-secondary hover:border-brand-400/30 hover:text-brand-400 flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium transition-[border-color,color,transform] duration-150 active:scale-[0.97] {confirmationEditIsVisible
						? 'border-brand-400/40 bg-brand-400/10 text-brand-400'
						: ''}"
					onclick={() => toggleConfirmationEditIsVisible(true)}
					onfocus={(e) => cancelFocus(e)}
				>
					<Icon icon="mdi:edit-outline" class="text-lg" />
					Editar cantidades
				</button>
				<button
					formaction="?/update_order_state"
					class="text-text-secondary hover:border-brand-400/30 hover:text-brand-400 flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium transition-[border-color,color,transform] duration-150 active:scale-[0.97]"
					onfocus={(e) => cancelFocus(e)}
				>
					{#if order.completed}
						<Icon icon="solar:cart-cross-bold" class="text-lg" />
						Marcar pendiente
					{:else}
						<Icon icon="solar:cart-check-bold" class="text-lg" />
						Marcar completado
					{/if}
				</button>
			</div>

			{#if confirmationDeleteIsVisible}
				<div
					transition:scale={{ duration: 200, easing: cubicOut }}
					class="bg-surface-2/60 flex flex-row place-content-between gap-2 rounded-xl p-1.5"
				>
					<button
						type="button"
						class="text-text-secondary hover:bg-surface-2 hover:text-text-primary grow rounded-lg px-2 py-1.5 text-sm transition-[background-color,color,transform] duration-150 active:scale-95"
						onclick={() => toggleConfirmationDeleteIsVisible(false)}
						onfocus={(e) => cancelFocus(e)}
					>
						Cancelar
					</button>
					<button
						formaction="?/delete_order"
						class="grow rounded-lg bg-red-500 p-1.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-red-600 active:scale-95"
						onfocus={(e) => cancelFocus(e)}
					>
						Confirmar eliminación
					</button>
				</div>
			{:else if confirmationEditIsVisible}
				<div
					transition:scale={{ duration: 200, easing: cubicOut }}
					class="bg-surface-2/60 flex flex-row place-content-between gap-2 rounded-xl p-1.5"
				>
					<button
						type="button"
						class="text-text-secondary hover:bg-surface-2 hover:text-text-primary grow rounded-lg px-2 py-1.5 text-sm transition-[background-color,color,transform] duration-150 active:scale-95"
						onclick={() => toggleConfirmationEditIsVisible(false)}
						onfocus={(e) => cancelFocus(e)}
					>
						Cancelar
					</button>
					<button
						type="button"
						class="grow rounded-lg bg-red-500 p-1.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-red-600 active:scale-95"
						onclick={() => sendEditOrder()}
						onfocus={(e) => cancelFocus(e)}
					>
						Confirmar
					</button>
				</div>
			{/if}

			{#if confirmationEditIsVisible && selectedLine}
				<div
					transition:slide={{ duration: 200, easing: cubicOut }}
					class="bg-surface-2/40 flex flex-col place-items-center gap-2 rounded-xl border border-white/8 p-3"
				>
					<span class="text-text-primary text-sm font-semibold">
						{selectedLine.name}
					</span>
					{#if selectedLine.size ?? selectedLine.color ?? selectedLine.cut}
						<div class="flex flex-wrap justify-center gap-1">
							{#each lineChips(selectedLine) as chip}
								<span
									class="bg-surface-0/60 text-text-secondary rounded-md border border-white/8 px-1.5 py-px text-xs"
								>
									{chip}
								</span>
							{/each}
						</div>
					{/if}
					<div class="flex flex-row place-items-center gap-3">
						<button
							type="button"
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
							type="button"
							class="text-text-secondary hover:border-brand-400/30 hover:text-brand-400 rounded-full border border-white/10 p-1.5 transition-[border-color,color,transform] duration-150 active:scale-90"
							onclick={() => addSelectedLineAmount()}
							onfocus={(e) => cancelFocus(e)}
							aria-label="Aumentar cantidad"
						>
							<Icon icon="ic:round-plus" />
						</button>
					</div>
				</div>
			{/if}

			<button bind:this={btnDeleteOrder} type="submit" formaction="?/delete_order" class="hidden">
				Delete Order
			</button>
			<button bind:this={btnEditOrder} type="submit" formaction="?/edit_order" class="hidden">
				Edit Order
			</button>
		</form>
	</section>
</div>
