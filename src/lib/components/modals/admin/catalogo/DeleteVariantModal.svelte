<script lang="ts">
	import type { ProductComplete } from '$lib/interfaces/product';
	import type { VariantComplete } from '$lib/actions';
	import type { ActionResult } from '@sveltejs/kit';
	import { deserialize } from '$app/forms';
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

	// Deactivation is reversible: the same modal drives both directions, so
	// its copy and payload follow the current state of the variant.
	let deactivated = $derived(Boolean(variantToDelete?.deactivatedAt));

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}

	async function handleSetActive() {
		if (!variantToDelete) return;

		try {
			const formData = new FormData();
			formData.append('variantId', variantToDelete.id);
			formData.append('productId', productSelected.product.id);
			formData.append('active', variantToDelete.deactivatedAt ? 'true' : 'false');

			const res = await fetch('?/set_variant_active', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await res.text()) as ActionResult<
				{ success: boolean; active: boolean; variants: VariantComplete[] },
				{ message?: string }
			>;

			if (result.type === 'failure') {
				formMessage = result.data?.message || 'Error al cambiar el estado de la variante';
				return;
			}
			if (result.type !== 'success') {
				formMessage = 'Error al cambiar el estado de la variante';
				return;
			}
			if (!result.data?.success) {
				formMessage = 'Error al cambiar el estado de la variante';
				return;
			}

			if (result.data.variants) {
				setVariants(result.data.variants);
			}

			toggleModal(false);
		} catch {
			formMessage = 'Error al cambiar el estado de la variante';
		}
	}

	// Permanent delete: only reachable once the variant is already inactive
	// (that is what reveals this button). The server keeps the reference
	// guards, so a variant sitting in an order or a cart comes back as a
	// failure instead of vanishing from that history.
	async function handlePermanentDelete() {
		if (!variantToDelete) return;

		try {
			const formData = new FormData();
			formData.append('variantId', variantToDelete.id);
			formData.append('productId', productSelected.product.id);

			const res = await fetch('?/delete_variant', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await res.text()) as ActionResult<
				{ success: boolean; variants?: VariantComplete[] },
				{ message?: string }
			>;

			if (result.type === 'failure') {
				formMessage = result.data?.message || 'Error al eliminar la variante';
				return;
			}
			if (result.type !== 'success' || !result.data?.success) {
				formMessage = 'Error al eliminar la variante';
				return;
			}

			if (result.data.variants) {
				setVariants(result.data.variants);
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
		<ContainerModal {toggleModal} cancelClick={true}>
			<div
				class="glass mx-4 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/4"
			>
				<div class="flex items-center justify-between border-b border-white/4 p-4">
					<h2 class="text-text-primary text-lg font-semibold">
						{deactivated ? 'Reactivar Variante' : 'Desactivar Variante'}
					</h2>
					<button
						class="text-text-secondary hover:text-brand-400 flex h-10 w-10 items-center justify-center rounded-full transition-colors"
						onclick={() => toggleModal(false)}
					>
						<Icon icon="material-symbols:close-rounded" class="text-xl" />
					</button>
				</div>
				<div class="text-text-secondary p-4">
					{#if deactivated}
						¿Reactivar <strong
							>{variantToDelete.size} / {variantToDelete.color} / {variantToDelete.cut}</strong
						>? Volverá a mostrarse en la tienda.
					{:else}
						¿Desactivar <strong
							>{variantToDelete.size} / {variantToDelete.color} / {variantToDelete.cut}</strong
						>? Dejará de mostrarse en la tienda, pero los pedidos y el carrito que ya la incluyen se
						conservan. Podrás reactivarla cuando quieras.
					{/if}
				</div>
				{#if formMessage}
					<div class="border-t border-white/4 p-4">
						<p class="text-text-error text-center">{formMessage}</p>
					</div>
				{/if}
				{#if deactivated}
					<div class="border-t border-white/4 p-4">
						<button
							type="button"
							class="btn-error w-full"
							onclick={handlePermanentDelete}
							onfocus={(e) => cancelFocus(e)}
						>
							Eliminar permanentemente
						</button>
						<p class="text-text-muted mt-2 text-center text-xs">
							Irreversible. Solo se elimina si ningún pedido ni carrito la referencia.
						</p>
					</div>
				{/if}
				<div class="flex justify-end gap-3 border-t border-white/4 p-4">
					<button type="button" class="btn-secondary" onclick={() => toggleModal(false)}
						>Cancelar</button
					>
					<button
						type="button"
						class={deactivated ? 'btn-primary' : 'btn-error'}
						onclick={handleSetActive}
						onfocus={(e) => cancelFocus(e)}
					>
						{deactivated ? 'Reactivar' : 'Desactivar'}
					</button>
				</div>
			</div>
		</ContainerModal>
	</div>
{/if}
