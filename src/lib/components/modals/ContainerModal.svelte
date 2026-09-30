<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { expoOut } from 'svelte/easing';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		toggleModal: (visible?: boolean) => void;
		cancelClick?: boolean;
		class?: string;
	}

	let { children, toggleModal, cancelClick = true, class: className = '' }: Props = $props();

	$effect(() => {
		// Read synchronously so a changing `cancelClick` re-registers the listener
		// with a fresh closure instead of capturing a stale value.
		const allowsCancel = cancelClick;

		document.body.classList.add('overflow-hidden');

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape' && allowsCancel) {
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
	class="fixed inset-0 z-50 overflow-x-hidden overflow-y-auto overscroll-contain p-3 sm:p-4"
	role="presentation"
>
	<!-- Backdrop overlay with blur and fade -->
	<div
		class="bg-surface-0/80 fixed inset-0 backdrop-blur-md"
		transition:fade={{ duration: 200 }}
		onclick={() => {
			if (cancelClick) toggleModal(false);
		}}
		aria-hidden="true"
	></div>

	<!-- Centering track: grows with the dialog so a tall modal scrolls from the top
	     instead of overflowing above a capped scroll box -->
	<div class="relative z-10 flex min-h-full items-center justify-center">
		<!-- Modal dialog surface with Emil Kowalski scale-in from 0.95 and custom expoOut easing -->
		<div
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			in:scale={{ start: 0.95, duration: 220, easing: expoOut }}
			out:scale={{ start: 0.95, duration: 160, easing: expoOut }}
			class="relative flex w-full max-w-xl origin-center items-center justify-center outline-none {className}"
		>
			{@render children()}
		</div>
	</div>
</div>
