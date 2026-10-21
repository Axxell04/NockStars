<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { PageProps } from './$types';
	import Icon from '@iconify/svelte';
	import { imageUrl } from '$lib/cloudinary';
	import { formatOrderDate, orderLinesTotal, orderShipping } from '$lib/order-content';
	import ImageLightbox from '$lib/components/ImageLightbox.svelte';

	let { data }: PageProps = $props();

	const order = data.order;
	let viewer: { urls: string[]; index: number; name: string } | null = $state(null);
	// Delivery fee recorded at checkout; 0 for orders placed before it existed.
	// It stays folded into `totalValue` but is no longer itemized on the page —
	// shipping is communicated through the admin template's {envio} token now.
	const shippingFee = $derived(order ? orderShipping(order.content) : 0);
	const linesTotal = $derived(order ? orderLinesTotal(order.items) : 0);
	const totalValue = $derived(linesTotal + shippingFee);
</script>

{#if order}
	<div in:fade class="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10">
		<!-- Order Header -->
		<header class="glass rounded-2xl border border-white/4 p-6">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 class="text-text-primary text-2xl font-bold">Pedido {order.id}</h1>
					<p class="text-text-secondary mt-1">Cliente: {order.clientName}</p>
					<p class="text-text-muted text-sm">
						{formatOrderDate(new Date(order.createdAt))}
					</p>
				</div>
				<div class="flex items-center gap-3">
					<span
						class="rounded-full px-3 py-1 text-sm font-medium {order.completed
							? 'bg-green-500/20 text-green-400'
							: 'bg-amber-500/20 text-amber-400'}"
					>
						{order.completed ? 'Completado' : 'Pendiente'}
					</span>
				</div>
			</div>
		</header>

		<!-- Admin-authored status message. Null when no template is configured
		     for this order's status, so the page is unchanged until one is set. -->
		{#if data.statusMessage}
			<section
				class="glass rounded-2xl border border-white/4 p-6"
				role="status"
				aria-label="Mensaje del estado del pedido"
			>
				<!-- whitespace-pre-line: the admin template is a textarea, so its \n must
				     render as real line breaks instead of collapsing into one line. -->
				<p class="text-text-secondary whitespace-pre-line">{data.statusMessage}</p>
			</section>
		{/if}

		<!-- Order Items -->
		<section class="glass overflow-hidden rounded-2xl border border-white/4">
			<div class="border-b border-white/4 p-4">
				<h2 class="text-text-primary text-lg font-semibold">Productos</h2>
			</div>
			<div class="divide-y divide-white/4">
				{#each order.items as item}
					{@const lineImages = item.product?.images?.length
						? item.product.images.map((img) => img.url)
						: (item.imageUrls ?? [])}
					{@const lineName = item.product?.name ?? item.productNameSnapshot}
					<div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex gap-4">
							<button
								type="button"
								disabled={lineImages.length === 0}
								aria-label={lineImages.length > 0 ? `Ampliar imagen de ${lineName}` : undefined}
								onclick={() => (viewer = { urls: lineImages, index: 0, name: lineName })}
								class="bg-surface-2 h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl {lineImages.length >
								0
									? 'cursor-zoom-in'
									: ''}"
							>
								{#if item.product?.images?.[0]?.url}
									<img
										src={imageUrl(item.product.images[0].url, 'thumb')}
										alt={item.product.name}
										class="h-full w-full object-cover"
									/>
								{:else if item.imageUrls?.[0]}
									<img
										src={imageUrl(item.imageUrls[0], 'thumb')}
										alt={item.productNameSnapshot}
										class="h-full w-full object-cover"
									/>
								{:else}
									<div class="flex h-full w-full items-center justify-center">
										<Icon icon="mdi:tshirt-crew" class="text-text-muted/30 text-3xl" />
									</div>
								{/if}
							</button>
							<div class="flex flex-col justify-center">
								<h3 class="text-text-primary font-semibold">
									{item.product?.name ?? item.productNameSnapshot}
								</h3>
								{#if item.variant}
									<p class="text-text-muted text-sm">
										{item.variant.size} / {item.variant.color} / {item.variant.cut}
									</p>
								{:else if item.variantSizeSnapshot || item.variantColorSnapshot || item.variantCutSnapshot}
									<p class="text-text-muted text-sm">
										{item.variantSizeSnapshot ?? 'Único'} / {item.variantColorSnapshot ?? 'Único'} /
										{item.variantCutSnapshot ?? 'Recto'}
									</p>
								{/if}
							</div>
						</div>
						<div class="flex flex-col items-end gap-1 text-right sm:items-end">
							<p class="text-brand-400 font-semibold">
								{Number(item.unitPriceSnapshot).toFixed(2)} $
							</p>
							<p class="text-text-muted text-sm">Cant: {item.quantity}</p>
							<p class="text-text-primary font-medium">
								{(Number(item.unitPriceSnapshot) * item.quantity).toFixed(2)} $
							</p>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- Order Total -->
		<section class="glass rounded-2xl border border-white/4 p-6">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex flex-col gap-1">
					<div class="flex items-baseline gap-2">
						<span class="text-text-secondary">Total:</span>
						<span class="text-brand-400 text-2xl font-bold tabular-nums"
							>{totalValue.toFixed(2)} $</span
						>
					</div>
				</div>
				<a href="/" class="btn-primary w-full py-3 sm:w-auto">
					<Icon icon="mdi:store-outline" class="mr-2 text-lg" />
					Seguir comprando
				</a>
			</div>
		</section>
	</div>
	<ImageLightbox bind:viewer />
{:else}
	<div in:fade class="text-text-muted flex flex-col items-center justify-center py-20">
		<Icon icon="mdi:package-variant-closed" class="mb-4 text-6xl opacity-20" />
		<p class="text-lg">{data.message ?? 'Pedido no encontrado'}</p>
	</div>
{/if}
