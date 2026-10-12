<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { toast } from '$lib/toast.svelte.js';
	import {
		ORDER_STATUS_PLACEHOLDERS,
		ORDER_STATUS_PLACEHOLDER_HINTS,
		buildOrderStatusValues,
		renderOrderStatusTemplate
	} from '$lib/order-status-template';

	let { data }: PageProps = $props();

	// Live-edited copies of the saved templates. Re-seeded explicitly from the
	// action result below rather than derived from `data`, so typing is never
	// clobbered by a background invalidation.
	let pendingMessage = $state(data.messages.pendingMessage);
	let completedMessage = $state(data.messages.completedMessage);

	let pendingTextarea = $state<HTMLTextAreaElement>();
	let completedTextarea = $state<HTMLTextAreaElement>();

	// A fixed example order so the preview is deterministic. It runs through the
	// SAME builder and renderer the storefront uses, which is the point: a
	// placeholder that previews correctly substitutes correctly.
	const previewValues = buildOrderStatusValues({
		id: 'a1b2c3d4e5',
		clientName: 'María',
		completed: false,
		createdAt: new Date(2026, 0, 15, 14, 30),
		items: [
			{ unitPriceSnapshot: 2500, quantity: 2 },
			{ unitPriceSnapshot: 1500, quantity: 1 }
		],
		shippingFee: 500
	});

	const pendingPreview = $derived(renderOrderStatusTemplate(pendingMessage, previewValues));
	const completedPreview = $derived(
		renderOrderStatusTemplate(completedMessage, { ...previewValues, '{estado}': 'Completado' })
	);

	// Shared by every action on this page: failures surface the server message,
	// successes re-seed both editors from what was actually persisted.
	const feedback: SubmitFunction =
		() =>
		async ({ result }) => {
			if (result.type === 'failure') {
				toast(result.data?.message ?? 'Error en el servidor');
				return;
			}
			if (result.type === 'success') {
				const messages = result.data?.messages;
				if (messages) {
					pendingMessage = messages.pendingMessage;
					completedMessage = messages.completedMessage;
				}
				toast('Guardado');
			}
		};

	/**
	 * Insert `token` at the caret of `textarea`, updating the matching bound
	 * value. Each section calls this with its OWN element, so a token never
	 * lands in the other editor.
	 */
	function insertToken(
		el: HTMLTextAreaElement | undefined,
		set: (value: string) => void,
		token: string
	) {
		if (!el) return;

		const start = el.selectionStart ?? el.value.length;
		const end = el.selectionEnd ?? start;
		set(el.value.slice(0, start) + token + el.value.slice(end));

		// Place the caret after the inserted token. requestAnimationFrame because
		// the bound value has not been written back to the DOM yet when this runs.
		requestAnimationFrame(() => {
			el.focus();
			el.selectionStart = el.selectionEnd = start + token.length;
		});
	}

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}
</script>

