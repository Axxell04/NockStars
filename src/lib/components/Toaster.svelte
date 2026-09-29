<script lang="ts">
	import Icon from '@iconify/svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import { dismissToast, getToasts } from '$lib/toast.svelte.js';
</script>

<!--
	Mount-once toast container for the root layout (fixed, above modals at
	z-50). The live region exists even while empty so assistive tech
	registers it before content arrives. Svelte transitions run on the Web
	Animations API, which the global prefers-reduced-motion rule in app.css
	does not reach, so `prefersReducedMotion` zeroes the travel distance
	here — keeping the gentle fade, dropping the movement.
-->
<div
	class="pointer-events-none fixed top-4 right-0 left-0 z-[60] flex flex-col items-center gap-2 px-4"
	role="status"
	aria-live="polite"
>
	{#each getToasts() as entry (entry.id)}
		<div
			transition:fly={{ y: prefersReducedMotion.current ? 0 : -12, duration: 200 }}
			class="bg-surface-1/95 shadow-depth border-brand-400/30 pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border px-4 py-3 backdrop-blur-xl"
		>
			<Icon icon="mdi:alert-circle-outline" class="text-brand-400 shrink-0 text-lg" />
			<p class="text-text-primary min-w-0 flex-1 text-sm font-medium">{entry.message}</p>
			<button
				type="button"
				class="text-text-muted hover:text-text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
				aria-label="Cerrar aviso"
				onclick={() => dismissToast(entry.id)}
			>
				<Icon icon="mdi:close" class="text-base" />
			</button>
		</div>
	{/each}
</div>
