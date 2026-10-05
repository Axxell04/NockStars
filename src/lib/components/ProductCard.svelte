<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { ProductComplete } from '$lib/interfaces/product';
	import { withCloudinaryTransform } from '$lib/cloudinary';
	import Icon from '@iconify/svelte';
	import { scale } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		product: ProductComplete;
		setProductSelected?: (product: ProductComplete) => void;
		toggleDeleteProductModalIsVisible?: (visible?: boolean) => void;
		toggleEditProductModalIsVisible?: (visible?: boolean) => void;
		priority?: boolean;
	}

	let {
		product,
		setProductSelected,
		toggleDeleteProductModalIsVisible,
		toggleEditProductModalIsVisible,
		priority = false
	}: Props = $props();

	let actualRoute = $derived(page.route.id);
	let isAdminRoute = $derived(actualRoute?.includes('/admin'));

	if (!toggleDeleteProductModalIsVisible) {
		toggleDeleteProductModalIsVisible = () => {};
	}
	if (!toggleEditProductModalIsVisible) {
		toggleEditProductModalIsVisible = () => {};
	}
	if (!setProductSelected) {
		setProductSelected = () => {};
	}

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			navigateToProduct();
		}
	}

	function navigateToProduct() {
		const returnTo = isAdminRoute ? page.url.pathname + page.url.search : undefined;
		const target = returnTo
			? `/producto/${product.product.id}?returnTo=${encodeURIComponent(returnTo)}`
			: `/producto/${product.product.id}`;
		goto(target);
	}

	function goToEditProduct() {
		const returnTo = isAdminRoute ? `/producto/${product.product.id}` : '/admin/catalogo';
		goto(`/admin/producto/${product.product.id}?returnTo=${encodeURIComponent(returnTo)}`);
	}

	function onEditButtonClick(e: MouseEvent) {
		e.stopPropagation();
		setProductSelected?.(product);
		goToEditProduct();
	}

	// Auto-carousel
	let imgContainer: HTMLDivElement | undefined = $state();
	let cardElement: HTMLDivElement | undefined = $state();
	let imgIndex = $state(0);
	let isHovered = $state(false);
	let isVisible = $state(false);
	let intervalId: ReturnType<typeof setInterval> | undefined;

	const CARD_WIDTH = 288;
	const INTERVAL_MS = 3000;

	function scrollToImage(index: number) {
		if (!imgContainer) return;
		imgContainer.scrollTo({ left: index * CARD_WIDTH, behavior: 'smooth' });
	}

	function nextImage() {
		if (isHovered || !isVisible) return;
		const total = product.imgs.length;
		if (total <= 1) return;
		imgIndex = (imgIndex + 1) % total;
		scrollToImage(imgIndex);
	}

	function startCarousel() {
		stopCarousel();
		if (product.imgs.length > 1) {
			intervalId = setInterval(nextImage, INTERVAL_MS);
		}
	}

	function stopCarousel() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = undefined;
		}
	}

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					isVisible = entry.isIntersecting;
				}
			},
			{ threshold: 0.1 }
		);

		if (cardElement) {
			observer.observe(cardElement);
		}

		startCarousel();

		return () => {
			observer.disconnect();
			stopCarousel();
		};
	});

	onDestroy(() => {
		stopCarousel();
	});
</script>

<div
	bind:this={cardElement}
	class="group/card card-thread hover:shadow-glow-md relative isolate flex h-80 w-72 cursor-pointer flex-col overflow-hidden rounded-[1.25rem] transition-all duration-500 ease-out outline-none"
	onclick={navigateToProduct}
	onmouseenter={() => {
		isHovered = true;
	}}
	onmouseleave={() => {
		isHovered = false;
	}}
	role="button"
	tabindex="0"
	onkeydown={handleKeydown}
	aria-label="Ver detalle de {product.product.name ?? 'camisa'}"
