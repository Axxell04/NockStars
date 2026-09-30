<script lang="ts">
	import { enhance } from '$app/forms';
	import { fade, scale } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import type { Catalog } from '$lib/server/db/schema';
	import ContainerModal from '../../ContainerModal.svelte';

	interface Props {
		setCatalogs: (newCatalogs: Catalog[]) => void;
		toggleAddCatalogModalIsVisible: (visible?: boolean) => void;
		addCatalogModalIsVisible: boolean;
	}

	let { setCatalogs, toggleAddCatalogModalIsVisible, addCatalogModalIsVisible }: Props = $props();

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
			}, 5000);
			return () => clearTimeout(timeout);
		}
	});
</script>

{#if addCatalogModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleAddCatalogModalIsVisible} cancelClick={true}>
			<form
				id="add-catalog"
				action="?/add_catalog"
				method="post"
				use:enhance={({ formElement }) => {
					return async ({ result }) => {
						if (result.type === 'failure') {
							if (result.data?.message) {
								formMessage = result.data.message as string;
							}
						}
						if (result.type === 'success') {
							formElement.reset();
							if (result.data?.catalogs) {
								setCatalogs(result.data.catalogs as Catalog[]);
								toggleAddCatalogModalIsVisible(false);
							}
							// await goto("/admin", {invalidateAll: true});
						}
					};
				}}
				enctype="multipart/form-data"
				class="modal-shell"
			>
				<div class="modal-header">
					<h3 class="modal-title">Nuevo catálogo</h3>
					<button
						type="button"
						class="modal-close"
						onclick={() => toggleAddCatalogModalIsVisible(false)}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Cerrar"
					>
						<Icon icon="material-symbols:close-rounded" class="text-xl" />
					</button>
				</div>

				<div class="modal-field">
					<label for="name" class="modal-label">Nombre</label>
					<input
						type="text"
						name="name"
						id="name"
						required
						autocomplete="off"
						class="modal-input"
					/>
				</div>

				<div class="modal-field">
					<label for="description" class="modal-label">Descripción</label>
					<input
						type="text"
						name="description"
						id="description"
						required
						step="0.01"
						class="modal-input"
					/>
				</div>

				<div class="modal-actions">
					<button type="submit" class="btn-primary" onfocus={(e) => cancelFocus(e)}>
						Agregar
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
