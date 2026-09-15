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

<div in:fade class="flex flex-col gap-2 max-w-full max-h-full">
    <section class="px-10 w-full sticky top-0 z-10 bg-stone-900/95 backdrop-blur-lg">
        <div class="flex flex-wrap gap-3 place-items-center place-content-between text-center text-red-400 font-normal p-4 border border-transparent border-b-red-400">
            <button class="mx-auto py-1 px-3 border rounded-md hover:text-red-500 active:text-red-500 active:scale-90 {!cod ? 'hidden' : ''}"
                onclick={() => {
                    // page.url.href = page.url.href.replace(page.url.search, '');
                    // page.url.search = '';
                    window.location.href = page.url.href.replace(page.url.search, '');
                    
                }}
            >
                Hecho
            </button>
            <div class="flex flex-row gap-2 place-items-center {page.url.searchParams.get("cod") ? 'hidden' : ''}">
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
                    <button bind:this={selectStateElement} type="button" class="text-center text-2xl bg-transparent outline-none hover:text-red-500 focus:text-red-500" 
                    onclick={()=>toggleStateListIsVisible()}
                    onfocus={(e) => cancelFocus(e)}
                    >
                        {#if viewState === 'pending'}
                        Pendientes
                        {:else if viewState === 'completed'}
                        Completados
                        {/if}
                    </button>
                    {#if stateListIsVisible}                        
                    <div transition:scale class="absolute flex flex-col text-2xl rounded-b-md border bg-stone-900/95 max-h-60 overflow-y-auto place-self-center z-10"
                    style="top: {selectStateElementHeight}px;"
                    >
                        <ul>
                            <li>
                                <button class="hover:bg-stone-800 focus:bg-stone-800 px-2 py-1 w-full {viewState === 'completed' ? '' : 'text-red-500'}" onclick={()=>{viewState = 'pending'; toggleStateListIsVisible(false)}}>
                                    Pendientes
                                </button>
                            </li>
                            <li>
                                <button class="hover:bg-stone-800 focus:bg-stone-800 px-2 py-1 w-full {viewState === 'pending' ? '' : 'text-red-500'}" onclick={()=>{viewState = 'completed'; toggleStateListIsVisible(false)}}>
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
                    <button class="hover:text-red-500 focus:text-red-500" onfocus={(e) => cancelFocus(e)}>
                        <Icon icon="icon-park-outline:left-c" class="text-3xl" />
                    </button>
                    {:else}
                    <button class="opacity-50" disabled>
                        <Icon icon="icon-park-outline:left-c" class="text-3xl" />
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
                    <button type="button" class="w-10 text-center text-3xl bg-transparent h-9 outline-none hover:text-red-500 focus:text-red-500" 
                    onclick={()=>toggleGotoPageListIsVisible()}
                    onfocus={(e) => cancelFocus(e)}
                    >
                        {orderPagination.currentPage}
                    </button>
                    {#if gotoPageListIsVisible}                        
                    <div transition:scale class="absolute top-9 flex flex-col text-3xl rounded-b-md border bg-stone-900/95 max-h-65 overflow-y-auto place-self-center">
                        <ul>
                            {#each createListPages(orderPagination.totalPages) as page}
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
                    <button class="hover:text-red-500 focus-within:text-red-500" onfocus={(e) => cancelFocus(e)}>
                        <Icon icon="icon-park-outline:right-c" class="text-3xl" />
                    </button>
                    {:else}    
                    <button class="opacity-50" disabled>
                        <Icon icon="icon-park-outline:right-c" class="text-3xl" />
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


