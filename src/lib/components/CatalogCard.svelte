<script lang="ts">
	import { page } from '$app/state';
	import type { Catalog } from '$lib/interfaces/catalog';
	import Icon from '@iconify/svelte';
	import { scale } from 'svelte/transition';

	interface Props {
		catalog: Catalog;
		catalogSelected?: Catalog | undefined;
		selectThisCatalog?: (catalog: Catalog) => void;
		toggleDeleteCatalogModalIsVisible?: (visible?: boolean) => void;
		toggleEditCatalogModalIsVisible?: (visible?: boolean) => void;
	}

	let {
		catalog,
		toggleDeleteCatalogModalIsVisible,
		toggleEditCatalogModalIsVisible,
		catalogSelected,
		selectThisCatalog
	}: Props = $props();

	let actualRoute = $derived(page.route.id);
	let isSelected = $derived(catalog.id === catalogSelected?.id);

	if (!toggleDeleteCatalogModalIsVisible) {
		toggleDeleteCatalogModalIsVisible = () => {};
	}
	if (!toggleEditCatalogModalIsVisible) {
		toggleEditCatalogModalIsVisible = () => {};
	}

	if (!selectThisCatalog) {
		selectThisCatalog = () => {};
	}

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 300);
		}
	}
</script>

<div
	class="group relative flex cursor-pointer flex-row gap-3 rounded-xl transition-all duration-400 ease-out
    {isSelected
		? 'bg-surface-2/80 border-brand-400/25 shadow-glow-sm border'
		: 'bg-surface-1/80 hover:bg-surface-2/60 hover:shadow-glow-sm border border-white/4 hover:border-white/8'}
    "
	onclick={() => selectThisCatalog(catalog)}
	role="button"
	tabindex="0"
	onkeydown={() => {}}
>
	<!-- Thread accent on selected -->
	{#if isSelected}
		<div
			class="from-brand-400/60 via-brand-400 to-brand-400/60 absolute top-2 bottom-2 left-0 w-[2px] rounded-full bg-gradient-to-b"
		></div>
	{/if}

	<div class="flex min-w-0 grow flex-col gap-1.5 p-4">
		<span
			class="text-text-primary group-hover:text-brand-400 truncate font-semibold transition-colors duration-300"
		>
			{catalog.name}
		</span>
		<p class="text-text-muted line-clamp-2 text-sm font-light">
			{catalog.description}
		</p>
	</div>

	{#if actualRoute?.includes('/admin')}
		<div
			transition:scale={{ duration: 150, start: 0.9 }}
			class="flex items-center gap-1 p-2 text-xl opacity-100 transition-opacity duration-200"
		>
			<button
				class="text-text-muted hover:text-brand-400 hover:bg-surface-3 rounded-lg p-1.5 transition-colors"
				onclick={(e) => {
					e.stopPropagation();
					selectThisCatalog(catalog);
					toggleDeleteCatalogModalIsVisible(true);
				}}
				onfocus={(e) => cancelFocus(e)}
				aria-label="Eliminar catálogo"
			>
				<Icon icon="mdi:delete-outline" />
			</button>
			<button
				class="text-text-muted hover:text-brand-400 hover:bg-surface-3 rounded-lg p-1.5 transition-colors"
				onclick={(e) => {
					e.stopPropagation();
					selectThisCatalog(catalog);
					toggleEditCatalogModalIsVisible(true);
				}}
				onfocus={(e) => cancelFocus(e)}
				aria-label="Editar catálogo"
			>
				<Icon icon="mdi:pencil-outline" />
			</button>
		</div>
	{/if}
</div>
