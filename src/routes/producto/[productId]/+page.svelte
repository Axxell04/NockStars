<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import { renderProductWithVariantsJsonLd } from '$lib/json-ld';
	import {
		effectivePrice,
		effectiveStock,
		getVariantDisplayName,
		isVariantAvailable,
		stockLimitMessage,
		totalStock
	} from '$lib/variant';
	import { specEntries } from '$lib/product-specs';
	import { withCloudinaryTransform } from '$lib/cloudinary';
	import Spinner from '$lib/components/Spinner.svelte';
	import VariantSelector from '$lib/components/VariantSelector.svelte';
	import { resolveSafeReturnTarget } from '$lib/route-back';
	import { toast } from '$lib/toast.svelte.js';
	import type { PageProps } from './$types';
	import { CartErrorCode } from '$lib/actions';
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

	// Ficha técnica: product-level attributes plus the live variant detail block.
	const productDescription = $derived((product.description ?? '').trim());
	const productSpecEntries = $derived(specEntries(product.specs));
	// The implicit variant is synthesized in `resolveImplicitVariant` with a
	// "Único" size/color and a hardcoded "recto" cut, none of which is a real
	// attribute — so it contributes no rows and the whole group stays hidden.
	const isExplicitVariant = $derived(selectedVariant !== null && selectedVariant.id !== 'implicit');
	// Once variants exist the base stock stops being the reference: the
	// sellable amount is the sum of the variant stocks, computed on read.
	const totalVariantStock = $derived(totalStock(product.stock, variants));
	const variantStockDiffers = $derived(
		isExplicitVariant && (selectedVariant?.stock ?? 0) !== totalVariantStock
	);
	const showFichaTecnica = $derived(
		productDescription !== '' || productSpecEntries.length > 0 || isExplicitVariant
	);

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
		imgIndex = 0;
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
	// True from submit until the action's result lands, so the button can
	// swap its icon for a spinner and refuse a second submit.
	let submitting = $state(false);

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
					{#each currentImages as image, i}
						<div class="h-full w-full shrink-0 basis-full">
							<img
								src={withCloudinaryTransform(image.url, 'w_1200,f_auto,q_auto')}
								alt={(image as { alt?: string }).alt ?? product.name}
								class="pointer-events-none h-full w-full object-cover"
								loading="eager"
								fetchpriority={i === 0 ? 'high' : 'auto'}
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
				submitting = true;
				return async (input: {
					result: {
						type: string;
						data?: {
							success?: boolean;
							message?: string;
							code?: string;
							details?: { available?: number };
						};
					};
				}) => {
					try {
						const { result } = input;
						if (result.type === 'success' && result.data?.success) {
							toast('Producto añadido al carrito');
							await invalidateAll();
						} else if (result.type === 'failure') {
							if (result.data?.code === CartErrorCode.OUT_OF_STOCK) {
								// Over-stock rejections use the availability-aware message.
								toast(stockLimitMessage(result.data.details?.available));
							} else {
								toast(result.data?.message ?? 'Error al añadir al carrito');
							}
						}
					} finally {
						submitting = false;
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
				disabled={!isVariantAvailable(selectedVariant, product) || submitting}
				aria-busy={submitting}
				onfocus={(e) => cancelFocus(e)}
			>
				<!-- Fixed-width slot: swapping the icon for a spinner must not resize the
				     button, which is shrink-to-fit from the sm breakpoint up. -->
				<span class="mr-2 flex w-5 shrink-0 items-center justify-center">
					{#if submitting}
						<Spinner />
					{:else}
						<Icon icon="bi:cart-plus-fill" class="text-xl" />
					{/if}
				</span>
				Añadir al carrito
			</button>
		</form>
	</section>
</div>

<!-- Ficha técnica: full-width sibling of the two-column grid, not a third grid child -->
{#if showFichaTecnica}
	<section in:fade class="mt-6 flex flex-col gap-4" aria-labelledby="ficha-tecnica-heading">
		<h2 id="ficha-tecnica-heading" class="text-text-primary text-xl font-semibold">
			Ficha técnica
		</h2>

		{#if productDescription}
			<p class="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
				{productDescription}
			</p>
		{/if}

		{#if productSpecEntries.length > 0}
			<dl class="flex flex-col gap-2">
				{#each productSpecEntries as entry (entry.key)}
					<div class="glass flex items-center gap-3 rounded-xl border border-white/4 p-3">
						<dt class="text-text-secondary text-sm font-medium">{entry.label}</dt>
						<dd class="text-text-primary ml-auto text-right font-medium">{entry.value}</dd>
					</div>
				{/each}
			</dl>
		{/if}

		{#if isExplicitVariant && selectedVariant}
			<div class="flex flex-col gap-2">
				<h3 class="text-text-secondary text-sm font-medium">Variante seleccionada</h3>
				<div
					class="glass border-brand-400/30 bg-brand-400/5 rounded-xl border p-3"
					aria-live="polite"
				>
					<div class="flex items-center gap-3">
						<Icon icon="mdi:cube-outline" class="text-brand-400 text-xl" />
						<p class="text-text-primary min-w-0 flex-1 font-medium">
							{getVariantDisplayName(selectedVariant)}
						</p>
					</div>

					<dl class="mt-2 flex flex-col gap-2 border-t border-white/4 pt-2">
						<div class="flex items-center gap-3">
							<dt class="text-text-secondary text-sm font-medium">Talla</dt>
							<dd class="text-text-primary ml-auto font-medium">{selectedVariant.size}</dd>
						</div>
						<div class="flex items-center gap-3">
							<dt class="text-text-secondary text-sm font-medium">Color</dt>
							<dd class="text-text-primary ml-auto font-medium">{selectedVariant.color}</dd>
						</div>
						<div class="flex items-center gap-3">
							<dt class="text-text-secondary text-sm font-medium">Corte</dt>
							<dd class="text-text-primary ml-auto font-medium capitalize">
								{selectedVariant.cut}
							</dd>
						</div>
						{#if showCrossedPrice}
							<div class="flex items-center gap-3">
								<dt class="text-text-secondary text-sm font-medium">Precio de la variante</dt>
								<dd class="ml-auto text-right font-medium">
									<span class="text-brand-400 font-bold tabular-nums">
										{variantPrice?.toFixed(2)} $
									</span>
									<span class="text-text-muted block text-xs">
										Base {basePrice.toFixed(2)} $
									</span>
								</dd>
							</div>
						{/if}
						{#if variantStockDiffers}
							<div class="flex items-center gap-3">
								<dt class="text-text-secondary text-sm font-medium">Stock de la variante</dt>
								<dd class="ml-auto text-right font-medium">
									<span class="text-text-primary tabular-nums">{selectedVariant.stock}</span>
									<span class="text-text-muted block text-xs">
										Total {totalVariantStock}
									</span>
								</dd>
							</div>
						{/if}
					</dl>
				</div>
			</div>
		{/if}
	</section>
{/if}
