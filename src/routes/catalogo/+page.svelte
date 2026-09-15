<script lang="ts">
    import { enhance } from "$app/forms";
	import { fade, scale } from "svelte/transition";
	import type { PageProps } from "./$types";
	import ProductCard from "$lib/components/ProductCard.svelte";
	import { goto, invalidate, invalidateAll } from "$app/navigation";
	import type { ProductComplete, ProductPagination } from "$lib/interfaces/product";
	import Icon from "@iconify/svelte";
	import type { Catalog, CatalogComplete } from "$lib/interfaces/catalog";
	import AddCatalogModal from "$lib/components/modals/admin/catalogo/AddCatalogModal.svelte";
	import CatalogCard from "$lib/components/CatalogCard.svelte";
	import DeleteCatalogModal from "$lib/components/modals/admin/catalogo/DeleteCatalogModal.svelte";
	import EditCatalogModal from "$lib/components/modals/admin/catalogo/EditCatalogModal.svelte";

    let { data }: PageProps = $props();


    // Pagination Data
    let catalogs: Catalog[] = $state(data.catalogs); 
    let productPagination: ProductPagination = $state({totalPages: 0, currentPage: 0, products: []})

    // Selected Product
    let catalogSelected: Catalog | undefined = $state()

    // HTML Element
    let btnViewCatalog: HTMLButtonElement | undefined = $state();

    function selectThisCatalog (catalog: Catalog) {
        catalogSelected = catalog;
    }

    function setCatalogs (newCatalogs: Catalog[]) {
        catalogs = newCatalogs;
    }
    

    // Effects

    $effect(() => {
        productPagination;
        scrollTo({behavior: 'smooth', top: 170})
    })

    $effect(() => {
        if (catalogSelected && typeof btnViewCatalog !== 'undefined') {
            btnViewCatalog.click();
        }
    })

</script>

<div in:fade class="flex flex-col gap-6 px-5 py-5">
    <!-- Section header -->
    <div class="flex items-center gap-3">
        <div class="w-1 h-6 bg-brand-400 rounded-full"></div>
        <h2 class="text-2xl font-bold text-text-primary tracking-wide">Catálogos</h2>
    </div>

    <section class="flex flex-col gap-4 ">
        <form action="?/view_catalog" method="post" use:enhance={() => {
            return async ({ result }) => {
                if (result.type === 'success') {
                    goto('/')
                }
            }
        }}
        class="hidden"
        >
            <input type="hidden" name="catalog_id" value={catalogSelected ? (catalogSelected.id) : ''}>
            <button bind:this={btnViewCatalog} >
                View Catalog
            </button>
        </form>
        
        <!-- Thread-woven catalog grid -->
        <div class="flex flex-wrap grow justify-center p-2 gap-4">
            {#each catalogs as catalog, index}
                <div class="animate-thread-appear" style="--stagger-delay: {80 * index}ms">
                    <CatalogCard {catalog} {catalogSelected} {selectThisCatalog}  />
                </div>
            {/each}
        </div>
    </section>
</div>
