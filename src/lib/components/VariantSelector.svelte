<script lang="ts">
	import { page } from '$app/state';
	import { resolveVariant, getVariantDisplayName, isVariantAvailable } from '$lib/variant';
	import type { VariantComplete, ProductWithVariants } from '$lib/actions';
	import Icon from '@iconify/svelte';
	import { tick } from 'svelte';

	interface Props {
		variants: VariantComplete[];
		implicitVariant: VariantComplete;
		product: ProductWithVariants;
		selectedVariantId?: string;
		onSelect: (variantId: string) => void;
	}

	let { variants, product, selectedVariantId, onSelect }: Props = $props();

	// Reactive state for size/color/cut selection
	let selectedSize = $state<string>('');
	let selectedColor = $state<string>('');
	let selectedCut: 'oversize' | 'recto' = $state('recto');

	// Derived: unique sizes from available variants
	const availableSizes = $derived(
		[...new Set(variants.filter((v) => isVariantAvailable(v, product)).map((v) => v.size))].sort()
	);

	// Derived: unique colors from available variants (filtered by selected size if any)
	const availableColors = $derived(
		variants
			.filter((v) => isVariantAvailable(v, product) && (!selectedSize || v.size === selectedSize))
			.map((v) => v.color)
	);

	// Derived: unique cuts from available variants (filtered by size/color if selected)
	const availableCuts = $derived(
		[
			...new Set(
				variants
					.filter(
						(v) =>
							isVariantAvailable(v, product) &&
							(!selectedSize || v.size === selectedSize) &&
							(!selectedColor || v.color === selectedColor)
					)
					.map((v) => v.cut)
			)
		].sort()
	);

	// Derived: matching variant when all three are selected
	const matchedVariant = $derived(
		selectedSize && selectedColor && selectedCut
			? resolveVariant(variants, selectedSize, selectedColor, selectedCut)
			: null
	);

	// Derived: check if a size is available with any color/cut combination
	function isSizeAvailable(size: string): boolean {
		return variants.some((v) => v.size === size && isVariantAvailable(v, product));
	}

	// Derived: check if a color is available with selected size (or any size if none selected)
	function isColorAvailable(color: string): boolean {
		return variants.some(
			(v) =>
				v.color === color &&
				isVariantAvailable(v, product) &&
				(!selectedSize || v.size === selectedSize)
		);
	}

	// Derived: check if a cut is available with selected size/color
	function isCutAvailable(cut: 'oversize' | 'recto'): boolean {
		return variants.some(
			(v) =>
				v.cut === cut &&
				isVariantAvailable(v, product) &&
				(!selectedSize || v.size === selectedSize) &&
				(!selectedColor || v.color === selectedColor)
		);
	}

	// Handle size selection
	function handleSizeSelect(size: string) {
		selectedSize = size;
		// Reset color/cut if they're no longer valid with new size
		if (!isColorAvailable(selectedColor)) {
			selectedColor = '';
		}
		if (!isCutAvailable(selectedCut)) {
			selectedCut = 'recto';
		}
		// Check if we have a complete match
		if (matchedVariant) {
			onSelect(matchedVariant.id);
			syncUrl(matchedVariant.id);
		}
	}

	// Handle color selection
	function handleColorSelect(color: string) {
		selectedColor = color;
		if (!isCutAvailable(selectedCut)) {
			selectedCut = 'recto';
		}
		if (matchedVariant) {
			onSelect(matchedVariant.id);
			syncUrl(matchedVariant.id);
		}
	}

	// Handle cut selection
	function handleCutSelect(cut: 'oversize' | 'recto') {
		selectedCut = cut;
		if (matchedVariant) {
			onSelect(matchedVariant.id);
			syncUrl(matchedVariant.id);
		}
	}

	// Sync URL with variant selection
	function syncUrl(variantId: string) {
		const url = new URL(page.url);
		url.searchParams.set('variant', variantId);
		history.replaceState(null, '', url.toString());
	}

	// Initialize from selectedVariantId prop
	$effect(() => {
		if (selectedVariantId && selectedVariantId !== 'implicit') {
			const variant = variants.find((v) => v.id === selectedVariantId);
			if (variant) {
				selectedSize = variant.size;
				selectedColor = variant.color;
				selectedCut = variant.cut;
			}
		} else {
			selectedSize = '';
			selectedColor = '';
			selectedCut = 'recto';
		}
	});

	// Keyboard navigation helpers
	function handleKeydown(
		e: KeyboardEvent,
		options: string[],
		selected: string,
		onSelect: (value: string) => void,
		disabledCheck: (value: string) => boolean
	) {
		const enabledOptions = options.filter((opt) => !disabledCheck(opt));
		if (enabledOptions.length === 0) return;

		const currentIndex = enabledOptions.indexOf(selected);
		let newIndex = currentIndex;

		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowDown':
				e.preventDefault();
				newIndex = (currentIndex + 1) % enabledOptions.length;
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
				e.preventDefault();
				newIndex = (currentIndex - 1 + enabledOptions.length) % enabledOptions.length;
				break;
			case 'Home':
				e.preventDefault();
				newIndex = 0;
				break;
			case 'End':
				e.preventDefault();
				newIndex = enabledOptions.length - 1;
				break;
			case 'Enter':
			case ' ':
				e.preventDefault();
				if (currentIndex >= 0 && selected) {
					onSelect(selected);
				}
				break;
		}

		if (newIndex !== currentIndex) {
			onSelect(enabledOptions[newIndex]);
			// Focus the newly selected option
			tick().then(() => {
				const buttons = document.querySelectorAll<HTMLButtonElement>(
					`[data-option-value="${enabledOptions[newIndex]}"]`
				);
				buttons.forEach((btn) => btn.focus());
			});
		}
	}
