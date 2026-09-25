<script lang="ts">
	import type { PurchaseDetail } from "$lib/interfaces/cart";
	import Icon from "@iconify/svelte";
    import type { Order, OrderPagination } from "$lib/interfaces/order";
	import { scale, slide } from "svelte/transition";
	import { enhance } from "$app/forms";
	import CatalogCard from "./CatalogCard.svelte";

    interface Props {
        order: Order
        orderSelected?: Order
        selectThisOrder: (order: Order | undefined) => void
        setOrderPagination: (newOrderPagination: OrderPagination) => void
        updateOrderPaginationContent: (orderId: string, newContent: PurchaseDetail[]) => void;
    }

    let { order, orderSelected, selectThisOrder, setOrderPagination, updateOrderPaginationContent }: Props = $props();

    let isSelected = $derived(order.id === orderSelected?.id);
    let purchaseDetails = $derived(order.content as PurchaseDetail[])
    let previousPurchaseDetails = $state(order.content as PurchaseDetail[]);
    let totalValue = $derived(purchaseDetails.reduce((pv, cv) => pv + (cv.amount * cv.product.product.price), 0))

    let purchaseDetailSelected: PurchaseDetail | undefined = $state();

    // HTML Elements
    let btnEditOrder: HTMLButtonElement | undefined = $state();
    let btnDeleteOrder: HTMLButtonElement | undefined = $state();

    // Visible Elements
    let confirmationDeleteIsVisible = $state(false);
    let confirmationEditIsVisible = $state(false);

    // Toggle Visible Elements
    function toggleConfirmationDeleteIsVisible (visible?: boolean) {
        if (typeof visible !== 'undefined') {
            confirmationDeleteIsVisible = visible;
        } else {
            confirmationDeleteIsVisible = !confirmationDeleteIsVisible;
        }
    }

    function toggleConfirmationEditIsVisible (visible?: boolean) {
        if (typeof visible !== 'undefined') {
            confirmationEditIsVisible = visible;
        } else {
            confirmationEditIsVisible = !confirmationEditIsVisible
        }
    }

    // Seletion Functions
    function selectThisPurchaseDetail (purchaseDetail: PurchaseDetail | undefined) {
        if (typeof purchaseDetail !== 'undefined') {
            purchaseDetailSelected = {...purchaseDetail};
        } else {
            purchaseDetailSelected = undefined;
        }
    }

    // Operation Functions
    function addAmountPDSelected () {
        if (typeof purchaseDetailSelected !== 'undefined') {
            purchaseDetailSelected = {...purchaseDetailSelected, amount: purchaseDetailSelected.amount + 1};
        }
    }

    function subtractAmountPDSelected () {
        if (typeof purchaseDetailSelected !== 'undefined') {
            if (purchaseDetailSelected.amount > 0) {
                purchaseDetailSelected = {...purchaseDetailSelected, amount: purchaseDetailSelected.amount - 1};
            }
        }
    }

    // Request Functions 
    function sendEditOrder () {
        if (typeof btnEditOrder !== 'undefined' && typeof purchaseDetailSelected !== 'undefined') {            
            let updatedPurchaseDetails = purchaseDetails.map((pd) => {
                if (pd.product.product.id === purchaseDetailSelected?.product.product.id) {
                    return {...purchaseDetailSelected}
                }
                return pd
            })
            
            if (updatedPurchaseDetails.length === 1 && updatedPurchaseDetails[0].amount === 0 && typeof btnDeleteOrder !== 'undefined') {
                btnDeleteOrder.click();
            } else {
                previousPurchaseDetails = {...purchaseDetails}
                updateOrderPaginationContent(order.id, updatedPurchaseDetails);
            }
        }
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
        isSelected;
        if (!isSelected && (confirmationDeleteIsVisible || confirmationEditIsVisible)) {
            toggleConfirmationDeleteIsVisible(false);
            toggleConfirmationEditIsVisible(false);
            selectThisPurchaseDetail(undefined);
        }
    })

    $effect(() => {
        if (confirmationDeleteIsVisible) {
            toggleConfirmationEditIsVisible(false);
            selectThisPurchaseDetail(undefined);
        }
    })
    
    $effect(() => {
        if (confirmationEditIsVisible) {
            toggleConfirmationDeleteIsVisible(false);
        }
    })

    $effect(() => {
        if (!confirmationEditIsVisible && typeof purchaseDetailSelected !== 'undefined') {
            selectThisPurchaseDetail(undefined);
        }
    })
    
    $effect(() => {
        if (previousPurchaseDetails !== purchaseDetails) {
            previousPurchaseDetails = purchaseDetails;
            if (confirmationEditIsVisible && typeof btnEditOrder !== 'undefined') {
                btnEditOrder.click();
            }
        }
    })

