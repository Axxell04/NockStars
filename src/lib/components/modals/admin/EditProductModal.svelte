<script lang="ts">
	import type { ProductComplete, ProductPagination } from '$lib/interfaces/product';
	import { fade, scale } from 'svelte/transition';
	import ContainerModal from '../ContainerModal.svelte';
	import Icon from '@iconify/svelte';
	import ImgsEditProductModal from './ImgsEditProductModal.svelte';
	import imageCompression from 'browser-image-compression';

	interface Props {
		setProductPagination: (newProductPagination: ProductPagination) => void;
		setProductSelected?: (product: ProductComplete) => void;
		productSelected?: ProductComplete;
		toggleEditProductModalIsVisible: (visible?: boolean) => void;
		editProductModalIsVisible: boolean;
	}

	let {
		setProductPagination,
		setProductSelected,
		toggleEditProductModalIsVisible,
		editProductModalIsVisible,
		productSelected
	}: Props = $props();

	// Form
	let formMessage = $state('');
	let name = $state('');
	let price = $state('');
	let imgsList: File[] = $state([]);
	let uploading = $state(false);

	// onMount(() => {
	//     if (!productSelected) return;
	//     name = productSelected.product.name;
	//     price = productSelected.product.price.toString();
	// })

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- reactive dependency marker for $effect
		editProductModalIsVisible;
		if (productSelected) {
			name = productSelected.product.name;
			price = productSelected.product.price.toString();
			imgsList = [];
			listDelete = [];
		}
	});

	$inspect(productSelected);

	let inputImgs: HTMLInputElement | undefined = $state();

	let listDelete: number[] = $state([]);

	let listDeleteToForm: string[] = $derived(
		!productSelected || !listDelete.length
			? []
			: [
					...productSelected.imgs
						.filter((img) => {
							if (listDelete.includes(productSelected.imgs.indexOf(img))) {
								return true;
							} else {
								return false;
							}
						})
						.map((img) => img.id)
				]
	);

	let imgsEditProductModalIsVisible = $state(false);
	function toggleImgsEditProductModalIsVisible(visible?: boolean) {
		if (typeof visible !== 'undefined') {
			imgsEditProductModalIsVisible = visible;
		} else {
			imgsEditProductModalIsVisible = !imgsEditProductModalIsVisible;
		}
	}

	function updateListDelete(newList: number[]) {
		listDelete = newList;
	}

	function clearList() {
		listDelete = [];
		imgsList = [];
	}

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}

	function handleName(e: Event) {
		const target = e.target as HTMLInputElement;
		name = target.value;
	}

	function handlePrice(e: Event) {
		const target = e.target as HTMLInputElement;
		price = target.value;
	}

	async function compress(file: File) {
		const compressedFile = await imageCompression(file, {
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

	async function sendUpdate() {
		uploading = true;
		formMessage = '';
		try {
			// Phase 1: Update name/price
			const formDataPhase1 = new FormData();
			formDataPhase1.append('phase', '1');
			formDataPhase1.append('product_id', productSelected?.product.id as string);
			formDataPhase1.append('name', name as string);
			formDataPhase1.append('price', price as string);
			const resPhase1 = await fetch('/admin/api/product/update', {
				method: 'POST',
				body: formDataPhase1
			});
			const jsonPhase1 = await resPhase1.json();
			if (!jsonPhase1.success) {
				formMessage = jsonPhase1.message || 'Error al actualizar el producto';
				return;
			}

			// Phase 2: Upload new images to Cloudinary, then bind URL
			for (const img of imgsList) {
				const url = await uploadToCloudinary(img);
				const formDataPhase2 = new FormData();
				formDataPhase2.append('phase', '2');
				formDataPhase2.append('url', url);
				formDataPhase2.append('product_id', productSelected?.product.id as string);
				const resPhase2 = await fetch('/admin/api/product/update', {
					method: 'POST',
					body: formDataPhase2
				});
				const jsonPhase2 = await resPhase2.json();
				if (!jsonPhase2.success) {
					formMessage = jsonPhase2.message || 'Error al guardar la imagen';
					return;
				}
			}

			// Phase 3: Delete removed images
			const formDataPhase3 = new FormData();
			formDataPhase3.append('phase', '3');
			formDataPhase3.append('product_id', productSelected?.product.id as string);
			formDataPhase3.append('list_delete', JSON.stringify(listDeleteToForm));
			const resPhase3 = await fetch('/admin/api/product/update', {
				method: 'POST',
				body: formDataPhase3
			});
			const jsonPhase3 = await resPhase3.json();
			if (!jsonPhase3.success) {
				formMessage = jsonPhase3.message || 'Error al eliminar imágenes';
				return;
			}
			setProductPagination(jsonPhase3.pagination as ProductPagination);
			// Update productSelected reference to the fresh object from new pagination
			if (setProductSelected) {
				const freshProduct = (jsonPhase3.pagination as ProductPagination).products.find(
					(p) => p.product.id === productSelected?.product.id
				);
				if (freshProduct) setProductSelected(freshProduct);
			}
			if (inputImgs) inputImgs.value = '';
			toggleEditProductModalIsVisible(false);
			clearList();
		} catch {
			formMessage = 'Error al subir las imágenes';
		} finally {
			uploading = false;
		}
	}

	$effect(() => {
		if (formMessage) {
			const timeout = setTimeout(() => {
				formMessage = '';
			}, 5000);
			return () => clearTimeout(timeout);
		}
	});

	$effect(() => {
		if (!editProductModalIsVisible) {
			clearList();
		}
	});
</script>

{#if editProductModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal
			toggleModal={toggleEditProductModalIsVisible}
			visible={editProductModalIsVisible}
			cancelClick={true}
		>
			<form
				id="edit-product"
				class="relative flex max-h-fit max-w-full flex-col gap-2 rounded-md border border-red-400 bg-stone-900 px-10 py-5"
			>
				<div class="flex flex-col place-items-center gap-2">
					<input
						type="hidden"
						name="product_id"
						value={!productSelected ? '' : productSelected.product.id}
					/>
					<label for="name">Nombre</label>
					<span class="text-red-300">
						{#if productSelected}
							<input
								type="text"
								name="name"
								id="name"
								required
								autocomplete="off"
								class="max-w-full rounded-md border border-red-400 px-1 outline-none"
								value={productSelected.product.name}
								oninput={handleName}
							/>
						{/if}
					</span>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="price">Precio</label>
					<span class="text-red-300">
						{#if productSelected}
							<input
								type="number"
								name="price"
								id="price"
								required
								step="0.01"
								class="max-w-full rounded-md border border-red-400 px-1 outline-none"
								value={productSelected.product.price}
								oninput={handlePrice}
							/>
						{/if}
					</span>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="imgs">Imagenes</label>
					<input
						type="file"
						aria-labelledby="imagenes"
						name="imgs"
						id="imgs"
						accept="image/*"
						multiple
						class="max-w-full rounded-md border border-red-400 px-1 outline-none"
						style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;"
						onchange={handleFile}
						bind:this={inputImgs}
					/>
					<button
						type="button"
						class="cursor-pointer rounded-md border p-1 hover:text-red-500 focus:text-red-500"
						onclick={() => toggleImgsEditProductModalIsVisible(true)}
						onfocus={(e) => cancelFocus(e)}
					>
						Ver imagenes
					</button>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<input type="hidden" name="list_delete" value={JSON.stringify(listDeleteToForm)} />
					<button
						type="button"
						disabled={uploading}
						class="cursor-pointer rounded-md border p-2 hover:text-red-500 focus:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={() => sendUpdate()}
						onfocus={(e) => cancelFocus(e)}
					>
						{uploading ? 'Subiendo...' : 'Editar'}
					</button>
				</div>
				{#if formMessage}
					<div transition:scale>
						<p class="text-center text-red-500">
							{formMessage}
						</p>
					</div>
				{/if}
				<div
					role="button"
					tabindex="0"
					onkeydown={() => {}}
					class="absolute top-2 right-2 cursor-pointer hover:text-red-500"
					onclick={() => toggleEditProductModalIsVisible(false)}
				>
					<Icon icon="material-symbols:close-rounded" class="text-3xl" />
				</div>
			</form>
		</ContainerModal>
		<ImgsEditProductModal
			{productSelected}
			{imgsEditProductModalIsVisible}
			{toggleImgsEditProductModalIsVisible}
			{listDelete}
			{updateListDelete}
		/>
	</div>
{/if}
