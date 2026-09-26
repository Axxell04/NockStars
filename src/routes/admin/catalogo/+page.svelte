<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { PageProps } from './$types';
	import type { ProductPagination } from '$lib/interfaces/product';
	import Icon from '@iconify/svelte';
	import type { Catalog } from '$lib/interfaces/catalog';
	import CatalogCard from '$lib/components/CatalogCard.svelte';
	import AddCatalogModal from '$lib/components/modals/admin/catalogo/AddCatalogModal.svelte';
	import DeleteCatalogModal from '$lib/components/modals/admin/catalogo/DeleteCatalogModal.svelte';
	import EditCatalogModal from '$lib/components/modals/admin/catalogo/EditCatalogModal.svelte';

	let { data }: PageProps = $props();

	// Pagination Data
	let catalogs: Catalog[] = $state(data.catalogs);
	let productPagination: ProductPagination = $state({
		totalPages: 0,
		currentPage: 0,
		products: []
	});

	// Visible Elements
	let addCatalogModalIsVisible = $state(false);
	let deleteCatalogModalIsVisible = $state(false);
	let editCatalogModalIsVisible = $state(false);

	// Selected Product
	let catalogSelected: Catalog | undefined = $state();

	function selectThisCatalog(catalog: Catalog) {
		catalogSelected = catalog;
	}

	function setCatalogs(newCatalogs: Catalog[]) {
		catalogs = newCatalogs;
	}

	// Toggle Visible Elements
	function toggleAddCatalogModalIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			addCatalogModalIsVisible = visible;
		} else {
			addCatalogModalIsVisible = !addCatalogModalIsVisible;
		}
	}

	function toggleDeleteCatalogModalIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			deleteCatalogModalIsVisible = visible;
		} else {
			deleteCatalogModalIsVisible = !deleteCatalogModalIsVisible;
		}
	}
	function toggleEditCatalogModalIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			editCatalogModalIsVisible = visible;
		} else {
			editCatalogModalIsVisible = !editCatalogModalIsVisible;
		}
	}

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 300);
		}
	}

	// Effects

	$effect(() => {
		// `products` is the dependency: re-frame whenever the rendered list is
		// replaced. A presence check, NOT page validation.
		if (productPagination.products) {
			scrollTo({ behavior: 'smooth', top: 170 });
		}
	});
</script>

<div in:fade class="flex flex-col gap-2 px-5 py-5">
	<section class="flex flex-col gap-3">
		<div
			class="glass relative sticky top-0 z-40 flex flex-row place-content-around place-items-center gap-3 rounded-2xl border border-white/4 p-4"
		>
			<div
				class="via-brand-400/20 absolute top-0 right-1/4 left-1/4 h-[1px] bg-gradient-to-r from-transparent to-transparent"
			></div>
			<button
				class="btn-primary"
				onclick={() => toggleAddCatalogModalIsVisible(true)}
				onfocus={(e) => cancelFocus(e)}
			>
				<Icon icon="material-symbols:add-rounded" class="text-xl" />
				<span> Añadir Catalogo </span>
			</button>
		</div>

		<div class="flex grow flex-wrap justify-center gap-3 p-2">
			{#each catalogs as catalog}
				<CatalogCard
					{catalog}
					{toggleDeleteCatalogModalIsVisible}
					{toggleEditCatalogModalIsVisible}
					{catalogSelected}
					{selectThisCatalog}
				/>
			{/each}
		</div>
	</section>
	<AddCatalogModal {setCatalogs} {toggleAddCatalogModalIsVisible} {addCatalogModalIsVisible} />
	<DeleteCatalogModal
		{setCatalogs}
		{catalogSelected}
		{toggleDeleteCatalogModalIsVisible}
		{deleteCatalogModalIsVisible}
	/>
	<EditCatalogModal
		{setCatalogs}
		{catalogSelected}
		{toggleEditCatalogModalIsVisible}
		{editCatalogModalIsVisible}
	/>
	<!-- <AddProductModal form={formAct} {setProductPagination} {toggleAddProductModalIsVisible} {addProductModalIsVisible} /> -->
	<!-- <DeleteProductModal form={formAct} {setProductPagination} {toggleDeleteProductModalIsVisible} {deleteProductModalIsVisible} {productSelected} /> -->
	<!-- <EditProductModal form={formAct} {setProductPagination} {toggleEditProductModalIsVisible} {editProductModalIsVisible} {productSelected} /> -->
</div>
