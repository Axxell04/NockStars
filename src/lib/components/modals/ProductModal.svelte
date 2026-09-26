<script lang="ts">
	import { fade } from 'svelte/transition';

	import ContainerModal from './ContainerModal.svelte';
	import type { ProductComplete } from '$lib/interfaces/product';

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
			<div>
				<img
					src={productSelected?.imgs[0].url}
					alt={productSelected?.product.name}
					loading="lazy"
				/>
			</div>
		</ContainerModal>
	</div>
{/if}
