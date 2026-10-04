<script lang="ts">
	/* eslint-disable @typescript-eslint/no-unused-vars */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '@iconify/svelte';
	import {
		MAX_SPEC_KEY_LENGTH,
		MAX_SPEC_ROWS,
		MAX_SPEC_VALUE_LENGTH,
		SPEC_LABELS
	} from '$lib/product-specs';
	import { variantManagerUrl } from '$lib/admin-links';

	let { data }: { data: { catalogs: { id: string; name: string }[] } } = $props();

	let formMessage = $state('');
	let creatingProduct = $state(false);

	type SpecRow = { id: string; key: string; value: string };

	// Form fields
	let name = $state('');
	let price = $state('');
	let stock = $state('');
	let catalogId = $state('');
	let description = $state('');
	let specRows = $state<SpecRow[]>([createSpecRow()]);

	function createSpecRow(): SpecRow {
		return { id: crypto.randomUUID(), key: '', value: '' };
	}

	function addSpecRow() {
		if (specRows.length >= MAX_SPEC_ROWS) return;
		specRows = [...specRows, createSpecRow()];
	}

	function removeSpecRow(id: string) {
		specRows = specRows.filter((row) => row.id !== id);
	}

	// Image handling
	let imageFiles: File[] = $state([]);
	let imagePreviewUrls: string[] = $state([]);
	let inputImages: HTMLInputElement | undefined = $state();
	let createdProductId = $state<string | null>(null);

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

	function removeImage(index: number) {
		const url = imagePreviewUrls[index];
		if (url) URL.revokeObjectURL(url);
		imageFiles = imageFiles.filter((_, i) => i !== index);
		imagePreviewUrls = imagePreviewUrls.filter((_, i) => i !== index);
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

	async function createProduct() {
		creatingProduct = true;
		formMessage = '';

		try {
			const formData = new FormData();
			formData.append('name', name);
			formData.append('price', price);
			formData.append('stock', stock);
			if (catalogId) formData.append('catalogId', catalogId);
			if (description) formData.append('description', description);
			for (const row of specRows) {
				formData.append('specKey', row.key);
				formData.append('specValue', row.value);
			}

			const imageUrls: string[] = [];
			for (const file of imageFiles) {
				imageUrls.push(await uploadToCloudinary(file));
			}

			if (imageUrls.length) {
				formData.append('imageUrls', JSON.stringify(imageUrls));
			}

			const res = await fetch('/admin/producto/nuevo?/createProduct', {
				method: 'POST',
				body: formData
			});
			const payload = (await res.json()) ?? {};
			const result = payload?.data ?? payload ?? {};
			const success = Boolean(
				res.ok &&
					(payload?.type === 'success' || result?.success === true || payload?.success === true)
			);
			const productId =
				result?.productId ??
				payload?.productId ??
				payload?.data?.productId ??
				result?.data?.productId ??
				null;

			if (success) {
				if (productId) {
					const returnTarget = resolveReturnTarget();
					formMessage = 'Producto creado correctamente. Redirigiendo a edición...';
					await goto(`/admin/producto/${productId}?returnTo=${encodeURIComponent(returnTarget)}`);
					return;
				}

				formMessage = 'Producto creado correctamente';
				return;
			}

			formMessage = result?.message || payload?.message || 'Error al crear producto';
		} catch (error) {
			console.error('Create product failed', error);
			formMessage =
				error instanceof Error
					? `No se pudo crear el producto: ${error.message}`
					: 'No se pudo crear el producto';
		} finally {
			creatingProduct = false;
		}
	}

	function goToVariants() {
		if (createdProductId) {
			goto(variantManagerUrl(createdProductId));
		}
	}
</script>

<div class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 lg:flex-row">
	<!-- Sidebar Navigation -->
	<aside class="hidden w-56 flex-shrink-0 lg:block">
		<nav class="flex flex-col gap-2">
			<button
				type="button"
				onclick={() => goto(resolveReturnTarget())}
				class="text-text-secondary hover:bg-surface-2 hover:text-text-primary rounded-lg px-3 py-2 text-left transition-colors"
			>
				<Icon icon="mdi:arrow-left" class="mr-1 inline" />
				{resolveReturnTarget().startsWith('/producto/')
					? 'Volver al producto'
					: 'Volver al catálogo'}
			</button>
		</nav>
	</aside>

	<!-- Main Content -->
	<main class="flex-1">
		<!-- Header -->
		<header class="mb-6 flex items-center justify-between gap-4">
			<div>
				<h1 class="text-text-primary text-2xl font-bold">Nuevo producto</h1>
				<p class="text-text-secondary text-sm">Completa la información básica</p>
			</div>
			<button
				type="button"
				onclick={() => goto(resolveReturnTarget())}
				class="text-text-secondary hover:bg-surface-2 hover:text-text-primary rounded-lg border border-white/10 px-4 py-2 transition-colors"
			>
				<Icon icon="mdi:close" class="mr-1 inline" />
				Cancelar
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

				<!-- Catalog Selection -->
				<fieldset class="bg-surface-1 space-y-4 rounded-xl border border-white/10 p-6">
					<legend class="text-text-primary mb-4 text-lg font-semibold">Catálogo</legend>
					<div class="space-y-1">
						<label for="catalogId" class="text-text-secondary block text-sm font-medium"
							>Catálogo</label
						>
						<select
							id="catalogId"
							bind:value={catalogId}
							class="bg-surface-2 text-text-primary focus:border-brand-400 w-full rounded-lg border border-white/10 px-3 py-2 transition-colors focus:outline-none"
						>
							<option value="">Sin catálogo (general)</option>
							{#each data.catalogs as catalog}
								<option value={catalog.id}>{catalog.name}</option>
							{/each}
						</select>
					</div>
				</fieldset>

				<!-- Product Images -->
				<fieldset class="bg-surface-1 space-y-4 rounded-xl border border-white/10 p-6">
					<legend class="text-text-primary mb-4 text-lg font-semibold">Imágenes del producto</legend
					>
					<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<label class="cursor-pointer">
							<input
								type="file"
								id="image-upload"
								accept="image/*"
								multiple
								class="hidden"
								onchange={(e) => {
									const target = e.target as HTMLInputElement;
									const files = target.files;
									if (!files || !files.length) return;
									const nextFiles = Array.from(files);
									imageFiles = nextFiles;
									imagePreviewUrls = nextFiles.map((file) => URL.createObjectURL(file));
								}}
								bind:this={inputImages}
							/>
							<button
								type="button"
								class="bg-brand-400 hover:bg-brand-300 flex items-center gap-2 rounded-lg px-4 py-2 text-white transition-colors"
								onclick={() => inputImages?.click()}
							>
								<Icon icon="mdi:cloud-upload" class="text-lg" />
								Seleccionar imágenes
							</button>
						</label>
					</div>

					{#if formMessage}
						<div
							class="bg-brand-400/10 border-brand-400/20 text-brand-400 rounded-lg border p-3 text-sm"
						>
							{formMessage}
						</div>
					{/if}

					<!-- Image Previews -->
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
						{#if imageFiles.length > 0}
							{#each imageFiles as image, index}
								<div
									class="bg-surface-2 relative aspect-square overflow-hidden rounded-xl border border-white/10"
								>
									<img
										src={imagePreviewUrls[index]}
										alt={`Vista previa ${index + 1}`}
										class="h-full w-full object-cover"
									/>
									<button
										type="button"
										onclick={() => removeImage(index)}
										class="absolute top-2 right-2 rounded-full bg-red-500/90 p-1.5 text-white transition-colors hover:bg-red-500"
										aria-label={`Eliminar imagen ${index + 1}`}
									>
										×
									</button>
								</div>
							{/each}
						{:else}
							<div
								class="text-text-muted/50 col-span-full flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10"
							>
								<Icon icon="mdi:image-off-outline" class="mb-2 text-4xl" />
								<p class="text-center">Sin imágenes seleccionadas</p>
							</div>
						{/if}
					</div>
				</fieldset>
			</section>

			<!-- Right: Actions & Info -->
			<aside class="space-y-6">
				<!-- Quick Actions (shown after creation) -->
				{#if createdProductId}
					<fieldset class="bg-surface-1 space-y-3 rounded-xl border border-white/10 p-4">
						<legend class="text-text-primary mb-2 text-sm font-semibold">Próximos pasos</legend>

						<button
							onclick={goToVariants}
							class="text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:border-brand-400/30 flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 transition-colors"
						>
							<Icon icon="mdi:cube-outline" class="text-lg" />
							Gestionar variantes
						</button>

						<a
							href={`/producto/${createdProductId}`}
							class="text-text-secondary hover:bg-surface-2 hover:text-text-primary flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 transition-colors"
							target="_blank"
						>
							<Icon icon="mdi:open-in-new" class="text-lg" />
							Ver en tienda
						</a>
					</fieldset>
				{/if}

				<!-- Save Button -->
				<div class="sticky top-24 space-y-3">
					<button
						onclick={createProduct}
						disabled={creatingProduct}
						class="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
					>
						<Icon icon="mdi:content-save" class="text-xl" />
						{creatingProduct ? 'Creando...' : 'Crear producto'}
					</button>

					<button
						type="button"
						onclick={() => goto(resolveReturnTarget())}
						class="btn-secondary w-full"
					>
						Cancelar
					</button>
				</div>
			</aside>
		</div>
	</main>
</div>

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
