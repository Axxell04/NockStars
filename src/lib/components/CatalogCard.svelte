<script lang="ts">
	import { page } from "$app/state";
	import type { Catalog } from "$lib/interfaces/catalog";
	import type { Img, Product, ProductComplete } from "$lib/interfaces/product";
	import Icon from "@iconify/svelte";
	import { fade, scale } from "svelte/transition";

    interface Props {
        catalog: Catalog
        catalogSelected?: Catalog | undefined
        selectThisCatalog?: (catalog: Catalog) => void
        toggleDeleteCatalogModalIsVisible?: (visible?: boolean) => void
        toggleEditCatalogModalIsVisible?: (visible?: boolean) => void
    }

    let { catalog, toggleDeleteCatalogModalIsVisible, toggleEditCatalogModalIsVisible, catalogSelected, selectThisCatalog }: Props = $props();

    let actualRoute = $derived(page.route.id);
    let isSelected = $derived(catalog.id === catalogSelected?.id);

    if (!toggleDeleteCatalogModalIsVisible) {
        toggleDeleteCatalogModalIsVisible = () => {};
    }
    if (!toggleEditCatalogModalIsVisible) {
        toggleEditCatalogModalIsVisible = () => {};
    }
    
    if (!selectThisCatalog) {
        selectThisCatalog = () => {};
    }

    function cancelFocus (e: FocusEvent) {
        const target = e.target as HTMLButtonElement;
        if (target) {
            setTimeout(() => {
                target.blur();
            }, 300)
        }
    }

</script>

<div class="group flex flex-row gap-3 relative rounded-xl cursor-pointer transition-all duration-300 ease-out
    {isSelected ? 'bg-surface-2 border border-brand-400/30' : 'bg-surface-1 border border-white/5 hover:border-white/10 hover:bg-surface-2/50'}
    "
    onclick={()=>selectThisCatalog(catalog)}
    role="button"
    tabindex="0"
    onkeydown={()=>{}}
>
    <div class="flex flex-col gap-1 p-4 grow min-w-0">
        <span class="font-semibold text-text-primary truncate">
            {catalog.name}
        </span>
        <p class="text-text-muted text-sm font-light line-clamp-2">
            {catalog.description}
        </p>
    </div>
    {#if actualRoute?.includes('/admin')}        
    <div transition:scale={{ duration: 150, start: 0.9 }} class="flex items-center gap-1 p-2 text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button class="p-1.5 rounded-lg text-text-muted transition-colors hover:text-brand-400 hover:bg-surface-3" 
        onclick={(e)=>{ e.stopPropagation(); toggleDeleteCatalogModalIsVisible(true) }}
        onfocus={(e) => cancelFocus(e)}
        aria-label="Eliminar catálogo"
        >
            <Icon icon="mdi:delete-outline" />
        </button>
        <button class="p-1.5 rounded-lg text-text-muted transition-colors hover:text-brand-400 hover:bg-surface-3" 
        onclick={(e)=>{ e.stopPropagation(); toggleEditCatalogModalIsVisible(true) }}
        onfocus={(e) => cancelFocus(e)}
        aria-label="Editar catálogo"
        >
            <Icon icon="mdi:pencil-outline" />
        </button>
    </div>
    {/if}
</div>