<script lang="ts">
	import { page } from "$app/state";
	import type { Catalog } from "$lib/interfaces/catalog";
	import Icon from "@iconify/svelte";
	import { scale } from "svelte/transition";

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

<div class="group relative flex flex-row gap-3 rounded-xl cursor-pointer transition-all duration-400 ease-out
    {isSelected ? 'bg-surface-2/80 border border-brand-400/25 shadow-glow-sm' : 'bg-surface-1/80 border border-white/4 hover:border-white/8 hover:bg-surface-2/60 hover:shadow-glow-sm'}
    "
    onclick={()=>selectThisCatalog(catalog)}
    role="button"
    tabindex="0"
    onkeydown={()=>{}}
>
    <!-- Thread accent on selected -->
    {#if isSelected}
        <div class="absolute left-0 top-2 bottom-2 w-[2px] bg-gradient-to-b from-brand-400/60 via-brand-400 to-brand-400/60 rounded-full"></div>
    {/if}

    <div class="flex flex-col gap-1.5 p-4 grow min-w-0">
        <span class="font-semibold text-text-primary truncate transition-colors duration-300 group-hover:text-brand-400">
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
