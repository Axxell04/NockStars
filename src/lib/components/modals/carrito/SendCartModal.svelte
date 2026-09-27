<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import ContainerModal from '../ContainerModal.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { CartItemWithProduct } from '$lib/actions';

	import { page } from '$app/state';

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

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}

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
				class="flex flex-col gap-2 rounded-md border bg-stone-900 px-4 py-3"
			>
				<input type="hidden" name="cart" value={JSON.stringify(cart)} />
				<div class="flex flex-col place-items-center">
					<label for="total_value">Valor total</label>
					<span class="font-semibold">$ {totalValue.toFixed(2)}</span>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="contact">Nombre de cliente</label>
					<input
						type="text"
						name="client-name"
						id="client-name"
						required
						autocomplete="off"
						class="max-w-full rounded-md border border-red-400 px-1 outline-none"
						autocorrect="off"
					/>
				</div>
				<div class="flex flex-row place-content-center gap-2">
					<button
						type="button"
						class="rounded border px-2 py-1 hover:text-red-500 focus:text-red-500"
						onclick={() => {
							toggleSendCartModalIsVisible(false);
						}}
						onfocus={(e) => cancelFocus(e)}
					>
						Cancelar
					</button>
					<button
						class="rounded border bg-red-400 px-2 py-1 text-stone-900 hover:bg-red-500 focus:bg-red-500"
						onfocus={(e) => cancelFocus(e)}
					>
						Realizar pedido
					</button>
				</div>
				{#if formMessage}
					<div transition:scale>
						<p class="text-center text-red-400">
							{formMessage}
						</p>
					</div>
				{/if}
			</form>
		</ContainerModal>
	</div>
{/if}
