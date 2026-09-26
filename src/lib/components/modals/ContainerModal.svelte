<script lang="ts">
	import { onDestroy, onMount, type Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		toggleModal: (visible?: boolean) => void;
		visible?: boolean;
		cancelClick?: boolean;
	}

	let { children, toggleModal, cancelClick }: Props = $props();

	onMount(() => {
		document.body.classList.add('overflow-hidden');
	});
	onDestroy(() => {
		document.body.classList.remove('overflow-hidden');
	});
</script>

<div
	role="button"
	tabindex="0"
	onkeydown={() => {}}
	class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4"
	onclick={() => {
		toggleModal(false);
	}}
>
	<!-- Backdrop -->
	<div class="bg-surface-0/80 absolute inset-0 backdrop-blur-sm"></div>

	{#if !cancelClick}
		<div class="relative z-10">
			{@render children()}
		</div>
	{:else}
		<div
			onclick={(e) => e.stopPropagation()}
			role="button"
			tabindex="0"
			onkeypress={() => {}}
			class="relative z-10 flex h-full w-fit max-w-full items-center justify-center outline-none"
		>
			{@render children()}
		</div>
	{/if}
</div>
