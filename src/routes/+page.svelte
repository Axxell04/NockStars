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
            // cart = [...cart, {product: cart[indexDetail].product, amount: cart[indexDetail].amount + 1}];
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

<div in:fade class="flex flex-col gap-2 max-w-full max-h-full">
    <section class="px-10 w-full sticky -top-1 z-40 bg-stone-900/95 backdrop-blur-lg">
        <div class="flex flex-wrap gap-3 place-items-center text-center text-red-400 font-normal p-4 border border-transparent border-b-red-400">
            <div class="flex flex-row gap-2 place-items-center">
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
                class="flex flex-col place-content-center relative"
                >
                    <input type="text" hidden name="catalog_id" value={catalogId} >
                    <!-- <input type="text" class="w-10 text-center text-3xl bg-transparent outline-none" value={productPagination.currentPage} oninput={(e)=>updatePagination(e)} /> -->
                    <button bind:this={selectCatalogElement} type="button" class="text-center text-2xl bg-transparent outline-none hover:text-red-500 focus:text-red-500" 
                    onclick={()=>toggleCatalogListIsVisible()}
                    onfocus={(e) => cancelFocus(e)}
                    aria-haspopup="listbox"
                    aria-expanded={catalogListIsVisible}
                    >
                        {catalogId ? catalogs.find((cat) => cat.id === catalogId)?.name : 'Todo'}
                    </button>
                    {#if catalogListIsVisible}                        
                    <div transition:scale class="absolute flex flex-col text-2xl rounded-b-md border bg-stone-900/95 max-h-60 overflow-y-auto place-self-center z-10"
                    style="top: {selectCatalogElementHeight}px;"
                    role="listbox"
                    >
                        <ul>
                            <li>
                                <button class="hover:bg-stone-800 focus:bg-stone-800 px-2 py-1 w-full {catalogId ? '' : 'text-red-500'}" onclick={()=>{catalogId = ''; toggleCatalogListIsVisible(false)}}>
                                    Todo
                                </button>
                            </li>
                            {#each catalogs as catalog}
                            <li>
                                <button class="hover:bg-stone-800 focus:bg-stone-800 px-2 py-1 w-full {catalogId === catalog.id ? 'text-red-500' : ''}" onclick={()=>{catalogId = catalog.id; toggleCatalogListIsVisible(false)}}>
                                    {catalog.name}
                                </button>
                            </li>
                            {/each}
                        </ul>
                    </div>
                    {/if}
                </form>
                <form action="?/prev_page" method="post" use:enhance={() => {
                    return async ({ result }) => {
                        if (result.type === "success") {
                            if (result.data?.pagination) {
                                setProductPagination(result.data.pagination as ProductPagination);
                            }
                        }
                    }
                }}
                class="flex flex-col place-content-center"
                >
                    <input type="number" hidden name="current_page" value={productPagination.currentPage}>
                    <input type="number" hidden name="total_pages" value={productPagination.totalPages}>
                    <input type="text" hidden name="search-value" value={searchValue}>
                    {#if productPagination.currentPage > 1}
                    <button class="hover:text-red-500 focus:text-red-500" onfocus={(e) => cancelFocus(e)} aria-label="Página anterior">
                        <Icon icon="icon-park-outline:left-c" class="text-3xl" />
                    </button>
                    {:else}
                    <button class="opacity-50" disabled aria-label="Página anterior">
                        <Icon icon="icon-park-outline:left-c" class="text-3xl" />
                    </button>
                    {/if}
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
                class="flex flex-col place-content-center relative"
                >
                    <input type="number" hidden name="goto_page" value={gotoPage} >
                    <input type="text" hidden name="search-value" value={searchValue}>                    
                    <!-- <input type="text" class="w-10 text-center text-3xl bg-transparent outline-none" value={productPagination.currentPage} oninput={(e)=>updatePagination(e)} /> -->
                    <button type="button" class="w-10 text-center text-3xl bg-transparent h-9 outline-none hover:text-red-500 focus:text-red-500" 
                    onclick={()=>toggleGotoPageListIsVisible()}
                    onfocus={(e) => cancelFocus(e)}
                    aria-label="Ir a página"
                    aria-haspopup="listbox"
                    aria-expanded={gotoPageListIsVisible}
                    >
                        {productPagination.currentPage}
                    </button>
                    {#if gotoPageListIsVisible}                        
                    <div transition:scale class="absolute top-9 flex flex-col text-3xl rounded-b-md border bg-stone-900/95 max-h-65 overflow-y-auto place-self-center" role="listbox">
                        <ul>
                            {#each createListPages(productPagination.totalPages) as page}
                            <li>
                                <button class="hover:bg-stone-800 focus:bg-stone-800 focus:text-red-500 px-2 py-1 w-full" 
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
                <!-- <span class="block text-3xl">
                    1
                </span> -->
                <form action="?/next_page" method="post" use:enhance={() => {
                    return async ({ result }) => {
                        if (result.type === "success") {
                            if (result.data?.pagination) {
                                setProductPagination(result.data.pagination as ProductPagination);
                            }
                        }
                    }
                }}
                class="flex flex-col place-content-center"
                >
                    <input type="number" hidden name="current_page" value={productPagination.currentPage}>
                    <input type="number" hidden name="total_pages" value={productPagination.totalPages}>
                    <input type="text" hidden name="search-value" value={searchValue}>
                    {#if productPagination.currentPage < productPagination.totalPages}
                    <button class="hover:text-red-500 focus-within:text-red-500" onfocus={(e) => cancelFocus(e)} aria-label="Página siguiente">
                        <Icon icon="icon-park-outline:right-c" class="text-3xl" />
                    </button>
                    {:else}    
                    <button class="opacity-50" disabled aria-label="Página siguiente">
                        <Icon icon="icon-park-outline:right-c" class="text-3xl" />
                    </button>
                    {/if}
                </form>
            </div>
            <div class="flex flex-row gap-2">
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
                    <button bind:this={btnInputSearch} class="hidden">
                        Search
                    </button>
                </form>
                {#if inputSearchIsVisible}
                <input bind:this={inputSearch} transition:slide={{axis: "x"}} type="text" placeholder="Search..." class="outline-none border rounded-md px-1"
                    oninput={(e) => updateSearchValue(e)}
                    aria-label="Buscar productos"
                >                    
                {/if}

                {#if inputSearchIsVisible}
                <button in:scale onclick={() => {clearSearchValue(); toggleInputSearchIsVisible(false)}} aria-label="Limpiar búsqueda">
                    <Icon icon="lucide:search-x" class="text-4xl"/>
                </button>
                {:else}
                <button in:scale onclick={() => {toggleInputSearchIsVisible(true);
                    setTimeout(() => {
                        inputSearch?.focus();
                    }, 100);
                }} aria-label="Abrir búsqueda">
                    <Icon icon="lucide:search" class="text-4xl" />                    
                </button>
                {/if}
            </div>
            <div class="flex flex-row ml-auto">
                <a href="/carrito" class="flex flex-row gap-1 justify-end self-end place-items-center hover:text-red-500 focus:text-red-500"
                onfocus={(e) => cancelFocus(e)}
                aria-label="Ir al carrito{cart.length ? `, ${cart.length} productos` : ''}"
                >
                    <div class="relative flex flex-col place-items-center">
                        <Icon icon="bi:cart-fill" class="text-4xl" />
                        {#if cart.length}
                        <span class="block absolute -top-2 -right-2 rounded-full font-bold text-lg bg-stone-900 text-red-400 border border-red-400 px-2 ">
                            {cart.length}
                        </span>                            
                        {/if}
                    </div>
                </a>
            </div>
		</div>
	</section>
    <section class="flex flex-wrap justify-center p-2 gap-5">
        {#each products as product (product.product.id)}
            <div in:scale={{delay: 100 * products.indexOf(product)}}>
                <ProductCard {product} {toggleProductModalIsVisible} {productSelected} {selectThisProduct} />                
            </div>
        {/each}
    </section>
</div>

<form action="?/update_cart" method="post" use:enhance={() => {
    return async ({ result }) => {
        if (result.type === 'success') {

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
    <button class="px-2 py-1 border rounded-full hover:text-red-500 focus:text-red-500 focus:bg-stone-800" onclick={addToCart}
    onfocus={(e) => cancelFocus(e)}
    >
        Añadir al carrito
    </button>
</ImgsProductModal>