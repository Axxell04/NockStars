<script lang="ts">
	import { scale } from 'svelte/transition';
	import Icon from '@iconify/svelte';

	interface Props {
		message: string;
	}

	let { message }: Props = $props();
</script>

{#if message}
	<div
		transition:scale={{ duration: 200, start: 0.9 }}
		class="pointer-events-none fixed top-4 right-0 left-0 z-[60] flex justify-center"
	>
		<div
			class="bg-brand-500 text-surface-0 shadow-brand-500/25 pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg"
		>
			<Icon icon="mdi:check-circle" class="text-lg" />
			{message}
		</div>
	</div>
{/if}
