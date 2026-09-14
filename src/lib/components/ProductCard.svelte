<script lang="ts">
	import { page } from "$app/state";
	import type { Img, Product, ProductComplete } from "$lib/interfaces/product";
	import Icon from "@iconify/svelte";
	import { fade, scale } from "svelte/transition";
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

    const CARD_WIDTH = 288; // w-72 = 18rem = 288px
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
        // IntersectionObserver: pause carousel when card is off-screen
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

<div bind:this={cardElement} class="group/card relative w-72 h-80 flex flex-col rounded-2xl overflow-hidden cursor-pointer outline-none transition-all duration-500 ease-out"
    style="box-shadow: var(--shadow-card);"
    onclick={()=>selectThisProduct(product)}
    onmouseenter={()=>{ isHovered = true; }}
    onmouseleave={()=>{ isHovered = false; }}
    role="button"
    tabindex="0"
    onkeydown={handleKeydown}
    aria-label="Ver detalle de {product.product.name ?? 'camisa'}"
>
    <!-- Imagen: ocupa toda la card -->
    <div bind:this={imgContainer} class="img-container absolute inset-0 flex flex-row overflow-y-hidden overflow-x-hidden snap-x snap-mandatory scroll-smooth">
        {#each product.imgs as imgProduct }
        <img src={imgProduct.url} alt={imgProduct.id} class="object-cover flex-shrink-0 snap-center w-72 h-full transition-transform duration-700 ease-out group-hover/card:scale-105" loading="lazy" width="288" height="320">            
        {/each}
    </div>

    <!-- Indicadores de imagen -->
    {#if product.imgs.length > 1}
    <div class="absolute top-3 left-0 right-0 flex flex-row justify-center gap-1.5 z-10 pointer-events-none">
        {#each product.imgs as _, i}
        <span class="rounded-full transition-all duration-300 {i === imgIndex ? 'bg-brand-400 w-4 h-1.5' : 'bg-white/40 w-1.5 h-1.5'}"></span>
        {/each}
    </div>
    {/if}

    <!-- Degradado inferior con nombre y precio -->
    <div class="absolute bottom-0 inset-x-0 flex flex-row items-end justify-between px-4 pb-3 pt-16 bg-gradient-to-t from-surface-0/95 via-surface-0/60 to-transparent pointer-events-none">
        <p class="text-text-primary font-bold text-base leading-tight drop-shadow-lg">
            {product.product.name ?? 'Camisa'}
        </p>
        <p class="font-semibold text-brand-400 text-lg tabular-nums drop-shadow-lg">
            {`${product.product.price.toFixed(2)} $`}
        </p>
    </div>

    <!-- Hover overlay -->
    <div class="absolute inset-0 bg-gradient-to-t from-brand-500/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover/card:opacity-100 pointer-events-none"></div>

    <!-- Admin overlay -->
    {#if isSelected && actualRoute?.includes('/admin')}        
    <div transition:scale={{ duration: 150, start: 0.9 }} class="absolute top-3 right-3 flex flex-col items-center gap-2 p-2 text-2xl glass rounded-xl z-10 border border-white/10">
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