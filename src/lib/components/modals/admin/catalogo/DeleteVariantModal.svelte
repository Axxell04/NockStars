<script lang="ts">
	import type { ProductComplete } from '$lib/interfaces/product';
	import type { VariantComplete } from '$lib/actions';
	import { fade } from 'svelte/transition';
	import ContainerModal from '../../ContainerModal.svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		productSelected: ProductComplete;
		variantToDelete: VariantComplete | null;
		setVariants: (newVariants: VariantComplete[]) => void;
		toggleModal: (visible?: boolean) => void;
		isVisible: boolean;
	}

	let { productSelected, variantToDelete, setVariants, toggleModal, isVisible }: Props = $props();

	let formMessage = $state('');

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}

	async function handleDelete() {
		if (!variantToDelete) return;

		try {
			const formData = new FormData();
			formData.append('variantId', variantToDelete.id);
			formData.append('productId', productSelected.product.id);

			const res = await fetch('?/delete_variant', {
				method: 'POST',
				body: formData
			});
			const json = await res.json();

			if (!json.success) {
				formMessage = json.message || 'Error al eliminar la variante';
				return;
			}

			if (json.variants) {
				setVariants(json.variants);
			}

			toggleModal(false);
		} catch {
			formMessage = 'Error al eliminar la variante';
		}
	}

	$effect(() => {
		if (formMessage) {
			const timeout = setTimeout(() => {
				formMessage = '';
			}, 5000);
			return () => clearTimeout(timeout);
		}
	});
</script>

{#if isVisible && variantToDelete}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal {toggleModal} visible={isVisible} cancelClick={true}>
			<div
				class="glass mx-4 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/4"
			>
				<div class="flex items-center justify-between border-b border-white/4 p-4">
					<h2 class="text-text-primary text-lg font-semibold">Eliminar Variante</h2>
					<button
						class="text-text-secondary hover:text-brand-400 flex h-10 w-10 items-center justify-center rounded-full transition-colors"
						onclick={() => toggleModal(false)}
					>
						<Icon icon="material-symbols:close-rounded" class="text-xl" />
					</button>
				</div>
				<div class="text-text-secondary p-4">
					¿Estás seguro de que quieres eliminar la variante <strong
						>{variantToDelete.size} / {variantToDelete.color} / {variantToDelete.cut}</strong
					>? No se puede eliminar si está referenciada en carritos o pedidos.
				</div>
				{#if formMessage}
					<div class="border-t border-white/4 p-4">
						<p class="text-text-error text-center">{formMessage}</p>
					</div>
				{/if}
				<div class="flex justify-end gap-3 border-t border-white/4 p-4">
					<button type="button" class="btn-secondary" onclick={() => toggleModal(false)}
						>Cancelar</button
					>
					<button
						type="button"
						class="btn-error"
						onclick={handleDelete}
						onfocus={(e) => cancelFocus(e)}
					>
						Eliminar
					</button>
				</div>
			</div>
		</ContainerModal>
	</div>
{/if}
