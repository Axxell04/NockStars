<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { expoOut } from 'svelte/easing';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		toggleModal: (visible?: boolean) => void;
		visible?: boolean;
		cancelClick?: boolean;
		class?: string;
	}

	let { children, toggleModal, class: className = '' }: Props = $props();

	$effect(() => {
		document.body.classList.add('overflow-hidden');

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				event.stopPropagation();
				toggleModal(false);
			}
		}

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			document.body.classList.remove('overflow-hidden');
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-3 sm:p-4"
	role="presentation"
>
	<!-- Backdrop overlay with blur and fade -->
	<div
		class="bg-surface-0/80 fixed inset-0 backdrop-blur-md"
		transition:fade={{ duration: 200 }}
		onclick={() => toggleModal(false)}
		aria-hidden="true"
	></div>

	<!-- Modal dialog surface with Emil Kowalski scale-in from 0.95 and custom expoOut easing -->
	<div
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		in:scale={{ start: 0.95, duration: 220, easing: expoOut }}
		out:scale={{ start: 0.95, duration: 160, easing: expoOut }}
		class="relative z-10 flex max-h-[90vh] w-full max-w-xl origin-center items-center justify-center overflow-y-auto outline-none {className}"
	>
		{@render children()}
	</div>
</div>
