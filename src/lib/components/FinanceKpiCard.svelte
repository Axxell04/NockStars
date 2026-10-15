<script lang="ts">
	import Icon from '@iconify/svelte';

	interface Props {
		label: string;
		value: number;
		/** Δ% vs the immediately preceding equal-length period; null = no comparable base. */
		deltaPercent: number | null;
	}

	let { label, value, deltaPercent }: Props = $props();

	let deltaTone = $derived(
		deltaPercent === null || deltaPercent === 0 ? 'neutral' : deltaPercent > 0 ? 'up' : 'down'
	);
	let deltaText = $derived(
		deltaPercent === null
			? '— sin base comparable'
			: `${deltaPercent > 0 ? '+' : ''}${deltaPercent.toFixed(1)}% vs. periodo anterior`
	);
</script>

<div class="card-thread flex flex-col gap-1 p-4">
	<span class="text-text-secondary text-sm"> {label} </span>
	<span class="text-brand-400 text-xl font-bold tabular-nums">
		$ {value.toFixed(2)}
	</span>
	<span
		class="flex flex-row items-center gap-1 text-xs tabular-nums {deltaTone === 'up'
			? 'text-text-success'
			: deltaTone === 'down'
				? 'text-text-error'
				: 'text-text-secondary'}"
	>
		{#if deltaTone === 'up'}
			<Icon icon="mdi:arrow-up-bold" class="text-sm" />
		{:else if deltaTone === 'down'}
			<Icon icon="mdi:arrow-down-bold" class="text-sm" />
		{/if}
		{deltaText}
	</span>
</div>
