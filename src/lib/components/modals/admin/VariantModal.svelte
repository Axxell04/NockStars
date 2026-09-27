<script lang="ts">
	import type { ProductComplete } from '$lib/interfaces/product';
	import type { VariantComplete } from '$lib/actions';
	import { fade, scale } from 'svelte/transition';
	import ContainerModal from '../ContainerModal.svelte';
	import Icon from '@iconify/svelte';
	import imageComression from 'browser-image-compression';

	interface Props {
		productSelected: ProductComplete;
		variantToEdit?: VariantComplete | null; // null for add, defined for edit
		isAdd: boolean;
		toggleModal: (visible?: boolean) => void;
		isVisible: boolean;
		onSuccess: () => void;
	}

	let { productSelected, variantToEdit, isAdd, toggleModal, isVisible, onSuccess }: Props =
		$props();

	let formMessage = $state('');
	let name = $state(variantToEdit?.size ?? '');
	let color = $state(variantToEdit?.color ?? '');
	let cut = $state<'oversize' | 'recto'>(variantToEdit?.cut ?? 'oversize');
	let description = $state(variantToEdit?.description ?? '');
	let stock = $state(variantToEdit?.stock ?? 0);
	let priceOverride = $state(
		variantToEdit?.priceOverride !== null && variantToEdit?.priceOverride !== undefined
			? String(Number(variantToEdit.priceOverride))
			: ''
	);
	let sortOrder = $state(variantToEdit?.sortOrder ?? 0);
	let imgsList: File[] = $state([]);
	let uploading = $state(false);
	let variantId = $state(variantToEdit?.id ?? '');

	let inputImgs: HTMLInputElement | undefined = $state();

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 300);
		}
	}

	async function compress(file: File) {
		const compressedFile = await imageComression(file, {
			maxWidthOrHeight: 800,
			maxSizeMB: 0.5,
			useWebWorker: true
		});
		return compressedFile;
	}

	async function convertToWebP(file: File): Promise<File> {
		const bitmap = await createImageBitmap(file);
		const canvas = document.createElement('canvas');
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(bitmap, 0, 0);
		bitmap.close();
		return new Promise((resolve, reject) => {
			canvas.toBlob(
				(blob) => {
					if (!blob) return reject(new Error('WebP conversion failed'));
					resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }));
				},
				'image/webp',
				0.85
			);
		});
	}

	async function handleFile(e: Event) {
		const target = e.target as HTMLInputElement;
		const files = target.files;
		if (!files || !files.length) return;
		imgsList = [];
		for (const file of files) {
			const compressed = await compress(file);
			imgsList.push(await convertToWebP(compressed));
		}
	}

	async function uploadToCloudinary(file: File, variantId: string): Promise<string> {
		const sigRes = await fetch(`/api/cloudinary/signature?type=variant&variantId=${variantId}`);
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

	async function sendVariant() {
		if (!name || !color || !cut) return;
		if (isAdd && !imgsList.length) {
			formMessage = 'Debes subir al menos una imagen';
			return;
		}
		uploading = true;
		formMessage = '';

		try {
			if (isAdd) {
				// Phase 1: Create variant
				const formDataPhase1 = new FormData();
				formDataPhase1.append('phase', '1');
				formDataPhase1.append('productId', productSelected.product.id);
				formDataPhase1.append('size', name);
				formDataPhase1.append('color', color);
				formDataPhase1.append('cut', cut);
				formDataPhase1.append('description', description);
				formDataPhase1.append('stock', String(stock));
				if (priceOverride) formDataPhase1.append('priceOverride', priceOverride);
				formDataPhase1.append('sortOrder', String(sortOrder));

				const resPhase1 = await fetch('/admin/api/variant/upload', {
					method: 'POST',
					body: formDataPhase1
				});
				const jsonPhase1 = await resPhase1.json();
				if (!jsonPhase1.success) {
					formMessage = jsonPhase1.message || 'Error al crear la variante';
					return;
				}
				variantId = jsonPhase1.variantId as string;

				// Phase 2: Upload images
				for (const img of imgsList) {
					const url = await uploadToCloudinary(img, variantId);
					const formDataPhase2 = new FormData();
					formDataPhase2.append('phase', '2');
					formDataPhase2.append('url', url);
					formDataPhase2.append('variant-id', variantId);
					const resPhase2 = await fetch('/admin/api/variant/upload', {
						method: 'POST',
						body: formDataPhase2
					});
					const jsonPhase2 = await resPhase2.json();
					if (!jsonPhase2.success) {
						formMessage = jsonPhase2.message || 'Error al guardar la imagen';
						return;
					}
				}

				// Phase 3: Finalize
				const formDataPhase3 = new FormData();
				formDataPhase3.append('phase', '3');
				formDataPhase3.append('productId', productSelected.product.id);
				const resPhase3 = await fetch('/admin/api/variant/upload', {
					method: 'POST',
					body: formDataPhase3
				});
				const jsonPhase3 = await resPhase3.json();
				if (!jsonPhase3.success) return;
			} else {
				// Edit variant
				const formData = new FormData();
				formData.append('variantId', variantId);
				if (name) formData.append('size', name);
				if (color) formData.append('color', color);
				if (cut) formData.append('cut', cut);
				if (description) formData.append('description', description);
				if (stock !== undefined) formData.append('stock', String(stock));
				if (priceOverride !== undefined) formData.append('priceOverride', priceOverride);
				if (sortOrder !== undefined) formData.append('sortOrder', String(sortOrder));

				const res = await fetch('?/update_variant', {
					method: 'POST',
					body: formData
				});
				const json = await res.json();
				if (!json.success) {
					formMessage = json.message || 'Error al actualizar la variante';
					return;
				}

				// Upload new images if any
				for (const img of imgsList) {
					const url = await uploadToCloudinary(img, variantId);
					const formDataPhase2 = new FormData();
					formDataPhase2.append('phase', '2');
					formDataPhase2.append('url', url);
					formDataPhase2.append('variant-id', variantId);
					const resPhase2 = await fetch('/admin/api/variant/upload', {
						method: 'POST',
						body: formDataPhase2
					});
					const jsonPhase2 = await resPhase2.json();
					if (!jsonPhase2.success) {
						formMessage = jsonPhase2.message || 'Error al guardar la imagen';
						return;
					}
				}
			}

			clearForm();
			onSuccess();
			toggleModal(false);
		} catch {
			formMessage = 'Error al procesar la variante';
		} finally {
			uploading = false;
		}
	}

	function clearForm() {
		name = '';
		color = '';
		cut = 'oversize';
		description = '';
		stock = 0;
		priceOverride = '';
		sortOrder = 0;
		imgsList = [];
		variantId = '';
		if (inputImgs) inputImgs.value = '';
	}

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
		<ContainerModal {toggleModal} visible={isVisible} cancelClick={true}>
			<form
				method="post"
				class="border-brand-400/50 bg-surface-0/95 relative flex max-h-fit max-w-full flex-col gap-2 rounded-md border px-4 py-4"
			>
				<div class="flex flex-col place-items-center gap-2">
					<label for="variantSize" class="text-text-secondary mb-1 block w-full text-sm"
						>Talla</label
					>
					<input
						id="variantSize"
						type="text"
						name="size"
						required
						class="bg-surface-2 text-text-primary focus:border-brand-400/50 w-full rounded-lg border border-white/4 px-4 py-2 focus:outline-none"
						placeholder="Ej: M, L, XL"
						bind:value={name}
						disabled={!isAdd}
					/>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="variantColor" class="text-text-secondary mb-1 block w-full text-sm"
						>Color</label
					>
					<input
						id="variantColor"
						type="text"
						name="color"
						required
						class="bg-surface-2 text-text-primary focus:border-brand-400/50 w-full rounded-lg border border-white/4 px-4 py-2 focus:outline-none"
						placeholder="Ej: Negro, Blanco"
						bind:value={color}
						disabled={!isAdd}
					/>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="variantCut" class="text-text-secondary mb-1 block w-full text-sm">Corte</label
					>
					<select
						id="variantCut"
						name="cut"
						required
						class="bg-surface-2 text-text-primary focus:border-brand-400/50 w-full rounded-lg border border-white/4 px-4 py-2 focus:outline-none"
						bind:value={cut}
						disabled={!isAdd}
					>
						<option value="oversize">Oversize</option>
						<option value="recto">Recto</option>
					</select>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="variantDescription" class="text-text-secondary mb-1 block w-full text-sm"
						>Descripción (opcional)</label
					>
					<textarea
						id="variantDescription"
						name="description"
						rows="2"
						class="bg-surface-2 text-text-primary focus:border-brand-400/50 w-full rounded-lg border border-white/4 px-4 py-2 focus:outline-none"
						bind:value={description}
					></textarea>
				</div>
				<div class="flex w-full flex-col place-items-center gap-2 sm:flex-row sm:justify-center">
					<div class="w-full sm:w-1/2">
						<label for="variantStock" class="text-text-secondary mb-1 block text-sm">Stock</label>
						<input
							id="variantStock"
							type="number"
							name="stock"
							min="0"
							class="bg-surface-2 text-text-primary focus:border-brand-400/50 w-full rounded-lg border border-white/4 px-4 py-2 focus:outline-none"
							bind:value={stock}
						/>
					</div>
					<div class="w-full sm:w-1/2">
						<label for="variantPriceOverride" class="text-text-secondary mb-1 block text-sm"
							>Precio override (opcional)</label
						>
						<input
							id="variantPriceOverride"
							type="number"
							name="priceOverride"
							step="0.01"
							min="0"
							class="bg-surface-2 text-text-primary focus:border-brand-400/50 w-full rounded-lg border border-white/4 px-4 py-2 focus:outline-none"
							placeholder="Dejar vacío para usar precio base"
							bind:value={priceOverride}
						/>
					</div>
				</div>
				<div class="flex w-full flex-col place-items-center gap-2">
					<label for="variantSortOrder" class="text-text-secondary mb-1 block w-full text-sm"
						>Orden de visualización</label
					>
					<input
						id="variantSortOrder"
						type="number"
						name="sortOrder"
						min="0"
						class="bg-surface-2 text-text-primary focus:border-brand-400/50 w-full rounded-lg border border-white/4 px-4 py-2 focus:outline-none"
						bind:value={sortOrder}
					/>
				</div>

				<!-- Image Upload -->
				<div
					class="mt-2 flex w-full flex-col place-items-center gap-2 border-t border-white/4 pt-4"
				>
					<label
						for="variantImages"
						class="text-text-secondary mb-1 block w-full text-center text-sm"
						>Imágenes de la variante</label
					>
					<input
						id="variantImages"
						type="file"
						name="imgs"
						accept="image/*"
						multiple
						class="border-brand-400/50 w-full max-w-full rounded-md border px-1 outline-none"
						style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;"
						onchange={handleFile}
						bind:this={inputImgs}
						required={isAdd}
					/>
					{#if imgsList.length > 0}
						<div class="flex w-full flex-wrap justify-center gap-2">
							{#each imgsList as img, i}
								<div class="relative h-16 w-16 overflow-hidden rounded-lg border border-white/4">
									<img
										src={URL.createObjectURL(img)}
										alt={`Preview ${i + 1}`}
										class="h-full w-full object-cover"
									/>
									<button
										type="button"
										class="absolute top-1 right-1 rounded-full bg-red-500/80 p-1 text-white hover:bg-red-500"
										onclick={() => {
											imgsList = imgsList.filter((_, idx) => idx !== i);
										}}
									>
										<Icon icon="material-symbols:close" class="text-xs" />
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="flex w-full flex-col place-items-center gap-2">
					<button
						type="button"
						disabled={uploading || !name || !color || !cut || (isAdd && imgsList.length === 0)}
						class="btn-primary w-full sm:w-auto {uploading ||
						!name ||
						!color ||
						!cut ||
						(isAdd && imgsList.length === 0)
							? 'cursor-not-allowed opacity-50'
							: ''}"
						onclick={() => sendVariant()}
						onfocus={(e) => cancelFocus(e)}
					>
						{uploading ? 'Procesando...' : isAdd ? 'Crear variante' : 'Guardar cambios'}
					</button>
				</div>
				{#if formMessage}
					<div transition:scale>
						<p class="text-text-error text-center">{formMessage}</p>
					</div>
				{/if}
				<div
					role="button"
					tabindex="0"
					onkeydown={() => {}}
					class="hover:text-brand-400 absolute top-2 right-2 cursor-pointer"
					onclick={() => toggleModal(false)}
				>
					<Icon icon="material-symbols:close-rounded" class="text-3xl" />
				</div>
			</form>
		</ContainerModal>
	</div>
{/if}
