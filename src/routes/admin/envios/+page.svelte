<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { invalidateAll } from '$app/navigation';
	import { toast } from '$lib/toast.svelte.js';

	let { data }: PageProps = $props();

	// Shared by every action on this page: failures surface the server message,
	// successes refresh the fee AND the layout load, so every public price
	// updates immediately.
	const feedback: SubmitFunction =
		() =>
		async ({ result }) => {
			if (result.type === 'failure') {
				toast(result.data?.message ?? 'Error en el servidor');
				return;
			}
			if (result.type === 'success') {
				toast('Guardado');
				await invalidateAll();
			}
		};

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}
</script>

<div in:fade class="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-5">
	<div class="flex flex-col gap-1">
		<h1 class="text-text-primary text-2xl font-bold">Envíos</h1>
		<p class="text-text-muted text-sm">
			Costo de envío fijo por pedido. Se cobra una sola vez con cada compra y los precios públicos
			ya lo incluyen.
		</p>
	</div>

	<!-- Flat fee -->
	<section class="glass rounded-2xl border border-white/4 p-4">
		<h2 class="text-text-secondary mb-3 text-sm font-semibold uppercase">Costo de envío</h2>
		<form
			method="POST"
			action="?/set_fee"
			use:enhance={feedback}
			class="flex flex-wrap items-end gap-3"
		>
			<div class="flex flex-col gap-1">
				<label for="fee" class="text-text-secondary text-sm">Monto ($)</label>
				<input
					id="fee"
					name="fee"
					type="number"
					step="0.01"
					min="0"
					required
					value={data.fee}
					class="modal-input w-40"
				/>
			</div>
			<button type="submit" class="btn-primary py-2.5" onfocus={(e) => cancelFocus(e)}>
				Guardar
			</button>
		</form>
		<p class="text-text-muted mt-2 text-xs">
			Se cobra una sola vez por pedido, no por producto. Si un pedido se acuerda sin envío, el admin
			lo anula desde la ficha del pedido.
		</p>
	</section>
</div>
