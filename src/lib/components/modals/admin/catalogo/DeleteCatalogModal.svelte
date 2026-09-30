<script lang="ts">
	import { enhance } from '$app/forms';
	import { fade, scale } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import type { Catalog } from '$lib/interfaces/catalog';
	import ContainerModal from '../../ContainerModal.svelte';

	interface Props {
		setCatalogs: (newCatalogs: Catalog[]) => void;
		catalogSelected?: Catalog;
		toggleDeleteCatalogModalIsVisible: (visible?: boolean) => void;
		deleteCatalogModalIsVisible: boolean;
	}

	let {
		setCatalogs,
		toggleDeleteCatalogModalIsVisible,
		deleteCatalogModalIsVisible,
		catalogSelected
	}: Props = $props();

	let formMessage = $state('');

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 300);
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

{#if deleteCatalogModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleDeleteCatalogModalIsVisible} cancelClick={true}>
			<form
				id="delete-catalog"
				action="?/delete_catalog"
				method="post"
				use:enhance={({ formElement }) => {
					return async ({ result }) => {
						if (result.type === 'success') {
							formElement.reset();
							if (result.data?.catalogs) {
								setCatalogs(result.data.catalogs as Catalog[]);
								toggleDeleteCatalogModalIsVisible(false);
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
					<h3 class="modal-title">Eliminar catálogo</h3>
					<button
						type="button"
						class="modal-close"
						onclick={() => toggleDeleteCatalogModalIsVisible(false)}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Cerrar"
					>
						<Icon icon="material-symbols:close-rounded" class="text-xl" />
					</button>
				</div>
				<input type="hidden" name="id" value={catalogSelected?.id ?? ''} />

				<div class="modal-field text-center">
					<label for="name" class="modal-label">Nombre</label>
					<span class="text-text-primary text-base font-medium">
						{#if catalogSelected}
							{catalogSelected.name}
						{/if}
					</span>
				</div>

				<div class="modal-field text-center">
					<label for="price" class="modal-label">Descripción</label>
					<span class="text-text-secondary text-sm">
						{#if catalogSelected}
							{catalogSelected.description}
						{/if}
					</span>
				</div>

				<div class="modal-actions">
					<button type="submit" class="btn-primary" onfocus={(e) => cancelFocus(e)}>
						Eliminar
					</button>
				</div>

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
