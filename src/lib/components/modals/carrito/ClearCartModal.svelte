<script lang="ts">
	import { fade } from 'svelte/transition';
	import ContainerModal from '../ContainerModal.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	interface Props {
		resetCart: () => void;
		clearCartModalIsVisible: boolean;
		toggleClearCartModalIsVisible: (visible?: boolean) => void;
	}

	let { resetCart, clearCartModalIsVisible, toggleClearCartModalIsVisible }: Props = $props();

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}
</script>

{#if clearCartModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleClearCartModalIsVisible} cancelClick={true}>
			<form
				action="?/clear_cart"
				method="post"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							await invalidateAll();
							resetCart();
							toggleClearCartModalIsVisible(false);
						}
					};
				}}
				class="flex flex-col gap-2 rounded-md border bg-stone-900 px-4 py-3"
			>
				<span class="text-xl"> ¿Desea vaciar su carrito de compra? </span>
				<div class="flex flex-row place-content-center gap-2">
					<button
						type="button"
						class="rounded border px-2 py-1 hover:text-red-500 focus:text-red-500"
						onclick={() => toggleClearCartModalIsVisible(false)}
						onfocus={(e) => cancelFocus(e)}
					>
						Cancelar
					</button>
					<button
						class="rounded border bg-red-400 px-2 py-1 text-stone-900 hover:bg-red-500 focus:bg-red-500"
						onfocus={(e) => cancelFocus(e)}
					>
						Confirmar
					</button>
				</div>
			</form>
		</ContainerModal>
	</div>
{/if}
