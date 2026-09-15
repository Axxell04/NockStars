<script lang="ts">
	import { enhance } from "$app/forms";
	import { fade, scale } from "svelte/transition";
	import type { PageProps } from "./$types";
	import type { BalanceDetail, BalanceDetailPagination } from "$lib/interfaces/balance";
	import Icon from "@iconify/svelte";
	import BalanceDetailCard from "$lib/components/BalanceDetailCard.svelte";

    let { data }: PageProps = $props()
    let totalRevenue = $state(data.totalRevenue);
    let totalCost = $state(data.totalCost);
    let totalExpense = $state(data.totalExpense);
    let profits = $derived(totalRevenue - (totalCost + totalExpense));

    type ViewState = 'resume' | 'revenue' | 'cost' | 'expense';

    let balanceDetailPagination: BalanceDetailPagination | undefined = $state();
    let balanceDetails: BalanceDetail[] | undefined = $derived(balanceDetailPagination?.balanceDetails)

    let balanceDetailSelected: BalanceDetail | undefined = $state();

    let gotoPage: number | undefined = $state();

    // View State
    let viewState: ViewState = $state('resume')

    // HTML Elements
    let selectStateElement: HTMLButtonElement | undefined = $state();
    let btnRefreshTotals: HTMLButtonElement | undefined = $state();

    let selectStateElementHeight: number = $state(9);

    // Visible Elements
    let gotoPageListIsVisible = $state(false);
    let stateListIsVisible = $state(false);
    let addPanelIsVisible = $state(false);

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

    function toggleAddPanelIsVisible (visible?: boolean) {
        if (typeof visible !== "undefined") {
            addPanelIsVisible = visible;
        } else {
            addPanelIsVisible = !addPanelIsVisible;
        }
    }

    // Setter Functions
    function setBalanceDetailPagination (newBalanceDetailPagination: BalanceDetailPagination | undefined) {
        balanceDetailPagination = newBalanceDetailPagination;
    }

    function refreshBalanceDetails () {
        if (typeof balanceDetailPagination === 'undefined') { return }
        const newBalanceDetails = balanceDetailPagination.balanceDetails;
        balanceDetailPagination.balanceDetails = [];
        setTimeout(() => {
            if (typeof balanceDetailPagination === 'undefined') { return }
            balanceDetailPagination.balanceDetails = newBalanceDetails;
        }, 200)
    }

    function selectThisBalanceDetail (balanceDetail: BalanceDetail | undefined) {
        balanceDetailSelected = balanceDetail;
    }

    // Request Functions
    function refreshTotals () {
        if (typeof btnRefreshTotals !== 'undefined' && viewState === 'resume') {
            btnRefreshTotals.click()
        }
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

    $effect(() => {
        if (typeof selectStateElement !== 'undefined' && stateListIsVisible) {
            selectStateElementHeight = selectStateElement.clientHeight;
        }
    })

    $effect(() => {
        if (viewState === 'resume') {
            refreshTotals()
        }
    })

    $inspect(balanceDetailPagination)

</script>


<div in:fade class="flex flex-col gap-2 max-w-full max-h-full">
    <section class="px-10 w-full sticky top-0 z-10 bg-stone-900/95 backdrop-blur-lg">
        <div class="flex flex-wrap gap-3 place-items-center place-content-between text-center text-red-400 font-normal p-4 border border-transparent border-b-red-400">
            <div class="flex flex-row gap-2 place-items-center">
                <form action="?/set_view_state" method="post" use:enhance={() => {
                    return async ({ result }) => {
                        if (result.type === "success") {
                            if (result.data?.balanceDetailPagination) {
                                setBalanceDetailPagination(result.data.balanceDetailPagination as BalanceDetailPagination);
                                refreshBalanceDetails();
                            } else {
                                setBalanceDetailPagination(undefined);
                            }
                        }
                    }
                }}
                class="flex flex-col place-content-center relative"
                >
                    <input type="text" hidden name="view_state" value={viewState} />
                    <button bind:this={selectStateElement} type="button" class="text-center text-2xl bg-transparent outline-none hover:text-red-500 focus:text-red-500" 
                    onclick={()=>toggleStateListIsVisible()}
                    onfocus={(e) => cancelFocus(e)}
                    >
                        {#if viewState === 'resume'}
                        Resumen
                        {:else if viewState === 'revenue'}
                        Ingresos
                        {:else if viewState === 'cost'}
                        Costos
                        {:else if viewState === 'expense'}
                        Gastos
                        {/if}
                    </button>
                    {#if stateListIsVisible}                        
                    <div transition:scale class="absolute flex flex-col text-2xl rounded-b-md border bg-stone-900/95 max-h-60 overflow-y-auto place-self-center z-10"
                    style="top: {selectStateElementHeight}px;"
                    >
                        <ul>
                            <li>
                                <button class="hover:bg-stone-800 focus:bg-stone-800 px-2 py-1 w-full {viewState === 'resume' ? '' : 'text-red-500'}" onclick={()=>{viewState = 'resume'; toggleStateListIsVisible(false)}}>
                                    Resumen
                                </button>
                            </li>
                            <li>
                                <button class="hover:bg-stone-800 focus:bg-stone-800 px-2 py-1 w-full {viewState === 'revenue' ? '' : 'text-red-500'}" onclick={()=>{viewState = 'revenue'; toggleStateListIsVisible(false)}}>
                                    Ingresos
                                </button>
                            </li>
                            <li>
                                <button class="hover:bg-stone-800 focus:bg-stone-800 px-2 py-1 w-full {viewState === 'cost' ? '' : 'text-red-500'}" onclick={()=>{viewState = 'cost'; toggleStateListIsVisible(false)}}>
                                    Costos
                                </button>
                            </li>
                            <li>
                                <button class="hover:bg-stone-800 focus:bg-stone-800 px-2 py-1 w-full {viewState === 'expense' ? '' : 'text-red-500'}" onclick={()=>{viewState = 'expense'; toggleStateListIsVisible(false)}}>
                                    Gastos
                                </button>
                            </li>
                        </ul>
                    </div>
                    {/if}
                </form>
                {#if typeof balanceDetailPagination !== 'undefined' && viewState !== 'resume'}
                <form action="?/prev_page" method="post" use:enhance={() => {
                    return async ({ result }) => {
                        if (result.type === "success") {
                            if (result.data?.balanceDetailPagination) {
                                setBalanceDetailPagination(result.data.balanceDetailPagination as BalanceDetailPagination);
                            }
                        }
                    }
                }}
                class="flex flex-col place-content-center"
                >
                    <input type="number" hidden name="current_page" value={balanceDetailPagination.currentPage}>
                    <input type="number" hidden name="total_pages" value={balanceDetailPagination.totalPages}>
                    <input type="hidden" name="view_state" value={viewState}>
                    {#if balanceDetailPagination.currentPage > 1}
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
                            if (result.data?.balanceDetailPagination) {
                                setBalanceDetailPagination(result.data.balanceDetailPagination as BalanceDetailPagination);
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
                        {balanceDetailPagination.currentPage}
                    </button>
                    {#if gotoPageListIsVisible}                        
                    <div transition:scale class="absolute top-9 flex flex-col text-3xl rounded-b-md border bg-stone-900/95 max-h-65 overflow-y-auto place-self-center">
                        <ul>
                            {#each createListPages(balanceDetailPagination.totalPages) as page}
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
                            if (result.data?.balanceDetailPagination) {
                                setBalanceDetailPagination(result.data.balanceDetailPagination as BalanceDetailPagination);
                            }
                        }
                    }
                }}
                class="flex flex-col place-content-center"
                >
                    <input type="number" hidden name="current_page" value={balanceDetailPagination.currentPage}>
                    <input type="number" hidden name="total_pages" value={balanceDetailPagination.totalPages}>
                    <input type="hidden" name="view_state" value={viewState}>
                    {#if balanceDetailPagination.currentPage < balanceDetailPagination.totalPages}
                    <button class="hover:text-red-500 focus-within:text-red-500" onfocus={(e) => cancelFocus(e)}>
                        <Icon icon="icon-park-outline:right-c" class="text-3xl" />
                    </button>
                    {:else}    
                    <button class="opacity-50" disabled>
                        <Icon icon="icon-park-outline:right-c" class="text-3xl" />
                    </button>
                    {/if}
                </form>
                {/if}
            </div>
		</div>
	</section>
    <section class="flex flex-col place-items-center">
        {#if typeof balanceDetails !== 'undefined' && viewState !== 'resume'}
        <div class="flex flex-col gap-2">
            {#if !addPanelIsVisible}
            <button in:scale class="flex flex-row gap-1 border p-1 rounded-md hover:text-red-500 focus:text-red-500 place-items-center"
            onfocus={(e) => cancelFocus(e)}
            onclick={() => toggleAddPanelIsVisible(true)}
            >
                <Icon icon="material-symbols:add-rounded" class="text-2xl" />
                <span style="font-family: Nunito;">
                    Añadir
                </span>
            </button>
            {:else}
            <form action="?/add_balance" method="post" use:enhance={() => {
                return async ({ result, formElement }) => {
                    if (result.type === 'success') {
                        if (result.data?.balanceDetailPagination) {
                            setBalanceDetailPagination(result.data.balanceDetailPagination as BalanceDetailPagination);
                            refreshBalanceDetails();
                            formElement.reset();
                            toggleAddPanelIsVisible(false);
                        }
                    }
                }
            }}
            class="flex flex-col gap-2 bg-stone-700/20 p-2 rounded-xl"
            >
            <div in:scale class="flex flex-row gap-2 rounded-full">
                <button type="button" class="focus:text-red-500 rounded-full px-1 grow"
                onfocus={(e) => cancelFocus(e)}
                onclick={() => toggleAddPanelIsVisible(false)}
                >
                    Cancelar
                </button>
                <button class="bg-red-400 text-stone-900 focus:bg-red-500 rounded-lg px-1 grow"
                onfocus={(e) => cancelFocus(e)}
                >
                    Confirmar
                </button>
            </div>
            <div class="flex flex-col gap-2 place-items-center text-center">
                <div class="flex flex-col">
                    <span>
                        Motivo
                    </span>
                    <input type="text" name="reason" id="reason" class="bg-transparent text-red-400 border rounded-md outline-none px-1" required autocomplete="off">
                </div>
                <div class="flex flex-col">
                    <span>
                        Valor
                    </span>
                    <input type="number" step="0.01" name="value" id="value" class="bg-transparent text-red-400 border rounded-md outline-none px-1" required autocomplete="off">
                </div>
            </div>
            </form>

            {/if}
        </div>
        {:else if viewState === 'resume'}
        <div class="flex flex-row gap-3 place-items-center place-content-center text-center">
            <span>
                Ganancias:
            </span>
            <span class="font-semibold">
                $ {profits.toFixed(2)}
            </span>
        </div>
        {/if}
    </section>
    <section class="flex flex-wrap justify-center p-2 gap-3">
        <!-- {#key Date.now()} -->
        {#if typeof balanceDetails !== 'undefined' && viewState !== 'resume'}
        
        {#each balanceDetails as balanceDetail (balanceDetail.id)}
            <div transition:scale={{delay: 100 * (balanceDetails.indexOf(balanceDetail) + 1), duration: 200}}>
                <!-- <OrderCard {order} {selectThisOrder} {orderSelected} {setOrderPagination} {updateOrderPaginationContent} /> -->
                <BalanceDetailCard {balanceDetail} {selectThisBalanceDetail} {balanceDetailSelected} {setBalanceDetailPagination} />
            </div>
        {/each}
        {/if}
        <!-- {/key} -->
        {#if viewState === 'resume'}
        <div transition:scale={{delay: 100, duration: 200}} class="flex flex-col gap-4 p-2 rounded-md bg-stone-800 self-start place-items-center card">
            <span>
                Ingresos
            </span>
            <span>
                $ {totalRevenue.toFixed(2)}
            </span>
        </div>
        <div transition:scale={{delay: 200, duration: 200}} class="flex flex-col gap-4 p-2 rounded-md bg-stone-800 self-start place-items-center card">
            <span>
                Costos
            </span>
            <span>
                $ {totalCost.toFixed(2)}
            </span>
        </div>
        <div transition:scale={{delay: 300, duration: 200}} class="flex flex-col gap-4 p-2 rounded-md bg-stone-800 self-start place-items-center card">
            <span>
                Gastos
            </span>
            <span>
                $ {totalExpense.toFixed(2)}
            </span>
        </div>
        
        {/if}
    </section>
</div>

<form action="?/refresh_totals" method="post" use:enhance={() => {
    return async ({ result }) => {
        if (result.type === 'success') {
            if (typeof result.data !== 'undefined' && 'totalRevenue' in result.data && 'totalCost' in result.data && 'totalExpense' in result.data) {
                totalRevenue = result.data.totalRevenue as number;
                totalCost = result.data.totalCost as number;
                totalExpense = result.data.totalExpense as number;
            }
        }
    }
}}>
    <button bind:this={btnRefreshTotals} type="submit" class="hidden">
        Refresh Totals
    </button>
</form>

<style>
    .card:hover {
        box-shadow: oklch(70.4% 0.191 22.216)  0px 0px 5px;
    }
</style>