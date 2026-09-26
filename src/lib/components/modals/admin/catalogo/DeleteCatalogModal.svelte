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
		<ContainerModal
			toggleModal={toggleDeleteCatalogModalIsVisible}
			visible={deleteCatalogModalIsVisible}
			cancelClick={true}
		>
			<form
				id="delete-catalog"
				action="?/delete_catalog"
				method="post"
				use:enhance={({ formElement }) => {
					return async ({ result }) => {
						if (result.type === 'success') {
							formElement.reset();
							if (result.data?.catalogs) {
								// console.log(result.data.products)
								setCatalogs(result.data.catalogs as Catalog[]);
								toggleDeleteCatalogModalIsVisible(false);
							}
							// await goto("/admin", {invalidateAll: true});
						} else if (result.type === 'failure') {
							if (result.data?.message) {
								formMessage = result.data.message as string;
							}
						}
					};
				}}
				enctype="multipart/form-data"
				class="relative flex max-h-fit max-w-full flex-col gap-2 rounded-md border border-red-400 bg-stone-900 px-10 py-5"
			>
				<div class="flex flex-col place-items-center gap-2 text-center">
					<input type="hidden" name="id" value={!catalogSelected ? '' : catalogSelected.id} />
					<label for="name">Nombre</label>
					<span class="text-red-300">
						{#if catalogSelected}
							{catalogSelected.name}
						{/if}
					</span>
				</div>
				<div class="flex flex-col place-items-center gap-2 text-center">
					<label for="price">Descripción</label>
					<span class="text-red-300">
						{#if catalogSelected}
							{catalogSelected.description}
						{/if}
					</span>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<button
						type="submit"
						class="cursor-pointer rounded-md border p-2 hover:text-red-500 focus:text-red-500"
						onfocus={(e) => cancelFocus(e)}
					>
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
				<div
					role="button"
					tabindex="0"
					onkeydown={() => {}}
					class="absolute top-2 right-2 cursor-pointer hover:text-red-500"
					onclick={() => toggleDeleteCatalogModalIsVisible(false)}
				>
					<Icon icon="material-symbols:close-rounded" class="text-3xl" />
				</div>
			</form>
		</ContainerModal>
	</div>
{/if}
