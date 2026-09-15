<script lang="ts">

	import ProductCard from "$lib/components/ProductCard.svelte";
	import { onMount } from "svelte";
	import { fade, scale, slide } from "svelte/transition";
	import type { PageProps } from "./$types";
	import ContainerModal from "$lib/components/modals/ContainerModal.svelte";
	import ProductModal from "$lib/components/modals/ProductModal.svelte";
	import type { Product, ProductComplete, ProductPagination } from "$lib/interfaces/product";
	import Icon from "@iconify/svelte";
	import ImgsProductModal from "$lib/components/modals/ImgsProductModal.svelte";
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import Toast from "$lib/components/Toast.svelte";

    let { data }: PageProps = $props();

    // Pagination Data
    let productPagination: ProductPagination = $state(data.pagination);
    let products: ProductComplete[] = $derived(productPagination.products); 

    let gotoPage: number | undefined = $state();

    // Catalogs 
    let catalogs = $state(data.catalogs);
    let catalogId = $state(data.catalogId ?? '');

    // Search
    let inputSearchIsVisible = $state(false);
    let searchValue = $state("");

    // Cart
    let cart = $state(data.cart);

    // HTML Elements
    let selectCatalogElement: HTMLButtonElement | undefined = $state();
    let btnUpdateCartElement: HTMLButtonElement | undefined = $state();
    let inputSearch: HTMLInputElement | undefined = $state();
    let btnInputSearch: HTMLButtonElement | undefined = $state();

    let selectCatalogElementHeight: number = $state(9);

    // Selected Elements
    let productSelected: ProductComplete | undefined = $state() 

    function selectThisProduct (product: ProductComplete) {
        productSelected = product;

        toggleProductModalIsVisible(true);
    }

    // Visible Elements
    let productModalIsVisible = $state(false);
    let gotoPageListIsVisible = $state(false);
    let catalogListIsVisible = $state(false);

    // Toast
    let toastMessage = $state('');


    // Toggle Visible Elements
    function toggleProductModalIsVisible (visible?: boolean) {
        if (typeof visible !== "undefined") {
            productModalIsVisible = visible;
        } else {
            productModalIsVisible = !productModalIsVisible;
        }
    }
    function toggleGotoPageListIsVisible (visible?: boolean) {
        if (typeof visible !== "undefined") {
            gotoPageListIsVisible = visible;
        } else {
            gotoPageListIsVisible = !gotoPageListIsVisible;
        }
    }
    function toggleCatalogListIsVisible (visible?: boolean) {
        if (typeof visible !== "undefined") {
            catalogListIsVisible = visible;
        } else {
            catalogListIsVisible = !catalogListIsVisible;
        }
    }
    function toggleInputSearchIsVisible (visible?: boolean) {
        if (typeof visible !== "undefined") {
            inputSearchIsVisible = visible;
        } else {
            inputSearchIsVisible = !inputSearchIsVisible;
        }
    }

    ///////

    function addToCart () {
        if (typeof productSelected === 'undefined') { return };

        const indexDetail = cart.findIndex((des) => des.product.product.id === productSelected?.product.id);

        if (indexDetail !== -1) {
            cart = cart.map((pd, index) => {
                if (index === indexDetail) {
                    return {
                        product: cart[indexDetail].product,
                        amount: cart[indexDetail].amount + 1
                    }
                } else {
                    return pd
                }
            })
        } else {
            cart = [...cart, { product: productSelected, amount: 1 }]
        }

        toastMessage = 'Producto añadido al carrito'
        setTimeout(() => {
            toastMessage = ''
        }, 3000);
    }

    function setProductPagination (newProductPagination: ProductPagination) {
        productPagination = newProductPagination;
    }

    function createListPages (totalPages: number) {
        let list = []
        for (let index = 1; index <= totalPages; index++) {
            list.push(index);
        }

        return list;
    }

    function cancelFocus (e: FocusEvent) {
        const target = e.target as HTMLButtonElement;
        if (target) {
            setTimeout(() => {
                target.blur();
            }, 200)
        }
    }

    let searchTimeout: ReturnType<typeof setTimeout>;
    function updateSearchValue (e: Event) {
        const target = e.target as HTMLInputElement;
        const value = target.value;
        searchValue = value;
        clearTimeout(searchTimeout);

        searchTimeout = setTimeout(() => {
            btnInputSearch?.click();
        }, 1000)
    }
    function clearSearchValue () {
        searchValue = "";
        setTimeout(() => {
            btnInputSearch?.click();
        }, 500)
    }
 
    // Effects

    $effect(() => {
        productPagination;
        scrollTo({behavior: 'smooth', top: 170})
    });

    $effect(() => {
        if (typeof selectCatalogElement !== 'undefined' && catalogListIsVisible) {
            selectCatalogElementHeight = selectCatalogElement.clientHeight;
        }
    })

    //Update cart locals
    $effect(() => {        
        cart;
        if (typeof btnUpdateCartElement !== 'undefined') {
            btnUpdateCartElement.click();
        }
    })

