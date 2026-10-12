<script lang="ts">
	import ContainerModal from '$lib/components/modals/ContainerModal.svelte';
	import Icon from '@iconify/svelte';
	import { imageUrl } from '$lib/cloudinary';

	type Viewer = { urls: string[]; index: number; name: string };

	// Owned by the caller so the trigger buttons (scattered through an item
	// list) can open it. Setting it to null closes it.
	let { viewer = $bindable<Viewer | null>(null) }: { viewer?: Viewer | null } = $props();

	function stepViewer(delta: number) {
		if (!viewer) return;
		const next = viewer.index + delta;
		if (next < 0 || next >= viewer.urls.length) return;
		viewer = { ...viewer, index: next };
	}

	function setViewerIndex(index: number) {
		if (!viewer) return;
		viewer = { ...viewer, index };
	}

	function close() {
		viewer = null;
	}

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}

	// Arrow-key navigation while the lightbox is open. Registered only for a
	// multi-image viewer and removed on close, mirroring ContainerModal's own
	// Escape listener so both stay in sync through the same `viewer` signal.
	$effect(() => {
		if (!viewer || viewer.urls.length < 2) return;

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'ArrowLeft') stepViewer(-1);
			if (event.key === 'ArrowRight') stepViewer(1);
		}

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	});
</script>

{#if viewer && viewer.urls.length > 0}
	<ContainerModal toggleModal={close} maxWidth="max-w-3xl">
		<figure class="relative">
			<img
				src={imageUrl(viewer.urls[viewer.index], 'hero')}
				alt="Imagen {viewer.index + 1} de {viewer.urls.length} de {viewer.name}"
				class="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain"
			/>
			{#if viewer.urls.length > 1}
				<button
					type="button"
					aria-label="Imagen anterior"
					disabled={viewer.index === 0}
					onclick={() => stepViewer(-1)}
					class="bg-surface-1/95 text-text-secondary hover:border-brand-400/30 hover:bg-brand-400/10 hover:text-brand-400 absolute top-1/2 left-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 transition-all duration-200 disabled:pointer-events-none disabled:opacity-30"
				>
					<Icon icon="mingcute:left-fill" class="text-xl" />
				</button>
				<button
					type="button"
					aria-label="Imagen siguiente"
					disabled={viewer.index === viewer.urls.length - 1}
					onclick={() => stepViewer(1)}
					class="bg-surface-1/95 text-text-secondary hover:border-brand-400/30 hover:bg-brand-400/10 hover:text-brand-400 absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 transition-all duration-200 disabled:pointer-events-none disabled:opacity-30"
				>
					<Icon icon="mingcute:right-fill" class="text-xl" />
				</button>
			{/if}
			<button
				type="button"
				aria-label="Cerrar imagen"
				onclick={close}
				onfocus={(e) => cancelFocus(e)}
				class="bg-surface-2 text-text-secondary hover:text-text-primary absolute -top-3 -right-3 rounded-full border border-white/10 p-2 transition-[color,transform] duration-150 active:scale-90"
			>
				<Icon icon="mdi:close" />
			</button>
			{#if viewer.urls.length > 1}
				<div
					class="mt-3 flex justify-center gap-2"
					role="tablist"
					aria-label="Navegación de imágenes"
				>
					{#each viewer.urls.keys() as i}
						<button
							role="tab"
							aria-selected={i === viewer.index}
							aria-label="Ver imagen {i + 1} de {viewer.urls.length}"
							onclick={() => setViewerIndex(i)}
							class="h-2 w-2 rounded-full transition-all duration-300 {i === viewer.index
								? 'bg-brand-400 shadow-glow-sm w-6'
								: 'bg-white/30 hover:bg-white/50'}"
						></button>
					{/each}
				</div>
			{/if}
			<figcaption class="text-text-secondary mt-2 flex items-center justify-center gap-2 text-sm">
				<span class="min-w-0 truncate">{viewer.name}</span>
				{#if viewer.urls.length > 1}
					<span class="text-text-muted flex-shrink-0 tabular-nums">
						{viewer.index + 1} / {viewer.urls.length}
					</span>
				{/if}
			</figcaption>
		</figure>
	</ContainerModal>
{/if}
