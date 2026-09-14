<script lang="ts">

	import { enhance } from "$app/forms";
	import type { ProductComplete } from "$lib/interfaces/product";
	import { fade, scale } from "svelte/transition";
	import type { ActionData } from "../../../routes/admin/$types";
	import ContainerModal from "./ContainerModal.svelte";
	import Icon from "@iconify/svelte";
	import type { Snippet } from "svelte";

    interface Props {
        children?: Snippet
        productSelected?: ProductComplete
        toggleImgsProductModalIsVisible: (visible?: boolean) => void
        imgsProductModalIsVisible: boolean

        setImgIndex?: (newIndex: number) => void
    }

    let { toggleImgsProductModalIsVisible, imgsProductModalIsVisible, productSelected, children, setImgIndex }: Props = $props();

    let imgIndex = $state(0);
    let imgSalt = $state(false);

    $effect(() => {
        if (typeof setImgIndex !== 'undefined') {
            setImgIndex(imgIndex);
        }
    })

    function nextImg () {
        if (nextImgIsValid()) {
            imgSalt = true;
            setTimeout(() => {
                imgSalt = false;
                imgIndex = imgIndex + 1;
            }, 50);
        }
    }

    function prevImg () {
        if (prevImgIsValid()) {
            imgSalt = true;
            setTimeout(() => {
                imgSalt = false;
                imgIndex = imgIndex - 1;
            }, 50);
        }
    }

    function nextImgIsValid () {
        if (!productSelected) { return false };
        if (imgIndex < productSelected.imgs.length - 1) {
            return true
        }
        return false
    
    }
    function prevImgIsValid () {
        if (!productSelected) { return false };
        if (imgIndex > 0) {
            return true
        }
        return false
    }

    function closeModal () {
        imgIndex = 0;
        if (typeof setImgIndex !== 'undefined') {
            setImgIndex(0);
        }
        toggleImgsProductModalIsVisible(false);
    }

    function cancelFocus (e: FocusEvent) {
        const target = e.target as HTMLButtonElement;
        if (target) {
            setTimeout(() => {
                target.blur();
            }, 200)
        }
    }

    function preloadImgs () {
        productSelected?.imgs.forEach((productImg) => {
            const img = new Image();
            img.src = productImg.url;
        })
    }

    $effect(() => {
        if (productSelected) {
            preloadImgs();
        }
    })

</script>

{#if imgsProductModalIsVisible }
    <div transition:fade={{duration: 200}}>
        <ContainerModal toggleModal={toggleImgsProductModalIsVisible} visible={imgsProductModalIsVisible} cancelClick={true}>
            <div class="flex flex-col gap-6 max-h-full relative">
                <!-- Image area -->
                <div class="relative flex items-center justify-center" style="height: 80%;">
                    {#if !imgSalt}
                    <div in:scale={{ duration: 300, start: 0.95 }} class="relative max-h-full">
                        <img 
                            class="object-contain max-h-[26rem] rounded-2xl" 
                            src={productSelected?.imgs[imgIndex].url} 
                            alt={productSelected?.product.name}
                            draggable="false"
                        >
                        <span class="absolute bottom-3 left-1/2 -translate-x-1/2 glass px-3 py-1 rounded-full text-xs font-medium text-text-secondary">
                            {imgIndex + 1} / {productSelected?.imgs.length ?? imgIndex + 1}
                        </span>
                    </div>
                    {/if}
                </div>

                <!-- Controls bar -->
                <div class="flex items-center gap-4 p-3 rounded-2xl bg-surface-1 border border-white/5">
                    {#if typeof children !== 'undefined'}
                    <div class="flex flex-1 items-center gap-2">
                        {@render children()}
                    </div>
                    {/if}

                    <!-- Navigation arrows -->
                    <div class="flex items-center gap-2">
                        <button 
                            class="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 transition-all duration-200
                            {prevImgIsValid() ? 'text-text-secondary hover:text-brand-400 hover:border-brand-400/30 hover:bg-brand-400/10' : 'text-text-muted/30 cursor-not-allowed'}"
                            onclick={prevImg}
                            onfocus={(e) => cancelFocus(e)}
                            disabled={!prevImgIsValid()}
                        >
                            <Icon icon="mingcute:left-fill" class="text-xl" />
                        </button>
                        <button 
                            class="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 transition-all duration-200
                            {nextImgIsValid() ? 'text-text-secondary hover:text-brand-400 hover:border-brand-400/30 hover:bg-brand-400/10' : 'text-text-muted/30 cursor-not-allowed'}"
                            onclick={nextImg}
                            onfocus={(e) => cancelFocus(e)}
                            disabled={!nextImgIsValid()}
                        >
                            <Icon icon="mingcute:right-fill" class="text-xl" />
                        </button>
                    </div>

                    <!-- Close button -->
                    <button 
                        class="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 text-text-secondary transition-all duration-200 hover:text-brand-400 hover:border-brand-400/30 hover:bg-brand-400/10"
                        onclick={closeModal}
                        onfocus={(e) => cancelFocus(e)}
                    >
                        <Icon icon="material-symbols:close-rounded" class="text-xl" />
                    </button>
                </div>
            </div>
        </ContainerModal>
    </div>
{/if}
