<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { PageProps } from './$types';
	import type { ActionResult } from '@sveltejs/kit';
	import Icon from '@iconify/svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import ClearCartModal from '$lib/components/modals/carrito/ClearCartModal.svelte';
	import SendCartModal from '$lib/components/modals/carrito/SendCartModal.svelte';
	import ContainerModal from '$lib/components/modals/ContainerModal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { getVariantDisplayName, stockLimitMessage } from '$lib/variant';
	import { imageUrl } from '$lib/cloudinary';
	import { toast } from '$lib/toast.svelte.js';
	import { CartErrorCode } from '$lib/actions';
	import type { CartItemWithProduct } from '$lib/actions';
	import { lineDisplay } from '$lib/shipping';

	let { data }: PageProps = $props();

	let cartItems: CartItemWithProduct[] = $state(data.cartItems);

	// HTML Elements
	let clearCartModalIsVisible = $state(false);
	let sendCartModalIsVisible = $state(false);

	// Fullscreen image viewer (lightbox), same mechanic as /admin/pedido.
	// `urls` holds every image of the line (variant first, product fallback);
	// an empty list never opens it.
	let viewer: { urls: string[]; index: number; name: string } | null = $state(null);

	function openViewer(urls: string[], name: string) {
		if (urls.length === 0) return;
		viewer = { urls, index: 0, name };
	}

	function stepViewer(delta: number) {
		if (!viewer) return;
		const next = viewer.index + delta;
		if (next < 0 || next >= viewer.urls.length) return;
		viewer = { ...viewer, index: next };
	}

	function setViewerIndex(index: number) {
		if (!viewer) return;
		viewer = { ...viewer, index };
	}

	// Arrow-key navigation while the lightbox is open. Registered only for a
	// multi-image viewer and removed on close, mirroring ContainerModal's own
	// Escape listener so both stay in sync through the same `viewer` signal.
	$effect(() => {
		if (!viewer || viewer.urls.length < 2) return;

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'ArrowLeft') stepViewer(-1);
			if (event.key === 'ArrowRight') stepViewer(1);
		}

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	});

	// Derived
	let shipping = $derived(data.shipping);

	/** Base unit price for one cart line: the variant override when present. */
	function lineBasePrice(item: CartItemWithProduct): number {
		const variant = item.variant;
		return variant?.priceOverride !== null && variant?.priceOverride !== undefined
			? Number(variant.priceOverride)
			: item.product.price;
	}

	let cartSubtotal = $derived(
		cartItems.reduce((acc, item) => acc + lineBasePrice(item) * item.quantity, 0)
	);
	// The first line is the carrier: it absorbs the flat fee into its regular
	// unit price, so the fee is never named anywhere in the UI. The total is
	// the sum of the displayed line totals — base × qty plus the fee once,
	// which is exactly subtotal + fee below, and only for a non-empty cart
	// (the fee belongs to an order, not to an empty basket).
	let cartTotal = $derived(cartItems.length > 0 ? cartSubtotal + shipping.fee : cartSubtotal);

	function extractCartItems(payload: unknown): CartItemWithProduct[] | null {
		if (payload && typeof payload === 'object' && 'cartItems' in payload) {
			const items = (payload as { cartItems?: unknown }).cartItems;
			if (Array.isArray(items)) {
				return items as CartItemWithProduct[];
			}
		}
		return null;
	}

	/**
	 * Single entry point for every cart action result: re-seeds the local list
	 * from the action's RETURNED payload (never a hard-coded literal) and
	 * invalidates so the header badge recomputes. On failure it invalidates
	 * first, then re-seeds from the refreshed load payload (server truth).
	 */
	async function applyCartResult(result: ActionResult): Promise<void> {
		if (result.type === 'success') {
			const items = extractCartItems(result.data);
			if (items) {
				cartItems = items;
			}
			await invalidateAll();
		} else {
			await invalidateAll();
			cartItems = data.cartItems;
		}
	}

	// Presentation-only busy keys for cart controls (e.g. `${lineId}:qty:inc`).
	// Set the moment a form action is submitted, cleared in `finally` AFTER
	// applyCartResult resolves — including failure branches — so no control can
	// ever stay stuck disabled. This is UI state, never re-seeded from the server.
	let pendingControls = $state<string[]>([]);

	function isPending(key: string): boolean {
		return pendingControls.includes(key);
	}

	function beginPending(key: string): void {
		pendingControls = [...pendingControls, key];
	}

	function endPending(key: string): void {
		pendingControls = pendingControls.filter((pending) => pending !== key);
	}

	function qtyPendingKey(lineId: string, direction: 'inc' | 'dec'): string {
		return `${lineId}:qty:${direction}`;
	}

	function removePendingKey(lineId: string): string {
		return `${lineId}:remove`;
	}

	/**
	 * A line's controls all write the same row (the quantity actions carry its
	 * optimistic-lock version), so the whole group goes non-interactive while
	 * any of them is in flight. Other lines stay usable — their versions are
	 * independent.
	 */
	function lineBusy(lineId: string): boolean {
		return (
			isPending(qtyPendingKey(lineId, 'inc')) ||
			isPending(qtyPendingKey(lineId, 'dec')) ||
			isPending(removePendingKey(lineId))
		);
	}

	/**
	 * Class fragment for one control: the control that is mid-flight keeps full
	 * opacity with a wait cursor so its spinner reads clearly; controls blocked
	 * behind it dim like any other disabled control in this app.
	 */
	function busyClass(key: string, blocked: boolean): string {
		if (isPending(key)) {
			return 'cursor-wait';
		}
		return blocked ? 'cursor-not-allowed opacity-50' : '';
	}

	// Toggle Visible Elements
	function toggleClearCartModalIsVisible(visible?: boolean) {
		if (typeof visible === 'undefined') {
			clearCartModalIsVisible = !clearCartModalIsVisible;
		} else {
			clearCartModalIsVisible = visible;
		}
	}

	function toggleSendCartModalIsVisible(visible?: boolean) {
		if (typeof visible === 'undefined') {
			sendCartModalIsVisible = !sendCartModalIsVisible;
		} else {
			sendCartModalIsVisible = visible;
		}
	}

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		// Pointer focus loses its outline after a beat (the original intent), but
		// keyboard focus must keep both the focus and the focus-visible ring —
		// otherwise tabbing through these controls is impossible.
		if (!target || target.matches(':focus-visible')) {
			return;
		}
		setTimeout(() => {
			target.blur();
		}, 200);
	}
