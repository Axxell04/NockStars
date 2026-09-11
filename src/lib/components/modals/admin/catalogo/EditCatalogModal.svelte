<script lang="ts">

	import { enhance } from "$app/forms";
	import { fade, scale } from "svelte/transition";
	import Icon from "@iconify/svelte";
	import type { Catalog } from "$lib/interfaces/catalog";
	import ContainerModal from "../../ContainerModal.svelte";

    interface Props {
        setCatalogs: (newCatalogs: Catalog[]) => void
        catalogSelected?: Catalog
        toggleEditCatalogModalIsVisible: (visible?: boolean) => void
        editCatalogModalIsVisible: boolean
    }

    let { setCatalogs, toggleEditCatalogModalIsVisible, editCatalogModalIsVisible, catalogSelected }: Props = $props();

    // Form
    let formMessage = $state('')

    function cancelFocus (e: FocusEvent) {
        const target = e.target as HTMLButtonElement;
        if (target) {
            setTimeout(() => {
                target.blur();
            }, 300)
        }
    }

</script>

{#if editCatalogModalIsVisible }
    <div transition:fade={{duration: 200}}>
        <ContainerModal toggleModal={toggleEditCatalogModalIsVisible} visible={editCatalogModalIsVisible} cancelClick={true}>
                <form id="edit-catalog" action="?/edit_catalog" method="post" use:enhance={({formElement, formData, action, cancel}) => {
                    return async ({ result }) => {
                        if (result.type === "failure") {
                            if (result.data?.message) {
                                formMessage = result.data.message as string;
                            }
                        } else if (result.type === "success") {
                            formElement.reset();
                            if (result.data?.catalogs) {
                                // console.log(result.data.products)
                                setCatalogs(result.data.catalogs as Catalog[]);
                                toggleEditCatalogModalIsVisible(false);
                            }
                            // await goto("/admin", {invalidateAll: true});
                        }
                    }
                }} 
                enctype="multipart/form-data" 
                class="relative flex flex-col gap-2 bg-stone-900 border border-red-400 py-5 px-10 rounded-md max-w-full max-h-fit">
                    <div class="flex flex-col gap-2 place-items-center">
                        <input type="hidden" name="id" value={!catalogSelected ? "" : (catalogSelected.id)}>
                        <label for="name">Nombre</label>
                        <span class="text-red-300">
                            {#if catalogSelected}
                            <input type="text" name="name" id="name" required autocomplete="off"
                            class="border border-red-400 rounded-md px-1 outline-none max-w-full" 
                            value={catalogSelected.name}
                            />                               
                            {/if}
                        </span>
                    </div>
                    <div class="flex flex-col gap-2 place-items-center">
                        <label for="description">Descripción</label>
                        <span class="text-red-300">
                            {#if catalogSelected}
                            <input type="text" name="description" id="description" required step="0.01"
                            class="border border-red-400 rounded-md px-1 outline-none max-w-full" 
                            value={catalogSelected.description}
                            />                             
                            {/if}
                        </span>
                    </div>
                    <div class="flex flex-col gap-2 place-items-center">
                        <button type="submit" class="border focus:text-red-500 hover:text-red-500 rounded-md p-2 cursor-pointer"
                        onfocus={(e) => cancelFocus(e)}
                        >
                            Editar
                        </button>
                    </div>
                    {#if formMessage}
                    <div transition:scale>
                        <p class="text-red-500 text-center">
                            {formMessage}
                        </p>
                    </div>
                    {/if}
                    <div role="button" tabindex="0" onkeydown={()=>{}}
                    class="absolute top-2 right-2 hover:text-red-500 cursor-pointer" onclick="{() => {toggleEditCatalogModalIsVisible(false)}}">
                        <Icon icon="material-symbols:close-rounded" class="text-3xl" />
                    </div>
                </form>
        </ContainerModal>
    </div>
{/if}
