<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import ContainerModal from '../ContainerModal.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { CartItemWithProduct } from '$lib/actions';
	import { page } from '$app/state';
	import Icon from '@iconify/svelte';

	interface Props {
		sendCartModalIsVisible: boolean;
		toggleSendCartModalIsVisible: (visible?: boolean) => void;
		cart: CartItemWithProduct[];
	}

	let { sendCartModalIsVisible, toggleSendCartModalIsVisible, cart }: Props = $props();

	let formMessage = $state('');

	let totalValue = $derived(
		cart.reduce((pv, cv) => {
			const variant = cv.variant;
			const price =
				variant?.priceOverride !== null && variant?.priceOverride !== undefined
					? Number(variant.priceOverride)
					: cv.product.price;
			return pv + price * cv.quantity;
		}, 0)
	);

	function sendWhatsApp(cod: string) {
		const number = '593997733619';
		const message = encodeURIComponent(
			`Hola, este es mi pedido \n ${page.url.origin}/pedido/${cod}`
		);
		window.open(`https://wa.me/${number}?text=${message}`, '_blank');
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

{#if sendCartModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleSendCartModalIsVisible} cancelClick={true}>
			<form
				action="?/send_cart"
				method="post"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'failure') {
							if (result.data?.message) {
								formMessage = result.data.message as string;
							}
						} else if (result.type === 'success') {
							await invalidateAll();
							if (result.data?.cod) {
								sendWhatsApp(result.data?.cod as string);
							}
							toggleSendCartModalIsVisible(false);
						}
					};
				}}
				class="modal-shell"
			>
				<input type="hidden" name="cart" value={JSON.stringify(cart)} />

				<div class="modal-header">
					<h3 class="modal-title">Realizar Pedido</h3>
					<button
						type="button"
						class="modal-close"
						onclick={() => toggleSendCartModalIsVisible(false)}
						aria-label="Cerrar modal"
					>
						<Icon icon="material-symbols:close-rounded" class="text-xl" />
					</button>
				</div>

				<div
					class="modal-field bg-surface-2/60 flex flex-row items-center justify-between rounded-lg border border-white/6 p-3"
				>
					<span class="text-text-secondary text-sm font-medium">Valor total:</span>
					<span class="text-brand-400 font-display text-lg font-bold tracking-wide"
						>$ {totalValue.toFixed(2)}</span
					>
				</div>

				<div class="modal-field">
					<label for="client-name" class="modal-label">Nombre del cliente</label>
					<input
						type="text"
						name="client-name"
						id="client-name"
						required
						autocomplete="off"
						placeholder="Tu nombre completo"
						class="modal-input"
						autocorrect="off"
					/>
				</div>

				<div class="modal-actions">
					<button
						type="button"
						class="btn-secondary"
						onclick={() => toggleSendCartModalIsVisible(false)}
					>
						Cancelar
					</button>
					<button type="submit" class="btn-primary"> Realizar pedido </button>
				</div>

				{#if formMessage}
					<div transition:scale>
						<p class="text-center text-sm font-medium text-red-400">
							{formMessage}
						</p>
					</div>
				{/if}
			</form>
		</ContainerModal>
	</div>
{/if}