</script>

<div class="flex flex-row place-items-center">


<div class="flex flex-col gap-4 p-2 {confirmationEditIsVisible ? 'rounded-l-md' : 'rounded-md'} bg-stone-800 self-start card"
tabindex="0"
onkeydown={() => {}}
role="button"
>   
    <div class="flex flex-row gap-2 place-items-center place-content-between">
        <div class="flex flex-row place-content-between gap-2 px-1 text-xl place-items-center">
            <Icon icon="akar-icons:shopping-bag" class="text-3xl"/>
            <span class="translate-y-1">
                {(order.content as PurchaseDetail[]).length}
            </span>
        </div>
        <div class="flex flex-row gap-2 text-xl place-items-center min-w-0">
            <Icon icon="solar:user-linear" class="text-3xl flex-shrink-0" />
            <span class="truncate">
                {order.clientName}
            </span>
        </div>
    </div>
    <div class="">
        <div class="flex flex-col gap-2">
            {#each purchaseDetails as purchaseDetail}
            <div class="flex flex-row gap-1 {purchaseDetailSelected?.product.product.id === purchaseDetail.product.product.id ? 'bg-stone-700/60' : 'bg-stone-700/20'} rounded-sm px-2 place-items-center place-content-between min-w-0"
            onclick={() => { if (confirmationEditIsVisible) {selectThisPurchaseDetail(purchaseDetail)}}}
            role="button"
            tabindex="0"
            onkeydown={() => {}}
            >
                <div class="flex flex-row gap-2 place-items-center min-w-0">
                    <span class="truncate">
                        {purchaseDetail.product.product.name}                    
                    </span>
                    <span class="flex-shrink-0">
                        ({purchaseDetail.amount})
                    </span>
                </div>
                <span class="font-semibold flex-shrink-0">
                    $ {(purchaseDetail.product.product.price * purchaseDetail.amount).toFixed(2)}
                </span>
            </div>
            {/each}
            <div class="flex flex-row gap-1 bg-stone-700/40 rounded-sm px-2 mt-1 place-items-center place-content-between">
                <span>
                    Total
                </span>
                <span class="font-semibold">
                    $ {totalValue.toFixed(2)}
                </span>
            </div>
        </div>
    </div>
    <div class="flex flex-row gap-3 justify-center min-w-0">
        <span class="font-bold flex-shrink-0">
            COD:
        </span>
        <span class="break-all">
            {order.id}
        </span>
    </div>
    <span class="place-self-center">
        {order.createdAt.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
    </span>
    {#if !isSelected}
    <button in:scale class="flex flex-col w-full place-items-center bg-stone-700/20 rounded-full"
    onclick={() => selectThisOrder(order)}
    >
        <Icon icon="mingcute:down-line" />
    </button>
    {:else}
    <form in:scale action="" method="post" use:enhance={() => {
        return async ({ result }) => {
            if (result.type === 'success') {
                if (result.data?.orderPagination) {
                    setOrderPagination(result.data.orderPagination as OrderPagination);
                }
            }
        }
    }}
    class="flex flex-col gap-2"
    >
        <input type="hidden" name="total_value" id="total_value" value={totalValue.toFixed(2)}>
        <div class="flex flex-row gap-2 place-content-around text-3xl bg-stone-700/20 rounded-full">
            <input type="hidden" name="order_id" value={order.id}>
            <button type="button" class="focus:text-red-500 rounded-full px-1 {confirmationDeleteIsVisible ? 'bg-red-400 text-stone-800/90' : ''}"
            onclick={() => toggleConfirmationDeleteIsVisible(true)}
            onfocus={(e) => cancelFocus(e)}
            >
                <Icon icon="famicons:trash" />
            </button>
            <button type="button" class="focus:text-red-500 rounded-full px-1 {confirmationEditIsVisible ? 'bg-red-400 text-stone-800/90' : ''}"
            onclick={() => toggleConfirmationEditIsVisible(true)}
            onfocus={(e) => cancelFocus(e)}
            >
                <Icon icon="mdi:edit-outline" />
            </button>
            <button formaction="?/update_order_state" class="focus:text-red-500"
            onfocus={(e) => cancelFocus(e)}
            >
                {#if order.completed}
                <Icon icon="solar:cart-cross-bold" class="text-4xl" />
                {:else}
                <Icon icon="solar:cart-check-bold" class="text-4xl" />
                {/if}
            </button>
        </div>
        {#if confirmationDeleteIsVisible}
        <div transition:scale={{duration: 200}} class="flex flex-row gap-1 place-content-between p-1 bg-stone-700/20 rounded-full">
            <button type="button" class="grow focus:text-red-500" style="font-family: 'PT Sans';" 
            onclick={() => toggleConfirmationDeleteIsVisible(false)}
            onfocus={(e) => cancelFocus(e)}
            >
                Cancelar
            </button>
            <button formaction="?/delete_order" class="bg-red-400 focus:bg-red-500 grow rounded-full text-stone-900 p-1" style="font-family: 'PT Sans';"
            onfocus={(e) => cancelFocus(e)}
            >
                Confirmar
            </button>
            
        </div>
        {:else if confirmationEditIsVisible}
        <div transition:scale={{duration: 200}} class="flex flex-row gap-1 place-content-between p-1 bg-stone-700/20 rounded-full">
            <button type="button" class="grow focus:text-red-500" style="font-family: 'PT Sans';" 
            onclick={() => toggleConfirmationEditIsVisible(false)}
            onfocus={(e) => cancelFocus(e)}
            >
                Cancelar
            </button>
            <button type="button" class="bg-red-400 focus:bg-red-500 grow rounded-full text-stone-900 p-1" style="font-family: 'PT Sans';"
            onclick={() => sendEditOrder()}
            onfocus={(e) => cancelFocus(e)}
            >
                Confirmar
            </button>            
            
            {#if confirmationEditIsVisible}
            <input type="hidden" name="content" value={JSON.stringify(purchaseDetails)}>
            {/if}            
        </div>
        {/if}

        <button bind:this={btnDeleteOrder} type="submit" formaction="?/delete_order" class="hidden">
            Delete Order
        </button>
        <button bind:this={btnEditOrder} type="submit" formaction="?/edit_order" class="hidden">
            Edit Order
        </button>
    </form>
    {/if}
</div>

{#if confirmationEditIsVisible && purchaseDetailSelected}
<div transition:slide={{axis: "x"}} class="flex flex-col gap-4 p-2 rounded-r-md bg-stone-800 self-start card"
tabindex="0"
onkeydown={() => {}}
role="button"
>
    <span>
        {purchaseDetailSelected.product.product.name}
    </span>
    <div class="flex flex-col gap-3 place-items-center ">
        <span>
            Cantidad
        </span>
        <div class="flex flex-row gap-2 place-items-center text-lg">
            <button class="p-1 border rounded-full hover:text-red-500 focus:text-red-500" 
            onclick={() => subtractAmountPDSelected()}
            onfocus={(e) => cancelFocus(e)}
            >
                <Icon icon="octicon:dash-16" />
            </button>
            <span>
                {purchaseDetailSelected.amount}
            </span>
            <button class="p-1 border rounded-full hover:text-red-500 focus:text-red-500" 
            onclick={() => addAmountPDSelected()}
            onfocus={(e) => cancelFocus(e)}
            >
                <Icon icon="ic:round-plus" />
            </button>
        </div>
    </div>
</div>
{/if}


</div>

<style>
    .card:hover {
        box-shadow: oklch(70.4% 0.191 22.216)  0px 0px 5px;
    }
</style>