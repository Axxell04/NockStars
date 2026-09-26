<script lang="ts">
	let btnDownloadIsVisible = $state(false);

	// Functions
	function toggleBtnDownloadIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			btnDownloadIsVisible = visible;
		} else {
			btnDownloadIsVisible = !btnDownloadIsVisible;
		}
	}
</script>

<div
	class="flex cursor-pointer flex-col gap-3 rounded-xl bg-stone-800 p-3"
	tabindex="0"
	onkeydown={() => {}}
	role="button"
	onclick={() => toggleBtnDownloadIsVisible()}
>
	<span class="font-bold"> Backup-001 </span>
	<span> 24/09/2025, 03:47 p. m. </span>
	{#if btnDownloadIsVisible}
		<button
			class="rounded-md border hover:text-red-500"
			onclick={(e) => {
				e.stopPropagation();
			}}
		>
			Download
		</button>
	{/if}
</div>