>
	<!-- Imagen: ocupa toda la card, recortada con el mismo radio -->
	<div
		bind:this={imgContainer}
		class="img-container absolute inset-0 z-0 flex snap-x snap-mandatory flex-row overflow-hidden scroll-smooth rounded-[1.25rem]"
	>
		{#each product.imgs as imgProduct, i}
			<img
				src={withCloudinaryTransform(imgProduct.url, 'w_576,f_auto,q_auto')}
				alt={imgProduct.id}
				class="h-full w-72 flex-shrink-0 snap-center object-cover transition-all duration-700 ease-out group-hover/card:scale-[1.06] group-hover/card:brightness-110"
				loading={priority && i === 0 ? 'eager' : 'lazy'}
				fetchpriority={priority && i === 0 ? 'high' : 'auto'}
				width="288"
				height="320"
			/>
		{/each}
	</div>

	<!-- Indicadores de imagen — Thread-wrapped dots -->
	{#if product.imgs.length > 1}
		<div
			class="pointer-events-none absolute top-3 right-0 left-0 z-10 flex flex-row justify-center gap-1.5"
		>
			{#each product.imgs.keys() as i}
				<span
					class="rounded-full transition-all duration-300 {i === imgIndex
						? 'bg-brand-400 shadow-glow-sm h-1.5 w-4'
						: 'h-1.5 w-1.5 bg-white/40'}"
				></span>
			{/each}
		</div>
	{/if}

	<!-- Degradado inferior con nombre y precio — Thread-veiled -->
	<div
		class="from-surface-0 via-surface-0/75 pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-row items-end justify-between gap-3 bg-gradient-to-t to-transparent px-4 pt-20 pb-3.5"
	>
		<p class="text-text-primary min-w-0 truncate text-base leading-tight font-bold drop-shadow-lg">
			{product.product.name ?? 'Camisa'}
		</p>
		<p class="text-brand-400 text-lg font-bold whitespace-nowrap tabular-nums drop-shadow-lg">
			{`${product.product.price.toFixed(2)} $`}
		</p>
	</div>

	<!-- Hover overlay — Thread glow effect -->
	<div
		class="from-brand-500/15 via-brand-500/5 pointer-events-none absolute inset-0 z-10 bg-gradient-to-t to-transparent opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
	></div>

	<!-- Inset ring — sigue la curva del radio exactamente -->
	<div
		class="group-hover/card:ring-brand-400/30 pointer-events-none absolute inset-0 z-20 rounded-[1.25rem] ring-1 ring-transparent transition-all duration-500 ring-inset"
	></div>

	<!-- Thread accent line at bottom -->
	<div
		class="via-brand-400/40 pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-[2px] bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
	></div>

	<!-- Admin overlay — Thread-wrapped -->
	{#if isAdminRoute}
		<div
			transition:scale={{ duration: 150, start: 0.9 }}
			class="glass absolute top-3 right-3 z-30 flex flex-col items-center gap-2 rounded-xl border border-white/8 p-2 text-2xl"
		>
			<button
				class="text-text-muted hover:text-brand-400 hover:bg-surface-2 rounded-lg p-1.5 transition-colors"
				onclick={(e) => {
					e.stopPropagation();
					setProductSelected(product);
					toggleDeleteProductModalIsVisible(true);
				}}
				onfocus={(e) => cancelFocus(e)}
				aria-label="Eliminar producto"
			>
				<Icon icon="mdi:delete-outline" />
			</button>
			<button
				class="text-text-muted hover:text-brand-400 hover:bg-surface-2 rounded-lg p-1.5 transition-colors"
				onclick={(e) => onEditButtonClick(e)}
				onfocus={(e) => cancelFocus(e)}
				aria-label="Editar producto"
			>
				<Icon icon="mdi:pencil-outline" />
			</button>
		</div>
	{/if}
</div>

<style>
	.img-container {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	.img-container::-webkit-scrollbar {
		display: none;
	}
</style>
