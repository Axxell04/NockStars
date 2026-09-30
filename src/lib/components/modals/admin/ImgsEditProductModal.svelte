<script lang="ts">
	import type { ProductComplete } from '$lib/interfaces/product';
	import { fade, scale } from 'svelte/transition';
	import ContainerModal from '../ContainerModal.svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		productSelected?: ProductComplete;
		toggleImgsEditProductModalIsVisible: (visible?: boolean) => void;
		imgsEditProductModalIsVisible: boolean;
		listDelete: number[];
		updateListDelete: (newList: number[]) => void;
	}

	let {
		toggleImgsEditProductModalIsVisible,
		imgsEditProductModalIsVisible,
		productSelected,
		updateListDelete,
		listDelete
	}: Props = $props();

	let imgIndex = $state(0);

	function nextImg() {
		if (nextImgIsValid()) {
			imgIndex = imgIndex + 1;
		}
	}

	function prevImg() {
		if (prevImgIsValid()) {
			imgIndex = imgIndex - 1;
		}
	}

	function nextImgIsValid() {
		if (!productSelected) {
			return false;
		}
		if (imgIndex < productSelected.imgs.length - 1) {
			return true;
		}
		return false;
	}

	function prevImgIsValid() {
		if (!productSelected) {
			return false;
		}
		if (imgIndex > 0) {
			return true;
		}
		return false;
	}

	function closeModal() {
		imgIndex = 0;
		toggleImgsEditProductModalIsVisible(false);
	}

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}

	function preloadImgs() {
		productSelected?.imgs.forEach((productImg) => {
			const img = new Image();
			img.src = productImg.url;
		});
	}

	$effect(() => {
		if (productSelected) {
			preloadImgs();
		}
	});

	function toggleDelete() {
		if (inListDelete()) {
			updateListDelete(listDelete.filter((index) => index !== imgIndex));
		} else {
			updateListDelete([...listDelete, imgIndex]);
		}
	}

	const inListDelete = () => listDelete.includes(imgIndex);
</script>

{#if imgsEditProductModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleImgsEditProductModalIsVisible} cancelClick={true}>
			<div class="relative flex max-h-full flex-col gap-6">
				<!-- Image area — caja estable: no salta entre fotos con distinto aspect ratio -->
				<div class="relative flex h-[min(60vh,26rem)] w-full items-center justify-center">
					<div
						in:scale={{ duration: 300, start: 0.95 }}
						class="bg-surface-2/40 relative h-full max-h-[26rem] w-full max-w-[28rem] overflow-hidden rounded-2xl"
					>
						{#key imgIndex}
							<img
								class="h-full w-full object-contain"
								src={productSelected?.imgs[imgIndex].url}
								alt={productSelected?.product.name}
								draggable="false"
								transition:fade={{ duration: 200 }}
							/>
						{/key}
						<span
							class="glass text-text-secondary absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium"
						>
							{imgIndex + 1} / {productSelected?.imgs.length ?? imgIndex + 1}
						</span>
					</div>
				</div>

				<!-- Controls bar -->
				<div class="bg-surface-1 flex items-center gap-4 rounded-2xl border border-white/5 p-3">
					<!-- Delete button for current image -->
					<button
						class="cursor-pointer rounded-full border p-1 text-3xl {inListDelete()
							? 'border-red-500 text-red-500 hover:border-red-400 hover:text-red-400'
							: 'hover:border-red-500 hover:text-red-500'}"
						onclick={toggleDelete}
						onfocus={(e) => cancelFocus(e)}
					>
						<Icon icon="famicons:trash" />
					</button>

					<!-- Discard all button -->
					{#if listDelete.length > 0}
						<div transition:scale class="flex flex-row gap-2">
							<button
								class="cursor-pointer hover:text-red-500 focus:text-red-500"
								onclick={() => updateListDelete([])}
								onfocus={(e) => cancelFocus(e)}
							>
								<span>
									{listDelete.length} Descartar
								</span>
							</button>
						</div>
					{/if}

					<!-- Navigation arrows -->
					<div class="flex flex-1 items-center justify-center gap-2">
						<button
							class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 transition-all duration-200
                                {prevImgIsValid()
								? 'text-text-secondary hover:text-brand-400 hover:border-brand-400/30 hover:bg-brand-400/10'
								: 'text-text-muted/30 cursor-not-allowed'}"
							onclick={prevImg}
							onfocus={(e) => cancelFocus(e)}
							disabled={!prevImgIsValid()}
						>
							<Icon icon="mingcute:left-fill" class="text-xl" />
						</button>
						<button
							class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 transition-all duration-200
                                {nextImgIsValid()
								? 'text-text-secondary hover:text-brand-400 hover:border-brand-400/30 hover:bg-brand-400/10'
								: 'text-text-muted/30 cursor-not-allowed'}"
							onclick={nextImg}
							onfocus={(e) => cancelFocus(e)}
							disabled={!nextImgIsValid()}
						>
							<Icon icon="mingcute:right-fill" class="text-xl" />
						</button>
					</div>

					<!-- Close button -->
					<button
						class="text-text-secondary hover:text-brand-400 hover:border-brand-400/30 hover:bg-brand-400/10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 transition-all duration-200"
						onclick={closeModal}
						onfocus={(e) => cancelFocus(e)}
					>
						<Icon icon="material-symbols:close-rounded" class="text-xl" />
					</button>
				</div>
			</div>
		</ContainerModal>
	</div>
{/if}
