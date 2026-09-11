<script lang="ts">

	import { enhance } from "$app/forms";
	import type { ProductComplete, ProductPagination } from "$lib/interfaces/product";
	import { fade, scale } from "svelte/transition";
	import Icon from "@iconify/svelte";
	import type { CatalogComplete } from "$lib/interfaces/catalog";
	import type { Catalog } from "$lib/server/db/schema";
	import ContainerModal from "../../ContainerModal.svelte";

    interface Props {
        setCatalogs: (newCatalogs: Catalog[]) => void
        toggleAddCatalogModalIsVisible: (visible?: boolean) => void
        addCatalogModalIsVisible: boolean
    }

    let { setCatalogs, toggleAddCatalogModalIsVisible, addCatalogModalIsVisible }: Props = $props();

    let formMessage = $state('');

    function cancelFocus (e: FocusEvent) {
        const target = e.target as HTMLButtonElement;
        if (target) {
            setTimeout(() => {
                target.blur();
            }, 300)
        }
    }

    $effect(() => {
        if (formMessage) {
            setTimeout(() => {
                formMessage = '';
            }, 5000)
        }
    })

</script>

{#if addCatalogModalIsVisible }
    <div transition:fade={{duration: 200}}>
        <ContainerModal toggleModal={toggleAddCatalogModalIsVisible} visible={addCatalogModalIsVisible} cancelClick={true}>
                <form id="add-catalog" action="?/add_catalog" method="post" use:enhance={({formElement, formData, action, cancel}) => {
                    return async ({ result }) => {
                        if (result.type === "failure") {
                            if (result.data?.message) {
                                formMessage = result.data.message as string;
                            }
                        }
                        if (result.type === "success") {
                            formElement.reset();
                            if (result.data?.catalogs) {
                                setCatalogs(result.data.catalogs as Catalog[]);
                                toggleAddCatalogModalIsVisible(false);
                            }
                            // await goto("/admin", {invalidateAll: true});
                        }
                    }
                }} 
                enctype="multipart/form-data" 
                class="relative flex flex-col gap-2 bg-stone-900 border border-red-400 py-3 px-4 rounded-md max-w-full max-h-fit">
                    <div class="flex flex-col gap-2 place-items-center">
                        <label for="name">Nombre</label>
                        <input type="text" name="name" id="name" required autocomplete="off"
                        class="border border-red-400 rounded-md px-1 outline-none max-w-full" 
                        />
                    </div>
                    <div class="flex flex-col gap-2 place-items-center">
                        <label for="description">Descripción</label>
                        <input type="text" name="description" id="description" required step="0.01"
                        class="border border-red-400 rounded-md px-1 outline-none max-w-full" 
                        />
                    </div>
                    <div class="flex flex-col gap-2 place-items-center">
                        <button class="border hover:text-red-500 focus:text-red-500 rounded-md p-2 cursor-pointer"
                        onfocus={(e) => cancelFocus(e)}
                        >
                            Agregar
                        </button>
                    </div>
                    {#if formMessage}
                    <div transition:scale>
                        <p class="text-red-400 text-center">
                            {formMessage}
                        </p>
                    </div>
                    {/if}
                    <div role="button" tabindex="0" onkeydown={()=>{}}
                    class="absolute top-2 right-2 hover:text-red-500 cursor-pointer" onclick="{() => toggleAddCatalogModalIsVisible(false)}">
                        <Icon icon="material-symbols:close-rounded" class="text-3xl" />
                    </div>
                </form>
        </ContainerModal>
    </div>
{/if}
