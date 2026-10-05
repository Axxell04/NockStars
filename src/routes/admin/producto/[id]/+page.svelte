<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '@iconify/svelte';
	import { fade } from 'svelte/transition';
	import ContainerModal from '$lib/components/modals/ContainerModal.svelte';
	import {
		MAX_SPEC_KEY_LENGTH,
		MAX_SPEC_ROWS,
		MAX_SPEC_VALUE_LENGTH,
		SPEC_LABELS,
		toSpecRows,
		type ProductSpecs
	} from '$lib/product-specs';
	import { totalStock } from '$lib/variant';
	import { variantManagerUrl } from '$lib/admin-links';

	interface ProductData {
		id: string;
		name: string;
		price: number;
		stock: number;
		description: string | null;
		specs: ProductSpecs;
		createdAt: Date;
		productImages: Array<{ id: string; url: string }>;
		variants: Array<{
			id: string;
			size: string;
			color: string;
			cut: 'oversize' | 'recto';
			description: string | null;
			stock: number;
			priceOverride: number | null;
			sortOrder: number;
			images: Array<{ id: string; url: string; alt: string | null; sortOrder: number }>;
		}>;
		implicitVariant: {
			id: string;
			size: string;
			color: string;
			cut: 'oversize' | 'recto';
			description: string | null;
			stock: number;
			priceOverride: number | null;
			sortOrder: number;
			images: [];
		};
	}

	let { data }: { data: { product: ProductData } } = $props();

	let formMessage = $state('');

	function resolveReturnTarget(defaultTarget = '/admin/catalogo') {
		const queryTarget = page.url.searchParams.get('returnTo');
		if (queryTarget) return queryTarget;

		if (typeof document !== 'undefined' && document.referrer) {
			try {
				const referrerUrl = new URL(document.referrer);
				if (referrerUrl.origin === page.url.origin) {
					if (referrerUrl.pathname.startsWith('/producto/')) {
						return referrerUrl.pathname + referrerUrl.search;
					}
				}
			} catch {
				// Fall back to the catalog route when the referrer is invalid.
			}
		}

		return defaultTarget;
	}

	function goBack() {
		goto(resolveReturnTarget());
	}

	// Form fields
	let name = $state(data.product.name);
	let price = $state(data.product.price.toString());
	let stock = $state(data.product.stock.toString());
	let description = $state(data.product.description || '');

	type SpecRow = { id: string; key: string; value: string };

	// Seeded once from the stored sheet, the same way the rest of the form is
	// seeded. Keys carry stable ids so removing a row cannot shift another row's
	// DOM node out from under its input.
	let specRows = $state<SpecRow[]>(seedSpecRows(data.product.specs));

	function createSpecRow(key = '', value = ''): SpecRow {
		return { id: crypto.randomUUID(), key, value };
	}

	function seedSpecRows(specs: ProductSpecs | null | undefined): SpecRow[] {
		const stored = toSpecRows(specs);
		return stored.length > 0
			? stored.map(({ key, value }) => createSpecRow(key, value))
			: [createSpecRow()];
	}

	function addSpecRow() {
		if (specRows.length >= MAX_SPEC_ROWS) return;
		specRows = [...specRows, createSpecRow()];
	}

	function removeSpecRow(id: string) {
		specRows = specRows.filter((row) => row.id !== id);
	}

	let savingProduct = $state(false);
	let uploadingImages = $state(false);
	let imageFiles: File[] = $state([]);
	let inputImages: HTMLInputElement | undefined = $state();

	// Delete modal
	let deleteProductModalIsVisible = $state(false);
	function toggleDeleteProductModalIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			deleteProductModalIsVisible = visible;
		} else {
			deleteProductModalIsVisible = !deleteProductModalIsVisible;
		}
	}

	async function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const files = target.files;
		if (!files || !files.length) return;
		imageFiles = Array.from(files);
	}

	async function uploadToCloudinary(file: File): Promise<string> {
		const sigRes = await fetch('/api/cloudinary/signature');
		if (!sigRes.ok) throw new Error('Failed to get upload signature');
		const sig = await sigRes.json();

		const formData = new FormData();
		formData.append('file', file);
		formData.append('api_key', sig.api_key);
		formData.append('timestamp', sig.timestamp);
		formData.append('folder', sig.folder);
		formData.append('signature', sig.signature);

		const uploadRes = await fetch(
			`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
			{ method: 'POST', body: formData }
		);
		if (!uploadRes.ok) throw new Error('Cloudinary upload failed');
		const data = await uploadRes.json();
		return data.secure_url;
	}

	async function uploadImages() {
		if (!imageFiles.length) return;
		uploadingImages = true;
		formMessage = '';

		try {
			const imageUrls: string[] = [];
			for (const file of imageFiles) {
				imageUrls.push(await uploadToCloudinary(file));
			}

			const formData = new FormData();
			formData.append('imageUrls', JSON.stringify(imageUrls));
			const res = await fetch(`/admin/producto/${data.product.id}?/uploadImage`, {
				method: 'POST',
				body: formData
			});
			const payload = await res.json();
			const result = payload?.data ?? payload;
			if (!res.ok || (payload?.type !== 'success' && !result?.success)) {
				formMessage = result?.message || payload?.message || 'Error al subir imagen';
				return;
			}
			formMessage = 'Imágenes subidas correctamente';
			await invalidateAll();
		} catch {
			formMessage = 'Error al subir imágenes';
		} finally {
			uploadingImages = false;
			imageFiles = [];
			if (inputImages) inputImages.value = '';
		}
	}

	async function deleteImage(imageId: string) {
		if (!confirm('¿Eliminar esta imagen?')) return;

		const formData = new FormData();
		formData.append('imageId', imageId);
		const res = await fetch(`/admin/producto/${data.product.id}?/deleteImage`, {
			method: 'POST',
			body: formData
		});
		const payload = await res.json();
		const result = payload?.data ?? payload ?? {};
		if (res.ok && (payload?.type === 'success' || result?.success)) {
			await invalidateAll();
		} else {
			formMessage = result?.message || payload?.message || 'Error al eliminar imagen';
		}
	}

	async function saveProduct() {
		if (savingProduct) return;
		savingProduct = true;
		formMessage = '';
		const formData = new FormData();
		formData.append('name', name);
		formData.append('price', parseFloat(price).toString());
		formData.append('stock', parseInt(stock).toString());
		formData.append('description', description);
		for (const row of specRows) {
			formData.append('specKey', row.key);
			formData.append('specValue', row.value);
		}

		try {
			const res = await fetch(`/admin/producto/${data.product.id}?/updateProduct`, {
				method: 'POST',
				body: formData
			});
			const payload = await res.json();
			const result = payload?.data ?? payload;
			if (res.ok && (payload?.type === 'success' || result?.success)) {
				const returnTarget = resolveReturnTarget();
				formMessage = 'Producto actualizado correctamente';
				setTimeout(() => {
					goto(returnTarget);
				}, 450);
			} else {
				formMessage = result?.message || payload?.message || 'Error al actualizar';
			}
		} catch {
			formMessage = 'Error al actualizar';
		} finally {
			savingProduct = false;
		}
	}

	async function deleteProduct() {
		const formData = new FormData();
		const res = await fetch(`/admin/producto/${data.product.id}?/deleteProduct`, {
			method: 'POST',
			body: formData
		});
		const payload = await res.json();
		const result = payload?.data ?? payload ?? {};
		if (res.ok && (payload?.type === 'success' || result?.success)) {
			goto('/admin');
		} else {
			formMessage = result?.message || payload?.message || 'Error al eliminar producto';
		}
		toggleDeleteProductModalIsVisible(false);
	}

	function goToVariants() {
		goto(variantManagerUrl(data.product.id));
	}
</script>

<div class="mx-auto flex max-w-6xl gap-6 px-4 py-6">
	<!-- Sidebar Navigation -->
	<aside class="hidden w-48 flex-shrink-0 lg:block">
		<nav class="flex flex-col gap-2">
			<button
				type="button"
				onclick={goBack}
				class="text-text-secondary hover:bg-surface-2 hover:text-text-primary rounded-lg px-3 py-2 text-left transition-colors"
			>
				<Icon icon="mdi:arrow-left" class="mr-1 inline" />
				{resolveReturnTarget().startsWith('/producto/')
					? 'Volver al producto'
					: 'Volver al catálogo'}
			</button>
			<div class="my-2 border-t border-white/10"></div>
			<button
				onclick={goToVariants}
				class="text-brand-400 bg-brand-400/10 rounded-lg px-3 py-2 text-left font-medium"
			>
				<Icon icon="mdi:cube-outline" class="mr-1 inline" />
				Gestionar variantes
			</button>
		</nav>
	</aside>

	<!-- Main Content -->
	<main class="flex-1">
		<!-- Header -->
		<header class="mb-6 flex items-center justify-between gap-4">
			<div>
				<h1 class="text-text-primary text-2xl font-bold">Editar producto</h1>
				<p class="text-text-secondary text-sm">ID: {data.product.id}</p>
			</div>
			<button
				type="button"
				onclick={goBack}
				class="text-text-secondary hover:bg-surface-2 hover:text-text-primary rounded-lg border border-white/10 px-4 py-2 transition-colors"
			>
				<Icon icon="mdi:arrow-left" class="mr-1 inline" />
				Regresar
			</button>
		</header>

		<!-- Form Sections -->
		<div class="grid gap-6 lg:grid-cols-3">
			<!-- Left: Basic Info -->
			<section class="space-y-6 lg:col-span-2">
				<!-- Basic Fields -->
				<fieldset class="bg-surface-1 space-y-4 rounded-xl border border-white/10 p-6">
					<legend class="text-text-primary mb-4 text-lg font-semibold">Información básica</legend>

					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label for="name" class="text-text-secondary block text-sm font-medium"
								>Nombre *</label
							>
							<input
								type="text"
								id="name"
								bind:value={name}
								required
								class="bg-surface-2 text-text-primary placeholder:text-text-muted/50 focus:border-brand-400 w-full rounded-lg border border-white/10 px-3 py-2 transition-colors focus:outline-none"
								placeholder="Nombre del producto"
							/>
						</div>
						<div class="space-y-1">
							<label for="price" class="text-text-secondary block text-sm font-medium"
								>Precio *</label
							>
							<input
								type="number"
								id="price"
								bind:value={price}
								required
								step="0.01"
								min="0"
								class="bg-surface-2 text-text-primary focus:border-brand-400 w-full rounded-lg border border-white/10 px-3 py-2 transition-colors focus:outline-none"
								placeholder="0.00"
							/>
						</div>
						<div class="space-y-1">
							{#if data.product.variants.length > 0}
								<div
									class="text-text-secondary bg-surface-2 rounded-lg border border-white/10 px-3 py-2 text-sm"
								>
									Stock total de variantes
									<span class="text-text-primary ml-1 font-semibold tabular-nums">
										{totalStock(data.product.stock, data.product.variants)}
									</span>
								</div>
							{/if}
							<label for="stock" class="text-text-secondary block text-sm font-medium"
								>Stock base *</label
							>
							<input
								type="number"
								id="stock"
								bind:value={stock}
								required
								min="0"
								class="bg-surface-2 text-text-primary focus:border-brand-400 w-full rounded-lg border border-white/10 px-3 py-2 transition-colors focus:outline-none"
								placeholder="0"
							/>
						</div>
					</div>

					<div class="space-y-1">
						<label for="description" class="text-text-secondary block text-sm font-medium"
							>Descripción</label
						>
						<textarea
							id="description"
							bind:value={description}
							rows={4}
							class="bg-surface-2 text-text-primary placeholder:text-text-muted/50 focus:border-brand-400 w-full resize-none rounded-lg border border-white/10 px-3 py-2 transition-colors focus:outline-none"
							placeholder="Descripción del producto (materiales, cuidados, etc.)"
						></textarea>
					</div>
				</fieldset>

				<!-- Ficha Técnica -->
				<fieldset class="bg-surface-1 space-y-4 rounded-xl border border-white/10 p-6">
					<legend class="text-text-primary mb-4 text-lg font-semibold">Ficha técnica</legend>
					<p class="text-text-secondary text-sm">
						Atributos libres del producto. Se muestran en la ficha técnica de su página y en los
						datos estructurados. Los nombres sugeridos son solo una ayuda: puedes escribir los que
						quieras.
					</p>

					<datalist id="spec-key-options">
						{#each Object.keys(SPEC_LABELS) as specKey (specKey)}
							<option value={specKey}>{SPEC_LABELS[specKey]}</option>
						{/each}
					</datalist>

					<div class="space-y-3">
						{#each specRows as row, index (row.id)}
							<div class="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
								<div class="space-y-1">
									<label
										for="specKey-{row.id}"
										class="text-text-secondary block text-sm font-medium">Atributo</label
									>
									<input
										type="text"
										id="specKey-{row.id}"
										list="spec-key-options"
										bind:value={row.key}
										maxlength={MAX_SPEC_KEY_LENGTH}
										class="bg-surface-2 text-text-primary placeholder:text-text-muted/50 focus:border-brand-400 w-full rounded-lg border border-white/10 px-3 py-2 transition-colors focus:outline-none"
										placeholder="material"
									/>
								</div>
								<div class="space-y-1">
									<label
										for="specValue-{row.id}"
										class="text-text-secondary block text-sm font-medium">Valor</label
									>
									<input
										type="text"
										id="specValue-{row.id}"
										bind:value={row.value}
										maxlength={MAX_SPEC_VALUE_LENGTH}
										class="bg-surface-2 text-text-primary placeholder:text-text-muted/50 focus:border-brand-400 w-full rounded-lg border border-white/10 px-3 py-2 transition-colors focus:outline-none"
										placeholder="Algodón peinado"
									/>
								</div>
								<button
									type="button"
									onclick={() => removeSpecRow(row.id)}
									class="text-text-secondary hover:bg-surface-2 hover:text-text-primary flex h-[42px] items-center justify-center rounded-lg border border-white/10 px-3 transition-colors"
									aria-label="Eliminar atributo {index + 1}"
								>
									<Icon icon="mdi:delete-outline" class="text-lg" />
								</button>
							</div>
						{/each}
					</div>

					<button
						type="button"
						onclick={addSpecRow}
						disabled={specRows.length >= MAX_SPEC_ROWS}
						class="text-text-secondary hover:bg-surface-2 hover:text-text-primary rounded-lg border border-white/10 px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Icon icon="mdi:plus" class="mr-1 inline" />
						Añadir atributo
					</button>
				</fieldset>

				<!-- Product Images -->
				<fieldset class="bg-surface-1 space-y-4 rounded-xl border border-white/10 p-6">
					<legend class="text-text-primary mb-4 text-lg font-semibold">Imágenes del producto</legend
					>
					<div class="flex items-center justify-between">
						<label class="cursor-pointer">
							<input
								type="file"
								id="image-upload"
								accept="image/*"
								multiple
								class="hidden"
								onchange={handleFileChange}
								bind:this={inputImages}
							/>
							<button
								type="button"
								class="bg-brand-400 hover:bg-brand-300 flex items-center gap-2 rounded-lg px-4 py-2 text-white transition-colors"
								onclick={() => inputImages?.click()}
								disabled={uploadingImages}
							>
								<Icon icon="mdi:cloud-upload" class="text-lg" />
								{uploadingImages ? 'Subiendo...' : 'Subir imágenes'}
							</button>
						</label>
						{#if imageFiles.length > 0}
							<button
								type="button"
								class="bg-brand-400 hover:bg-brand-300 flex items-center gap-2 rounded-lg px-4 py-2 text-white transition-colors"
								onclick={uploadImages}
								disabled={uploadingImages}
							>
								<Icon icon="mdi:upload" class="text-lg" />
								{uploadingImages ? 'Subiendo...' : 'Confirmar subida'}
							</button>
						{/if}

						{#if formMessage}
							<div
								class="bg-brand-400/10 border-brand-400/20 text-brand-400 rounded-lg border p-3 text-sm"
								transition:fade
							>
								{formMessage}
							</div>
						{/if}

						<!-- Current Images Grid -->
						<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
							{#each data.product.productImages as img}
								<div class="bg-surface-2 relative aspect-square overflow-hidden rounded-lg">
									<img src={img.url} alt="Imagen del producto" class="h-full w-full object-cover" />
									<button
										onclick={() => deleteImage(img.id)}
										class="absolute top-2 right-2 rounded-full bg-red-500/90 p-1.5 text-white transition-colors hover:bg-red-500"
										aria-label="Eliminar imagen"
									>
										<Icon icon="mdi:delete" class="text-sm" />
									</button>
								</div>
							{/each}

							{#if data.product.productImages.length === 0}
								<div
									class="text-text-muted/50 col-span-full flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/10"
								>
									<Icon icon="mdi:image-off-outline" class="mb-2 text-4xl" />
									<p class="text-center">Sin imágenes</p>
								</div>
							{/if}
						</div>
					</div>
				</fieldset>
			</section>

			<!-- Right: Actions & Info -->
			<aside class="space-y-6">
				<!-- Quick Actions -->
				<fieldset class="bg-surface-1 space-y-3 rounded-xl border border-white/10 p-4">
					<legend class="text-text-primary mb-2 text-sm font-semibold">Acciones rápidas</legend>

					<button
						onclick={goToVariants}
						class="text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:border-brand-400/30 flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 transition-colors"
					>
						<Icon icon="mdi:cube-outline" class="text-lg" />
						Gestionar variantes
					</button>

					<a
						href={`/producto/${data.product.id}`}
						class="text-text-secondary hover:bg-surface-2 hover:text-text-primary flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 transition-colors"
						target="_blank"
					>
						<Icon icon="mdi:open-in-new" class="text-lg" />
						Ver en tienda
					</a>

					<button
						onclick={() => toggleDeleteProductModalIsVisible(true)}
						class="flex w-full items-center gap-2 rounded-lg border border-red-400/30 px-3 py-2 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
					>
						<Icon icon="mdi:delete" class="text-lg" />
						Eliminar producto
					</button>
				</fieldset>

				<!-- Save Button -->
				<div class="sticky top-24 space-y-3">
					<button
						onclick={saveProduct}
						disabled={savingProduct}
						class="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
					>
						<Icon icon="mdi:content-save" class="text-xl" />
						{savingProduct ? 'Guardando...' : 'Guardar cambios'}
					</button>
					<a href="/admin/catalogo" class="btn-secondary w-full">Cancelar</a>
				</div>
			</aside>
		</div>
	</main>
</div>

<!-- Delete Product Confirmation Modal -->
{#if deleteProductModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleDeleteProductModalIsVisible} cancelClick={true}>
			<div class="bg-surface-1 max-w-md space-y-4 rounded-xl border border-white/10 p-6">
				<h2 class="text-text-primary text-lg font-semibold">Eliminar producto</h2>
				<p class="text-text-secondary">
					¿Estás seguro de que quieres eliminar <strong>"{data.product.name}"</strong>? Esta acción
					eliminará el producto, todas sus variantes, imágenes asociadas y no se puede deshacer.
				</p>
				<div class="flex justify-end gap-3 pt-2">
					<button
						onclick={() => toggleDeleteProductModalIsVisible(false)}
						class="text-text-secondary hover:bg-surface-2 hover:text-text-primary rounded-lg border border-white/10 px-4 py-2 transition-colors"
					>
						Cancelar
					</button>
					<button
						onclick={deleteProduct}
						class="rounded-lg bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600"
					>
						Eliminar
					</button>
				</div>
			</div>
		</ContainerModal>
	</div>
{/if}

<style>
	/* File input styling */
	input[type='file']::file-selector-button {
		background-color: hsl(var(--brand-400) / 0.2);
		color: hsl(var(--brand-400));
		border-radius: 0.5rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	input[type='file']::file-selector-button:hover {
		background-color: hsl(var(--brand-400) / 0.3);
	}
</style>
