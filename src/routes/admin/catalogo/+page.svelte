<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import Icon from '@iconify/svelte';
	import type { Catalog } from '$lib/interfaces/catalog';
	import type { ProductComplete } from '$lib/interfaces/product';
	import type { VariantComplete } from '$lib/actions';
	import CatalogCard from '$lib/components/CatalogCard.svelte';
	import AddCatalogModal from '$lib/components/modals/admin/catalogo/AddCatalogModal.svelte';
	import DeleteCatalogModal from '$lib/components/modals/admin/catalogo/DeleteCatalogModal.svelte';
	import EditCatalogModal from '$lib/components/modals/admin/catalogo/EditCatalogModal.svelte';
	import VariantModal from '$lib/components/modals/admin/VariantModal.svelte';
	import DeleteVariantModal from '$lib/components/modals/admin/catalogo/DeleteVariantModal.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	let { data }: PageProps = $props();

	// Active tab: 'catalogs' | 'products' | 'variants'
	let activeTab = $state<'catalogs' | 'products' | 'variants'>('catalogs');

	// Catalog data
	let catalogs: Catalog[] = $state(data.catalogs);
	let catalogSelected: Catalog | undefined = $state();

	// Product data
	let products: ProductComplete[] = $state([]);
	let productSelected: ProductComplete | undefined = $state();

	// Variant data
	let variants: VariantComplete[] = $state([]);
	let variantToEdit: VariantComplete | null = $state(null);
	let variantToDelete: VariantComplete | null = $state(null);

	// True while a subview's own fetch is in flight. Drives the skeleton, so a
	// slow response never leaves a false empty state on screen.
	let productsLoading = $state(false);
	let variantsLoading = $state(false);

	// Fixed placeholder counts — they communicate "loading", they do not predict
	// the real list length.
	const PRODUCT_SKELETONS = Array.from({ length: 6 }, (_, i) => i);
	const VARIANT_SKELETONS = Array.from({ length: 4 }, (_, i) => i);

	// Modals visibility
	let addCatalogModalIsVisible = $state(false);
	let deleteCatalogModalIsVisible = $state(false);
	let editCatalogModalIsVisible = $state(false);

	let addProductModalIsVisible = $state(false);
	let deleteProductModalIsVisible = $state(false);
	let editProductModalIsVisible = $state(false);

	let addVariantModalIsVisible = $state(false);
	let deleteVariantModalIsVisible = $state(false);
	let editVariantModalIsVisible = $state(false);

	// Form action references for enhance callbacks
	let addProductForm: HTMLFormElement | undefined = $state();
	let updateProductForm: HTMLFormElement | undefined = $state();
	let deleteProductForm: HTMLFormElement | undefined = $state();

	// Selection functions
	// The product selection belongs to a catalog: changing the catalog (or clearing
	// it) invalidates it, otherwise Variantes keeps showing the previous product.
	function clearProductSelection() {
		productSelected = undefined;
		variants = [];
	}

	function selectThisCatalog(catalog: Catalog) {
		catalogSelected = catalog;
		clearProductSelection();
	}

	function selectThisProduct(product: ProductComplete) {
		productSelected = product;
		// Load variants for this product
		loadVariants(product.product.id);
	}

	function setCatalogs(newCatalogs: Catalog[]) {
		catalogs = newCatalogs;
	}

	function setProducts(newProducts: ProductComplete[]) {
		products = newProducts;
	}

	function setVariants(newVariants: VariantComplete[]) {
		variants = newVariants;
	}

	// Toggle functions
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

	function toggleAddVariantModalIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			addVariantModalIsVisible = visible;
		} else {
			addVariantModalIsVisible = !addVariantModalIsVisible;
		}
	}

	function toggleDeleteVariantModalIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			deleteVariantModalIsVisible = visible;
		} else {
			deleteVariantModalIsVisible = !deleteVariantModalIsVisible;
		}
	}

	function toggleEditVariantModalIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			editVariantModalIsVisible = visible;
		} else {
			editVariantModalIsVisible = !editVariantModalIsVisible;
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

	// Load products for the selected catalog, or the catalog-less ones when none is selected
	async function loadProducts(catalogId?: string) {
		productsLoading = true;
		try {
			const url = catalogId
				? `/admin/catalogo/api/products?catalogId=${catalogId}`
				: '/admin/catalogo/api/products';
			const response = await fetch(url);
			if (response.ok) {
				const data = await response.json();
				setProducts(data.products);
			}
		} catch (error) {
			console.error('Failed to load products:', error);
		} finally {
			productsLoading = false;
		}
	}

	// Single entry point for the Productos tab: loads the product list for the
	// current selection (with or without a catalog) exactly once per entry.
	function openProductsTab() {
		activeTab = 'products';
		void loadProducts(catalogSelected?.id);
	}

	// Load variants for selected product
	async function loadVariants(productId: string) {
		variantsLoading = true;
		try {
			const response = await fetch(`/admin/catalogo/api/variants?productId=${productId}`);
			if (response.ok) {
				const data = await response.json();
				setVariants(data.variants);
			}
		} catch (error) {
			console.error('Failed to load variants:', error);
		} finally {
			variantsLoading = false;
		}
	}

	// Enhance callbacks
	function handleAddProductEnhance() {
		return async (input: unknown) => {
			const { result } = input as { result: { type: string; data?: { success?: boolean } } };
			if (result.type === 'success' && result.data?.success) {
				toggleAddProductModalIsVisible(false);
				await loadProducts(catalogSelected?.id);
			}
		};
	}

	function handleUpdateProductEnhance() {
		return async (input: unknown) => {
			const { result } = input as { result: { type: string; data?: { success?: boolean } } };
			if (result.type === 'success' && result.data?.success) {
				toggleEditProductModalIsVisible(false);
				await loadProducts(catalogSelected?.id);
			}
		};
	}

	function handleDeleteProductEnhance() {
		return async (input: unknown) => {
			const { result } = input as { result: { type: string; data?: { success?: boolean } } };
			if (result.type === 'success' && result.data?.success) {
				toggleDeleteProductModalIsVisible(false);
				// Capture the deleted product before awaiting: the selection may change meanwhile.
				const deletedProductId = productSelected?.product.id;
				await loadProducts(catalogSelected?.id);
				if (deletedProductId && productSelected?.product.id === deletedProductId) {
					productSelected = undefined;
					variants = [];
				}
			}
		};
	}

	function handleVariantSuccess() {
		if (productSelected) {
			loadVariants(productSelected.product.id);
		}
	}
</script>

<div in:fade class="flex flex-col gap-3 px-3 py-4 sm:px-5 sm:py-5">
	<!-- Tab Navigation -->
	<section
		class="glass shadow-depth sticky top-0 z-40 overflow-hidden rounded-2xl border border-white/6 backdrop-blur-md"
	>
		<div
			class="via-brand-400/20 absolute top-0 right-1/4 left-1/4 h-[1px] bg-gradient-to-r from-transparent to-transparent"
		></div>
		<div class="grid w-full grid-cols-3">
			<button
				class="flex items-center justify-center gap-1 border-b-2 px-1.5 py-2.5 text-xs font-medium transition-all active:scale-[0.98] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm {activeTab ===
				'catalogs'
					? 'text-brand-400 bg-brand-400/10 border-brand-400 font-semibold'
					: 'text-text-secondary hover:text-text-primary hover:bg-surface-1/60 border-transparent'}"
				onclick={() => (activeTab = 'catalogs')}
				onfocus={(e) => cancelFocus(e)}
			>
				<Icon icon="mdi:folder-outline" class="flex-shrink-0 text-base sm:text-lg" />
				<span class="truncate">Catálogos</span>
			</button>
			<button
				class="flex items-center justify-center gap-1 border-b-2 px-1.5 py-2.5 text-xs font-medium transition-all active:scale-[0.98] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm {activeTab ===
				'products'
					? 'text-brand-400 bg-brand-400/10 border-brand-400 font-semibold'
					: 'text-text-secondary hover:text-text-primary hover:bg-surface-1/60 border-transparent'}"
				onclick={() => openProductsTab()}
				onfocus={(e) => cancelFocus(e)}
			>
				<Icon icon="mdi:tshirt-crew-outline" class="flex-shrink-0 text-base sm:text-lg" />
				<span class="truncate">Productos</span>
				{#if catalogSelected}
					<span class="xs:inline-block bg-brand-400 hidden h-1.5 w-1.5 flex-shrink-0 rounded-full"
					></span>
				{/if}
			</button>
			<button
				class="flex items-center justify-center gap-1 border-b-2 px-1.5 py-2.5 text-xs font-medium transition-all active:scale-[0.98] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm {activeTab ===
				'variants'
					? 'text-brand-400 bg-brand-400/10 border-brand-400 font-semibold'
					: 'text-text-secondary hover:text-text-primary hover:bg-surface-1/60 border-transparent'} {productSelected
					? ''
					: 'opacity-80'}"
				onclick={() => (activeTab = 'variants')}
				onfocus={(e) => cancelFocus(e)}
			>
				<Icon icon="mdi:cube-outline" class="flex-shrink-0 text-base sm:text-lg" />
				<span class="truncate">Variantes</span>
				{#if productSelected}
					<span class="xs:inline-block bg-brand-400 hidden h-1.5 w-1.5 flex-shrink-0 rounded-full"
					></span>
				{/if}
			</button>
		</div>
	</section>

	<!-- Context indicator for selected catalog/product -->
	{#if catalogSelected || productSelected}
		<div
			class="bg-surface-1/80 flex items-center justify-between gap-2 rounded-xl border border-white/6 px-3 py-1.5 text-xs"
		>
			<div class="flex items-center gap-1.5 truncate">
				<span class="text-text-muted flex-shrink-0">Selección:</span>
				{#if catalogSelected}
					<span class="text-brand-400 flex items-center gap-1 truncate font-medium">
						<Icon icon="mdi:folder-outline" class="flex-shrink-0 text-sm" />
						<span class="truncate">{catalogSelected.name}</span>
					</span>
				{:else}
					<span class="text-text-muted flex-shrink-0">Sin catálogo</span>
				{/if}
				{#if productSelected}
					<span class="text-text-muted flex-shrink-0">›</span>
					<span class="text-brand-400 flex items-center gap-1 truncate font-medium">
						<Icon icon="mdi:tshirt-crew-outline" class="flex-shrink-0 text-sm" />
						<span class="truncate">{productSelected.product.name}</span>
					</span>
				{/if}
			</div>
			<button
				type="button"
				class="text-text-muted hover:text-brand-400 ml-2 flex-shrink-0 text-xs underline"
				onclick={() => {
					catalogSelected = undefined;
					productSelected = undefined;
					variants = [];
					products = [];
					if (activeTab === 'products') {
						void loadProducts();
					}
				}}
			>
				Limpiar
			</button>
		</div>
	{/if}

	<!-- Catalogs Tab -->
	{#if activeTab === 'catalogs'}
		<section class="flex flex-1 flex-col gap-3">
			<div
				class="flex flex-col items-stretch justify-between gap-2.5 sm:flex-row sm:items-center sm:gap-3"
			>
				<button
					class="btn-primary w-full sm:w-auto"
					onclick={() => toggleAddCatalogModalIsVisible(true)}
					onfocus={(e) => cancelFocus(e)}
				>
					<Icon icon="material-symbols:add-rounded" class="text-xl" />
					<span> Añadir Catálogo </span>
				</button>
				<button
					type="button"
					class="btn-secondary w-full sm:w-auto {catalogSelected ? '' : 'ring-brand-400/50 ring-2'}"
					onclick={() => {
						catalogSelected = undefined;
						clearProductSelection();
						openProductsTab();
					}}
					onfocus={(e) => cancelFocus(e)}
				>
					<Icon icon="mdi:folder-open-outline" class="text-xl" />
					<span>Sin catálogo</span>
				</button>
			</div>

			<div class="flex grow flex-wrap justify-center gap-3 p-2">
				<div
					class="group relative flex w-full max-w-sm cursor-pointer flex-row gap-3 rounded-xl transition-all duration-400 ease-out {catalogSelected
						? 'bg-surface-1/80 hover:bg-surface-2/60 border border-white/4'
						: 'bg-surface-2/80 border-brand-400/25 shadow-glow-sm border'}"
					onclick={() => {
						catalogSelected = undefined;
						clearProductSelection();
						// activeTab = 'products';
					}}
					role="button"
					tabindex="0"
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							catalogSelected = undefined;
							clearProductSelection();
							// activeTab = 'products';
						}
					}}
				>
					{#if !catalogSelected}
						<div
							class="from-brand-400/60 via-brand-400 to-brand-400/60 absolute top-2 bottom-2 left-0 w-[2px] rounded-full bg-gradient-to-b"
						></div>
					{/if}
					<div class="flex min-w-0 grow flex-col gap-1.5 p-4">
						<span
							class="text-text-primary truncate font-semibold transition-colors duration-300 {catalogSelected
								? 'group-hover:text-brand-400'
								: 'text-brand-400'}"
						>
							Sin catálogo
						</span>
						<p class="text-text-muted line-clamp-2 text-sm font-light">
							Se continuará la creación sin un catálogo preseleccionado.
						</p>
					</div>
					<div class="flex items-center p-2 text-xl opacity-100">
						<Icon icon="mdi:folder-open-outline" class="text-brand-400" />
					</div>
				</div>

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
	{/if}

	{#snippet productCard(product: ProductComplete, index: number)}
		<div
			class="bg-surface-1/80 hover:bg-surface-2/50 hover:shadow-glow-sm animate-thread-appear stagger-thread flex gap-4 rounded-2xl border border-white/4 p-4 text-left transition-all duration-400 hover:border-white/8 {productSelected
				?.product.id === product.product.id
				? 'ring-brand-400/50 ring-2'
				: ''}"
			style="--stagger-delay: {60 * index}ms"
			role="button"
			tabindex="0"
			onclick={() => selectThisProduct(product)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					selectThisProduct(product);
				}
			}}
		>
			<div class="bg-surface-2 h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl">
				{#if product.imgs.length > 0}
					<img
						src={product.imgs[0].url}
						alt={product.product.name}
						class="h-full w-full object-cover"
					/>
				{:else}
					<div class="flex h-full w-full items-center justify-center">
						<Icon icon="mdi:tshirt-crew" class="text-text-muted/30 text-4xl" />
					</div>
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				<h4 class="text-text-primary truncate font-semibold">{product.product.name}</h4>
				<p class="text-brand-400 mt-1 font-semibold">
					{product.product.price.toFixed(2)} $
				</p>
				<p class="text-text-muted text-xs">Stock: {product.product.stock}</p>
			</div>
			<div class="flex flex-col gap-2">
				<button
					class="text-text-muted hover:text-brand-400 text-sm transition-colors"
					onclick={(e) => {
						e.stopPropagation();
						productSelected = product;
						toggleEditProductModalIsVisible(true);
					}}
					onfocus={(e) => cancelFocus(e)}
				>
					<Icon icon="mdi:pencil-outline" class="text-xl" />
				</button>
				<button
					class="text-text-muted hover:text-text-error text-sm transition-colors"
					onclick={(e) => {
						e.stopPropagation();
						productSelected = product;
						toggleDeleteProductModalIsVisible(true);
					}}
					onfocus={(e) => cancelFocus(e)}
				>
					<Icon icon="mdi:delete-outline" class="text-xl" />
				</button>
			</div>
		</div>
	{/snippet}

	<!-- Products Tab -->
	{#if activeTab === 'products'}
		<section class="flex flex-1 flex-col gap-3">
			<div class="flex flex-col items-stretch justify-between gap-2.5 sm:flex-row sm:items-center">
				<h3 class="text-text-primary truncate text-base font-semibold sm:text-lg">
					{catalogSelected ? catalogSelected.name : 'Sin catálogo'}
				</h3>
				<a
					href={catalogSelected
						? '/admin/producto/nuevo'
						: '/admin/producto/nuevo?returnTo=%2Fadmin%2Fcatalogo'}
					class="btn-primary w-full justify-center text-center sm:w-auto"
					onfocus={(e) => cancelFocus(e)}
				>
					<Icon icon="material-symbols:add-rounded" class="text-xl" />
					<span>
						{catalogSelected ? 'Añadir Producto' : 'Agregar producto sin catálogo'}
					</span>
				</a>
			</div>

			<div class="flex grow flex-wrap justify-center gap-3 p-2">
				{#if productsLoading}
					<div class="flex w-full flex-wrap justify-center gap-3" role="status">
						<span class="sr-only">Cargando productos…</span>
						{#each PRODUCT_SKELETONS as i (i)}
							<div class="bg-surface-1/80 flex gap-4 rounded-2xl border border-white/4 p-4">
								<Skeleton class="h-24 w-24 flex-shrink-0 rounded-xl" />
								<div class="min-w-0 flex-1 py-1">
									<div class="flex flex-col gap-2">
										<Skeleton class="h-4 w-3/5 rounded" />
										<Skeleton class="h-4 w-1/4 rounded" />
										<Skeleton class="h-3 w-1/3 rounded" />
									</div>
								</div>
								<div class="flex flex-col gap-2">
									<Skeleton class="h-6 w-6 rounded" />
									<Skeleton class="h-6 w-6 rounded" />
								</div>
							</div>
						{/each}
					</div>
				{:else}
					{#each products as product, index (product.product.id)}
						{@render productCard(product, index)}
					{/each}

					{#if products.length === 0}
						<div
							class="text-text-muted flex w-full flex-col items-center justify-center gap-4 py-20"
						>
							<Icon icon="mdi:tshirt-crew-outline" class="mb-4 text-6xl opacity-20" />
							<p class="text-lg">
								{catalogSelected
									? 'No hay productos en este catálogo'
									: 'No hay productos sin catálogo'}
							</p>
							<a
								href={catalogSelected
									? '/admin/producto/nuevo'
									: '/admin/producto/nuevo?returnTo=%2Fadmin%2Fcatalogo'}
								class="btn-primary"
								onfocus={(e) => cancelFocus(e)}
							>
								<Icon icon="material-symbols:add-rounded" class="text-xl" />
								<span>
									{catalogSelected ? 'Añadir Producto' : 'Agregar producto sin catálogo'}
								</span>
							</a>
						</div>
					{/if}
				{/if}
			</div>
		</section>
	{/if}

	<!-- Variants Tab -->
	{#if activeTab === 'variants'}
		{#if !productSelected}
			<div class="text-text-muted flex flex-1 flex-col items-center justify-center">
				<Icon icon="mdi:tshirt-crew-outline" class="mb-4 text-6xl opacity-20" />
				<p class="text-lg">Selecciona un producto para gestionar sus variantes</p>
			</div>
		{:else}
			<section class="flex flex-1 flex-col gap-3">
				<div
					class="flex flex-col items-stretch justify-between gap-2.5 sm:flex-row sm:items-center"
				>
					<div class="min-w-0">
						<h3 class="text-text-primary truncate text-base font-semibold sm:text-lg">
							{productSelected.product.name}
						</h3>
						<p class="text-text-muted text-xs sm:text-sm">Gestión de variantes</p>
					</div>
					<button
						class="btn-primary w-full justify-center sm:w-auto"
						onclick={() => toggleAddVariantModalIsVisible(true)}
						onfocus={(e) => cancelFocus(e)}
					>
						<Icon icon="material-symbols:add-rounded" class="text-xl" />
						<span> Nueva Variante </span>
					</button>
				</div>

				<div class="flex-1 overflow-auto">
					{#if variantsLoading}
						<span class="sr-only" role="status">Cargando variantes…</span>
					{/if}
					{#if variantsLoading || variants.length > 0}
						<table class="w-full text-sm">
							<thead>
								<tr class="text-text-muted border-b border-white/4 text-left">
									<th class="px-2 pb-2 font-medium">Imagen</th>
									<th class="px-2 pb-2 font-medium">Talla</th>
									<th class="px-2 pb-2 font-medium">Color</th>
									<th class="px-2 pb-2 font-medium">Corte</th>
									<th class="px-2 pb-2 font-medium">Stock</th>
									<th class="px-2 pb-2 font-medium">Precio</th>
									<th class="px-2 pb-2 font-medium">Orden</th>
									<th class="px-2 pb-2 font-medium">Acciones</th>
								</tr>
							</thead>
							<tbody>
								{#if variantsLoading}
									{#each VARIANT_SKELETONS as i (i)}
										<tr class="border-b border-white/4">
											<td class="px-2 py-3">
												<Skeleton class="h-12 w-12 rounded-lg" />
											</td>
											<td class="px-2 py-3"><Skeleton class="h-4 w-10 rounded" /></td>
											<td class="px-2 py-3"><Skeleton class="h-4 w-16 rounded" /></td>
											<td class="px-2 py-3"><Skeleton class="h-4 w-14 rounded" /></td>
											<td class="px-2 py-3"><Skeleton class="h-4 w-6 rounded" /></td>
											<td class="px-2 py-3"><Skeleton class="h-4 w-16 rounded" /></td>
											<td class="px-2 py-3"><Skeleton class="h-4 w-6 rounded" /></td>
											<td class="px-2 py-3"><Skeleton class="h-4 w-12 rounded" /></td>
										</tr>
									{/each}
								{:else}
									{#each variants as variant}
										<tr class="hover:bg-surface-1/50 border-b border-white/4 transition-colors">
											<td class="px-2 py-3">
												{#if variant.images.length > 0}
													<img
														src={variant.images[0].url}
														alt={variant.images[0].alt}
														class="h-12 w-12 rounded-lg object-cover"
													/>
												{:else if productSelected.imgs.length > 0}
													<img
														src={productSelected.imgs[0].url}
														alt={productSelected.product.name}
														class="h-12 w-12 rounded-lg object-cover"
													/>
												{:else}
													<div
														class="bg-surface-2 flex h-12 w-12 items-center justify-center rounded-lg"
													>
														<Icon icon="mdi:tshirt-crew" class="text-text-muted/30 text-xl" />
													</div>
												{/if}
											</td>
											<td class="text-text-primary px-2 py-3 font-medium">{variant.size}</td>
											<td class="text-text-primary px-2 py-3">
												<span
													class="inline-flex items-center gap-2 rounded-full border border-white/4 py-1 pr-2.5 pl-1"
												>
													<span
														class="block size-4 shrink-0 rounded-full border border-white/20"
														style="background-color: {variant.colorHex ?? '#6b7280'};"
														aria-hidden="true"
													></span>
													{variant.color}
												</span>
											</td>
											<td class="text-text-primary px-2 py-3 capitalize">{variant.cut}</td>
											<td class="text-text-primary px-2 py-3 tabular-nums">{variant.stock}</td>
											<td class="text-brand-400 px-2 py-3 font-medium tabular-nums">
												{variant.priceOverride !== null && variant.priceOverride !== undefined
													? Number(variant.priceOverride).toFixed(2) + ' $'
													: productSelected.product.price.toFixed(2) + ' $ (base)'}
											</td>
											<td class="text-text-muted px-2 py-3 tabular-nums">{variant.sortOrder}</td>
											<td class="px-2 py-3">
												<div class="flex items-center gap-2">
													<button
														class="text-text-muted hover:text-brand-400 transition-colors"
														onclick={() => {
															variantToEdit = variant;
															toggleEditVariantModalIsVisible(true);
														}}
														onfocus={(e) => cancelFocus(e)}
													>
														<Icon icon="mdi:pencil-outline" class="text-xl" />
													</button>
													<button
														class="text-text-muted hover:text-text-error transition-colors"
														onclick={() => {
															variantToDelete = variant;
															toggleDeleteVariantModalIsVisible(true);
														}}
														onfocus={(e) => cancelFocus(e)}
													>
														<Icon icon="mdi:delete-outline" class="text-xl" />
													</button>
												</div>
											</td>
										</tr>
									{/each}
								{/if}
							</tbody>
						</table>
					{:else}
						<div class="text-text-muted flex flex-col items-center justify-center py-20">
							<Icon icon="mdi:cube-outline" class="mb-4 text-6xl opacity-20" />
							<p class="text-lg">Este producto no tiene variantes</p>
							<p class="text-sm">
								Las variantes permiten definir tallas, colores y cortes con stock y precio
								independientes
							</p>
						</div>
					{/if}
				</div>
			</section>
		{/if}
	{/if}

	<!-- Modals -->
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

	<!-- Product Modals (inline for now) -->
	{#if addProductModalIsVisible && catalogSelected}
		<div
			class="bg-surface-0/95 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
			transition:fade={{ duration: 200 }}
		>
			<div
				class="glass mx-4 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/4"
			>
				<div class="flex items-center justify-between border-b border-white/4 p-4">
					<h2 class="text-text-primary text-lg font-semibold">Nuevo Producto</h2>
					<button
						class="text-text-secondary hover:text-brand-400 flex h-10 w-10 items-center justify-center rounded-full transition-colors"
						onclick={() => toggleAddProductModalIsVisible(false)}
					>
						<Icon icon="material-symbols:close-rounded" class="text-xl" />
					</button>
				</div>
				<form
					action="?/add_product"
					method="post"
					use:enhance={handleAddProductEnhance()}
					bind:this={addProductForm}
					class="overflow-y-auto p-4"
				>
					<input type="hidden" name="catalogId" value={catalogSelected.id} />
					<div class="space-y-4">
						<div>
							<label for="addProductName" class="text-text-secondary mb-1 block text-sm"
								>Nombre</label
							>
							<input
								id="addProductName"
								type="text"
								name="name"
								required
								class="bg-surface-2 text-text-primary placeholder:text-text-muted/50 focus:border-brand-400/50 w-full rounded-lg border border-white/4 px-4 py-2 focus:outline-none"
							/>
						</div>
						<div>
							<label for="addProductPrice" class="text-text-secondary mb-1 block text-sm"
								>Precio ($)</label
							>
							<input
								id="addProductPrice"
								type="number"
								name="price"
								step="0.01"
								min="0"
								required
								class="bg-surface-2 text-text-primary focus:border-brand-400/50 w-full rounded-lg border border-white/4 px-4 py-2 focus:outline-none"
							/>
						</div>
						<div>
							<label for="addProductStock" class="text-text-secondary mb-1 block text-sm"
								>Stock inicial</label
							>
							<input
								id="addProductStock"
								type="number"
								name="stock"
								min="0"
								value="0"
								class="bg-surface-2 text-text-primary focus:border-brand-400/50 w-full rounded-lg border border-white/4 px-4 py-2 focus:outline-none"
							/>
						</div>
					</div>
					<div class="mt-6 flex justify-end gap-3">
						<button
							type="button"
							class="btn-secondary"
							onclick={() => toggleAddProductModalIsVisible(false)}>Cancelar</button
						>
						<button type="submit" class="btn-primary">Crear</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if editProductModalIsVisible && productSelected}
		<div
			class="bg-surface-0/95 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
			transition:fade={{ duration: 200 }}
		>
			<div
				class="glass mx-4 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/4"
			>
				<div class="flex items-center justify-between border-b border-white/4 p-4">
					<h2 class="text-text-primary text-lg font-semibold">Editar Producto</h2>
					<button
						class="text-text-secondary hover:text-brand-400 flex h-10 w-10 items-center justify-center rounded-full transition-colors"
						onclick={() => toggleEditProductModalIsVisible(false)}
					>
						<Icon icon="material-symbols:close-rounded" class="text-xl" />
					</button>
				</div>
				<form
					action="?/update_product"
					method="post"
					use:enhance={handleUpdateProductEnhance()}
					bind:this={updateProductForm}
					class="overflow-y-auto p-4"
				>
					<input type="hidden" name="productId" value={productSelected.product.id} />
					<div class="space-y-4">
						<div>
							<label for="editProductName" class="text-text-secondary mb-1 block text-sm"
								>Nombre</label
							>
							<input
								id="editProductName"
								type="text"
								name="name"
								value={productSelected.product.name}
								required
								class="bg-surface-2 text-text-primary focus:border-brand-400/50 w-full rounded-lg border border-white/4 px-4 py-2 focus:outline-none"
							/>
						</div>
						<div>
							<label for="editProductPrice" class="text-text-secondary mb-1 block text-sm"
								>Precio ($)</label
							>
							<input
								id="editProductPrice"
								type="number"
								name="price"
								step="0.01"
								min="0"
								value={productSelected.product.price}
								required
								class="bg-surface-2 text-text-primary focus:border-brand-400/50 w-full rounded-lg border border-white/4 px-4 py-2 focus:outline-none"
							/>
						</div>
						<div>
							<label for="editProductStock" class="text-text-secondary mb-1 block text-sm"
								>Stock</label
							>
							<input
								id="editProductStock"
								type="number"
								name="stock"
								min="0"
								value={productSelected.product.stock}
								class="bg-surface-2 text-text-primary focus:border-brand-400/50 w-full rounded-lg border border-white/4 px-4 py-2 focus:outline-none"
							/>
						</div>
					</div>
					<div class="mt-6 flex justify-end gap-3">
						<button
							type="button"
							class="btn-secondary"
							onclick={() => toggleEditProductModalIsVisible(false)}>Cancelar</button
						>
						<button type="submit" class="btn-primary">Guardar</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if deleteProductModalIsVisible && productSelected}
		<div
			class="bg-surface-0/95 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
			transition:fade={{ duration: 200 }}
		>
			<div
				class="glass mx-4 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/4"
			>
				<div class="flex items-center justify-between border-b border-white/4 p-4">
					<h2 class="text-text-primary text-lg font-semibold">Eliminar Producto</h2>
					<button
						class="text-text-secondary hover:text-brand-400 flex h-10 w-10 items-center justify-center rounded-full transition-colors"
						onclick={() => toggleDeleteProductModalIsVisible(false)}
					>
						<Icon icon="material-symbols:close-rounded" class="text-xl" />
					</button>
				</div>
				<div class="text-text-secondary p-4">
					¿Estás seguro de que quieres eliminar "{productSelected.product.name}"? Esta acción no se
					puede deshacer.
				</div>
				<form
					action="?/delete_product"
					method="post"
					use:enhance={handleDeleteProductEnhance()}
					bind:this={deleteProductForm}
					class="flex justify-end gap-3 border-t border-white/4 p-4"
				>
					<input type="hidden" name="productId" value={productSelected.product.id} />
					<button
						type="button"
						class="btn-secondary"
						onclick={() => toggleDeleteProductModalIsVisible(false)}>Cancelar</button
					>
					<button type="submit" class="btn-error">Eliminar</button>
				</form>
			</div>
		</div>
	{/if}

	<!-- Variant Modals -->
	{#if productSelected}
		<VariantModal
			{productSelected}
			{variantToEdit}
			isAdd={true}
			toggleModal={toggleAddVariantModalIsVisible}
			isVisible={addVariantModalIsVisible}
			onSuccess={handleVariantSuccess}
		/>
		<VariantModal
			{productSelected}
			{variantToEdit}
			isAdd={false}
			toggleModal={toggleEditVariantModalIsVisible}
			isVisible={editVariantModalIsVisible}
			onSuccess={handleVariantSuccess}
		/>
		<DeleteVariantModal
			{setVariants}
			{productSelected}
			{variantToDelete}
			toggleModal={toggleDeleteVariantModalIsVisible}
			isVisible={deleteVariantModalIsVisible}
		/>
	{/if}
</div>
