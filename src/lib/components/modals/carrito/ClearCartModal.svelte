<script lang="ts">
	import { fade } from 'svelte/transition';
	import ContainerModal from '../ContainerModal.svelte';
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import Icon from '@iconify/svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	interface Props {
		clearCartModalIsVisible: boolean;
		toggleClearCartModalIsVisible: (visible?: boolean) => void;
		onCartResult: (result: ActionResult) => Promise<void>;
	}

	let { clearCartModalIsVisible, toggleClearCartModalIsVisible, onCartResult }: Props = $props();

	// In-flight state for the confirm action: set on submission, cleared in
	// `finally` after onCartResult resolves so a failure can never leave the
	// button stuck. The modal only closes on success, after the result lands.
	let submitting = $state(false);
</script>

{#if clearCartModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleClearCartModalIsVisible} cancelClick={true}>
			<form
				action="?/clearCart"
				method="post"
				use:enhance={() => {
					submitting = true;
					return async ({ result }) => {
						try {
							await onCartResult(result);
							if (result.type === 'success') {
								toggleClearCartModalIsVisible(false);
							}
						} finally {
							submitting = false;
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
						class="btn-secondary {submitting ? 'cursor-not-allowed opacity-50' : ''}"
						disabled={submitting}
						onclick={() => toggleClearCartModalIsVisible(false)}
					>
						Cancelar
					</button>
					<button type="submit" class="btn-primary" disabled={submitting} aria-busy={submitting}>
						{#if submitting}
							<Spinner />
						{/if}
						Confirmar
					</button>
				</div>
			</form>
		</ContainerModal>
	</div>
{/if}
