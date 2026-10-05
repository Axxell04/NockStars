<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { fade, scale, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { lineKey, setLineAmounts, toOrderLines, type OrderLine } from '$lib/order-content';
	import ContainerModal from '$lib/components/modals/ContainerModal.svelte';

	let { data }: PageProps = $props();

	// `data.order` is the live source: every successful mutation refreshes it
	// through `invalidateAll()`, so everything below derives from it. The only
	// local fork is `contentOverride`, which holds the edited content between
	// the optimistic update and the server round-trip.
	let order = $derived(data.order);
	let contentOverride: unknown = $state(undefined);
	let effectiveContent = $derived(contentOverride ?? order.content);
	let orderLines = $derived(toOrderLines(effectiveContent));
	// `$state.raw`, not `$state`: toOrderLines() returns a raw array, and a plain
	// `$state` would re-proxy it on every assignment so `previous !== orderLines`
	// could never become false — the auto-submit effect below would loop until
	// `effect_update_depth_exceeded`.
	let previousOrderLines = $state.raw<OrderLine[]>([]);
	let totalValue = $derived(orderLines.reduce((pv, cv) => pv + cv.amount * cv.unitPrice, 0));

	let selectedLine: OrderLine | undefined = $state();

	// Fullscreen image viewer (lightbox). `urls` holds every image of the
	// line (variant first, product fallback); an empty list never opens it.
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

	// HTML Elements
	let btnEditOrder: HTMLButtonElement | undefined = $state();
	let btnDeleteOrder: HTMLButtonElement | undefined = $state();

	// Visible Elements
	let confirmationDeleteIsVisible = $state(false);
	let confirmationEditIsVisible = $state(false);

	// Toggle Visible Elements
	function toggleConfirmationDeleteIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			confirmationDeleteIsVisible = visible;
		} else {
			confirmationDeleteIsVisible = !confirmationDeleteIsVisible;
		}
	}

	function toggleConfirmationEditIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			confirmationEditIsVisible = visible;
		} else {
			confirmationEditIsVisible = !confirmationEditIsVisible;
		}
	}

	// Seletion Functions
	function selectThisLine(line: OrderLine | undefined) {
		if (typeof line !== 'undefined') {
			selectedLine = { ...line };
		} else {
			selectedLine = undefined;
		}
	}

	function capitalize(value: string): string {
		return value.charAt(0).toUpperCase() + value.slice(1);
	}

	// Chips for a line's variant snapshots. Each chip pairs an icon with its
	// value; the color chip renders its swatch circle when the live variant
	// carries a valid hex, falling back to the palette glyph so the chip
	// never shows a wrong color. Empty when the line carries no variant
	// (legacy shape or variant-less product).
	interface LineChip {
		icon: string;
		label: string;
		title: string;
		hex: string | null;
	}

	function lineChips(line: OrderLine, colorHex: string | null): LineChip[] {
		const chips: LineChip[] = [];
		if (line.size)
			chips.push({ icon: 'mdi:ruler', label: line.size, title: `Talla ${line.size}`, hex: null });
		if (line.color)
			chips.push({
				icon: 'mdi:palette',
				label: line.color,
				title: `Color ${line.color}`,
				hex: colorHex
			});
		if (line.cut)
			chips.push({
				icon: 'mdi:scissors-cutting',
				label: capitalize(line.cut),
				title: `Corte ${capitalize(line.cut)}`,
				hex: null
			});
		return chips;
	}

	// Operation Functions
	function addSelectedLineAmount() {
		if (typeof selectedLine !== 'undefined') {
			selectedLine = {
				...selectedLine,
				amount: selectedLine.amount + 1
			};
		}
	}

	function subtractSelectedLineAmount() {
		if (typeof selectedLine !== 'undefined') {
			if (selectedLine.amount > 0) {
				selectedLine = {
					...selectedLine,
					amount: selectedLine.amount - 1
				};
			}
		}
	}

	// Request Functions
	function sendEditOrder() {
		if (typeof btnEditOrder !== 'undefined' && typeof selectedLine !== 'undefined') {
			let updatedLines = orderLines.map((line) => {
				if (selectedLine && lineKey(line) === lineKey(selectedLine)) {
					return { ...selectedLine };
				}
				return line;
			});

			if (
				updatedLines.length === 1 &&
				updatedLines[0].amount === 0 &&
				typeof btnDeleteOrder !== 'undefined'
			) {
				btnDeleteOrder.click();
			} else {
				previousOrderLines = [...orderLines];
				contentOverride = setLineAmounts(effectiveContent, updatedLines);
			}
		}
	}

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}

	$effect(() => {
		if (confirmationDeleteIsVisible) {
			toggleConfirmationEditIsVisible(false);
			selectThisLine(undefined);
		}
	});

	$effect(() => {
		if (confirmationEditIsVisible) {
			toggleConfirmationDeleteIsVisible(false);
		}
	});

	$effect(() => {
		if (!confirmationEditIsVisible && typeof selectedLine !== 'undefined') {
			selectThisLine(undefined);
		}
	});

	$effect(() => {
		if (previousOrderLines !== orderLines) {
			previousOrderLines = orderLines;
			if (confirmationEditIsVisible && typeof btnEditOrder !== 'undefined') {
				btnEditOrder.click();
			}
		}
	});