</script>

<div in:fade class="flex flex-col gap-6 max-w-full max-h-full">
    <!-- Toolbar — Thread-wrapped glass panel, sticky below header -->
    <section class="sticky top-2 z-30 glass rounded-2xl p-4 border border-white/4">
        <!-- Thread accent line at top -->
        <div class="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-brand-400/20 to-transparent"></div>
        
        <div class="flex flex-wrap items-center gap-3">
            <!-- Catalog selector — Thread-wrapped dropdown -->
            <form action="?/set_catalog" method="post" use:enhance={() => {
                return async ({ result }) => {
                    if (result.type === "success") {
                        if (result.data?.pagination) {
                            setProductPagination(result.data.pagination as ProductPagination);
                            toggleInputSearchIsVisible(false);                                
                        }
                    }
                }
            }}
            class="relative"
            >
                <input type="text" hidden name="catalog_id" value={catalogId} >
                <button 
                    bind:this={selectCatalogElement} 
                    type="button" 
                    class="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-2/80 border border-white/6 text-sm font-medium text-text-primary transition-all duration-300 hover:border-brand-400/20 hover:bg-surface-2"
                    onclick={()=>toggleCatalogListIsVisible()}
                    onfocus={(e) => cancelFocus(e)}
                    aria-haspopup="listbox"
                    aria-expanded={catalogListIsVisible}
                >
                    {catalogId ? catalogs.find((cat) => cat.id === catalogId)?.name : 'Todos'}
                    <Icon icon="mdi:chevron-down" class="text-base text-text-muted transition-transform duration-300 {catalogListIsVisible ? 'rotate-180' : ''}" />
                </button>
                {#if catalogListIsVisible}                        
                <div 
                    transition:scale={{ duration: 150, start: 0.95 }}
                    class="absolute top-full left-0 mt-1 w-48 overflow-hidden rounded-xl border border-white/8 bg-surface-1/95 backdrop-blur-xl shadow-depth z-50"
                    role="listbox"
                >
                    <ul class="py-1">
                        <li>
                            <button 
                                class="w-full px-4 py-2.5 text-left text-sm transition-all {catalogId ? 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:pl-5' : 'text-brand-400 bg-brand-400/10'}" 
                                onclick={()=>{catalogId = ''; toggleCatalogListIsVisible(false)}}
                            >
                                Todos
                            </button>
                        </li>
                        {#each catalogs as catalog}
                        <li>
                            <button 
                                class="w-full px-4 py-2.5 text-left text-sm transition-all {catalogId === catalog.id ? 'text-brand-400 bg-brand-400/10' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:pl-5'}" 
                                onclick={()=>{catalogId = catalog.id; toggleCatalogListIsVisible(false)}}
                            >
                                {catalog.name}
                            </button>
                        </li>
                        {/each}
                    </ul>
                </div>
                {/if}
            </form>

            <!-- Pagination — Thread-wrapped controls -->
            <div class="flex items-center gap-1">
                <form action="?/prev_page" method="post" use:enhance={() => {
                    return async ({ result }) => {
                        if (result.type === "success") {
                            if (result.data?.pagination) {
                                setProductPagination(result.data.pagination as ProductPagination);
                            }
                        }
                    }
                }}>
                    <input type="number" hidden name="current_page" value={productPagination.currentPage}>
                    <input type="number" hidden name="total_pages" value={productPagination.totalPages}>
                    <input type="text" hidden name="search-value" value={searchValue}>
                    <button 
                        class="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300
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

                <form action="?/goto_page" method="post" use:enhance={() => {
                    return async ({ result }) => {
                        if (result.type === "success") {
                            if (result.data?.pagination) {
                                setProductPagination(result.data.pagination as ProductPagination);
                                gotoPage = undefined;
                            }
                        }
                    }
                }}
                class="relative"
                >
                    <input type="number" hidden name="goto_page" value={gotoPage} >
                    <input type="text" hidden name="search-value" value={searchValue}>                    
                    <button 
                        type="button" 
                        class="w-12 h-9 rounded-xl bg-surface-2/80 border border-white/6 text-sm font-semibold text-text-primary transition-all duration-300 hover:bg-surface-2 hover:border-brand-400/20"
                        onclick={()=>toggleGotoPageListIsVisible()}
                        onfocus={(e) => cancelFocus(e)}
                        aria-label="Ir a página"
                        aria-haspopup="listbox"
                        aria-expanded={gotoPageListIsVisible}
                    >
                        {productPagination.currentPage} / {productPagination.totalPages}
                    </button>
                    {#if gotoPageListIsVisible}                        
                    <div transition:scale={{ duration: 150, start: 0.95 }} class="absolute top-full left-0 mt-1 w-16 max-h-48 overflow-y-auto rounded-xl border border-white/8 bg-surface-1/95 backdrop-blur-xl shadow-depth z-50" role="listbox">
                        <ul class="py-1">
                            {#each createListPages(productPagination.totalPages) as page}
                            <li>
                                <button 
                                    class="w-full px-3 py-2 text-center text-sm transition-all {page === productPagination.currentPage ? 'text-brand-400 bg-brand-400/10' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'}" 
                                    onclick={()=>{gotoPage = page; toggleGotoPageListIsVisible(false)}}
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

                <form action="?/next_page" method="post" use:enhance={() => {
                    return async ({ result }) => {
                        if (result.type === "success") {
                            if (result.data?.pagination) {
                                setProductPagination(result.data.pagination as ProductPagination);
                            }
                        }
                    }
                }}>
                    <input type="number" hidden name="current_page" value={productPagination.currentPage}>
                    <input type="number" hidden name="total_pages" value={productPagination.totalPages}>
                    <input type="text" hidden name="search-value" value={searchValue}>
                    <button 
                        class="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300
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
            <div class="flex items-center gap-2 ml-auto">
                <form action="?/search" method="post" use:enhance={() => {
                    return async ({result}) => {
                        if (result.type === "success") {
                            if (result.data?.pagination) {
                                setProductPagination(result.data.pagination as ProductPagination);
                            }
                        }
                    }
                }}>
                    <input type="hidden" name="value" value={searchValue}>
                    <button bind:this={btnInputSearch} class="hidden">Search</button>
                </form>

                {#if inputSearchIsVisible}
                <input 
                    bind:this={inputSearch} 
                    transition:slide={{ axis: "x", duration: 250, easing: (t) => 1 - Math.pow(1 - t, 3) }} 
                    type="text" 
                    placeholder="Buscar..." 
                    class="w-44 px-3 py-2 rounded-xl bg-surface-2/80 border border-white/6 text-sm text-text-primary placeholder:text-text-muted/50 outline-none transition-all duration-300 focus:border-brand-400/25 focus:w-60 focus:bg-surface-2"
                    oninput={(e) => updateSearchValue(e)}
                    aria-label="Buscar productos"
                >
                {/if}

                {#if inputSearchIsVisible}
                <button 
                    in:scale={{ duration: 150, start: 0.8 }}
                    class="flex items-center justify-center w-9 h-9 rounded-xl text-text-muted transition-all duration-300 hover:text-brand-400 hover:bg-surface-2 hover:border hover:border-white/8" 
                    onclick={() => {clearSearchValue(); toggleInputSearchIsVisible(false)}} 
                    aria-label="Limpiar búsqueda"
                >
                    <Icon icon="mdi:close" class="text-lg"/>
                </button>
                {:else}
                <button 
                    in:scale={{ duration: 150, start: 0.8 }}
                    class="flex items-center justify-center w-9 h-9 rounded-xl text-text-muted transition-all duration-300 hover:text-brand-400 hover:bg-surface-2 hover:border hover:border-white/8" 
                    onclick={() => {toggleInputSearchIsVisible(true);
                        setTimeout(() => { inputSearch?.focus(); }, 100);
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
    <section class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 justify-items-center">
        {#each products as product, index (product.product.id)}
            <div class="animate-thread-appear" style="--stagger-delay: {60 * index}ms">
                <ProductCard {product} {toggleProductModalIsVisible} {productSelected} {selectThisProduct} />                
            </div>
        {/each}
    </section>
</div>

<form action="?/update_cart" method="post" use:enhance={() => {
    return async ({ result }) => {
        if (result.type === 'success') {
            await invalidateAll();
        }
    }
}}
class="hidden"
>
    <input type="hidden" name="cart" value={JSON.stringify(cart)}>
    <button bind:this={btnUpdateCartElement} type="submit">
        Update Cart
    </button>
</form>

<Toast message={toastMessage} />

<ImgsProductModal {productSelected} imgsProductModalIsVisible={productModalIsVisible} toggleImgsProductModalIsVisible={toggleProductModalIsVisible}>
    <button class="btn-secondary px-4 py-2" onclick={addToCart}
    onfocus={(e) => cancelFocus(e)}
    >
        Añadir al carrito
    </button>
</ImgsProductModal>