</script>

{#if variants.length === 0}
	<!-- Implicit variant only - single "Único" option -->
	<div class="flex flex-col gap-3" role="radiogroup" aria-label="Variante del producto">
		<div class="text-text-secondary text-sm font-medium">Variante</div>
		<div
			class="glass flex items-center gap-3 rounded-xl border border-white/4 p-3"
			role="radio"
			aria-checked="true"
			aria-disabled="false"
			tabindex="0"
		>
			<Icon icon="mdi:tshirt-crew" class="text-brand-400 text-xl" />
			<div>
				<p class="text-text-primary font-medium">Único</p>
				<p class="text-text-muted text-xs">Variante base del producto</p>
			</div>
			<Icon icon="mdi:check-circle" class="text-brand-400 text-xl" />
		</div>
	</div>
{:else}
	<!-- Explicit variants - size/color/cut selection -->
	<div class="flex flex-col gap-4" role="radiogroup" aria-label="Seleccionar variante">
		<!-- Size Selection -->
		{#if availableSizes.length > 0}
			<fieldset class="flex flex-col gap-2">
				<legend class="text-text-secondary text-sm font-medium">Talla</legend>
				<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Seleccionar talla">
					{#each availableSizes as size}
						<button
							type="button"
							class="chip {selectedSize === size
								? 'chip-selected border-brand-400 bg-brand-400/10 text-brand-400'
								: 'chip-unselected hover:bg-surface-2 border-white/4 hover:border-white/8'} {!isSizeAvailable(
								size
							)
								? 'cursor-not-allowed opacity-40'
								: ''}"
							role="radio"
							aria-checked={selectedSize === size}
							aria-disabled={!isSizeAvailable(size)}
							aria-label={`Talla ${size}`}
							data-option-value={size}
							onclick={() => isSizeAvailable(size) && handleSizeSelect(size)}
							onkeydown={(e) =>
								handleKeydown(
									e,
									availableSizes,
									selectedSize,
									handleSizeSelect,
									(s) => !isSizeAvailable(s)
								)}
							disabled={!isSizeAvailable(size)}
							tabindex={selectedSize === size ? 0 : -1}
						>
							{size}
							{#if !isSizeAvailable(size)}
								<span class="ml-1 text-xs" aria-hidden="true">⚠</span>
							{/if}
						</button>
					{/each}
				</div>
			</fieldset>
		{/if}

		<!-- Color Selection -->
		{#if availableColors.length > 0}
			<fieldset class="flex flex-col gap-2">
				<legend class="text-text-secondary text-sm font-medium">Color</legend>
				<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Seleccionar color">
					{#each availableColors as color}
						<button
							type="button"
							class="swatch {selectedColor === color
								? 'swatch-selected ring-brand-400 ring-offset-surface-0 ring-2 ring-offset-2'
								: 'swatch-unselected border-white/4 hover:border-white/8'} {!isColorAvailable(color)
								? 'cursor-not-allowed opacity-40'
								: ''}"
							role="radio"
							aria-checked={selectedColor === color}
							aria-disabled={!isColorAvailable(color)}
							aria-label={`Color ${color}`}
							data-option-value={color}
							onclick={() => isColorAvailable(color) && handleColorSelect(color)}
							onkeydown={(e) =>
								handleKeydown(
									e,
									availableColors,
									selectedColor,
									handleColorSelect,
									(c) => !isColorAvailable(c)
								)}
							disabled={!isColorAvailable(color)}
							tabindex={selectedColor === color ? 0 : -1}
							style="background-color: {color};"
						>
							{#if selectedColor === color}
								<Icon icon="mdi:check" class="text-surface-0 text-sm" aria-hidden="true" />
							{/if}
							{#if !isColorAvailable(color)}
								<Icon icon="mdi:cancel" class="text-text-error text-sm" aria-hidden="true" />
							{/if}
						</button>
					{/each}
				</div>
			</fieldset>
		{/if}

		<!-- Cut Selection (read-only badge when determined) -->
		{#if availableCuts.length > 0 && selectedSize && selectedColor}
			<div class="glass flex items-center gap-3 rounded-xl border border-white/4 p-3">
				<Icon icon="mdi:scissors-cutting" class="text-brand-400 text-xl" />
				<div class="flex-1">
					<p class="text-text-secondary text-sm font-medium">Corte</p>
					<p class="text-text-primary font-medium capitalize">
						{availableCuts.length === 1 ? availableCuts[0] : `${availableCuts.join(' / ')} (auto)`}
					</p>
				</div>
				{#if availableCuts.length > 1}
					<select
						bind:value={selectedCut}
						onchange={(e) => handleCutSelect(e.currentTarget.value as 'oversize' | 'recto')}
						class="bg-surface-2 text-text-primary focus:border-brand-400 rounded-lg border-white/4 px-3 py-1.5 text-sm focus:outline-none"
						aria-label="Seleccionar corte"
					>
						{#each availableCuts as cut}
							<option value={cut}>{cut}</option>
						{/each}
					</select>
				{/if}
			</div>
		{/if}

		<!-- Selected Variant Summary -->
		{#if matchedVariant}
			<div
				class="glass border-brand-400/30 bg-brand-400/5 flex items-center gap-3 rounded-xl border p-3"
			>
				<Icon icon="mdi:check-circle" class="text-brand-400 text-xl" />
				<div class="min-w-0 flex-1">
					<p class="text-text-primary font-medium">Variante seleccionada</p>
					<p class="text-text-secondary text-sm">{getVariantDisplayName(matchedVariant)}</p>
					<p class="text-brand-400 text-sm font-bold tabular-nums">
						{matchedVariant.priceOverride !== null && matchedVariant.priceOverride !== undefined
							? Number(matchedVariant.priceOverride).toFixed(2)
							: product.price.toFixed(2)} $
					</p>
				</div>
			</div>
		{:else if selectedSize || selectedColor}
			<div
				class="glass bg-surface-2/50 flex items-center gap-3 rounded-xl border border-white/4 p-3"
			>
				<Icon icon="mdi:information-outline" class="text-text-muted text-xl" />
				<div class="min-w-0 flex-1">
					<p class="text-text-secondary text-sm font-medium">Selecciona todas las opciones</p>
					<p class="text-text-muted text-xs">
						{!selectedSize ? 'Falta talla' : ''}
						{selectedSize && !selectedColor ? 'Falta color' : ''}
						{selectedSize && selectedColor && availableCuts.length === 0
							? 'Sin stock para esta combinación'
							: ''}
					</p>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.chip {
		border-radius: 9999px;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
		border: 1px solid rgba(255, 255, 255, 0.1);
		outline: none;
	}

	.chip:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 2px var(--color-brand-400),
			0 0 0 4px var(--color-surface-0);
	}

	.chip-selected {
		border-width: 2px;
		border-color: var(--color-brand-400);
		background-color: rgba(248, 113, 113, 0.1);
		color: var(--color-brand-400);
	}

	.chip-unselected {
		border-width: 1px;
	}

	.chip-unselected:hover {
		background-color: var(--color-surface-2);
		border-color: rgba(255, 255, 255, 0.2);
	}

	.swatch {
		display: flex;
		width: 2.5rem;
		height: 2.5rem;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		border-width: 2px;
		transition: all 0.2s ease;
		outline: none;
	}

	.swatch:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 2px var(--color-brand-400),
			0 0 0 4px var(--color-surface-0);
	}

	.swatch-selected {
		transform: scale(1.1);
		box-shadow:
			0 0 0 2px var(--color-brand-400),
			0 0 0 4px var(--color-surface-0);
	}

	.swatch-unselected {
		border-color: rgba(255, 255, 255, 0.1);
	}

	.swatch-unselected:hover {
		border-color: rgba(255, 255, 255, 0.2);
	}

	/* Focus visible for all interactive elements */
	button:focus-visible,
	select:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 2px var(--color-brand-400),
			0 0 0 4px var(--color-surface-0);
	}

	/* Disabled state styling */
	button:disabled,
	button[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.4;
	}

	/* Tooltip for out of stock */
	button[aria-disabled='true']:hover::after {
		content: 'Agotado';
		background-color: var(--color-surface-0);
		color: var(--color-text-primary);
		box-shadow: var(--shadow-depth);
		position: absolute;
		bottom: 100%;
		left: 50%;
		z-index: 10;
		margin-bottom: 0.5rem;
		transform: translateX(-50%);
		border-radius: 0.25rem;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		white-space: nowrap;
	}

	button[aria-disabled='true']:hover::before {
		content: '';
		border-top-color: var(--color-surface-0);
		position: absolute;
		bottom: 100%;
		left: 50%;
		z-index: 10;
		margin-bottom: 0.125rem;
		transform: translateX(-50%);
		border-width: 0.25rem;
		border-style: solid;
		border-color: transparent;
		border-bottom-width: 0;
	}
</style>