</script>

<div in:fade class="flex flex-col gap-6">
	<!-- Header — Thread-wrapped glass panel, sticky below header -->
	<section class="glass sticky top-0 z-20 rounded-2xl border border-white/4 p-4">
		<!-- Thread accent line at top -->
		<div
			class="via-brand-400/20 absolute top-0 right-1/4 left-1/4 h-[1px] bg-gradient-to-r from-transparent to-transparent"
		></div>

		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-text-primary text-xl font-bold">Carrito de compras</h2>
			<div class="flex items-center gap-3">
				<button
					class="btn-primary {cartItems.length === 0 ? 'cursor-not-allowed opacity-50' : ''}"
					onclick={() => {
						if (cartItems.length > 0) {
							toggleSendCartModalIsVisible(true);
						}
					}}
					onfocus={(e) => cancelFocus(e)}
					disabled={cartItems.length === 0}
				>
					<Icon icon="mdi:cart-check" class="text-lg" />
					Realizar pedido
				</button>
				<button
					class="btn-secondary {cartItems.length === 0 ? 'cursor-not-allowed opacity-30' : ''}"
					onclick={() => {
						if (cartItems.length > 0) {
							toggleClearCartModalIsVisible(true);
						}
					}}
					onfocus={(e) => cancelFocus(e)}
					disabled={cartItems.length === 0}
				>
					<Icon icon="mdi:cart-remove" class="text-lg" />
					Vaciar
				</button>
			</div>
		</div>
	</section>

	<!-- Cart items — Thread-woven list -->
	<section class="flex flex-col gap-4">
		{#each cartItems as item, index (item.id)}
			{@const lineIsBusy = lineBusy(item.id)}
			{@const decKey = qtyPendingKey(item.id, 'dec')}
			{@const incKey = qtyPendingKey(item.id, 'inc')}
			{@const removeKey = removePendingKey(item.id)}
			{@const display = lineDisplay(
				lineBasePrice(item),
				item.quantity,
				index === 0 && shipping.fee > 0,
				shipping.fee
			)}
			{@const imageUrls =
				item.variant && item.variant.images?.length > 0
					? item.variant.images.map((img) => img.url)
					: item.productImages.map((img) => img.url)}
			<div
				class="bg-surface-1/80 hover:bg-surface-2/50 hover:shadow-glow-sm animate-thread-appear flex gap-4 rounded-2xl border border-white/4 p-4 transition-all duration-400 hover:border-white/8"
				style="--stagger-delay: {60 * index}ms"
			>
				<!-- Product image — Thread-wrapped. Clicking it opens the same
				     lightbox as /admin/pedido; no images means no affordance. -->
				<button
					type="button"
					disabled={imageUrls.length === 0}
					aria-label={imageUrls.length > 0 ? `Ampliar imagen de ${item.product.name}` : undefined}
					onclick={() => openViewer(imageUrls, item.product.name)}
					class="bg-surface-2 h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl sm:h-32 sm:w-32 {imageUrls.length >
					0
						? 'cursor-zoom-in'
						: ''}"
				>
					{#if item.variant && item.variant.images?.length > 0}
						<img
							src={imageUrl(item.variant.images[0].url, 'thumb')}
							alt={item.variant.images[0].alt ?? item.product.name}
							class="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
						/>
					{:else if item.productImages?.length > 0}
						<img
							src={imageUrl(item.productImages[0].url, 'thumb')}
							alt={item.product.name}
							class="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
						/>
					{:else}
						<div class="flex h-full w-full items-center justify-center">
							<Icon icon="mdi:tshirt-crew" class="text-text-muted/30 text-4xl" />
						</div>
					{/if}
				</button>

				<!-- Product info -->
				<div class="flex min-w-0 flex-1 flex-col justify-between">
					<div>
						<h3 class="text-text-primary truncate text-base font-semibold">
							{item.product.name}
						</h3>
						{#if item.variant && item.variant.id !== 'implicit'}
							<p class="text-text-muted mt-1 text-xs">{getVariantDisplayName(item.variant)}</p>
						{/if}
						<p class="text-brand-400 mt-1 font-semibold">
							{display.unitPrice.toFixed(2)} $
						</p>
						{#if index === 0 && shipping.fee > 0 && item.quantity > 1}
							<span
								class="bg-brand-400 text-surface-0 mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide"
							>
								a partir de la 2.ª unidad: {lineBasePrice(item).toFixed(2)} $
							</span>
						{/if}
					</div>

					<!-- Quantity controls — Thread-wrapped buttons -->
					<div class="mt-3 flex items-center justify-between">
						<span class="text-text-muted text-xs tracking-wider uppercase">Cantidad</span>
						<form
							action="?/updateQuantity"
							method="post"
							use:enhance={({ formData }) => {
								// Direction comes from the submitted value: the quantity buttons
								// always post current ± 1, so the larger one is the increment.
								const quantity = Number(formData.get('quantity'));
								const direction: 'inc' | 'dec' = quantity > item.quantity ? 'inc' : 'dec';
								const key = qtyPendingKey(item.id, direction);
								beginPending(key);
								return async ({ result }) => {
									try {
										// An over-stock rejection carries the machine-readable
										// code plus the available count — surface it as a
										// toast; applyCartResult stays responsible for
										// re-seeding the list and clearing the spinner.
										if (
											result.type === 'failure' &&
											result.data?.code === CartErrorCode.OUT_OF_STOCK
										) {
											const details = result.data.details as { available?: number } | undefined;
											toast(stockLimitMessage(details?.available));
										}
										await applyCartResult(result);
									} finally {
										endPending(key);
									}
								};
							}}
						>
							<input type="hidden" name="cartItemId" value={item.id} />
							<input type="hidden" name="version" value={item.version} />
							<div class="flex items-center gap-3">
								<button
									type="submit"
									name="quantity"
									value={Math.max(0, item.quantity - 1)}
									class="text-text-secondary hover:border-brand-400/25 hover:text-brand-400 hover:bg-brand-400/5 flex h-9 w-9 items-center justify-center rounded-full border border-white/8 transition-all duration-200 active:scale-95 {busyClass(
										decKey,
										lineIsBusy || item.quantity <= 1
									)}"
									disabled={lineIsBusy || item.quantity <= 1}
									aria-busy={isPending(decKey)}
									aria-label="Disminuir cantidad"
									onfocus={(e) => cancelFocus(e)}
								>
									{#if isPending(decKey)}
										<Spinner />
									{:else}
										<Icon icon="mdi:minus" class="text-sm" />
									{/if}
								</button>
								<span class="text-text-primary w-8 text-center font-semibold tabular-nums">
									{item.quantity}
								</span>
								<button
									type="submit"
									name="quantity"
									value={item.quantity + 1}
									class="text-text-secondary hover:border-brand-400/25 hover:text-brand-400 hover:bg-brand-400/5 flex h-9 w-9 items-center justify-center rounded-full border border-white/8 transition-all duration-200 active:scale-95 {busyClass(
										incKey,
										lineIsBusy
									)}"
									disabled={lineIsBusy}
									aria-busy={isPending(incKey)}
									aria-label="Aumentar cantidad"
									onfocus={(e) => cancelFocus(e)}
								>
									{#if isPending(incKey)}
										<Spinner />
									{:else}
										<Icon icon="mdi:plus" class="text-sm" />
									{/if}
								</button>
							</div>
						</form>
					</div>

					<!-- Line total -->
					<div class="mt-2 text-right">
						<span class="text-text-primary font-semibold">
							{display.total.toFixed(2)} $
						</span>
					</div>

					<!-- Remove button -->
					<form
						action="?/removeFromCart"
						method="post"
						use:enhance={() => {
							beginPending(removeKey);
							return async ({ result }) => {
								try {
									await applyCartResult(result);
								} finally {
									endPending(removeKey);
								}
							};
						}}
						class="mt-2"
					>
						<input type="hidden" name="cartItemId" value={item.id} />
						<button
							type="submit"
							class="text-text-muted hover:text-text-error inline-flex items-center gap-1.5 text-xs font-medium transition-all duration-200 active:scale-95 {busyClass(
								removeKey,
								lineIsBusy
							)}"
							disabled={lineIsBusy}
							aria-busy={isPending(removeKey)}
							onfocus={(e) => cancelFocus(e)}
						>
							{#if isPending(removeKey)}
								<Spinner />
							{/if}
							Eliminar
						</button>
					</form>
				</div>
			</div>
		{/each}

		{#if cartItems.length === 0}
			<div class="text-text-muted flex flex-col items-center justify-center py-20">
				<div class="relative mb-6">
					<Icon icon="mdi:cart-outline" class="text-7xl opacity-20" />
					<!-- Thread accent -->
					<div
						class="bg-brand-400/20 absolute -bottom-2 left-1/2 h-[1px] w-12 -translate-x-1/2"
					></div>
				</div>
				<p class="text-text-secondary text-lg">Tu carrito está vacío</p>
				<a href="/" class="btn-primary mt-6"> Explorar tienda </a>
			</div>
		{/if}
	</section>

	<!-- Cart Total -->
	{#if cartItems.length > 0}
		<section class="glass sticky bottom-0 z-20 mt-auto rounded-2xl border border-white/4 p-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-baseline gap-2">
					<span class="text-text-secondary">Total:</span>
					<span class="text-brand-400 text-2xl font-bold tabular-nums"
						>{cartTotal.toFixed(2)} $</span
					>
				</div>
				<button
					class="btn-primary w-full py-3 sm:w-auto"
					onclick={() => {
						if (cartItems.length > 0) {
							toggleSendCartModalIsVisible(true);
						}
					}}
					onfocus={(e) => cancelFocus(e)}
					disabled={cartItems.length === 0}
				>
					<Icon icon="mdi:cart-check" class="mr-2 text-lg" />
					Proceder al pago
				</button>
			</div>
		</section>
	{/if}
</div>

<ClearCartModal
	{toggleClearCartModalIsVisible}
	{clearCartModalIsVisible}
	onCartResult={applyCartResult}
/>
<SendCartModal
	{toggleSendCartModalIsVisible}
	cart={cartItems}
	{sendCartModalIsVisible}
	onCartResult={applyCartResult}
/>

<!-- Image lightbox — same mechanic as /admin/pedido: arrows for multi-image
     lines, dots for direct access, Escape/backdrop handled by ContainerModal. -->
{#if viewer}
	<ContainerModal toggleModal={() => (viewer = null)} maxWidth="max-w-3xl">
		<figure class="relative">
			<img
				src={imageUrl(viewer.urls[viewer.index], 'hero')}
				alt="Imagen {viewer.index + 1} de {viewer.urls.length} de {viewer.name}"
				class="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain"
			/>
			{#if viewer.urls.length > 1}
				<button
					type="button"
					aria-label="Imagen anterior"
					disabled={viewer.index === 0}
					onclick={() => stepViewer(-1)}
					class="bg-surface-1/95 text-text-secondary hover:border-brand-400/30 hover:bg-brand-400/10 hover:text-brand-400 absolute top-1/2 left-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 transition-all duration-200 disabled:pointer-events-none disabled:opacity-30"
				>
					<Icon icon="mingcute:left-fill" class="text-xl" />
				</button>
				<button
					type="button"
					aria-label="Imagen siguiente"
					disabled={viewer.index === viewer.urls.length - 1}
					onclick={() => stepViewer(1)}
					class="bg-surface-1/95 text-text-secondary hover:border-brand-400/30 hover:bg-brand-400/10 hover:text-brand-400 absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 transition-all duration-200 disabled:pointer-events-none disabled:opacity-30"
				>
					<Icon icon="mingcute:right-fill" class="text-xl" />
				</button>
			{/if}
			<button
				type="button"
				aria-label="Cerrar imagen"
				onclick={() => (viewer = null)}
				onfocus={(e) => cancelFocus(e)}
				class="bg-surface-2 text-text-secondary hover:text-text-primary absolute -top-3 -right-3 rounded-full border border-white/10 p-2 transition-[color,transform] duration-150 active:scale-90"
			>
				<Icon icon="mdi:close" />
			</button>
			{#if viewer.urls.length > 1}
				<div
					class="mt-3 flex justify-center gap-2"
					role="tablist"
					aria-label="Navegación de imágenes"
				>
					{#each viewer.urls.keys() as i}
						<button
							role="tab"
							aria-selected={i === viewer.index}
							aria-label="Ver imagen {i + 1} de {viewer.urls.length}"
							onclick={() => setViewerIndex(i)}
							class="h-2 w-2 rounded-full transition-all duration-300 {i === viewer.index
								? 'bg-brand-400 shadow-glow-sm w-6'
								: 'bg-white/30 hover:bg-white/50'}"
						></button>
					{/each}
				</div>
			{/if}
			<figcaption class="text-text-secondary mt-2 flex items-center justify-center gap-2 text-sm">
				<span class="min-w-0 truncate">{viewer.name}</span>
				{#if viewer.urls.length > 1}
					<span class="text-text-muted flex-shrink-0 tabular-nums">
						{viewer.index + 1} / {viewer.urls.length}
					</span>
				{/if}
			</figcaption>
		</figure>
	</ContainerModal>
{/if}