</script>

<div in:fade class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-5">
	<a
		href="/admin/pedidos"
		class="text-text-secondary hover:bg-surface-2 hover:text-text-primary self-start rounded-lg px-3 py-2 text-left transition-colors"
	>
		<Icon icon="mdi:arrow-left" class="mr-1 inline" />
		Volver a pedidos
	</a>

	<!-- Order summary -->
	<section class="card-thread rounded-2xl p-4 sm:p-6">
		<div class="flex flex-wrap place-content-between place-items-center gap-3">
			<div class="flex min-w-0 flex-row place-items-center gap-3">
				<Icon icon="akar-icons:shopping-bag" class="text-text-secondary flex-shrink-0 text-3xl" />
				<h1 class="text-text-primary truncate text-2xl font-bold">
					{order.clientName}
				</h1>
			</div>
			{#if order.completed}
				<span
					class="text-text-muted rounded-full border border-white/10 px-2.5 py-1 text-xs font-medium"
				>
					Completada
				</span>
			{:else}
				<span
					class="border-brand-400/30 bg-brand-400/10 text-brand-400 rounded-full border px-2.5 py-1 text-xs font-medium"
				>
					Pendiente
				</span>
			{/if}
		</div>
		<div class="text-text-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
			<span class="break-all">COD: {order.id}</span>
			<span>
				{order.createdAt.toLocaleDateString('es-EC', {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					hour: '2-digit',
					minute: '2-digit'
				})}
			</span>
		</div>
		<div
			class="mt-3 flex flex-row place-content-between place-items-center border-t border-white/5 pt-3"
		>
			<span class="text-text-secondary">Total</span>
			<span class="text-text-primary text-xl font-bold">$ {totalValue.toFixed(2)}</span>
		</div>
	</section>

	<!-- Order lines -->
	<section class="flex flex-col gap-2">
		{#each orderLines as line}
			{@const lineDisplay = data.display[lineKey(line)] ?? null}
			{@const imageUrls = lineDisplay?.imageUrls ?? []}
			{@const thumb = imageUrls[0] ?? null}
			<div
				class="flex min-w-0 flex-row gap-3 rounded-xl border px-2 py-2 transition-colors duration-150 {selectedLine &&
				lineKey(selectedLine) === lineKey(line)
					? 'border-brand-400/40 bg-brand-400/10'
					: 'bg-surface-1 border-white/5'} place-content-between place-items-center"
				onclick={() => {
					if (confirmationEditIsVisible) {
						selectThisLine(line);
					}
				}}
				role="button"
				tabindex="0"
				onkeydown={() => {}}
			>
				{#if thumb}
					<button
						type="button"
						aria-label="Ampliar imagen de {line.name}"
						onclick={(e) => {
							e.stopPropagation();
							openViewer(imageUrls, line.name);
						}}
						onfocus={(e) => cancelFocus(e)}
						class="h-16 w-16 shrink-0 self-start overflow-hidden rounded-lg border border-white/8 transition-transform duration-150 active:scale-95"
					>
						<img src={thumb} alt="" class="h-full w-full object-cover" loading="lazy" />
					</button>
				{/if}
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					<div class="flex w-full min-w-0 flex-row place-content-between place-items-center gap-2">
						<div class="flex min-w-0 flex-row place-items-center gap-2">
							<span class="text-text-primary truncate">
								{line.name}
							</span>
							<span class="text-text-secondary flex-shrink-0">
								({line.amount})
							</span>
						</div>
						<span class="text-text-primary flex-shrink-0 font-semibold">
							$ {(line.unitPrice * line.amount).toFixed(2)}
						</span>
					</div>
					{#if line.size ?? line.color ?? line.cut}
						<div class="flex w-full flex-wrap gap-1">
							{#each lineChips(line, lineDisplay?.colorHex ?? null) as chip}
								<span
									title={chip.title}
									class="text-text-secondary bg-surface-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-0.5 text-xs font-medium"
								>
									{#if chip.hex}
										<span
											aria-hidden="true"
											class="h-3.5 w-3.5 shrink-0 rounded-full border border-white/25"
											style="background-color: {chip.hex};"
										></span>
									{:else}
										<Icon icon={chip.icon} class="text-sm" aria-hidden="true" />
									{/if}
									{chip.label}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</section>

	<!-- Order management -->
	<section class="bg-surface-1 rounded-2xl border border-white/8 p-4">
		<form
			action=""
			method="post"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						if (confirmationDeleteIsVisible) {
							await goto('/admin/pedidos');
						} else {
							if (typeof contentOverride !== 'undefined') {
								contentOverride = undefined;
								toggleConfirmationEditIsVisible(false);
								selectThisLine(undefined);
							}
							await invalidateAll();
						}
					}
				};
			}}
			class="flex flex-col gap-3"
		>
			<input type="hidden" name="total_value" id="total_value" value={totalValue.toFixed(2)} />
			<input type="hidden" name="order_id" value={order.id} />
			{#if confirmationEditIsVisible}
				<input type="hidden" name="content" value={JSON.stringify(effectiveContent)} />
			{/if}

			<div class="flex flex-col gap-2 sm:flex-row">
				<button
					type="button"
					class="text-text-secondary hover:border-brand-400/30 hover:text-brand-400 flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium transition-[border-color,color,transform] duration-150 active:scale-[0.97] {confirmationDeleteIsVisible
						? 'border-brand-400/40 bg-brand-400/10 text-brand-400'
						: ''}"
					onclick={() => toggleConfirmationDeleteIsVisible(true)}
					onfocus={(e) => cancelFocus(e)}
				>
					<Icon icon="famicons:trash" class="text-lg" />
					Eliminar
				</button>
				<button
					type="button"
					class="text-text-secondary hover:border-brand-400/30 hover:text-brand-400 flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium transition-[border-color,color,transform] duration-150 active:scale-[0.97] {confirmationEditIsVisible
						? 'border-brand-400/40 bg-brand-400/10 text-brand-400'
						: ''}"
					onclick={() => toggleConfirmationEditIsVisible(true)}
					onfocus={(e) => cancelFocus(e)}
				>
					<Icon icon="mdi:edit-outline" class="text-lg" />
					Editar cantidades
				</button>
				<button
					formaction="?/update_order_state"
					class="text-text-secondary hover:border-brand-400/30 hover:text-brand-400 flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium transition-[border-color,color,transform] duration-150 active:scale-[0.97]"
					onfocus={(e) => cancelFocus(e)}
				>
					{#if order.completed}
						<Icon icon="solar:cart-cross-bold" class="text-lg" />
						Marcar pendiente
					{:else}
						<Icon icon="solar:cart-check-bold" class="text-lg" />
						Marcar completado
					{/if}
				</button>
			</div>

			{#if confirmationDeleteIsVisible}
				<div
					transition:scale={{ duration: 200, easing: cubicOut }}
					class="bg-surface-2/60 flex flex-row place-content-between gap-2 rounded-xl p-1.5"
				>
					<button
						type="button"
						class="text-text-secondary hover:bg-surface-2 hover:text-text-primary grow rounded-lg px-2 py-1.5 text-sm transition-[background-color,color,transform] duration-150 active:scale-95"
						onclick={() => toggleConfirmationDeleteIsVisible(false)}
						onfocus={(e) => cancelFocus(e)}
					>
						Cancelar
					</button>
					<button
						formaction="?/delete_order"
						class="grow rounded-lg bg-red-500 p-1.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-red-600 active:scale-95"
						onfocus={(e) => cancelFocus(e)}
					>
						Confirmar eliminación
					</button>
				</div>
			{:else if confirmationEditIsVisible}
				<div
					transition:scale={{ duration: 200, easing: cubicOut }}
					class="bg-surface-2/60 flex flex-row place-content-between gap-2 rounded-xl p-1.5"
				>
					<button
						type="button"
						class="text-text-secondary hover:bg-surface-2 hover:text-text-primary grow rounded-lg px-2 py-1.5 text-sm transition-[background-color,color,transform] duration-150 active:scale-95"
						onclick={() => toggleConfirmationEditIsVisible(false)}
						onfocus={(e) => cancelFocus(e)}
					>
						Cancelar
					</button>
					<button
						type="button"
						class="grow rounded-lg bg-red-500 p-1.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-red-600 active:scale-95"
						onclick={() => sendEditOrder()}
						onfocus={(e) => cancelFocus(e)}
					>
						Confirmar
					</button>
				</div>
			{/if}

			{#if confirmationEditIsVisible && selectedLine}
				<div
					transition:slide={{ duration: 200, easing: cubicOut }}
					class="bg-surface-2/40 flex flex-col place-items-center gap-2 rounded-xl border border-white/8 p-3"
				>
					<span class="text-text-primary text-sm font-semibold">
						{selectedLine.name}
					</span>
					{#if selectedLine.size ?? selectedLine.color ?? selectedLine.cut}
						<div class="flex flex-wrap justify-center gap-1">
							{#each lineChips(selectedLine, data.display[lineKey(selectedLine)]?.colorHex ?? null) as chip}
								<span
									class="bg-surface-0/60 text-text-secondary rounded-md border border-white/8 px-1.5 py-px text-xs"
								>
									{chip.label}
								</span>
							{/each}
						</div>
					{/if}
					<div class="flex flex-row place-items-center gap-3">
						<button
							type="button"
							class="text-text-secondary hover:border-brand-400/30 hover:text-brand-400 rounded-full border border-white/10 p-1.5 transition-[border-color,color,transform] duration-150 active:scale-90"
							onclick={() => subtractSelectedLineAmount()}
							onfocus={(e) => cancelFocus(e)}
							aria-label="Reducir cantidad"
						>
							<Icon icon="octicon:dash-16" />
						</button>
						<span class="text-text-primary min-w-6 text-center text-lg font-semibold tabular-nums">
							{selectedLine.amount}
						</span>
						<button
							type="button"
							class="text-text-secondary hover:border-brand-400/30 hover:text-brand-400 rounded-full border border-white/10 p-1.5 transition-[border-color,color,transform] duration-150 active:scale-90"
							onclick={() => addSelectedLineAmount()}
							onfocus={(e) => cancelFocus(e)}
							aria-label="Aumentar cantidad"
						>
							<Icon icon="ic:round-plus" />
						</button>
					</div>
				</div>
			{/if}

			<button bind:this={btnDeleteOrder} type="submit" formaction="?/delete_order" class="hidden">
				Delete Order
			</button>
			<button bind:this={btnEditOrder} type="submit" formaction="?/edit_order" class="hidden">
				Edit Order
			</button>
		</form>
	</section>

	{#if viewer}
		<ContainerModal toggleModal={() => (viewer = null)} maxWidth="max-w-3xl">
			<figure class="relative">
				<img
					src={viewer.urls[viewer.index]}
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
</div>
