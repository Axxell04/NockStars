<script lang="ts">
	import type { PurchaseDetail } from "$lib/interfaces/cart";
	import Icon from "@iconify/svelte";
    import type { Order, OrderPagination } from "$lib/interfaces/order";
	import { scale, slide } from "svelte/transition";
	import { enhance } from "$app/forms";
	import CatalogCard from "./CatalogCard.svelte";
	import type { BalanceDetail, BalanceDetailPagination } from "$lib/interfaces/balance";

    interface Props {
        balanceDetail: BalanceDetail
        balanceDetailSelected?: BalanceDetail
        selectThisBalanceDetail: (balanceDetail: BalanceDetail | undefined) => void
        setBalanceDetailPagination: (newBalanceDetailPagination: BalanceDetailPagination) => void
    }

    let { balanceDetail, balanceDetailSelected, selectThisBalanceDetail, setBalanceDetailPagination }: Props = $props();

    let isSelected = $derived(balanceDetail.id === balanceDetailSelected?.id);

    // HTML Elements
    let btnEditBalanceDetail: HTMLButtonElement | undefined = $state();
    let btnDeleteBalanceDetail: HTMLButtonElement | undefined = $state();

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

    // Request Funcitons 
    function sendEditBalanceDetail () {
        if (typeof btnEditBalanceDetail !== 'undefined' && confirmationEditIsVisible) {
            btnEditBalanceDetail.click();
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
            selectThisBalanceDetail(undefined);
        }
    })

    $effect(() => {
        if (confirmationDeleteIsVisible) {
            toggleConfirmationEditIsVisible(false);
        }
    })
    
    $effect(() => {
        if (confirmationEditIsVisible) {
            toggleConfirmationDeleteIsVisible(false);
        }
    })


</script>

<div class="flex flex-row place-items-center">


<div class="flex flex-col gap-4 p-2 rounded-2xl bg-stone-800 self-start card"
tabindex="0"
onkeydown={() => {}}
role="button"
>   
    <form action="" method="post" use:enhance={() => {
        return async ({ result }) => {
            if (result.type === 'success') {
                if (result.data?.balanceDetailPagination) {
                    setBalanceDetailPagination(result.data.balanceDetailPagination as BalanceDetailPagination);
                    toggleConfirmationEditIsVisible(false);
                    toggleConfirmationDeleteIsVisible(false);
                }
            }
        }
    }}
    class="flex flex-col gap-2 place-items-center"
    >
        <input type="hidden" name="balance_id" id="balance_id" value={balanceDetail.id}>
        <div class="text-center flex flex-col">
            <span class="font-semibold">
                Motivo
            </span>
            {#if confirmationEditIsVisible}
            <input transition:slide type="text" name="new_reason" id="new_reason" class="bg-transparent text-red-400 border rounded-md outline-none px-1" 
            required autocomplete="off" value={balanceDetail.reason}>
            {:else}
            <span transition:slide>
                {balanceDetail.reason}
            </span>
            {/if}
        </div>
        <div class="text-center flex flex-col">
            <span class="font-semibold">
                Valor
            </span>
            {#if confirmationEditIsVisible}
            <input transition:slide type="number" step="0.01" name="new_value" id="new_value" class="bg-transparent text-red-400 border rounded-md outline-none px-1" 
            required autocomplete="off" value={balanceDetail.value.toFixed(2)}>
            {:else}
            <span transition:slide>
                $ {balanceDetail.value.toFixed(2)}
            </span>
            {/if}
        </div>
        <button bind:this={btnEditBalanceDetail} type="submit" formaction="?/edit_balance" class="hidden">
            Edit Balance Detail
        </button>
        <button bind:this={btnDeleteBalanceDetail} type="submit" formaction="?/delete_balance" class="hidden">
            Delete Balance Detail
        </button>
    </form>
    <span class="place-self-center">
        {balanceDetail.createdAt.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
    </span>
    {#if !isSelected}
    <button in:scale class="flex flex-col w-full place-items-center bg-stone-700/20 rounded-full"
    onclick={() => selectThisBalanceDetail(balanceDetail)}
    >
        <Icon icon="mingcute:down-line" />
    </button>
    {:else}
    <form in:scale action="" method="post" use:enhance={() => {
        return async ({ result }) => {
            if (result.type === 'success') {
                if (result.data?.balanceDetailPagination) {
                    setBalanceDetailPagination(result.data.balanceDetailPagination as BalanceDetailPagination);
                }
            }
        }
    }}
    class="flex flex-col gap-2"
    >
        <input type="hidden" name="balance_id" id="balance_id" value={balanceDetail.id}>
        <div class="flex flex-row gap-2 py-1 place-content-around text-3xl bg-stone-700/20 rounded-full">
            <input type="hidden" name="order_id" value={balanceDetail.id}>
            <button type="button" class="focus:text-red-500 rounded-full p-1 {confirmationDeleteIsVisible ? 'bg-red-400 text-stone-800/90' : ''}"
            onclick={() => toggleConfirmationDeleteIsVisible(true)}
            onfocus={(e) => cancelFocus(e)}
            >
                <Icon icon="famicons:trash" />
            </button>
            <button type="button" class="focus:text-red-500 rounded-full p-1 {confirmationEditIsVisible ? 'bg-red-400 text-stone-800/90' : ''}"
            onclick={() => toggleConfirmationEditIsVisible(true)}
            onfocus={(e) => cancelFocus(e)}
            >
                <Icon icon="mdi:edit-outline" />
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
            <button formaction="?/delete_balance" class="bg-red-400 focus:bg-red-500 grow rounded-full text-stone-900 p-1" style="font-family: 'PT Sans';"
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
            onclick={() => sendEditBalanceDetail()}
            onfocus={(e) => cancelFocus(e)}
            >
                Confirmar
            </button>            
            
            {#if confirmationEditIsVisible}
            <!-- <input type="hidden" name="content" value={JSON.stringify(purchaseDetails)}> -->
            {/if}            
        </div>
        {/if}
    </form>
    {/if}
</div>

<!-- {#if confirmationEditIsVisible && purchaseDetailSelected}
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
{/if} -->


</div>

<style>
    .card:hover {
        box-shadow: oklch(70.4% 0.191 22.216)  0px 0px 5px;
    }
</style>