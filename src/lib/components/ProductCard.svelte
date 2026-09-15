<script lang="ts">
	import { page } from "$app/state";
	import type { ProductComplete } from "$lib/interfaces/product";
	import Icon from "@iconify/svelte";
	import { scale } from "svelte/transition";
	import { onMount, onDestroy } from "svelte";

    interface Props {
        product: ProductComplete
        productSelected?: ProductComplete | undefined
        selectThisProduct?: (product: ProductComplete) => void
        toggleProductModalIsVisible?: (visible?: boolean) => void
        toggleDeleteProductModalIsVisible?: (visible?: boolean) => void
        toggleEditProductModalIsVisible?: (visible?: boolean) => void
    }

    let { product, toggleProductModalIsVisible, toggleDeleteProductModalIsVisible, toggleEditProductModalIsVisible, productSelected, selectThisProduct }: Props = $props();

    let actualRoute = $derived(page.route.id);
    let isSelected = $derived(product.product.id === productSelected?.product.id);

    if (!toggleProductModalIsVisible) {
        toggleProductModalIsVisible = () => {};
    }
    if (!toggleDeleteProductModalIsVisible) {
        toggleDeleteProductModalIsVisible = () => {};
    }
    if (!toggleEditProductModalIsVisible) {
        toggleEditProductModalIsVisible = () => {};
    }
    
    if (!selectThisProduct) {
        selectThisProduct = () => {};
    }

    function cancelFocus (e: FocusEvent) {
        const target = e.target as HTMLButtonElement;
        if (target) {
            setTimeout(() => {
                target.blur();
            }, 200)
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectThisProduct?.(product);
        }
    }

    // Auto-carousel
    let imgContainer: HTMLDivElement | undefined = $state();
    let cardElement: HTMLDivElement | undefined = $state();
    let imgIndex = $state(0);
    let isHovered = $state(false);
    let isVisible = $state(false);
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const CARD_WIDTH = 288;
    const INTERVAL_MS = 3000;

    function scrollToImage(index: number) {
        if (!imgContainer) return;
        imgContainer.scrollTo({ left: index * CARD_WIDTH, behavior: 'smooth' });
    }

    function nextImage() {
        if (isHovered || !isVisible) return;
        const total = product.imgs.length;
        if (total <= 1) return;
        imgIndex = (imgIndex + 1) % total;
        scrollToImage(imgIndex);
    }

    function startCarousel() {
        stopCarousel();
        if (product.imgs.length > 1) {
            intervalId = setInterval(nextImage, INTERVAL_MS);
        }
    }

    function stopCarousel() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = undefined;
        }
    }

    onMount(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    isVisible = entry.isIntersecting;
                }
            },
            { threshold: 0.1 }
        );

        if (cardElement) {
            observer.observe(cardElement);
        }

        startCarousel();

        return () => {
            observer.disconnect();
            stopCarousel();
        };
    });

    onDestroy(() => {
        stopCarousel();
    });

</script>

<div bind:this={cardElement} class="group/card relative w-72 h-80 flex flex-col rounded-[1.25rem] overflow-hidden isolate cursor-pointer outline-none transition-all duration-500 ease-out card-thread hover:shadow-glow-md {isSelected && actualRoute?.includes('/admin') ? 'ring-1 ring-inset ring-brand-400/40 shadow-glow-md' : ''}"
    onclick={()=>selectThisProduct(product)}
    onmouseenter={()=>{ isHovered = true; }}
    onmouseleave={()=>{ isHovered = false; }}
    role="button"
    tabindex="0"
    onkeydown={handleKeydown}
    aria-label="Ver detalle de {product.product.name ?? 'camisa'}"
>
    <!-- Imagen: ocupa toda la card, recortada con el mismo radio -->
    <div bind:this={imgContainer} class="img-container absolute inset-0 z-0 flex flex-row snap-x snap-mandatory scroll-smooth overflow-hidden rounded-[1.25rem]">
        {#each product.imgs as imgProduct }
        <img src={imgProduct.url} alt={imgProduct.id} class="object-cover flex-shrink-0 snap-center w-72 h-full transition-all duration-700 ease-out group-hover/card:scale-[1.06] group-hover/card:brightness-110" loading="lazy" width="288" height="320">            
        {/each}
    </div>

    <!-- Indicadores de imagen — Thread-wrapped dots -->
    {#if product.imgs.length > 1}
    <div class="absolute top-3 left-0 right-0 flex flex-row justify-center gap-1.5 z-10 pointer-events-none">
        {#each product.imgs as _, i}
        <span class="rounded-full transition-all duration-300 {i === imgIndex ? 'bg-brand-400 w-4 h-1.5 shadow-glow-sm' : 'bg-white/40 w-1.5 h-1.5'}"></span>
        {/each}
    </div>
    {/if}

    <!-- Degradado inferior con nombre y precio — Thread-veiled -->
    <div class="absolute bottom-0 inset-x-0 z-10 flex flex-row items-end justify-between gap-3 px-4 pb-3.5 pt-20 bg-gradient-to-t from-surface-0 via-surface-0/75 to-transparent pointer-events-none">
        <p class="min-w-0 text-text-primary font-bold text-base leading-tight drop-shadow-lg truncate">
            {product.product.name ?? 'Camisa'}
        </p>
        <p class="font-bold text-brand-400 text-lg tabular-nums whitespace-nowrap drop-shadow-lg">
            {`${product.product.price.toFixed(2)} $`}
        </p>
    </div>

    <!-- Hover overlay — Thread glow effect -->
    <div class="absolute inset-0 z-10 bg-gradient-to-t from-brand-500/15 via-brand-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover/card:opacity-100 pointer-events-none"></div>

    <!-- Inset ring — sigue la curva del radio exactamente -->
    <div class="absolute inset-0 z-20 rounded-[1.25rem] ring-1 ring-inset ring-transparent group-hover/card:ring-brand-400/30 transition-all duration-500 pointer-events-none"></div>

    <!-- Thread accent line at bottom -->
    <div class="absolute bottom-0 left-0 right-0 z-20 h-[2px] bg-gradient-to-r from-transparent via-brand-400/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

    <!-- Admin overlay — Thread-wrapped -->
    {#if isSelected && actualRoute?.includes('/admin')}        
    <div transition:scale={{ duration: 150, start: 0.9 }} class="absolute top-3 right-3 z-30 flex flex-col items-center gap-2 p-2 text-2xl glass rounded-xl border border-white/8">
        <button class="p-1.5 rounded-lg text-text-muted transition-colors hover:text-brand-400 hover:bg-surface-2" 
        onclick={(e)=>{e.stopPropagation(); toggleDeleteProductModalIsVisible(true)}}
        onfocus={(e) => cancelFocus(e)}
        aria-label="Eliminar producto"
        >
            <Icon icon="mdi:delete-outline" />
        </button>
        <button class="p-1.5 rounded-lg text-text-muted transition-colors hover:text-brand-400 hover:bg-surface-2" 
        onclick={(e)=>{e.stopPropagation(); toggleEditProductModalIsVisible(true)}}
        onfocus={(e) => cancelFocus(e)}
        aria-label="Editar producto"
        >
            <Icon icon="mdi:pencil-outline" />
        </button>
    </div>
    {/if}
</div>

<style>
    .img-container {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }

    .img-container::-webkit-scrollbar {
        display: none;
    }
</style>
