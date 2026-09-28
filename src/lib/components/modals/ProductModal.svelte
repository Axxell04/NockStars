<script lang="ts">
	import { fade } from 'svelte/transition';
	import ContainerModal from './ContainerModal.svelte';
	import type { ProductComplete } from '$lib/interfaces/product';
	import Icon from '@iconify/svelte';

	interface Props {
		productModalIsVisible: boolean;
		toggleProductModalIsVisible: (visible?: boolean) => void;
		productSelected: ProductComplete | undefined;
	}

	let { toggleProductModalIsVisible, productModalIsVisible, productSelected }: Props = $props();
</script>

{#if productModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleProductModalIsVisible} visible={productModalIsVisible}>
			<div
				class="bg-surface-1/95 relative flex flex-col items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-white/10 p-2 shadow-[var(--shadow-depth)]"
			>
				<button
					type="button"
					class="modal-close absolute top-3 right-3 z-10 bg-black/40 hover:bg-black/60"
					onclick={() => toggleProductModalIsVisible(false)}
					aria-label="Cerrar imagen"
				>
					<Icon icon="material-symbols:close-rounded" class="text-xl" />
				</button>
				<img
					src={productSelected?.imgs[0]?.url}
					alt={productSelected?.product?.name ?? 'Imagen de producto'}
					loading="lazy"
					class="max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
				/>
			</div>
		</ContainerModal>
	</div>
{/if}
