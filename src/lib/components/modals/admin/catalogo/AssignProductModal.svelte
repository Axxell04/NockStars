<script lang="ts">
	import { enhance } from '$app/forms';
	import { fade, scale } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import ContainerModal from '../../ContainerModal.svelte';
	import { imageUrl } from '$lib/cloudinary';
	import { cancelFocus } from '$lib/focus';

	// One row of the candidate list: a product outside the target catalog,
	// tagged with the catalog it currently sits in (null = none). The
	// thumbnail/stock fields mirror what the product cards show so the admin
	// recognizes the product by sight, not just by name.
	interface AssignableProduct {
		id: string;
		name: string;
		price: number;
		stock: number;
		deactivatedAt: string | null;
		currentCatalogId: string | null;
		currentCatalogName: string | null;
		thumbnailUrl: string | null;
		variantStockTotal: number | null;
	}

	interface Props {
		catalogId: string;
		catalogName: string;
		isVisible: boolean;
		toggleModal: (visible?: boolean) => void;
		/** Refresh the product list after a successful assignment. */
		onAssigned: () => void;
	}

	let { catalogId, catalogName, isVisible, toggleModal, onAssigned }: Props = $props();

	let formMessage = $state('');
	let candidatesLoading = $state(false);
	let candidates: AssignableProduct[] = $state([]);
	let selectedIds: string[] = $state([]);

	function isSelected(id: string) {
		return selectedIds.includes(id);
	}

	function toggleProductToAssign(id: string) {
		selectedIds = isSelected(id)
			? selectedIds.filter((entry) => entry !== id)
			: [...selectedIds, id];
	}

	async function loadCandidates() {
		candidatesLoading = true;
		try {
			const response = await fetch(
				`/admin/catalogo/api/products/assignable?catalogId=${encodeURIComponent(catalogId)}`
			);
			if (response.ok) {
				const data = await response.json();
				candidates = data.products as AssignableProduct[];
			} else {
				formMessage = 'No se pudieron cargar los productos';
			}
		} catch {
			formMessage = 'No se pudieron cargar los productos';
		} finally {
			candidatesLoading = false;
		}
	}

	// Refetch on every open: the candidate list changes with each assignment,
	// so a stale list would offer products that are already in this catalog.
	$effect(() => {
		if (isVisible) {
			selectedIds = [];
			void loadCandidates();
		}
	});

	$effect(() => {
		if (formMessage) {
			const timeout = setTimeout(() => {
				formMessage = '';
			}, 5000);
			return () => clearTimeout(timeout);
		}
	});
</script>

{#if isVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal {toggleModal} cancelClick={true}>
			<form
				id="assign-product-to-catalog"
				action="?/assign_product_to_catalog"
				method="post"
				use:enhance={({ formElement }) => {
					return async ({ result }) => {
						if (result.type === 'failure' && result.data?.message) {
							formMessage = result.data.message as string;
						}
						if (result.type === 'success') {
							formElement.reset();
							toggleModal(false);
							onAssigned();
						}
					};
				}}
				class="modal-shell"
			>
				<input type="hidden" name="catalog_id" value={catalogId} />
				<input type="hidden" name="product_ids" value={JSON.stringify(selectedIds)} />

				<div class="modal-header">
					<h3 class="modal-title">Asignar productos</h3>
					<button
						type="button"
						class="modal-close"
						onclick={() => toggleModal(false)}
						onfocus={(e) => cancelFocus(e)}
						aria-label="Cerrar"
					>
						<Icon icon="material-symbols:close-rounded" class="text-xl" />
					</button>
				</div>

				<p class="text-text-muted text-sm">
					Productos de otros catálogos o sin catálogo. Al asignarlos, se mueven a
					<span class="text-text-primary font-semibold">{catalogName}</span>.
				</p>

				<div class="flex max-h-80 w-full flex-col gap-1.5 overflow-y-auto">
					{#if candidatesLoading}
						<p class="text-text-muted py-6 text-center text-sm">Cargando productos…</p>
					{:else if candidates.length === 0}
						<p class="text-text-muted py-6 text-center text-sm">
							No hay productos fuera de este catálogo
						</p>
					{:else}
						<ul class="flex flex-col gap-1.5">
							{#each candidates as candidate (candidate.id)}
								<li>
									<button
										type="button"
										class="flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors {isSelected(
											candidate.id
										)
											? 'border-brand-400/50 bg-brand-400/8'
											: 'border-white/4 hover:bg-white/4'}"
										onclick={() => toggleProductToAssign(candidate.id)}
										onfocus={(e) => cancelFocus(e)}
									>
										<!-- Thumbnail mirrors the product cards: primary image via the
										     thumb preset, placeholder icon when the product has none. -->
										<div class="bg-surface-2 h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
											{#if candidate.thumbnailUrl}
												<img
													src={imageUrl(candidate.thumbnailUrl, 'thumb')}
													alt={candidate.name}
													loading="lazy"
													class="h-full w-full object-cover"
												/>
											{:else}
												<div class="flex h-full w-full items-center justify-center">
													<Icon icon="mdi:tshirt-crew" class="text-text-muted/30 text-2xl" />
												</div>
											{/if}
										</div>

										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												<span class="text-text-primary truncate text-sm font-semibold">
													{candidate.name}
												</span>
												{#if candidate.deactivatedAt}
													<span
														class="shrink-0 rounded-full bg-red-500/85 px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-white uppercase"
													>
														Inactivo
													</span>
												{/if}
											</div>
											<div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
												<span class="text-brand-400 text-sm font-semibold tabular-nums">
													{candidate.price.toFixed(2)} $
												</span>
												<span class="text-text-muted text-xs tabular-nums">
													Stock: {candidate.variantStockTotal ?? candidate.stock}
												</span>
											</div>
										</div>

										<!-- Origin tag says what the move displaces; the check is the
										     selection state, which color alone would not convey. -->
										<div class="flex flex-shrink-0 flex-col items-end gap-1">
											<span
												class="text-text-muted max-w-28 truncate rounded-full bg-white/4 px-2 py-0.5 text-[0.65rem]"
											>
												{candidate.currentCatalogName ?? 'Sin catálogo'}
											</span>
											<span
												class="flex h-5 w-5 items-center justify-center rounded-full border transition-colors {isSelected(
													candidate.id
												)
													? 'border-brand-400 bg-brand-400 text-surface-0'
													: 'border-white/15 text-transparent'}"
											>
												<Icon icon="mdi:check-bold" class="text-xs" />
											</span>
										</div>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<div class="modal-actions">
					<button type="button" class="btn-secondary" onclick={() => toggleModal(false)}>
						Cancelar
					</button>
					{#if selectedIds.length > 0}
						<button type="submit" class="btn-primary">
							Asignar ({selectedIds.length})
						</button>
					{:else}
						<button type="submit" class="btn-primary" disabled>Asignar</button>
					{/if}
				</div>

				{#if formMessage}
					<div transition:scale>
						<p class="text-center text-red-400">
							{formMessage}
						</p>
					</div>
				{/if}
			</form>
		</ContainerModal>
	</div>
{/if}
