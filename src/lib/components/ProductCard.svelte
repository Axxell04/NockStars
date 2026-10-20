<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { ProductComplete } from '$lib/interfaces/product';
	import { imageUrl } from '$lib/cloudinary';
	import { withShipping, type ListingPromo, type ShippingSelection } from '$lib/shipping';
	import Icon from '@iconify/svelte';
	import { scale } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';
	import { cancelFocus } from '$lib/focus';

	interface Props {
		product: ProductComplete;
		setProductSelected?: (product: ProductComplete) => void;
		toggleDeleteProductModalIsVisible?: (visible?: boolean) => void;
		toggleEditProductModalIsVisible?: (visible?: boolean) => void;
		priority?: boolean;
		/**
		 * Listing promo, computed by the caller via `listingPromo`: whether the
		 * cart already covers the fee (this card shows a struck price) or this
		 * product is the carrier (extra units at base). Only the storefront grid
		 * passes it; admin routes never do.
		 */
		promo?: ListingPromo;
	}

	let {
		product,
		setProductSelected,
		toggleDeleteProductModalIsVisible,
		toggleEditProductModalIsVisible,
		priority = false,
		promo = 'none'
	}: Props = $props();

	let actualRoute = $derived(page.route.id);
	let isAdminRoute = $derived(actualRoute?.includes('/admin'));

	// Root layout data. Cast because App.PageData declares no key for it —
	// the layout load always returns it, so the fallback only exists to keep
	// the type honest when the data is genuinely absent.
	let shipping = $derived((page.data as { shipping?: ShippingSelection }).shipping);
	// The base price, resolved once: the promo branches and the plain price
	// must all read the same number.
	let basePrice = $derived(product.product.price);
	// Listing promo, `discounted` only: this card shows the base price against
	// the fee-inclusive one struck through, so the grid reads as a multi-buy
	// offer. Display only — the charged total never depends on it.
	let compareAt = $derived(
		promo === 'discounted' && shipping ? withShipping(basePrice, shipping) : null
	);
	// Admin cards show the editable base price; storefront cards show what the
	// visitor pays, fee included — unless the promo above took over.
	let displayPrice = $derived(
		isAdminRoute || !shipping || compareAt !== null ? basePrice : withShipping(basePrice, shipping)
	);

	if (!toggleDeleteProductModalIsVisible) {
		toggleDeleteProductModalIsVisible = () => {};
	}
	if (!toggleEditProductModalIsVisible) {
		toggleEditProductModalIsVisible = () => {};
	}
	if (!setProductSelected) {
		setProductSelected = () => {};
	}

	// The card is a real link, not a div with a click handler: a crawler only
	// discovers `/producto/{id}` if the URL is in the HTML, and a native anchor
	// also restores middle-click, "open in new tab" and copy-link.
	// Admin cards keep the previous target: an inactive product has no storefront
	// page (404 by design), so the card opens the backoffice editor instead.
	let productHref = $derived.by(() => {
		const target =
			isAdminRoute && product.product.deactivatedAt
				? `/admin/producto/${product.product.id}`
				: `/producto/${product.product.id}`;
		const returnTo = isAdminRoute ? page.url.pathname + page.url.search : undefined;
		return returnTo ? `${target}?returnTo=${encodeURIComponent(returnTo)}` : target;
	});

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

		// Auto-advance is motion the user did not ask for: honor reduced-motion
		// (the app.css blanket rule only reaches CSS, not this interval).
		// Manual swiping still works — it is direct manipulation, not animation.
		if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			startCarousel();
		}

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
	class="group/card card-thread card-product relative isolate flex h-80 w-72 flex-col overflow-hidden rounded-[1.25rem]"
