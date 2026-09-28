<script lang="ts">
	import { fade } from 'svelte/transition';
	import ContainerModal from '../ContainerModal.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Icon from '@iconify/svelte';

	interface Props {
		clearCartModalIsVisible: boolean;
		toggleClearCartModalIsVisible: (visible?: boolean) => void;
	}

	let { clearCartModalIsVisible, toggleClearCartModalIsVisible }: Props = $props();
</script>

{#if clearCartModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleClearCartModalIsVisible} cancelClick={true}>
			<form
				action="?/clearCart"
				method="post"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							await invalidateAll();
							toggleClearCartModalIsVisible(false);
						}
					};
				}}
				class="modal-shell"
			>
				<div class="modal-header">
					<h3 class="modal-title">Vaciar carrito</h3>
					<button
						type="button"
						class="modal-close"
						onclick={() => toggleClearCartModalIsVisible(false)}
						aria-label="Cerrar modal"
					>
						<Icon icon="material-symbols:close-rounded" class="text-xl" />
					</button>
				</div>

				<p class="text-text-secondary text-sm leading-relaxed">
					¿Estás seguro de que deseas vaciar tu carrito de compra? Esta acción no se puede deshacer.
				</p>

				<div class="modal-actions">
					<button
						type="button"
						class="btn-secondary"
						onclick={() => toggleClearCartModalIsVisible(false)}
					>
						Cancelar
					</button>
					<button type="submit" class="btn-primary"> Confirmar </button>
				</div>
			</form>
		</ContainerModal>
	</div>
{/if}
