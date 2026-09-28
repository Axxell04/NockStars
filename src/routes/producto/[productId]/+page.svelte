<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import { renderProductWithVariantsJsonLd } from '$lib/json-ld';
	import { effectivePrice, effectiveStock, isVariantAvailable } from '$lib/variant';
	import VariantSelector from '$lib/components/VariantSelector.svelte';
	import { resolveSafeReturnTarget } from '$lib/route-back';
	import type { PageProps } from './$types';
	import type { VariantComplete, ProductWithVariants } from '$lib/actions';

	let { data }: PageProps = $props();

	// Product data from server (ProductWithVariants spreads product properties directly)
	// Data is guaranteed to exist since server returns 404 if not found
	const product: ProductWithVariants = data.product!;
	const variants: VariantComplete[] = data.variants!;
	const isAdminUser = $derived(Boolean(page.data.user?.admin));
	let selectedVariant: VariantComplete | null = $state(data.selectedVariant ?? null);
	const implicitVariant: VariantComplete = data.implicitVariant!;
	let price = $state(data.price!);

	// Image gallery state
	let imgIndex = $state(0);
	let touchStartX = $state(0);
	let touchEndX = $state(0);
	let touchCurrentX = $state(0);
	let dragOffset = $state(0);
	let showControls = $state(true);

	// Toast
	let toastMessage = $state('');

	// Derived: images for current variant (fallback to product images)
	const currentImages = $derived(
		selectedVariant?.images?.length ? selectedVariant.images : (product.productImages ?? [])
	);

	// Derived: stock status (as a function to avoid stale closure issues)
	function getStockStatus() {
		const available = isVariantAvailable(selectedVariant, product);
		const currentStock = effectiveStock(selectedVariant, product);
		if (!available) return { text: 'Agotado', class: 'text-text-error' };
		if (currentStock <= 5)
			return { text: `Solo ${currentStock} unidades`, class: 'text-brand-400' };
		return { text: 'En stock', class: 'text-text-success' };
	}

	// Derived: price display (crossed base price if variant has override)
	const basePrice = $derived(product.price);
	const variantPrice = $derived(
		selectedVariant?.priceOverride !== null && selectedVariant?.priceOverride !== undefined
			? Number(selectedVariant.priceOverride)
			: null
	);
	const showCrossedPrice = $derived(variantPrice !== null && variantPrice !== basePrice);

	// Variant selection handler
	function handleVariantSelect(variantId: string) {
		if (variantId === 'implicit') {
			selectedVariant = implicitVariant;
		} else {
			const variant = variants.find((v) => v.id === variantId);
			if (variant) {
				selectedVariant = variant;
			}
		}
		price = effectivePrice(selectedVariant, product);
	}

	// Image gallery
	function nextImg() {
		if (imgIndex < currentImages.length - 1) imgIndex++;
	}
	function prevImg() {
		if (imgIndex > 0) imgIndex--;
	}

	// Touch handlers for mobile swipe
	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].clientX;
		touchCurrentX = touchStartX;
		dragOffset = 0;
	}
	function handleTouchMove(e: TouchEvent) {
		touchCurrentX = e.touches[0].clientX;
		const delta = touchCurrentX - touchStartX;
		const isAtStart = imgIndex === 0 && delta > 0;
		const isAtEnd = imgIndex === currentImages.length - 1 && delta < 0;
		const resistance = isAtStart || isAtEnd ? 0.18 : 1;
		dragOffset = delta * resistance;
	}
	function handleTouchEnd(e: TouchEvent) {
		touchEndX = e.changedTouches[0].clientX;
		handleSwipe();
		dragOffset = 0;
	}
	function handleSwipe() {
		const swipeThreshold = 50;
		const diff = touchStartX - touchEndX;
		if (Math.abs(diff) > swipeThreshold) {
			if (diff > 0) {
				nextImg();
			} else {
				prevImg();
			}
		}
	}

	// Toggle gallery controls visibility on image click/tap
	function toggleControls() {
		showControls = !showControls;
	}

	// Toast
	function showToast(message: string) {
		toastMessage = message;
		setTimeout(() => {
			toastMessage = '';
		}, 3000);
	}

	function goBack() {
		const safeTarget = resolveSafeReturnTarget({
			currentOrigin: page.url.origin,
			referrer: typeof document !== 'undefined' ? document.referrer : undefined,
			returnTo: page.url.searchParams.get('returnTo'),
			fallback: '/'
		});

		goto(safeTarget);
	}

	// Add to cart handler (via form enhance)
	let addToCartForm: HTMLFormElement | undefined = $state();

	// Cancel focus helper
	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}
