<script lang="ts">
	import { onDestroy, onMount, type Snippet } from "svelte";

    interface Props {
        children: Snippet
        toggleModal: (visible?: boolean) => void
        visible?: boolean
        cancelClick?: boolean
    }

    let { children, toggleModal, cancelClick, visible }: Props = $props();

    // $effect(() => {
    //     if (typeof window !== 'undefined') {
    //         if (visible) {
    //             document.body.classList.add('overflow-hidden');
    //         } else {
    //             document.body.classList.remove('overflow-hidden');
    //         }
    //     }
    // })
    
    
    onMount(() => {
        document.body.classList.add('overflow-hidden');
    })
    onDestroy(() => {
        document.body.classList.remove('overflow-hidden');
    }) 
    

</script>

<div role="button" tabindex="0" onkeydown={()=>{}}
    class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden"
    onclick={()=>{toggleModal(false)}}    
>
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-surface-0/80 backdrop-blur-sm"></div>
    
    {#if !cancelClick}
    <div class="relative z-10">
        {@render children()}
    </div>
    {:else}
    <div onclick={(e) => e.stopPropagation()} role="button" tabindex="0" onkeypress={()=>{}} 
    class="relative z-10 flex items-center justify-center w-fit max-w-full h-full outline-none"
    >
        {@render children()}
    </div>
    {/if}
</div>