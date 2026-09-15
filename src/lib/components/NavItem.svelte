<script lang="ts">
	interface Props {
		name: string;
		endPoint: string;
        actualRoute: string | null
	}

	let { name, endPoint, actualRoute }: Props = $props();

	let active = $derived(
		actualRoute && endPoint
			? actualRoute === endPoint || endPoint.replace('/admin', '') === actualRoute || endPoint.replace('admin', '') === actualRoute
			: false
	);

</script>

<li class="relative list-none">
	<a
		href={endPoint}
		class="relative block px-3 py-1.5 text-sm font-medium transition-colors duration-200
			{active ? 'text-brand-400' : 'text-text-muted hover:text-text-primary'}"
	>
		{name}
		<!-- Thread accent line — Animated on hover and active -->
		<span class="absolute bottom-0 left-1/2 h-[2px] rounded-full transition-all duration-400 {active ? 'w-6 -translate-x-1/2 bg-brand-400' : 'w-0 -translate-x-1/2 bg-brand-400/60 group-hover:w-4'}"></span>
		<!-- Thread glow on active -->
		{#if active}
			<span class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-brand-400/20 blur-sm rounded-full"></span>
		{/if}
	</a>
</li>
