<script lang="ts">
	import ProductCard from '$lib/components/ProductCard.svelte';
	import { fade, scale, slide } from 'svelte/transition';
	import type { PageProps } from './$types';
	import type { ProductComplete, ProductPagination } from '$lib/interfaces/product';
	import Icon from '@iconify/svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Toast from '$lib/components/Toast.svelte';
	import type { CartItemWithProduct } from '$lib/actions';

	let { data }: PageProps = $props();

	// Pagination Data
	let productPagination: ProductPagination = $state(data.pagination);
	let products: ProductComplete[] = $derived(productPagination.products);

	let gotoPage: number | undefined = $state();

	// Catalogs
	// Read-only, never assigned locally, so `$derived` is safe here and keeps the
	// catalog list in sync whenever the load data refreshes (e.g. a catalog added
	// in the admin). Do NOT convert the three seeds below to `$derived`: they are
	// deliberately bootstrap-only and are re-seeded manually from action results.
	let catalogs = $derived(data.catalogs);
	let catalogId = $state(data.catalogId ?? '');

	// Search
	let inputSearchIsVisible = $state(false);
	let searchValue = $state('');

	// Cart
	let cart: CartItemWithProduct[] = $state(data.cartItems);
	let cartCount: number = $derived(cart.reduce((acc, item) => acc + item.quantity, 0));

	// HTML Elements
	let btnUpdateCartElement: HTMLButtonElement | undefined = $state();
	let inputSearch: HTMLInputElement | undefined = $state();
	let btnInputSearch: HTMLButtonElement | undefined = $state();

	// Visible Elements
	let gotoPageListIsVisible = $state(false);
	let catalogListIsVisible = $state(false);

	// Toast
	let toastMessage = $state('');

	// Toggle Visible Elements
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
	function toggleInputSearchIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			inputSearchIsVisible = visible;
		} else {
			inputSearchIsVisible = !inputSearchIsVisible;
		}
	}

	///////

	function setProductPagination(newProductPagination: ProductPagination) {
		productPagination = newProductPagination;
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

	let searchTimeout: ReturnType<typeof setTimeout>;
	function updateSearchValue(e: Event) {
		const target = e.target as HTMLInputElement;
		const value = target.value;
		searchValue = value;
		clearTimeout(searchTimeout);

		searchTimeout = setTimeout(() => {
			btnInputSearch?.click();
		}, 1000);
	}
	function clearSearchValue() {
		searchValue = '';
		setTimeout(() => {
			btnInputSearch?.click();
		}, 500);
	}

	// Effects

	// Plain `let`, deliberately not `$state`: non-reactive in runes mode, so
	// mutating it cannot re-trigger the effect below.
	let hasScrolledToProducts = false;

	$effect(() => {
		// `products` is the dependency: the effect re-frames the viewport
		// whenever the rendered list is replaced. It is a presence check, NOT
		// page validation — `currentPage` is never verified anywhere.
		if (productPagination.products) {
			// The visitor should land at the top of the storefront. Only re-frame
			// the viewport once the product set has actually changed underneath
			// them (pagination, catalog switch), not on the initial mount.
			if (hasScrolledToProducts) {
				scrollTo({ behavior: 'smooth', top: 170 });
			}
			hasScrolledToProducts = true;
		}
	});

	//Update cart locals
	$effect(() => {
		if (cart.length >= 0 && typeof btnUpdateCartElement !== 'undefined') {
			btnUpdateCartElement.click();
		}
	});
</script>

<div in:fade class="flex max-h-full max-w-full flex-col gap-6">
	<!-- Catalog selector — visually docked to the toolbar, scrolls away independently -->
	<div class="relative z-40 -mb-5 flex justify-start gap-2">
		<form
			action="?/set_catalog"
			method="post"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						if (result.data?.pagination) {
							setProductPagination(result.data.pagination as ProductPagination);
							toggleInputSearchIsVisible(false);
						}
					}
				};
			}}
			class="relative"
		>
			<input type="text" hidden name="catalog_id" value={catalogId} />
			<button
				type="button"
				class="bg-surface-1/95 text-text-primary hover:border-brand-400/20 hover:bg-surface-2 flex items-center gap-2 rounded-xl border border-white/6 px-4 py-2 text-sm font-medium backdrop-blur-xl transition-all duration-300"
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
								>
									{catalog.name}
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</form>

		<!-- Cart — docked beside the catalog selector, same visual level -->
		<a
			href="/carrito"
			class="group bg-surface-1/95 text-text-primary hover:border-brand-400/20 hover:bg-surface-2 relative ml-auto flex items-center rounded-xl border border-white/6 px-4 py-2 text-sm font-medium backdrop-blur-xl transition-all duration-300"
			onfocus={(e) => cancelFocus(e)}
			aria-label="Ir al carrito"
		>
			<Icon icon="bi:cart-fill" class="text-lg" />
			{#if cartCount > 0}
				<span
					class="bg-brand-500 text-surface-0 shadow-glow-sm absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold transition-transform duration-300 group-hover:scale-110"
				>
					{cartCount > 99 ? '99+' : cartCount}
				</span>
			{/if}
		</a>
	</div>

	<!-- Toolbar — Thread-wrapped glass panel, sticky below header -->
	<section class="glass sticky top-2 z-30 rounded-2xl border border-white/4 p-4">
		<!-- Thread accent line at top -->
		<div
			class="via-brand-400/20 absolute top-0 right-1/4 left-1/4 h-[1px] bg-gradient-to-r from-transparent to-transparent"
		></div>

		<div class="flex flex-wrap items-center gap-3">
			<!-- Pagination — Thread-wrapped controls -->
			<div class="flex items-center gap-1">
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
				>
					<input type="number" hidden name="current_page" value={productPagination.currentPage} />
					<input type="number" hidden name="total_pages" value={productPagination.totalPages} />
					<input type="text" hidden name="search-value" value={searchValue} />
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
					class="relative"
				>
					<input type="number" hidden name="goto_page" value={gotoPage} />
					<input type="text" hidden name="search-value" value={searchValue} />
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
				>
					<input type="number" hidden name="current_page" value={productPagination.currentPage} />
					<input type="number" hidden name="total_pages" value={productPagination.totalPages} />
					<input type="text" hidden name="search-value" value={searchValue} />
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

			<!-- Search — Thread-wrapped input -->
			<div class="ml-auto flex items-center gap-2">
				<form
					action="?/search"
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
				>
					<input type="hidden" name="value" value={searchValue} />
					<button bind:this={btnInputSearch} class="hidden">Search</button>
				</form>

				{#if inputSearchIsVisible}
					<input
						bind:this={inputSearch}
						transition:slide={{ axis: 'x', duration: 250, easing: (t) => 1 - Math.pow(1 - t, 3) }}
						type="text"
						placeholder="Buscar..."
						class="bg-surface-2/80 text-text-primary placeholder:text-text-muted/50 focus:border-brand-400/25 focus:bg-surface-2 w-44 rounded-xl border border-white/6 px-3 py-2 text-sm transition-all duration-300 outline-none focus:w-60"
						oninput={(e) => updateSearchValue(e)}
						aria-label="Buscar productos"
					/>
				{/if}

				{#if inputSearchIsVisible}
					<button
						in:scale={{ duration: 150, start: 0.8 }}
						class="text-text-muted hover:text-brand-400 hover:bg-surface-2 flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 hover:border hover:border-white/8"
						onclick={() => {
							clearSearchValue();
							toggleInputSearchIsVisible(false);
						}}
						aria-label="Limpiar búsqueda"
					>
						<Icon icon="mdi:close" class="text-lg" />
					</button>
				{:else}
					<button
						in:scale={{ duration: 150, start: 0.8 }}
						class="text-text-muted hover:text-brand-400 hover:bg-surface-2 flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 hover:border hover:border-white/8"
						onclick={() => {
							toggleInputSearchIsVisible(true);
							setTimeout(() => {
								inputSearch?.focus();
							}, 100);
						}}
						aria-label="Abrir búsqueda"
					>
						<Icon icon="mdi:magnify" class="text-lg" />
					</button>
				{/if}
			</div>
		</div>
	</section>

	<!-- Products grid — Thread-woven layout -->
	<section
		class="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
	>
		{#each products as product, index (product.product.id)}
			<div class="animate-thread-appear" style="--stagger-delay: {60 * index}ms">
				<ProductCard {product} />
			</div>
		{/each}
	</section>
</div>

<form
	action="?/update_cart"
	method="post"
	use:enhance={() => {
		return async ({ result }) => {
			if (result.type === 'success') {
				await invalidateAll();
			}
		};
	}}
	class="hidden"
>
	<input type="hidden" name="cart" value={JSON.stringify(cart)} />
	<button bind:this={btnUpdateCartElement} type="submit"> Update Cart </button>
</form>

<Toast message={toastMessage} />
