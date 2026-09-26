<script lang="ts">
	import { enhance } from '$app/forms';
	import { fade, scale, slide } from 'svelte/transition';
	import type { PageProps } from './$types';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import type { ProductComplete, ProductPagination } from '$lib/interfaces/product';
	import Icon from '@iconify/svelte';
	import AddProductModal from '$lib/components/modals/admin/AddProductModal.svelte';
	import DeleteProductModal from '$lib/components/modals/admin/DeleteProductModal.svelte';
	import EditProductModal from '$lib/components/modals/admin/EditProductModal.svelte';
	import AddProductToCatalogModal from '$lib/components/modals/admin/AddProductToCatalogModal.svelte';

	let { data }: PageProps = $props();

	// Pagination Data
	let productPagination: ProductPagination = $state(data.pagination);
	let products: ProductComplete[] = $derived(productPagination.products);

	let gotoPage: number | undefined = $state();

	// Catalogs
	let catalogs = $state(data.catalogs);
	let catalogId = $state(data.catalogId ?? '');

	// HTML Elements
	let selectCatalogElement: HTMLButtonElement | undefined = $state();

	// Visible Elements
	let addProductModalIsVisible = $state(false);
	let addProductToCatalogModalIsVisible = $state(false);
	let deleteProductModalIsVisible = $state(false);
	let editProductModalIsVisible = $state(false);
	let gotoPageListIsVisible = $state(false);
	let catalogListIsVisible = $state(false);

	let optAddProductIsVisible = $state(false);

	// Selected Product
	let productSelected: ProductComplete | undefined = $state();

	function selectThisProduct(product: ProductComplete) {
		productSelected = product;
	}

	function setProductSelected(product: ProductComplete) {
		productSelected = product;
	}

	function setProductPagination(newProductPagination: ProductPagination) {
		productPagination = newProductPagination;
	}

	// Toggle Visible Elements
	function toggleAddProductModalIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			addProductModalIsVisible = visible;
		} else {
			addProductModalIsVisible = !addProductModalIsVisible;
		}
	}
	function toggleDeleteProductModalIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			deleteProductModalIsVisible = visible;
		} else {
			deleteProductModalIsVisible = !deleteProductModalIsVisible;
		}
	}
	function toggleEditProductModalIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			editProductModalIsVisible = visible;
		} else {
			editProductModalIsVisible = !editProductModalIsVisible;
		}
	}
	function toggleGotoPageListIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			gotoPageListIsVisible = visible;
		} else {
			gotoPageListIsVisible = !gotoPageListIsVisible;
		}
	}
	function toggleCatalogListIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			catalogListIsVisible = visible;
		} else {
			catalogListIsVisible = !catalogListIsVisible;
		}
	}
	function toggleOptAddProductIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			optAddProductIsVisible = visible;
		} else {
			optAddProductIsVisible = !optAddProductIsVisible;
		}
	}
	function toggleAddProductToCatalogModalIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			addProductToCatalogModalIsVisible = visible;
		} else {
			addProductToCatalogModalIsVisible = !addProductToCatalogModalIsVisible;
		}
	}

	function createListPages(totalPages: number) {
		let list = [];
		for (let index = 1; index <= totalPages; index++) {
			list.push(index);
		}

		return list;
	}

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}

	// Effects

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- reactive dependency marker for $effect
		productPagination;
		scrollTo({ behavior: 'smooth', top: 170 });
	});

	$inspect(productPagination);
</script>

