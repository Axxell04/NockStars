<script lang="ts">
	import { scale } from "svelte/transition";
	import Icon from "@iconify/svelte";

    interface Props {
        message: string
    }

    let { message }: Props = $props();

</script>

{#if message}
<div transition:scale={{ duration: 200, start: 0.9 }} class="fixed top-4 left-0 right-0 z-[60] flex justify-center pointer-events-none">
    <div class="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-brand-500 text-surface-0 text-sm font-semibold shadow-lg shadow-brand-500/25">
        <Icon icon="mdi:check-circle" class="text-lg" />
        {message}
    </div>
</div>
{/if}