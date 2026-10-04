<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { Order } from '$lib/interfaces/order';
	import { toOrderLines, type OrderLine } from '$lib/order-content';

	interface Props {
		order: Order;
	}

	let { order }: Props = $props();

	let orderLines = $derived(toOrderLines(order.content));
	let totalValue = $derived(orderLines.reduce((pv, cv) => pv + cv.amount * cv.unitPrice, 0));

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
</script>

<a
	href="/admin/pedido/{order.id}"
	aria-label="Ver pedido {order.id}"
	class="card-thread block w-full max-w-sm min-w-0 self-start rounded-2xl p-3"
>
	<div class="flex min-w-0 flex-col gap-3">
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
		<div class="flex flex-col gap-2">
			{#each orderLines as line}
				<div
					class="bg-surface-2/60 flex min-w-0 flex-col gap-1 rounded-lg border border-white/5 px-2 py-1.5"
				>
					<div class="flex w-full min-w-0 flex-row place-content-between place-items-center gap-2">
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
	</div>
</a>
