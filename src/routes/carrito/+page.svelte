<script lang="ts">

	import { fade } from "svelte/transition";
	import type { PageProps } from "./$types";
	import Icon from "@iconify/svelte";
	import type { PurchaseDetail } from "$lib/interfaces/cart";
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
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
    })

</script>

<div in:fade class="flex flex-col gap-6">
    <!-- Header — Thread-wrapped glass panel, sticky below header -->
    <section class="sticky top-0 z-20 glass rounded-2xl p-4 border border-white/4">
        <!-- Thread accent line at top -->
        <div class="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-brand-400/20 to-transparent"></div>
        
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 class="text-xl font-bold text-text-primary">Carrito de compras</h2>
            <div class="flex items-center gap-3">
                <button 
                    class="btn-primary {cart.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                    onclick={() => {if (cart.length > 0) {toggleSendCartModalIsVisible(true)}}}
                    onfocus={(e) => cancelFocus(e)}
                    disabled={cart.length === 0}
                >
                    <Icon icon="mdi:cart-check" class="text-lg" />
                    Realizar pedido
                </button>
                <button 
                    class="btn-secondary {cart.length === 0 ? 'opacity-30 cursor-not-allowed' : ''}"
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

    <!-- Cart items — Thread-woven list -->
    <section class="flex flex-col gap-4">
        {#each cart as purchaseDetail, index (purchaseDetail.product.product.id)}
            <div 
                class="flex gap-4 p-4 rounded-2xl bg-surface-1/80 border border-white/4 transition-all duration-400 hover:border-white/8 hover:bg-surface-2/50 hover:shadow-glow-sm animate-thread-appear"
                style="--stagger-delay: {60 * index}ms"
            >
                <!-- Product image — Thread-wrapped -->
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

                    <!-- Quantity controls — Thread-wrapped buttons -->
                    <div class="flex items-center justify-between mt-3">
                        <span class="text-xs text-text-muted uppercase tracking-wider">Cantidad</span>
                        <div class="flex items-center gap-3">
                            <button 
                                class="flex items-center justify-center w-9 h-9 rounded-full border border-white/8 text-text-secondary transition-all duration-300 hover:border-brand-400/25 hover:text-brand-400 hover:bg-brand-400/5"
                                onclick={() => subtract(purchaseDetail)}
                                onfocus={(e) => cancelFocus(e)}
                            >
                                <Icon icon="mdi:minus" class="text-sm" />
                            </button>
                            <span class="w-8 text-center font-semibold text-text-primary tabular-nums">
                                {purchaseDetail.amount}
                            </span>
                            <button 
                                class="flex items-center justify-center w-9 h-9 rounded-full border border-white/8 text-text-secondary transition-all duration-300 hover:border-brand-400/25 hover:text-brand-400 hover:bg-brand-400/5"
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
            <div class="flex flex-col items-center justify-center py-20 text-text-muted">
                <div class="relative mb-6">
                    <Icon icon="mdi:cart-outline" class="text-7xl opacity-20" />
                    <!-- Thread accent -->
                    <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-[1px] bg-brand-400/20"></div>
                </div>
                <p class="text-lg text-text-secondary">Tu carrito está vacío</p>
                <a href="/" class="btn-primary mt-6">
                    Explorar tienda
                </a>
            </div>
        {/if}
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

<ClearCartModal {toggleClearCartModalIsVisible} {resetCart} {clearCartModalIsVisible} />
<SendCartModal {toggleSendCartModalIsVisible} {cart} {sendCartModalIsVisible} {resetCart} />
