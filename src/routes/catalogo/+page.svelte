<script lang="ts">
	import { enhance } from '$app/forms';
	import { fade } from 'svelte/transition';
	import type { PageProps } from './$types';
	import { goto } from '$app/navigation';
	import type { Catalog } from '$lib/interfaces/catalog';
	import CatalogCard from '$lib/components/CatalogCard.svelte';

	let { data }: PageProps = $props();

	// Catalog list
	let catalogs: Catalog[] = $state(data.catalogs);

	// Selected Product
	let catalogSelected: Catalog | undefined = $state();

	// HTML Element
	let btnViewCatalog: HTMLButtonElement | undefined = $state();

	function selectThisCatalog(catalog: Catalog) {
		catalogSelected = catalog;
	}

	// Effects

	$effect(() => {
		if (catalogSelected && typeof btnViewCatalog !== 'undefined') {
			btnViewCatalog.click();
		}
	});
</script>

<div in:fade class="flex flex-col gap-6 px-5 py-5">
	<!-- Section header -->
	<div class="flex items-center gap-3">
		<div class="bg-brand-400 h-6 w-1 rounded-full"></div>
		<h2 class="text-text-primary text-2xl font-bold tracking-wide">Catálogos</h2>
	</div>

	<section class="flex flex-col gap-4">
		<form
			action="?/view_catalog"
			method="post"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						goto('/');
					}
				};
			}}
			class="hidden"
		>
			<input type="hidden" name="catalog_id" value={catalogSelected ? catalogSelected.id : ''} />
			<button bind:this={btnViewCatalog}> View Catalog </button>
		</form>

		<!-- Thread-woven catalog grid -->
		<div class="flex grow flex-wrap justify-center gap-4 p-2">
			{#each catalogs as catalog, index}
				<div class="animate-thread-appear" style="--stagger-delay: {80 * index}ms">
					<CatalogCard {catalog} {catalogSelected} {selectThisCatalog} />
				</div>
			{/each}
		</div>
	</section>
</div>
