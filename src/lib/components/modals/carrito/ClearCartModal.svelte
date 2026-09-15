<script lang="ts">
	import { fade } from "svelte/transition";
	import ContainerModal from "../ContainerModal.svelte";
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import type { PurchaseDetail } from "$lib/interfaces/cart";

    interface Props {
        resetCart: () => void
        clearCartModalIsVisible: boolean
        toggleClearCartModalIsVisible: (visible?: boolean) => void
    }

    let { resetCart, clearCartModalIsVisible, toggleClearCartModalIsVisible }: Props = $props();

    let formMessage = $state('');

    function cancelFocus (e: FocusEvent) {
        const target = e.target as HTMLButtonElement;
        if (target) {
            setTimeout(() => {
                target.blur();
            }, 200)
        }
    }

</script>

{#if clearCartModalIsVisible}
<div transition:fade={{duration: 200}}>
    <ContainerModal toggleModal={toggleClearCartModalIsVisible} cancelClick={true} >
        <form action="?/clear_cart" method="post" use:enhance={() => {
            return async ({ result }) => {
                if (result.type === "failure") {
                    if (result.data?.message) {
                        formMessage = result.data.message as string;
                    }
                } else if (result.type === "success") {
                    await invalidateAll();
                    resetCart();
                    toggleClearCartModalIsVisible(false);
                }
            }
        }}
        class="flex flex-col gap-2 py-3 px-4 border rounded-md bg-stone-900"
        >
            <span class="text-xl">
                ¿Desea vaciar su carrito de compra?
            </span>
            <div class="flex flex-row gap-2 place-content-center">
                <button type="button" class="py-1 px-2 rounded border hover:text-red-500 focus:text-red-500"
                onclick={() => toggleClearCartModalIsVisible(false)}
                onfocus={(e) => cancelFocus(e)}
                >
                    Cancelar
                </button>
                <button class="py-1 px-2 rounded bg-red-400 text-stone-900 border hover:bg-red-500 focus:bg-red-500"
                onfocus={(e) => cancelFocus(e)}
                >
                    Confirmar
                </button>
            </div>
        </form>
    </ContainerModal>    
</div>
{/if}