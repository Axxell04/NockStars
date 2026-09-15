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
	import type { Order, OrderPagination } from "$lib/interfaces/order";
	import type { PurchaseDetail } from "$lib/interfaces/cart";
	import OrderCard from "$lib/components/OrderCard.svelte";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";

    let { data }: PageProps = $props();

    // Pagination Data
    // let pendingOrdersPagination: OrderPagination = $state(data.pendingOrders);
    // let completedOrdersPagination: OrderPagination = $state(data.completedOrders);
    let orderPagination: OrderPagination = $state(data.orderPagination)
    let orders: Order[] = $derived(orderPagination.orders);
    // let pendingOrders: Order[] = $derived(pendingOrdersPagination.orders); 
    // let completedOrders: Order[] = $derived(completedOrdersPagination.orders);

    let gotoPage: number | undefined = $state();

    // View State
    let viewState = $state('pending');

    // ORDER COD
    let cod = $derived(page.url.searchParams.get("cod"));

    // HTML Elements
    let selectStateElement: HTMLButtonElement | undefined = $state();
    let btnGetOrders: HTMLButtonElement | undefined = $state();
    let btnSetInitViewState: HTMLButtonElement | undefined = $state();

    let selectStateElementHeight: number = $state(9);

    // Selected Elements
    let orderSelected: Order | undefined = $state();

    function selectThisOrder (order: Order | undefined) {
        orderSelected = order;
    }

    // Visible Elements
    let gotoPageListIsVisible = $state(false);
    let stateListIsVisible = $state(false);

    // Toast
    let toastMessage = $state('');


    // Toggle Visible Elements
    function toggleGotoPageListIsVisible (visible?: boolean) {
        if (typeof visible !== "undefined") {
            gotoPageListIsVisible = visible;
        } else {
            gotoPageListIsVisible = !gotoPageListIsVisible;
        }
    }

    function toggleStateListIsVisible (visible?: boolean) {
        if (typeof visible !== "undefined") {
            stateListIsVisible = visible;
        } else {
            stateListIsVisible = !stateListIsVisible;
        }
    }

    ///////

    function setOrderPagination (newOrderPagination: OrderPagination) {
        orderPagination = newOrderPagination;
    }

    function updateOrderPaginationContent (orderId: string, newContent: PurchaseDetail[]) {
        orderPagination = {...orderPagination, orders: orderPagination.orders.map((order) => {
            if (order.id === orderId) {
                newContent = newContent.filter((pd) => pd.amount > 0);
                return {...order, content: newContent}
            }
            return order
        }).filter((order) => (order.content as PurchaseDetail[]).length > 0)}
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

    function refreshOrders () {
        const newOrders = orderPagination.orders;
        orderPagination.orders = [];
        setTimeout(() => {
            orderPagination.orders = newOrders;
        }, 200)
    }
 
    // Effects

    $effect(() => {
        orderPagination;
        scrollTo({behavior: 'smooth', top: 170})
        orderSelected = undefined;
    });

    $effect(() => {
        if (typeof selectStateElement !== 'undefined' && stateListIsVisible) {
            selectStateElementHeight = selectStateElement.clientHeight;
        }
    })

    // $effect(() => {
    //     viewState;
    //     if (typeof btnGetOrders !== 'undefined') {
    //         // btnGetOrders.click();
    //     }
    // });

    onMount(() => {
        if (typeof btnSetInitViewState !== 'undefined') {
            btnSetInitViewState.click();
        }
    })

</script>

<div in:fade class="flex flex-col gap-2 px-5 py-5 max-w-full max-h-full">
    <section class="w-full sticky top-0 z-40">
        <div class="relative glass rounded-2xl p-4 border border-white/4 flex flex-wrap gap-3 place-items-center place-content-between text-center text-brand-400 font-normal">
            <div class="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-brand-400/20 to-transparent"></div>
            <button class="mx-auto px-3 py-2 rounded-xl text-sm font-medium border border-white/6 text-text-secondary transition-all duration-300 hover:text-brand-400 hover:border-brand-400/25 hover:bg-brand-400/5 active:scale-90 {!cod ? 'hidden' : ''}"
                onclick={() => {
                    // page.url.href = page.url.href.replace(page.url.search, '');
                    // page.url.search = '';
                    window.location.href = page.url.href.replace(page.url.search, '');
                    
                }}
            >
                Hecho
            </button>
            <div class="flex flex-row gap-3 place-items-center {page.url.searchParams.get("cod") ? 'hidden' : ''}">
                <form action="?/set_view_state" method="post" use:enhance={() => {
                    return async ({ result }) => {
                        if (result.type === "success") {
                            if (result.data?.orderPagination) {
                                setOrderPagination(result.data.orderPagination as OrderPagination);
                                refreshOrders();
                            }
                        }
                    }
                }}
                class="flex flex-col place-content-center relative"
                >
                    <input type="text" hidden name="view_state" value={viewState} />
                    <input type="text" hidden name="cod" value={cod} />                    
                    <button bind:this={selectStateElement} type="button" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-2/80 border border-white/6 text-sm font-medium text-text-primary transition-all duration-300 hover:border-brand-400/20 hover:bg-surface-2"
                    onclick={()=>toggleStateListIsVisible()}
                    onfocus={(e) => cancelFocus(e)}
                    aria-haspopup="listbox"
                    aria-expanded={stateListIsVisible}
                    >
                        {#if viewState === 'pending'}
                        Pendientes
                        {:else if viewState === 'completed'}
                        Completados
                        {/if}
                        <Icon icon="mdi:chevron-down" class="text-base text-text-muted transition-transform duration-300 {stateListIsVisible ? 'rotate-180' : ''}" />
                    </button>
                    {#if stateListIsVisible}                        
                    <div transition:scale class="absolute flex flex-col w-48 max-h-60 overflow-y-auto rounded-xl border border-white/8 bg-surface-1/95 backdrop-blur-xl shadow-depth place-self-center z-50"
                    style="top: {selectStateElementHeight}px;"
                    role="listbox"
                    >
                        <ul class="py-1">
                            <li>
                                <button class="w-full px-4 py-2.5 text-left text-sm transition-all {viewState === 'pending' ? 'text-brand-400 bg-brand-400/10' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:pl-5'}" onclick={()=>{viewState = 'pending'; toggleStateListIsVisible(false)}}>
                                    Pendientes
                                </button>
                            </li>
                            <li>
                                <button class="w-full px-4 py-2.5 text-left text-sm transition-all {viewState === 'completed' ? 'text-brand-400 bg-brand-400/10' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:pl-5'}" onclick={()=>{viewState = 'completed'; toggleStateListIsVisible(false)}}>
                                    Completados
                                </button>
                            </li>
                        </ul>
                    </div>
                    {/if}

                    <button bind:this={btnSetInitViewState} type="submit" class="hidden" >
                        Set Init View State
                    </button>
                </form>
                <form action="?/prev_page" method="post" use:enhance={() => {
                    return async ({ result }) => {
                        if (result.type === "success") {
                            if (result.data?.orderPagination) {
                                setOrderPagination(result.data.orderPagination as OrderPagination);
                            }
                        }
                    }
                }}
                class="flex flex-col place-content-center"
                >
                    <input type="number" hidden name="current_page" value={orderPagination.currentPage}>
                    <input type="number" hidden name="total_pages" value={orderPagination.totalPages}>
                    <input type="hidden" name="view_state" value={viewState}>
                    {#if orderPagination.currentPage > 1}
                    <button class="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300 text-text-secondary hover:text-brand-400 hover:bg-surface-2 hover:border hover:border-white/8" onfocus={(e) => cancelFocus(e)} aria-label="Página anterior">
                        <Icon icon="icon-park-outline:left-c" class="text-lg" />
                    </button>
                    {:else}
                    <button class="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300 text-text-muted/30 cursor-not-allowed" disabled aria-label="Página anterior">
                        <Icon icon="icon-park-outline:left-c" class="text-lg" />
                    </button>
                    {/if}
                </form>
                <form action="?/goto_page" method="post" use:enhance={() => {
                    return async ({ result }) => {
                        if (result.type === "success") {
                            if (result.data?.orderPagination) {
                                setOrderPagination(result.data.orderPagination as OrderPagination);
                                gotoPage = undefined;
                            }
                        }
                    }
                }}
                class="flex flex-col place-content-center relative"
                >
                    <input type="number" hidden name="goto_page" value={gotoPage} >
                    <input type="hidden" name="view_state" value={viewState}>
                    <button type="button" class="w-12 h-9 rounded-xl bg-surface-2/80 border border-white/6 text-sm font-semibold text-text-primary transition-all duration-300 hover:bg-surface-2 hover:border-brand-400/20"
                    onclick={()=>toggleGotoPageListIsVisible()}
                    onfocus={(e) => cancelFocus(e)}
                    aria-label="Ir a página"
                    aria-haspopup="listbox"
                    aria-expanded={gotoPageListIsVisible}
                    >
                        {orderPagination.currentPage}
                    </button>
                    {#if gotoPageListIsVisible}                        
                    <div transition:scale class="absolute top-9 flex flex-col w-16 max-h-48 overflow-y-auto rounded-xl border border-white/8 bg-surface-1/95 backdrop-blur-xl shadow-depth place-self-center z-50" role="listbox">
                        <ul class="py-1">
                            {#each createListPages(orderPagination.totalPages) as page}
                            <li>
                                <button class="w-full px-3 py-2 text-center text-sm transition-all {page === orderPagination.currentPage ? 'text-brand-400 bg-brand-400/10' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'}" 
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
                            if (result.data?.orderPagination) {
                                setOrderPagination(result.data.orderPagination as OrderPagination);
                            }
                        }
                    }
                }}
                class="flex flex-col place-content-center"
                >
                    <input type="number" hidden name="current_page" value={orderPagination.currentPage}>
                    <input type="number" hidden name="total_pages" value={orderPagination.totalPages}>
                    <input type="hidden" name="view_state" value={viewState}>
                    {#if orderPagination.currentPage < orderPagination.totalPages}
                    <button class="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300 text-text-secondary hover:text-brand-400 hover:bg-surface-2 hover:border hover:border-white/8" onfocus={(e) => cancelFocus(e)} aria-label="Página siguiente">
                        <Icon icon="icon-park-outline:right-c" class="text-lg" />
                    </button>
                    {:else}    
                    <button class="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300 text-text-muted/30 cursor-not-allowed" disabled aria-label="Página siguiente">
                        <Icon icon="icon-park-outline:right-c" class="text-lg" />
                    </button>
                    {/if}
                </form>
            </div>
		</div>
	</section>
    <section class="flex flex-wrap justify-center p-2 gap-3">
        <!-- {#key Date.now()} -->
        {#each orders as order (order.id)}
            <div transition:scale={{delay: 100 * (orders.indexOf(order) + 1), duration: 200}}>
                <OrderCard {order} {selectThisOrder} {orderSelected} {setOrderPagination} {updateOrderPaginationContent} />
            </div>
        {/each}
        <!-- {/key} -->
    </section>
</div>

<form action="?/get_orders" method="post" use:enhance={() => {
    return async ({ result }) => {
        if (result.type === 'success') {
            if (result.data?.orderPagination) {
                setOrderPagination(result.data.orderPagination as OrderPagination);
            }
        }
    }
}}
class="hidden"
>
    <button type="submit" bind:this={btnGetOrders}>
        Get Orders
    </button>
</form>

<Toast message={toastMessage} />