>
	<!-- Stretched link: the whole card is the hit area, and the anchor carries the
	     product URL plus the accessible name. It sits above the visuals (z-20) and
	     below the admin controls (z-30), so those buttons stay clickable.
	     Hover events here pause the image carousel. -->
	<a
		href={productHref}
		class="focus-visible:outline-brand-400 absolute inset-0 z-20 rounded-[1.25rem] focus-visible:outline-2 focus-visible:outline-offset-2"
		onmouseenter={() => {
			isHovered = true;
		}}
		onmouseleave={() => {
			isHovered = false;
		}}
	>
		<span class="sr-only">Ver detalle de {product.product.name ?? 'camisa'}</span>
	</a>
	<!-- Imagen: ocupa toda la card, recortada con el mismo radio -->
	<div
		bind:this={imgContainer}
		class="img-container absolute inset-0 z-0 flex snap-x snap-mandatory flex-row overflow-hidden scroll-smooth rounded-[1.25rem]"
	>
		{#each product.imgs as imgProduct, i}
			<img
				src={imageUrl(imgProduct.url, 'card')}
				alt={i === 0 ? (product.product.name ?? 'camisa') : ''}
				class="h-full w-72 flex-shrink-0 snap-center object-cover transition-[transform,filter] duration-300 ease-out group-hover/card:scale-[1.06] group-hover/card:brightness-110"
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
					class="rounded-full transition-[width,height,background-color] duration-300 {i ===
					imgIndex
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
		<div class="min-w-0">
			{#if isAdminRoute && product.product.deactivatedAt}
				<span
					class="mb-1 inline-block rounded-full bg-red-500/85 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide text-white uppercase backdrop-blur-sm"
				>
					Inactivo
				</span>
			{/if}
			<p
				class="text-text-primary min-w-0 truncate text-base leading-tight font-bold drop-shadow-lg"
			>
				{product.product.name ?? 'Camisa'}
			</p>
		</div>
		{#if compareAt !== null && shipping}
			<div class="flex flex-col items-end gap-1">
				<span
					class="bg-brand-400 text-surface-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide drop-shadow-lg"
				>
					-{shipping.fee.toFixed(2)} $
				</span>
				<p
					class="flex items-baseline gap-2 text-lg font-bold whitespace-nowrap tabular-nums drop-shadow-lg"
				>
					<span class="text-text-muted text-sm line-through">{compareAt.toFixed(2)} $</span>
					<span class="text-brand-400">{displayPrice.toFixed(2)} $</span>
				</p>
			</div>
		{:else if promo === 'carrier-extra'}
			<div class="flex flex-col items-end gap-1">
				<span
					class="bg-brand-400 text-surface-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide drop-shadow-lg"
				>
					más unidades {basePrice.toFixed(2)} $
				</span>
				<p class="text-brand-400 text-lg font-bold whitespace-nowrap tabular-nums drop-shadow-lg">
					{displayPrice.toFixed(2)} $
				</p>
			</div>
		{:else}
			<p class="text-brand-400 text-lg font-bold whitespace-nowrap tabular-nums drop-shadow-lg">
				{`${displayPrice.toFixed(2)} $`}
			</p>
		{/if}
	</div>

	<!-- Hover overlay — Thread glow effect -->
	<div
		class="from-brand-500/15 via-brand-500/5 pointer-events-none absolute inset-0 z-10 bg-gradient-to-t to-transparent opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
	></div>

	<!-- Inset ring — sigue la curva del radio exactamente -->
	<div
		class="group-hover/card:ring-brand-400/30 pointer-events-none absolute inset-0 z-20 rounded-[1.25rem] ring-1 ring-transparent transition-[box-shadow] duration-300 ring-inset"
	></div>

	<!-- Thread accent line at bottom -->
	<div
		class="via-brand-400/40 pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-[2px] bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
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
				aria-label={product.product.deactivatedAt ? 'Reactivar producto' : 'Desactivar producto'}
			>
				<Icon icon={product.product.deactivatedAt ? 'mdi:eye-outline' : 'mdi:eye-off-outline'} />
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

	/* Explicit hover/press transitions. `card-thread` (app.css) declares
	   `transition: all 0.4s` unlayered, so a Tailwind transition utility can
	   never win here — scoped rules are the only honest place to own them. */
	.card-product {
		transition:
			transform 0.2s var(--ease-out-expo),
			box-shadow 0.2s var(--ease-out-expo),
			border-color 0.2s var(--ease-out-expo);
	}

	/* Press feedback; must out-specify `.card-thread:hover`'s translateY. */
	.card-product:active {
		transform: translateY(0) scale(0.985);
		transition-duration: 0.1s;
	}
</style>