<div in:fade class="flex flex-col gap-2 px-5 py-5">
	<section class="flex flex-col gap-3">
		<div
			class="glass sticky top-2 z-40 flex flex-wrap items-center gap-3 rounded-2xl border border-white/4 p-4"
		>
			<!-- Thread accent line at top -->
			<div
				class="via-brand-400/20 absolute top-0 right-1/4 left-1/4 h-[1px] bg-gradient-to-r from-transparent to-transparent"
			></div>
			<div class="flex flex-row place-items-center gap-2">
				<button
					class="btn-primary"
					style="padding-inline: 10px;"
					onclick={() => {
						if (catalogId) {
							toggleOptAddProductIsVisible();
						} else {
							toggleAddProductModalIsVisible(true);
						}
					}}
					onfocus={(e) => cancelFocus(e)}
				>
					<Icon icon="lucide:package-plus" class="text-xl" />
				</button>
				{#if optAddProductIsVisible}
					<div transition:slide={{ axis: 'x' }} class="flex flex-row items-center gap-1">
						<button
							class="bg-brand-500/15 text-brand-400 hover:bg-brand-500/25 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-300"
							onclick={() => toggleAddProductModalIsVisible(true)}
							onfocus={(e) => cancelFocus(e)}
						>
							<span> Nuevo </span>
						</button>
						<button
							class="text-text-secondary hover:text-brand-400 hover:border-brand-400/25 hover:bg-brand-400/5 rounded-xl border border-white/6 px-3 py-2 text-sm font-medium transition-all duration-300"
							onclick={() => toggleAddProductToCatalogModalIsVisible(true)}
							onfocus={(e) => cancelFocus(e)}
						>
							<span> Existente </span>
						</button>
					</div>
				{/if}
			</div>

			<div class="flex flex-row place-items-center gap-3">
				<form
					action="?/set_catalog"
					method="post"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								if (result.data?.pagination) {
									setProductPagination(result.data.pagination as ProductPagination);
								}
							}
						};
					}}
					class="relative"
				>
					<input type="text" hidden name="catalog_id" value={catalogId} />
					<!-- <input type="text" class="w-10 text-center text-3xl bg-transparent outline-none" value={productPagination.currentPage} oninput={(e)=>updatePagination(e)} /> -->
					<button
						bind:this={selectCatalogElement}
						type="button"
						class="bg-surface-2/80 text-text-primary hover:border-brand-400/20 hover:bg-surface-2 flex items-center gap-2 rounded-xl border border-white/6 px-4 py-2 text-sm font-medium transition-all duration-300"
						onclick={() => toggleCatalogListIsVisible()}
						onfocus={(e) => cancelFocus(e)}
						aria-haspopup="listbox"
						aria-expanded={catalogListIsVisible}
					>
						{catalogId ? catalogs.find((cat) => cat.id === catalogId)?.name : 'Todos'}
						<Icon
							icon="mdi:chevron-down"
							class="text-text-muted text-base transition-transform duration-300 {catalogListIsVisible
								? 'rotate-180'
								: ''}"
						/>
					</button>
					{#if catalogListIsVisible}
						<div
							transition:scale={{ duration: 150, start: 0.95 }}
							class="bg-surface-1/95 shadow-depth absolute top-full left-0 z-50 mt-1 w-48 overflow-hidden rounded-xl border border-white/8 backdrop-blur-xl"
							role="listbox"
						>
							<ul class="py-1">
								<li>
									<button
										class="w-full px-4 py-2.5 text-left text-sm transition-all {catalogId
											? 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:pl-5'
											: 'text-brand-400 bg-brand-400/10'}"
										onclick={() => {
											catalogId = '';
											toggleCatalogListIsVisible(false);
										}}
										onfocus={(e) => cancelFocus(e)}
									>
										Todos
									</button>
								</li>
								{#each catalogs as catalog}
									<li>
										<button
											class="w-full px-4 py-2.5 text-left text-sm transition-all {catalogId ===
											catalog.id
												? 'text-brand-400 bg-brand-400/10'
												: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:pl-5'}"
											onclick={() => {
												catalogId = catalog.id;
												toggleCatalogListIsVisible(false);
											}}
											onfocus={(e) => cancelFocus(e)}
										>
											{catalog.name}
										</button>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</form>
				<form
					action="?/prev_page"
					method="post"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								if (result.data?.pagination) {
									setProductPagination(result.data.pagination as ProductPagination);
								}
							}
						};
					}}
					class="flex flex-col place-content-center"
				>
					<input type="number" hidden name="current_page" value={productPagination.currentPage} />
					<input type="number" hidden name="total_pages" value={productPagination.totalPages} />
					<button
						class="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300
                    {productPagination.currentPage > 1
							? 'text-text-secondary hover:text-brand-400 hover:bg-surface-2 hover:border hover:border-white/8'
							: 'text-text-muted/30 cursor-not-allowed'}"
						disabled={productPagination.currentPage <= 1}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Página anterior"
					>
						<Icon icon="mdi:chevron-left" class="text-lg" />
					</button>
				</form>
				<!-- <input type="text" class="w-10 text-center text-3xl bg-transparent outline-none" value={productPagination.currentPage ?? 1} /> -->
				<form
					action="?/goto_page"
					method="post"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								if (result.data?.pagination) {
									setProductPagination(result.data.pagination as ProductPagination);
									gotoPage = undefined;
								}
							}
						};
					}}
					class="relative flex flex-col place-content-center"
				>
					<input type="number" hidden name="goto_page" value={gotoPage} />
					<!-- <input type="text" class="w-10 text-center text-3xl bg-transparent outline-none" value={productPagination.currentPage} oninput={(e)=>updatePagination(e)} /> -->
					<button
						type="button"
						class="bg-surface-2/80 text-text-primary hover:bg-surface-2 hover:border-brand-400/20 h-9 w-12 rounded-xl border border-white/6 text-sm font-semibold transition-all duration-300"
						onclick={() => toggleGotoPageListIsVisible()}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Ir a página"
						aria-haspopup="listbox"
						aria-expanded={gotoPageListIsVisible}
					>
						{productPagination.currentPage} / {productPagination.totalPages}
					</button>
					{#if gotoPageListIsVisible}
						<div
							transition:scale={{ duration: 150, start: 0.95 }}
							class="bg-surface-1/95 shadow-depth absolute top-full left-0 z-50 mt-1 max-h-48 w-16 overflow-y-auto rounded-xl border border-white/8 backdrop-blur-xl"
							role="listbox"
						>
							<ul class="py-1">
								{#each createListPages(productPagination.totalPages) as page}
									<li>
										<button
											class="w-full px-3 py-2 text-center text-sm transition-all {page ===
											productPagination.currentPage
												? 'text-brand-400 bg-brand-400/10'
												: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'}"
											onclick={() => {
												gotoPage = page;
												toggleGotoPageListIsVisible(false);
											}}
											onfocus={(e) => cancelFocus(e)}
										>
											{page}
										</button>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</form>
				<form
					action="?/next_page"
					method="post"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								if (result.data?.pagination) {
									setProductPagination(result.data.pagination as ProductPagination);
								}
							}
						};
					}}
					class="flex flex-col place-content-center"
				>
					<input type="number" hidden name="current_page" value={productPagination.currentPage} />
					<input type="number" hidden name="total_pages" value={productPagination.totalPages} />
					<button
						class="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300
                    {productPagination.currentPage < productPagination.totalPages
							? 'text-text-secondary hover:text-brand-400 hover:bg-surface-2 hover:border hover:border-white/8'
							: 'text-text-muted/30 cursor-not-allowed'}"
						disabled={productPagination.currentPage >= productPagination.totalPages}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Página siguiente"
					>
						<Icon icon="mdi:chevron-right" class="text-lg" />
					</button>
				</form>
			</div>
		</div>

		<section
			class="grid grid-cols-1 justify-items-center gap-6 p-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
		>
			{#each products as product, index (product.product.id)}
				<div class="animate-thread-appear" style="--stagger-delay: {60 * index}ms">
					<ProductCard
						{product}
						{productSelected}
						{selectThisProduct}
						{toggleDeleteProductModalIsVisible}
						{toggleEditProductModalIsVisible}
					/>
				</div>
			{/each}
		</section>
	</section>
	<AddProductModal
		{setProductPagination}
		{toggleAddProductModalIsVisible}
		{addProductModalIsVisible}
	/>
	<DeleteProductModal
		{setProductPagination}
		{catalogId}
		{toggleDeleteProductModalIsVisible}
		{deleteProductModalIsVisible}
		{productSelected}
	/>
	<EditProductModal
		{setProductPagination}
		{setProductSelected}
		{toggleEditProductModalIsVisible}
		{editProductModalIsVisible}
		{productSelected}
	/>
	<AddProductToCatalogModal
		{setProductPagination}
		{catalogId}
		{toggleAddProductToCatalogModalIsVisible}
		{addProductToCatalogModalIsVisible}
	/>
</div>
