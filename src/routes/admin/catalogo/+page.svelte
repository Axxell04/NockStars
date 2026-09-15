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

    let { data, form }: PageProps = $props();


    // Pagination Data
    let catalogs: Catalog[] = $state(data.catalogs); 
    let productPagination: ProductPagination = $state({totalPages: 0, currentPage: 0, products: []})

    // Visible Elements
    let addCatalogModalIsVisible = $state(false);
    let deleteCatalogModalIsVisible = $state(false);
    let editCatalogModalIsVisible = $state(false);

    // Selected Product
    let catalogSelected: Catalog | undefined = $state()

    function selectThisCatalog (catalog: Catalog) {
        catalogSelected = catalog;
    }

    function setCatalogs (newCatalogs: Catalog[]) {
        catalogs = newCatalogs;
    }

    // Toggle Visible Elements
    function toggleAddCatalogModalIsVisible (visible?: boolean) {
        if (typeof visible !== "undefined") {
            addCatalogModalIsVisible = visible;
        } else {
            addCatalogModalIsVisible = !addCatalogModalIsVisible;
        }
    }

    function toggleDeleteCatalogModalIsVisible (visible?: boolean) {
        if (typeof visible !== "undefined") {
            deleteCatalogModalIsVisible = visible;
        } else {
            deleteCatalogModalIsVisible = !deleteCatalogModalIsVisible;
        }
    }
    function toggleEditCatalogModalIsVisible (visible?: boolean) {
        if (typeof visible !== "undefined") {
            editCatalogModalIsVisible = visible;
        } else {
            editCatalogModalIsVisible = !editCatalogModalIsVisible;
        }
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
            }, 300)
        }
    } 

    // Effects

    $effect(() => {
        productPagination;
        scrollTo({behavior: 'smooth', top: 170})
    })

</script>

<div in:fade class="flex flex-col gap-2 px-5 py-5">
    <section class="flex flex-col gap-3 ">
        <div class="sticky top-0 z-40 glass rounded-2xl p-4 border border-white/4 relative place-content-around flex flex-row gap-3 place-items-center">
            <div class="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-brand-400/20 to-transparent"></div>
            <button class="btn-primary"
            onclick={() => toggleAddCatalogModalIsVisible(true)}
            onfocus={(e) => cancelFocus(e)}
            >
                <Icon icon="material-symbols:add-rounded" class="text-xl" />
                <span>
                    Añadir Catalogo
                </span>
            </button>

        </div>

        <div class="flex flex-wrap grow justify-center p-2 gap-3">
            {#each catalogs as catalog}
                <CatalogCard {catalog} {toggleDeleteCatalogModalIsVisible} {toggleEditCatalogModalIsVisible} {catalogSelected} {selectThisCatalog}  />
            {/each}
        </div>
    </section>
    <AddCatalogModal {setCatalogs} {toggleAddCatalogModalIsVisible} {addCatalogModalIsVisible} />
    <DeleteCatalogModal {setCatalogs} {catalogSelected} {toggleDeleteCatalogModalIsVisible} {deleteCatalogModalIsVisible} />
    <EditCatalogModal {setCatalogs} {catalogSelected} {toggleEditCatalogModalIsVisible} {editCatalogModalIsVisible} />
    <!-- <AddProductModal form={formAct} {setProductPagination} {toggleAddProductModalIsVisible} {addProductModalIsVisible} /> -->
    <!-- <DeleteProductModal form={formAct} {setProductPagination} {toggleDeleteProductModalIsVisible} {deleteProductModalIsVisible} {productSelected} /> -->
    <!-- <EditProductModal form={formAct} {setProductPagination} {toggleEditProductModalIsVisible} {editProductModalIsVisible} {productSelected} /> -->
</div>