</script>

<!-- JSON-LD Structured Data -->
<!-- eslint-disable-next-line svelte/no-at-html-tags -->
{@html renderProductWithVariantsJsonLd({
	product: product,
	variants: variants,
	selectedVariant: selectedVariant,
	baseUrl: page.url.origin
})}

<div in:fade class="grid gap-6 lg:grid-cols-2 lg:gap-8">
	<!-- Image Gallery -->
	<section class="relative lg:sticky lg:top-24">
		<div
			class="bg-surface-1 aspect-square w-full cursor-pointer touch-pan-x overflow-hidden rounded-2xl"
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
			ontouchend={handleTouchEnd}
			onclick={toggleControls}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggleControls();
				}
			}}
			tabindex="0"
			role="button"
			aria-label="Galería de imágenes del producto (clic o Enter para mostrar/ocultar controles)"
		>
			{#if currentImages.length > 0}
				<div
					class="flex h-full w-full transition-transform duration-400 ease-out"
					style={`transform: translateX(calc(-${imgIndex * 100}% + ${dragOffset}px))`}
				>
					{#each currentImages as image}
						<div class="h-full w-full shrink-0 basis-full">
							<img
								src={image.url}
								alt={(image as { alt?: string }).alt ?? product.name}
								class="pointer-events-none h-full w-full object-cover"
								loading="eager"
							/>
						</div>
					{/each}
				</div>
			{:else}
				<div
					class="bg-surface-2 pointer-events-none flex h-full w-full items-center justify-center"
				>
					<Icon icon="mdi:tshirt-crew" class="text-text-muted/30 text-6xl" />
				</div>
			{/if}
		</div>

		<!-- Image indicators -->
		{#if currentImages.length > 1}
			<div
				class="mt-3 flex justify-center gap-2"
				role="tablist"
				aria-label="Navegación de imágenes"
			>
				{#each currentImages.keys() as i}
					<button
						role="tab"
						aria-selected={i === imgIndex}
						aria-label="Ver imagen {i + 1} de {currentImages.length}"
						class="h-2 w-2 rounded-full transition-all duration-300 {i === imgIndex
							? 'bg-brand-400 shadow-glow-sm w-6'
							: 'bg-white/30 hover:bg-white/50'}"
						onclick={(e) => {
							e.stopPropagation();
							imgIndex = i;
						}}
					></button>
				{/each}
			</div>
		{/if}

		<!-- Gallery navigation (toggleable via image click/tap) -->
		{#if currentImages.length > 1}
			<button
				class="bg-surface-1/95 text-text-secondary hover:text-brand-400 hover:border-brand-400/30 hover:bg-brand-400/10 focus:ring-brand-400/50 absolute top-1/2 left-3 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 transition-all duration-300 hover:opacity-100 focus:opacity-100 focus:ring-2 focus:outline-none {showControls
					? 'translate-x-0 opacity-60 lg:opacity-100'
					: 'pointer-events-none translate-x-2 opacity-0 lg:opacity-0'}"
				onclick={(e) => {
					e.stopPropagation();
					prevImg();
				}}
				disabled={imgIndex === 0}
				aria-label="Imagen anterior"
				aria-disabled={imgIndex === 0}
			>
				<Icon icon="mingcute:left-fill" class="text-xl" />
			</button>
			<button
				class="bg-surface-1/95 text-text-secondary hover:text-brand-400 hover:border-brand-400/30 hover:bg-brand-400/10 focus:ring-brand-400/50 absolute top-1/2 right-3 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 transition-all duration-300 hover:opacity-100 focus:opacity-100 focus:ring-2 focus:outline-none {showControls
					? 'translate-x-0 opacity-60 lg:opacity-100'
					: 'pointer-events-none -translate-x-2 opacity-0 lg:opacity-0'}"
				onclick={(e) => {
					e.stopPropagation();
					nextImg();
				}}
				disabled={imgIndex === currentImages.length - 1}
				aria-label="Imagen siguiente"
				aria-disabled={imgIndex === currentImages.length - 1}
			>
				<Icon icon="mingcute:right-fill" class="text-xl" />
			</button>
		{/if}
	</section>

	<!-- Product Info -->
	<section class="flex flex-col gap-4">
		<div class="flex items-center justify-between gap-3">
			<button
				type="button"
				onclick={goBack}
				class="text-text-secondary hover:bg-surface-2 hover:text-text-primary inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm transition-colors"
			>
				<Icon icon="mdi:arrow-left" class="text-base" />
				Regresar
			</button>

			{#if isAdminUser}
				<button
					type="button"
					onclick={() =>
						goto(
							`/admin/producto/${product.id}?returnTo=${encodeURIComponent(page.url.pathname + page.url.search)}`
						)}
					class="bg-brand-400 hover:bg-brand-300 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
				>
					<Icon icon="mdi:pencil-outline" class="text-base" />
					Editar producto
				</button>
			{/if}
		</div>

		<h1 class="text-text-primary text-2xl font-bold">{product.name}</h1>

		<!-- Variant Selector -->
		{#if variants.length > 0 || implicitVariant}
			<VariantSelector
				{variants}
				{implicitVariant}
				{product}
				selectedVariantId={selectedVariant?.id}
				onSelect={handleVariantSelect}
			/>
		{/if}

		<!-- Price -->
		<div class="flex flex-wrap items-baseline gap-3">
			{#if showCrossedPrice}
				<span class="text-text-muted text-xl line-through">{basePrice.toFixed(2)} $</span>
			{/if}
			<span class="text-brand-400 text-3xl font-bold tabular-nums">{price.toFixed(2)} $</span>
		</div>

		<!-- Stock Status -->
		<div class="flex items-center gap-2 text-sm">
			<span class={getStockStatus().class}>
				{getStockStatus().text}
			</span>
		</div>

		<!-- Description -->
		{#if selectedVariant?.description && selectedVariant.id !== 'implicit'}
			<p class="text-text-secondary mt-2">{selectedVariant.description}</p>
		{/if}

		<!-- Add to Cart Form -->
		<form
			action="?/addToCart"
			method="post"
			use:enhance={() => {
				return async (input: {
					result: { type: string; data?: { success?: boolean; message?: string } };
				}) => {
					const { result } = input;
					if (result.type === 'success' && result.data?.success) {
						showToast('Producto añadido al carrito');
						await invalidateAll();
					} else if (result.type === 'failure') {
						showToast(result.data?.message ?? 'Error al añadir al carrito');
					}
				};
			}}
			bind:this={addToCartForm}
		>
			<input type="hidden" name="productId" value={product.id} />
			{#if selectedVariant?.id && selectedVariant.id !== 'implicit'}
				<input type="hidden" name="variantId" value={selectedVariant.id} />
			{/if}
			<input type="hidden" name="quantity" value="1" />

			<button
				type="submit"
				class="btn-primary w-full py-4 text-lg sm:w-auto"
				disabled={!isVariantAvailable(selectedVariant, product)}
				onfocus={(e) => cancelFocus(e)}
			>
				<Icon icon="bi:cart-plus-fill" class="mr-2 text-xl" />
				Añadir al carrito
			</button>
		</form>
	</section>
</div>

<!-- Toast -->
{#if toastMessage}
	<div class="animate-slide-up fixed right-6 bottom-6 z-50" transition:fade={{ duration: 200 }}>
		<div class="glass shadow-depth rounded-xl border border-white/4 px-4 py-3">
			{toastMessage}
		</div>
	</div>
{/if}
