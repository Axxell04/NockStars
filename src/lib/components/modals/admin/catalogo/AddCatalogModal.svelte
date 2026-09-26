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
		<ContainerModal
			toggleModal={toggleAddCatalogModalIsVisible}
			visible={addCatalogModalIsVisible}
			cancelClick={true}
		>
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
				class="relative flex max-h-fit max-w-full flex-col gap-2 rounded-md border border-red-400 bg-stone-900 px-4 py-3"
			>
				<div class="flex flex-col place-items-center gap-2">
					<label for="name">Nombre</label>
					<input
						type="text"
						name="name"
						id="name"
						required
						autocomplete="off"
						class="max-w-full rounded-md border border-red-400 px-1 outline-none"
					/>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="description">Descripción</label>
					<input
						type="text"
						name="description"
						id="description"
						required
						step="0.01"
						class="max-w-full rounded-md border border-red-400 px-1 outline-none"
					/>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<button
						class="cursor-pointer rounded-md border p-2 hover:text-red-500 focus:text-red-500"
						onfocus={(e) => cancelFocus(e)}
					>
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
				<div
					role="button"
					tabindex="0"
					onkeydown={() => {}}
					class="absolute top-2 right-2 cursor-pointer hover:text-red-500"
					onclick={() => toggleAddCatalogModalIsVisible(false)}
				>
					<Icon icon="material-symbols:close-rounded" class="text-3xl" />
				</div>
			</form>
		</ContainerModal>
	</div>
{/if}
