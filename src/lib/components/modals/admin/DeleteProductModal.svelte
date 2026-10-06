<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ProductComplete, ProductPagination } from '$lib/interfaces/product';
	import { fade, scale } from 'svelte/transition';
	import ContainerModal from '../ContainerModal.svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		setProductPagination: (newProductPagination: ProductPagination) => void;
		productSelected?: ProductComplete;
		catalogId: string;
		toggleDeleteProductModalIsVisible: (visible?: boolean) => void;
		deleteProductModalIsVisible: boolean;
	}

	let {
		setProductPagination,
		catalogId,
		toggleDeleteProductModalIsVisible,
		deleteProductModalIsVisible,
		productSelected
	}: Props = $props();

	let formMessage = $state('');

	// Deactivation is reversible: the same modal drives both directions, so
	// its copy and payload follow the current state of the product.
	let deactivated = $derived(Boolean(productSelected?.product?.deactivatedAt));

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}

	$effect(() => {
		if (formMessage) {
			const timeout = setTimeout(() => {
				formMessage = '';
			}, 6000);
			return () => clearTimeout(timeout);
		}
	});
</script>

{#if deleteProductModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleDeleteProductModalIsVisible} cancelClick={true}>
			<form
				id="delete-product"
				action="?/set_product_active"
				method="post"
				use:enhance={({ formElement }) => {
					return async ({ result }) => {
						if (result.type === 'success') {
							formElement.reset();
							if (result.data?.pagination) {
								setProductPagination(result.data.pagination as ProductPagination);
								toggleDeleteProductModalIsVisible(false);
							}
						} else if (result.type === 'failure') {
							if (result.data?.message) {
								formMessage = result.data.message as string;
							}
						}
					};
				}}
				enctype="multipart/form-data"
				class="modal-shell"
			>
				<div class="modal-header">
					<h3 class="modal-title">{deactivated ? 'Reactivar producto' : 'Desactivar producto'}</h3>
					<button
						type="button"
						class="modal-close"
						onclick={() => toggleDeleteProductModalIsVisible(false)}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Cerrar"
					>
						<Icon icon="material-symbols:close-rounded" class="text-xl" />
					</button>
				</div>
				<input type="hidden" name="product_id" value={productSelected?.product?.id ?? ''} />
				<input type="hidden" name="productId" value={productSelected?.product?.id ?? ''} />
				<input type="hidden" name="active" value={deactivated ? 'true' : 'false'} />

				<div class="modal-field text-center">
					<label for="name" class="modal-label">Nombre</label>
					<span class="text-text-primary text-base font-medium">
						{#if productSelected}
							{productSelected.product.name}
						{/if}
					</span>
				</div>

				<div class="modal-field text-center">
					<label for="price" class="modal-label">Precio</label>
					<span class="text-text-secondary text-sm">
						{#if productSelected}
							{productSelected.product.price}
						{/if}
					</span>
				</div>

				<div class="modal-field text-center">
					<p class="text-text-secondary text-sm">
						{#if deactivated}
							El producto volverá a mostrarse en la tienda.
						{:else}
							El producto dejará de mostrarse en la tienda. Los pedidos y el carrito que ya lo
							incluyen se conservan, y podrás reactivarlo cuando quieras.
						{/if}
					</p>
				</div>

				<div class="modal-actions">
					<button type="submit" class="btn-primary" onfocus={(e) => cancelFocus(e)}>
						{deactivated ? 'Reactivar' : 'Desactivar'}
					</button>
				</div>

				{#if deactivated}
					<div class="modal-actions">
						<button
							formaction="?/delete_product"
							type="submit"
							class="btn-error"
							onfocus={(e) => cancelFocus(e)}
						>
							Eliminar permanentemente
						</button>
					</div>
					<div class="modal-field text-center">
						<p class="text-text-secondary text-xs">
							Irreversible. Solo se elimina si ningún pedido ni carrito lo referencia.
						</p>
					</div>
				{/if}

				{#if catalogId}
					<div class="modal-actions">
						<button
							formaction="?/remove_product_to_catalog"
							type="submit"
							class="btn-secondary"
							onfocus={(e) => cancelFocus(e)}
						>
							Quitar del catálogo
						</button>
					</div>
				{/if}

				{#if formMessage}
					<div transition:scale>
						<p class="text-center text-red-400">
							{formMessage}
						</p>
					</div>
				{/if}
			</form>
		</ContainerModal>
	</div>
{/if}
