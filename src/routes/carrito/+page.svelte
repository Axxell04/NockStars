<script lang="ts">

	import { fade } from "svelte/transition";
	import type { PageProps } from "./$types";
	import Icon from "@iconify/svelte";
	import type { PurchaseDetail } from "$lib/interfaces/cart";
	import { enhance } from "$app/forms";
	import ClearCartModal from "$lib/components/modals/carrito/ClearCartModal.svelte";
	import SendCartModal from "$lib/components/modals/carrito/SendCartModal.svelte";

    let { data }: PageProps = $props();

    let cart = $state(data.cart);

    //HTML Elements
    let btnUpdateCartElement: HTMLButtonElement | undefined = $state();

    // Visible Elements
    let clearCartModalIsVisible = $state(false);
    let sendCartModalIsVisible = $state(false);

    // Toggle Visible Elements
    function toggleClearCartModalIsVisible (visible?: boolean) {
        if (typeof visible === 'undefined') {
            clearCartModalIsVisible = !clearCartModalIsVisible;
        } else {
            clearCartModalIsVisible = visible;
        }
    }
    function toggleSendCartModalIsVisible (visible?: boolean) {
        if (typeof visible === 'undefined') {
            sendCartModalIsVisible = !sendCartModalIsVisible;
        } else {
            sendCartModalIsVisible = visible;
        }
    }

    function addProduct (purchaseDetail: PurchaseDetail) {
        cart = cart.map((pd) => {
            if (pd.product.product.id === purchaseDetail.product.product.id) {
                return {
                    product: pd.product,
                    amount: pd.amount + 1
                }
            } else {
                return pd
            }
        })
    }
    
    function subtract (purchaseDetail: PurchaseDetail) {
        cart = cart.map((pd) => {
            if (pd.product.product.id === purchaseDetail.product.product.id) {
                return {
                    product: pd.product,
                    amount: pd.amount - 1
                }
            } else {
                return pd
            }
        });

        cart = cart.filter((pd) => pd.amount > 0);
    }

    function resetCart () {
        cart = [];
    }

    function cancelFocus (e: FocusEvent) {
        const target = e.target as HTMLButtonElement;
        if (target) {
            setTimeout(() => {
                target.blur();
            }, 200)
        }
    }

    $effect(() => {
        cart;
        if (typeof btnUpdateCartElement !== 'undefined') {
            btnUpdateCartElement.click();
        }
        // USAR UNA COLA DE ACTUALIZACIÓN PARA EVITAR ACTUALIZACIONES DESFAZADAS???
    })

</script>

<div in:fade class="flex flex-col gap-6">
    <!-- Header -->
    <section class="sticky top-[var(--header-height,0px)] z-20 glass rounded-2xl p-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 class="text-xl font-bold text-text-primary">Carrito de compras</h2>
            <div class="flex items-center gap-3">
                <button 
                    class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                    {cart.length > 0 
                        ? 'bg-brand-500 text-surface-0 hover:bg-brand-600 shadow-lg shadow-brand-500/20' 
                        : 'bg-surface-2 text-text-muted cursor-not-allowed'}"
                    onclick={() => {if (cart.length > 0) {toggleSendCartModalIsVisible(true)}}}
                    onfocus={(e) => cancelFocus(e)}
                    disabled={cart.length === 0}
                >
                    <Icon icon="mdi:cart-check" class="text-lg" />
                    Realizar pedido
                </button>
                <button 
                    class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-white/10 text-text-secondary transition-all duration-200
                    {cart.length > 0 
                        ? 'hover:border-brand-400/30 hover:text-brand-400 hover:bg-brand-400/10' 
                        : 'opacity-30 cursor-not-allowed'}"
                    onclick={() => {if (cart.length > 0) {toggleClearCartModalIsVisible(true)}}}
                    onfocus={(e) => cancelFocus(e)}
                    disabled={cart.length === 0}
                >
                    <Icon icon="mdi:cart-remove" class="text-lg" />
                    Vaciar
                </button>
            </div>
        </div>
    </section>

    <!-- Cart items -->
    <section class="flex flex-col gap-3">
        {#each cart as purchaseDetail, index (purchaseDetail.product.product.id)}
            <div 
                class="flex gap-4 p-4 rounded-2xl bg-surface-1 border border-white/5 transition-all duration-300 hover:border-white/10 hover:bg-surface-2/50"
                style="animation: fade-up 0.4s var(--ease-smooth) {index * 0.05}s both"
            >
                <!-- Product image -->
                <div class="flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 overflow-hidden rounded-xl bg-surface-2">
                    <img 
                        src={purchaseDetail.product.imgs[0].url} 
                        alt={purchaseDetail.product.product.name} 
                        class="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                    >
                </div>

                <!-- Product info -->
                <div class="flex flex-col flex-1 justify-between min-w-0">
                    <div>
                        <h3 class="text-base font-semibold text-text-primary truncate">
                            {purchaseDetail.product.product.name}
                        </h3>
                        <p class="text-brand-400 font-semibold mt-1">
                            {purchaseDetail.product.product.price} $
                        </p>
                    </div>

                    <!-- Quantity controls -->
                    <div class="flex items-center justify-between mt-3">
                        <span class="text-xs text-text-muted uppercase tracking-wider">Cantidad</span>
                        <div class="flex items-center gap-3">
                            <button 
                                class="flex items-center justify-center w-8 h-8 rounded-full border border-white/10 text-text-secondary transition-all duration-200 hover:border-brand-400/30 hover:text-brand-400 hover:bg-brand-400/10"
                                onclick={() => subtract(purchaseDetail)}
                                onfocus={(e) => cancelFocus(e)}
                            >
                                <Icon icon="mdi:minus" class="text-sm" />
                            </button>
                            <span class="w-8 text-center font-semibold text-text-primary tabular-nums">
                                {purchaseDetail.amount}
                            </span>
                            <button 
                                class="flex items-center justify-center w-8 h-8 rounded-full border border-white/10 text-text-secondary transition-all duration-200 hover:border-brand-400/30 hover:text-brand-400 hover:bg-brand-400/10"
                                onclick={() => addProduct(purchaseDetail)}
                                onfocus={(e) => cancelFocus(e)}
                            >
                                <Icon icon="mdi:plus" class="text-sm" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        {/each}

        {#if cart.length === 0}
            <div class="flex flex-col items-center justify-center py-16 text-text-muted">
                <Icon icon="mdi:cart-outline" class="text-6xl mb-4 opacity-30" />
                <p class="text-lg">Tu carrito está vacío</p>
                <a href="/" class="mt-4 px-4 py-2 rounded-xl bg-brand-500 text-surface-0 text-sm font-medium hover:bg-brand-600 transition-colors">
                    Explorar tienda
                </a>
            </div>
        {/if}
    </section>
</div>

<form action="?/update_cart" method="post" use:enhance 
class="hidden"
>
    <input type="hidden" name="cart" value={JSON.stringify(cart)}>
    <button bind:this={btnUpdateCartElement} type="submit">
        Update Cart
    </button>
</form>

<ClearCartModal {toggleClearCartModalIsVisible} {resetCart} {clearCartModalIsVisible} />
<SendCartModal {toggleSendCartModalIsVisible} {cart} {sendCartModalIsVisible} {resetCart} />