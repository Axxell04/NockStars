<script lang="ts">
	import { enhance } from '$app/forms';
	import { fade, scale } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import type { Catalog } from '$lib/interfaces/catalog';
	import ContainerModal from '../../ContainerModal.svelte';

	interface Props {
		setCatalogs: (newCatalogs: Catalog[]) => void;
		catalogSelected?: Catalog;
		toggleEditCatalogModalIsVisible: (visible?: boolean) => void;
		editCatalogModalIsVisible: boolean;
	}

	let {
		setCatalogs,
		toggleEditCatalogModalIsVisible,
		editCatalogModalIsVisible,
		catalogSelected
	}: Props = $props();

	// Form
	let formMessage = $state('');

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 300);
		}
	}
</script>

{#if editCatalogModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleEditCatalogModalIsVisible} cancelClick={true}>
			<form
				id="edit-catalog"
				action="?/edit_catalog"
				method="post"
				use:enhance={({ formElement }) => {
					return async ({ result }) => {
						if (result.type === 'failure') {
							if (result.data?.message) {
								formMessage = result.data.message as string;
							}
						} else if (result.type === 'success') {
							formElement.reset();
							if (result.data?.catalogs) {
								setCatalogs(result.data.catalogs as Catalog[]);
								toggleEditCatalogModalIsVisible(false);
							}
						}
					};
				}}
				enctype="multipart/form-data"
				class="modal-shell"
			>
				<div class="modal-header">
					<h3 class="modal-title">Editar catálogo</h3>
					<button
						type="button"
						class="modal-close"
						onclick={() => toggleEditCatalogModalIsVisible(false)}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Cerrar"
					>
						<Icon icon="material-symbols:close-rounded" class="text-xl" />
					</button>
				</div>

				{#if catalogSelected}
					<input type="hidden" name="id" value={catalogSelected.id} />
					<div class="modal-field">
						<label for="name" class="modal-label">Nombre</label>
						<input
							type="text"
							name="name"
							id="name"
							required
							autocomplete="off"
							class="modal-input"
							value={catalogSelected.name}
						/>
					</div>

					<div class="modal-field">
						<label for="description" class="modal-label">Descripción</label>
						<input
							type="text"
							name="description"
							id="description"
							required
							class="modal-input"
							value={catalogSelected.description}
						/>
					</div>
				{/if}

				<div class="modal-actions">
					<button type="submit" class="btn-primary" onfocus={(e) => cancelFocus(e)}>
						Editar
					</button>
				</div>

				{#if formMessage}
					<div transition:scale>
						<p class="text-center text-red-500">
							{formMessage}
						</p>
					</div>
				{/if}
			</form>
		</ContainerModal>
	</div>
{/if}
