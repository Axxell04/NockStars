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
		class="block px-3 py-1.5 text-sm font-medium transition-colors duration-200
			{active ? 'text-brand-400' : 'text-text-muted hover:text-text-primary'}"
	>
		{name}
	</a>
	{#if active}
		<span class="absolute bottom-0 left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-brand-400"></span>
	{/if}
</li>
