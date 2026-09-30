<script lang="ts">
	interface Props {
		name: string;
		endPoint: string;
		actualRoute: string | null;
	}

	let { name, endPoint, actualRoute }: Props = $props();

	let active = $derived(
		actualRoute && endPoint
			? actualRoute === endPoint ||
					endPoint.replace('/admin', '') === actualRoute ||
					endPoint.replace('admin', '') === actualRoute
			: false
	);
</script>

<li class="relative list-none">
	<a
		href={endPoint}
		class="group relative block rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200
			{active ? 'text-brand-400' : 'text-text-muted hover:bg-surface-2 hover:text-text-primary'}"
	>
		{name}
		<!-- Thread accent line — grows from the centre on hover, pinned when active -->
		<span
			class="absolute bottom-0 left-1/2 h-[2px] rounded-full transition-all duration-300 {active
				? 'bg-brand-400 w-6 -translate-x-1/2'
				: 'bg-brand-400/60 w-0 -translate-x-1/2 group-hover:w-4'}"
		></span>
		<!-- Thread glow on active -->
		{#if active}
			<span
				class="bg-brand-400/20 absolute -bottom-1 left-1/2 h-2 w-8 -translate-x-1/2 rounded-full blur-sm"
			></span>
		{/if}
	</a>
</li>
