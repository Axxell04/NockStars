<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ProductComplete, ProductPagination } from '$lib/interfaces/product';
	import { fade, scale } from 'svelte/transition';
	import ContainerModal from '../ContainerModal.svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		setProductPagination: (newProductPagination: ProductPagination) => void;
		catalogId: string;
		toggleAddProductToCatalogModalIsVisible: (visible?: boolean) => void;
		addProductToCatalogModalIsVisible: boolean;
	}

	let {
		setProductPagination,
		catalogId,
		toggleAddProductToCatalogModalIsVisible,
		addProductToCatalogModalIsVisible
	}: Props = $props();

	let formMessage = $state('');

	// Binded Elements
	let btnGetProducts: HTMLButtonElement | undefined = $state();

	let totalProductsList: ProductComplete[] = $state([]);
	let productsToAddList: ProductComplete[] = $state([]);

	function toggleProductToAdd(product: ProductComplete) {
		const initLength = productsToAddList.length;
		productsToAddList = productsToAddList.filter((p) => p.product.id !== product.product.id);
		const finalLength = productsToAddList.length;
		if (initLength === finalLength) {
			productsToAddList.push(product);
		}
	}

	function isSelected(product: ProductComplete) {
		if (productsToAddList.find((p) => p.product.id === product.product.id)) {
			return true;
		}
		return false;
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
		if (formMessage) {
			setTimeout(() => {
				formMessage = '';
			}, 5000);
		}
	});

	$effect(() => {
		if (typeof window !== 'undefined') {
			if (addProductToCatalogModalIsVisible) {
				if (typeof btnGetProducts !== 'undefined') {
					btnGetProducts.click();
				}
			}
		}
	});
</script>

{#if addProductToCatalogModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleAddProductToCatalogModalIsVisible} cancelClick={true}>
			<form
				action="?/get_products"
				method="post"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'failure') {
							if (result.data?.message) {
								formMessage = result.data.message as string;
							}
						} else if (result.type === 'success') {
							if (result.data?.products) {
								// setProductPagination(result.data.pagination as ProductPagination);
								totalProductsList = result.data.products as ProductComplete[];
							}
						}
					};
				}}
			>
				<button bind:this={btnGetProducts} class="hidden"> Get Products </button>
			</form>
			<form
				id="add-product-to-catalog"
				action="?/add_product_to_catalog"
				method="post"
				use:enhance={({ formElement }) => {
					return async ({ result }) => {
						if (result.type === 'failure') {
							if (result.data?.message) {
								formMessage = result.data.message as string;
							}
						}
						if (result.type === 'success') {
							formElement.reset();
							if (result.data?.pagination) {
								setProductPagination(result.data.pagination as ProductPagination);
								toggleAddProductToCatalogModalIsVisible(false);
								productsToAddList = [];
							}
							// await goto("/admin", {invalidateAll: true});
						}
					};
				}}
				enctype="multipart/form-data"
				class="relative flex max-h-fit max-w-full flex-col gap-2 rounded-md border border-red-400 bg-stone-900 px-9 py-5"
			>
				<input type="hidden" name="catalog_id" value={catalogId} />
				<input
					type="hidden"
					name="products_to_add_list"
					value={JSON.stringify(productsToAddList)}
				/>
				<!-- <div class="flex flex-col gap-2 place-items-center">
                        <label for="name">Nombre</label>
                        <input type="text" name="name" id="name" required autocomplete="off"
                        class="border border-red-400 rounded-md px-1 outline-none max-w-full" 
                        />
                    </div>
                    <div class="flex flex-col gap-2 place-items-center">
                        <label for="price">Precio</label>
                        <input type="number" name="price" id="price" required step="0.01"
                        class="border border-red-400 rounded-md px-1 outline-none max-w-full" 
                        />
                    </div> -->
				<div class="relative flex max-h-72 flex-col place-items-center gap-2">
					<div class="flex max-h-full flex-col overflow-y-auto">
						<ul>
							{#each totalProductsList as product}
								<li>
									<button
										type="button"
										class="w-full p-2 hover:bg-stone-800 focus:bg-stone-800 {isSelected(product)
											? 'text-red-500'
											: ''}"
										onclick={() => toggleProductToAdd(product)}
										onfocus={(e) => cancelFocus(e)}
									>
										{product.product.name}
									</button>
								</li>
							{/each}
						</ul>
					</div>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					{#if productsToAddList.length > 0}
						<button
							type="submit"
							class="cursor-pointer rounded-md border p-2 hover:text-red-500 focus:text-red-500"
							onfocus={(e) => cancelFocus(e)}
						>
							Agregar
						</button>
					{:else}
						<button type="submit" class="cursor-pointer rounded-md border p-2 opacity-50" disabled>
							Agregar
						</button>
					{/if}
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
					onclick={() => toggleAddProductToCatalogModalIsVisible(false)}
				>
					<Icon icon="material-symbols:close-rounded" class="text-3xl" />
				</div>
			</form>
		</ContainerModal>
	</div>
{/if}
