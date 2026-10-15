<script lang="ts">
	import type { Snippet } from 'svelte';

	interface RankingRow {
		name: string;
		metric: number;
		display: string;
	}

	interface Props {
		title: string;
		rows: RankingRow[];
		/** Honest one-line explanation of what the ranking actually counts. */
		caption?: string;
		emptyText?: string;
		/** Renders the "not available yet" state instead of rows. */
		unavailable?: boolean;
		unavailableText?: string;
		/** Optional header slot, e.g. a metric toggle. */
		actions?: Snippet;
	}

	let {
		title,
		rows,
		caption,
		emptyText = 'Sin datos en este rango.',
		unavailable = false,
		unavailableText = 'No disponible — pendiente de migración',
		actions
	}: Props = $props();

	let maxMetric = $derived(rows.reduce((max, row) => Math.max(max, row.metric), 1));
</script>

<div class="card-thread flex flex-col gap-3 p-4">
	<div class="flex flex-row flex-wrap place-content-between place-items-center gap-2">
		<span class="text-text-secondary text-sm font-medium"> {title} </span>
		{#if actions}
			{@render actions()}
		{/if}
	</div>
	{#if unavailable}
		<span class="text-text-secondary text-sm"> {unavailableText} </span>
	{:else if rows.length === 0}
		<span class="text-text-secondary text-sm"> {emptyText} </span>
	{:else}
		<ul class="flex flex-col gap-2.5">
			{#each rows as row, index (index)}
				<li class="flex flex-col gap-1">
					<div class="flex flex-row place-content-between place-items-center gap-3 text-sm">
						<span class="text-text-primary truncate"> {row.name} </span>
						<span class="text-text-secondary tabular-nums"> {row.display} </span>
					</div>
					<div class="bg-surface-2 h-1.5 w-full overflow-hidden rounded-full">
						<div
							class="bg-brand-400/70 h-full rounded-full transition-[width] duration-300"
							style="width: {(row.metric / maxMetric) * 100}%"
						></div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
	{#if caption}
		<p class="text-text-secondary text-xs">{caption}</p>
	{/if}
</div>
