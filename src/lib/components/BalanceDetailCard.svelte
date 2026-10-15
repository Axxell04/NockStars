<script lang="ts">
	import Icon from '@iconify/svelte';
	import { scale, slide } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ActionResult } from '@sveltejs/kit';
	import type {
		BalanceDetail,
		BalanceDetailPagination,
		BalanceSortKey
	} from '$lib/interfaces/balance';
	import { cancelFocus } from '$lib/focus';
	import { toast } from '$lib/toast.svelte.js';
	import { formatCurrency } from '$lib/format';
	import { actionFailureMessage } from '$lib/action-result';

	interface Props {
		balanceDetail: BalanceDetail;
		balanceDetailSelected?: BalanceDetail;
		selectThisBalanceDetail: (balanceDetail: BalanceDetail | undefined) => void;
		setBalanceDetailPagination: (newBalanceDetailPagination: BalanceDetailPagination) => void;
		/**
		 * Active list filter/sort, threaded as hidden inputs into every
		 * mutation form so an applied search survives the edit/delete
		 * refetch. Defaults to the unfiltered contract for callers that do
		 * not pass it.
		 */
		listParams?: { q: string; sort: BalanceSortKey };
	}

	let {
		balanceDetail,
		balanceDetailSelected,
		selectThisBalanceDetail,
		setBalanceDetailPagination,
		listParams = { q: '', sort: 'date_desc' }
	}: Props = $props();

	let isSelected = $derived(balanceDetail.id === balanceDetailSelected?.id);

	// HTML Elements
	let btnEditBalanceDetail: HTMLButtonElement | undefined = $state();

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

	// Request Functions
	function sendEditBalanceDetail() {
		if (typeof btnEditBalanceDetail !== 'undefined' && confirmationEditIsVisible) {
			btnEditBalanceDetail.click();
		}
	}

	// Shared success handling for both mutation forms: the pagination contract
	// is applied, then either the order-linked refusal is announced (a no-op
	// edit/delete that would otherwise look like silent success) or the range
	// dashboard above is invalidated so its KPIs/chart pick the change up.
	async function applyMutationResult(result: ActionResult) {
		if (result.type !== 'success') {
			return;
		}
		if (result.data?.balanceDetailPagination) {
			setBalanceDetailPagination(result.data.balanceDetailPagination as BalanceDetailPagination);
		}
		const notice = result.data?.notice;
		if (typeof notice === 'string' && notice.length > 0) {
			toast(notice);
			return;
		}
		await invalidateAll();
	}

	// Audit (AGENTS.md "Reactivity: real reads, not markers"): every effect
	// below depends on values it actually reads (isSelected and the two
	// confirmation flags) — no bare markers, no suppressions. The writes
	// converge: clearing an already-cleared flag does not re-trigger, so the
	// mutual-exclusion pair settles after one pass and the deselect effect
	// fires once per selection loss.
	$effect(() => {
		if (!isSelected && (confirmationDeleteIsVisible || confirmationEditIsVisible)) {
			toggleConfirmationDeleteIsVisible(false);
			toggleConfirmationEditIsVisible(false);
			selectThisBalanceDetail(undefined);
		}
	});

	$effect(() => {
		if (confirmationDeleteIsVisible) {
			toggleConfirmationEditIsVisible(false);
		}
	});

	$effect(() => {
		if (confirmationEditIsVisible) {
			toggleConfirmationDeleteIsVisible(false);
		}
	});
</script>

