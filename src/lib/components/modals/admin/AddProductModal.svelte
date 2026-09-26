<script lang="ts">
	import type { ProductPagination } from '$lib/interfaces/product';
	import { fade, scale } from 'svelte/transition';
	import ContainerModal from '../ContainerModal.svelte';
	import Icon from '@iconify/svelte';
	import imageComression from 'browser-image-compression';

	interface Props {
		setProductPagination: (newProductPagination: ProductPagination) => void;
		toggleAddProductModalIsVisible: (visible?: boolean) => void;
		addProductModalIsVisible: boolean;
	}

	let { setProductPagination, toggleAddProductModalIsVisible, addProductModalIsVisible }: Props =
		$props();

	let formMessage = $state('');
	let name = $state('');
	let price = $state('');
	let imgsList: File[] = $state([]);
	let uploading = $state(false);

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

	async function sendProduct() {
		if (!name || !price || !imgsList.length) return;
		uploading = true;
		formMessage = '';

		try {
			const formDataPhase1 = new FormData();
			formDataPhase1.append('phase', '1');
			formDataPhase1.append('name', name);
			formDataPhase1.append('price', price);
			const resPhase1 = await fetch('/admin/api/product/upload', {
				method: 'POST',
				body: formDataPhase1
			});
			const jsonPhase1 = await resPhase1.json();
			if (!jsonPhase1.success) {
				formMessage = jsonPhase1.message || 'Error al crear el producto';
				return;
			}
			const productId = jsonPhase1.productId as string;

			for (const img of imgsList) {
				const url = await uploadToCloudinary(img);
				const formDataPhase2 = new FormData();
				formDataPhase2.append('phase', '2');
				formDataPhase2.append('url', url);
				formDataPhase2.append('product-id', productId);
				const resPhase2 = await fetch('/admin/api/product/upload', {
					method: 'POST',
					body: formDataPhase2
				});
				const jsonPhase2 = await resPhase2.json();
				if (!jsonPhase2.success) {
					formMessage = jsonPhase2.message || 'Error al guardar la imagen';
					return;
				}
			}

			const formDataPhase3 = new FormData();
			formDataPhase3.append('phase', '3');
			const resPhase3 = await fetch('/admin/api/product/upload', {
				method: 'POST',
				body: formDataPhase3
			});
			const jsonPhase3 = await resPhase3.json();
			if (!jsonPhase3.success) return;
			clearForm();
			setProductPagination(jsonPhase3.pagination as ProductPagination);
			toggleAddProductModalIsVisible(false);
		} catch {
			formMessage = 'Error al subir las imágenes';
		} finally {
			uploading = false;
		}
	}

	function clearForm() {
		name = '';
		price = '';
		imgsList = [];
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

{#if addProductModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal
			toggleModal={toggleAddProductModalIsVisible}
			visible={addProductModalIsVisible}
			cancelClick={true}
		>
			<form
				id="add-product"
				method="post"
				class="relative flex max-h-fit max-w-full flex-col gap-2 rounded-md border border-red-400 bg-stone-900 px-4 py-3"
			>
				<div class="flex flex-col place-items-center gap-2">
					<label for="name">Nombre</label>
					<input
						type="text"
						name="name"
						id="name"
						required
						autocomplete="off"
						class="max-w-full rounded-md border border-red-400 px-1 outline-none"
						bind:value={name}
					/>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="price">Precio</label>
					<input
						type="number"
						name="price"
						id="price"
						required
						step="0.01"
						class="max-w-full rounded-md border border-red-400 px-1 outline-none"
						bind:value={price}
					/>
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
						required
						class="max-w-full rounded-md border border-red-400 px-1 outline-none"
						style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;"
						onchange={handleFile}
						bind:this={inputImgs}
					/>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<button
						type="button"
						disabled={uploading || !name || !price || !imgsList.length}
						class="cursor-pointer rounded-md border p-2 hover:text-red-500 focus:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={() => sendProduct()}
						onfocus={(e) => cancelFocus(e)}
					>
						{uploading ? 'Subiendo...' : 'Agregar'}
					</button>
				</div>
				{#if formMessage}
					<div transition:scale>
						<p class="text-center text-red-400">
							{formMessage}
						</p>
					</div>
				{/if}
				<div
					role="button"
					tabindex="0"
					onkeydown={() => {}}
					class="absolute top-2 right-2 cursor-pointer hover:text-red-500"
					onclick={() => toggleAddProductModalIsVisible(false)}
				>
					<Icon icon="material-symbols:close-rounded" class="text-3xl" />
				</div>
			</form>
		</ContainerModal>
	</div>
{/if}