<div in:fade class="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-5">
	<div class="flex flex-col gap-1">
		<h1 class="text-text-primary text-2xl font-bold">Estado del pedido</h1>
		<p class="text-text-muted text-sm">
			Mensaje que ve el cliente en su página de pedido. Se guarda uno por estado: vacío significa no
			mostrar nada.
		</p>
	</div>

	<!-- Placeholder reference: tokens with what each one resolves to. -->
	<section class="glass rounded-2xl border border-white/4 p-4">
		<h2 class="text-text-secondary mb-3 text-sm font-semibold uppercase">Placeholders</h2>
		<p class="text-text-muted mb-3 text-xs">
			Cada campo tiene sus propios botones para insertarlos en la posición del cursor. Un
			placeholder que no existe se muestra tal cual, para que el error se note.
		</p>
		<dl class="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
			{#each ORDER_STATUS_PLACEHOLDERS as token}
				<div class="flex items-baseline gap-2 text-sm">
					<dt class="text-text-secondary font-mono text-xs whitespace-nowrap">{token}</dt>
					<dd class="text-text-muted">{ORDER_STATUS_PLACEHOLDER_HINTS[token]}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<!-- Pending template -->
	<section class="glass rounded-2xl border border-white/4 p-4">
		<h2 class="text-text-secondary mb-3 text-sm font-semibold uppercase">
			<span class="mr-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-400">Pendiente</span>
		</h2>
		<form method="POST" action="?/save" use:enhance={feedback} class="flex flex-col gap-3">
			<label for="pendingMessage" class="text-text-secondary text-sm">Mensaje</label>
			<textarea
				id="pendingMessage"
				name="pendingMessage"
				rows="3"
				bind:this={pendingTextarea}
				bind:value={pendingMessage}
				class="modal-input w-full resize-y"
				placeholder={'Ej: Gracias {cliente}, tu pedido está en preparación.'}
			></textarea>

			<div class="flex flex-wrap gap-2">
				{#each ORDER_STATUS_PLACEHOLDERS as token}
					<button
						type="button"
						onclick={() => insertToken(pendingTextarea, (v) => (pendingMessage = v), token)}
						class="bg-surface-2/80 text-text-secondary hover:border-brand-400/30 hover:text-brand-400 rounded-lg border border-white/6 px-2.5 py-1 font-mono text-xs transition-colors duration-200"
						title={ORDER_STATUS_PLACEHOLDER_HINTS[token]}
					>
						{token}
					</button>
				{/each}
			</div>

			{#if pendingPreview.trim()}
				<div class="bg-surface-2/60 rounded-xl border border-white/4 p-3">
					<span class="text-text-muted mb-1 block text-xs">Vista previa</span>
					<p class="text-text-secondary text-sm">{pendingPreview}</p>
				</div>
			{/if}

			<div class="flex justify-end">
				<button type="submit" class="btn-primary py-2.5" onfocus={(e) => cancelFocus(e)}>
					Guardar
				</button>
			</div>
		</form>
	</section>

	<!-- Completed template -->
	<section class="glass rounded-2xl border border-white/4 p-4">
		<h2 class="text-text-secondary mb-3 text-sm font-semibold uppercase">
			<span class="mr-2 rounded-full bg-green-500/20 px-2 py-0.5 text-green-400">Completado</span>
		</h2>
		<form method="POST" action="?/save" use:enhance={feedback} class="flex flex-col gap-3">
			<label for="completedMessage" class="text-text-secondary text-sm">Mensaje</label>
			<textarea
				id="completedMessage"
				name="completedMessage"
				rows="3"
				bind:this={completedTextarea}
				bind:value={completedMessage}
				class="modal-input w-full resize-y"
				placeholder={'Ej: ¡Listo {cliente}! Tu pedido está completo.'}
			></textarea>

			<div class="flex flex-wrap gap-2">
				{#each ORDER_STATUS_PLACEHOLDERS as token}
					<button
						type="button"
						onclick={() => insertToken(completedTextarea, (v) => (completedMessage = v), token)}
						class="bg-surface-2/80 text-text-secondary hover:border-brand-400/30 hover:text-brand-400 rounded-lg border border-white/6 px-2.5 py-1 font-mono text-xs transition-colors duration-200"
						title={ORDER_STATUS_PLACEHOLDER_HINTS[token]}
					>
						{token}
					</button>
				{/each}
			</div>

			{#if completedPreview.trim()}
				<div class="bg-surface-2/60 rounded-xl border border-white/4 p-3">
					<span class="text-text-muted mb-1 block text-xs">Vista previa</span>
					<p class="text-text-secondary text-sm">{completedPreview}</p>
				</div>
			{/if}

			<div class="flex justify-end">
				<button type="submit" class="btn-primary py-2.5" onfocus={(e) => cancelFocus(e)}>
					Guardar
				</button>
			</div>
		</form>
	</section>
</div>