<div class="flex flex-row place-items-center">
	<div class="card flex flex-col gap-4 self-start rounded-2xl bg-stone-800 p-2">
		<form
			action=""
			method="post"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						await applyMutationResult(result);
						toggleConfirmationEditIsVisible(false);
						toggleConfirmationDeleteIsVisible(false);
						return;
					}
					const failure = actionFailureMessage(result, 'No se pudo guardar el movimiento');
					if (failure) {
						toast(failure);
					}
				};
			}}
			class="flex flex-col place-items-center gap-2"
		>
			<input type="hidden" name="q" value={listParams.q} />
			<input type="hidden" name="sort" value={listParams.sort} />
			<input
				type="hidden"
				name="balance_id"
				id="balance_id-{balanceDetail.id}"
				value={balanceDetail.id}
			/>
			<div class="flex flex-col text-center">
				<span class="font-semibold"> Motivo </span>
				{#if confirmationEditIsVisible}
					<input
						transition:slide
						type="text"
						name="new_reason"
						id="new_reason-{balanceDetail.id}"
						aria-label="Motivo"
						class="rounded-md border bg-transparent px-1 text-red-400 outline-none"
						required
						autocomplete="off"
						value={balanceDetail.reason}
					/>
				{:else}
					<span transition:slide>
						{balanceDetail.reason}
					</span>
				{/if}
			</div>
			<div class="flex flex-col text-center">
				<span class="font-semibold"> Valor </span>
				{#if confirmationEditIsVisible}
					<input
						transition:slide
						type="number"
						step="0.01"
						name="new_value"
						id="new_value-{balanceDetail.id}"
						aria-label="Valor"
						class="rounded-md border bg-transparent px-1 text-red-400 outline-none"
						required
						autocomplete="off"
						value={balanceDetail.value.toFixed(2)}
					/>
				{:else}
					<span transition:slide>
						{formatCurrency(balanceDetail.value)}
					</span>
				{/if}
			</div>
			<button
				bind:this={btnEditBalanceDetail}
				type="submit"
				formaction="?/edit_balance"
				class="hidden"
			>
				Edit Balance Detail
			</button>
		</form>
		<span class="place-self-center">
			{balanceDetail.createdAt.toLocaleDateString('es-EC', {
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
				type="button"
				class="flex w-full flex-col place-items-center rounded-full bg-stone-700/20"
				aria-label="Ver detalles del movimiento"
				aria-expanded="false"
				onclick={() => selectThisBalanceDetail(balanceDetail)}
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
							await applyMutationResult(result);
							toggleConfirmationDeleteIsVisible(false);
							return;
						}
						const failure = actionFailureMessage(result, 'No se pudo eliminar el movimiento');
						if (failure) {
							toast(failure);
						}
					};
				}}
				class="flex flex-col gap-2"
			>
				<input type="hidden" name="q" value={listParams.q} />
				<input type="hidden" name="sort" value={listParams.sort} />
				<input
					type="hidden"
					name="balance_id"
					id="delete_balance_id-{balanceDetail.id}"
					value={balanceDetail.id}
				/>
				<div
					class="flex flex-row place-content-around gap-2 rounded-full bg-stone-700/20 py-1 text-3xl"
				>
					<input type="hidden" name="order_id" value={balanceDetail.id} />
					<button
						type="button"
						class="rounded-full p-1 focus:text-red-500 {confirmationDeleteIsVisible
							? 'bg-red-400 text-stone-800/90'
							: ''}"
						onclick={() => toggleConfirmationDeleteIsVisible(true)}
						onfocus={(e) => cancelFocus(e)}
					>
						<Icon icon="famicons:trash" />
					</button>
					<button
						type="button"
						class="rounded-full p-1 focus:text-red-500 {confirmationEditIsVisible
							? 'bg-red-400 text-stone-800/90'
							: ''}"
						onclick={() => toggleConfirmationEditIsVisible(true)}
						onfocus={(e) => cancelFocus(e)}
					>
						<Icon icon="mdi:edit-outline" />
					</button>
				</div>
				<button
					type="button"
					class="flex w-full flex-col place-items-center rounded-full bg-stone-700/20"
					aria-label="Ocultar detalles del movimiento"
					aria-expanded="true"
					onclick={() => selectThisBalanceDetail(undefined)}
				>
					<Icon icon="mingcute:up-line" />
				</button>
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
							formaction="?/delete_balance"
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
							onclick={() => sendEditBalanceDetail()}
							onfocus={(e) => cancelFocus(e)}
						>
							Confirmar
						</button>
					</div>
				{/if}
			</form>
		{/if}
	</div>
</div>

<style>
	.card:hover {
		box-shadow: oklch(70.4% 0.191 22.216) 0px 0px 5px;
	}
</style>
