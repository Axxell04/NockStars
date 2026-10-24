<script lang="ts">
	import { fade } from 'svelte/transition';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { invalidateAll } from '$app/navigation';
	import { toast } from '$lib/toast.svelte.js';
	import ContactCard from '$lib/components/ContactCard.svelte';
	import type { Contact } from '$lib/interfaces/contact';
	import AddContactModal from '$lib/components/modals/admin/contacto/AddContactModal.svelte';
	import EditContactModal from '$lib/components/modals/admin/contacto/EditContactModal.svelte';
	import DeleteContactModal from '$lib/components/modals/admin/contacto/DeleteContactModal.svelte';
	import Icon from '@iconify/svelte';
	import { isValidWhatsAppNumber, normalizeWhatsAppNumber } from '$lib/whatsapp';
	import { cancelFocus } from '$lib/focus';

	let { data }: PageProps = $props();

	// Shared by the contact-data form: failures surface the server message,
	// successes refresh the config AND the layout load, so the WhatsApp number
	// used after checkout updates immediately.
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

	let contacts = $state(untrack(() => data.contacts));
	let contactSelected: Contact | undefined = $state();

	// Live echo of the WhatsApp field. Seeded once from the saved value and
	// then owned by the input, so the preview reflects typing rather than the
	// last server response — same shape as the estado-pedido editor.
	let whatsappInput = $state(untrack(() => data.contactConfig?.whatsappNumber ?? ''));

	// Exactly the digits checkout will send to wa.me, and whether they form a
	// number WhatsApp can actually open. Both read `whatsappInput`, so the
	// preview and the save path can never disagree about the format.
	const whatsappDigits = $derived(normalizeWhatsAppNumber(whatsappInput));
	const whatsappIsValid = $derived(isValidWhatsAppNumber(whatsappDigits));
	// Ecuador numbers are written `593` + 9 digits; a bare 10-digit local
	// number is the mistake this preview exists to catch.
	const whatsappLooksLocal = $derived(/^0\d{9}$/.test(whatsappDigits));

	// Visible Elements
	let addContactModalIsVisible = $state(false);
	let editContactModalIsVisible = $state(false);
	let deleteContactModalIsVisible = $state(false);

	// Toggle Visible Elements
	function toggleAddContactModalIsVisible(visible?: boolean) {
		if (typeof visible === 'undefined') {
			addContactModalIsVisible = !addContactModalIsVisible;
		} else {
			addContactModalIsVisible = visible;
		}
	}
	function toggleEditContactModalIsVisible(visible?: boolean) {
		if (typeof visible === 'undefined') {
			editContactModalIsVisible = !editContactModalIsVisible;
		} else {
			editContactModalIsVisible = visible;
		}
	}
	function toggleDeleteContactModalIsVisible(visible?: boolean) {
		if (typeof visible === 'undefined') {
			deleteContactModalIsVisible = !deleteContactModalIsVisible;
		} else {
			deleteContactModalIsVisible = visible;
		}
	}

	function setContacts(newContacts: Contact[]) {
		contacts = newContacts;
	}

	function selectThisContact(contact: Contact) {
		contactSelected = contact;
	}
</script>

<div in:fade class="flex flex-col place-items-center gap-2 px-5 py-5">
	<!-- Datos de contacto operativos -->
	<section class="glass w-full max-w-2xl rounded-2xl border border-white/4 p-4">
		<h2 class="text-text-secondary mb-3 text-sm font-semibold uppercase">Datos de contacto</h2>
		<form
			method="POST"
			action="?/set_contact_config"
			use:enhance={feedback}
			class="flex flex-col gap-3"
		>
			<div class="flex flex-col gap-1">
				<label for="whatsapp" class="text-text-secondary text-sm">Número de WhatsApp</label>
				<input
					id="whatsapp"
					name="whatsapp"
					type="text"
					inputmode="numeric"
					autocomplete="tel"
					required
					bind:value={whatsappInput}
					placeholder="593997733619"
					class="modal-input"
				/>
				<p class="text-text-muted text-xs">
					Número que se abre en WhatsApp cuando un cliente finaliza el pedido.
				</p>
				<ul class="text-text-muted mt-1 flex list-disc flex-col gap-0.5 pl-4 text-xs">
					<li>
						Con código de país <span class="text-text-secondary font-mono">593</span> y los 9
						dígitos del celular, sin el <span class="text-text-secondary font-mono">0</span> inicial.
					</li>
					<li>
						Espacios, guiones y el <span class="text-text-secondary font-mono">+</span> se quitan solos
						al guardar.
					</li>
				</ul>

				<!-- Live preview: the exact digits checkout will dial, so a format
				     mistake is caught while typing instead of after a customer hits it. -->
				{#if whatsappInput.trim()}
					{#if whatsappIsValid}
						<div class="bg-surface-2/60 flex flex-col gap-0.5 rounded-xl border border-white/4 p-3">
							<span class="text-text-muted text-xs">Se enviará como</span>
							<p class="text-text-secondary font-mono text-sm">{whatsappDigits}</p>
							<a
								href="https://wa.me/{whatsappDigits}"
								target="_blank"
								rel="noopener noreferrer"
								class="text-brand-400 hover:text-brand-300 mt-0.5 text-xs underline-offset-2 hover:underline"
							>
								Probar el enlace
							</a>
						</div>
					{:else if whatsappLooksLocal}
						<p class="text-xs text-amber-400">
							Parece un número local. Agregá el código de país <span class="font-mono">593</span>
							adelante y quitá el <span class="font-mono">0</span> inicial: por ejemplo
							<span class="font-mono">099 773 3619</span> →
							<span class="font-mono">593997733619</span>.
						</p>
					{:else}
						<p class="text-xs text-amber-400">
							Faltan dígitos. Escribí el número completo con código de país, por ejemplo
							<span class="font-mono">593997733619</span>.
						</p>
					{/if}
				{/if}
			</div>
			<div class="flex flex-col gap-1">
				<label for="email" class="text-text-secondary text-sm">Correo destino</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					value={data.contactConfig?.orderEmail ?? ''}
					class="modal-input"
				/>
				<p class="text-text-muted text-xs">
					Correo que recibe los mensajes del formulario de contacto público.
				</p>
			</div>
			<button type="submit" class="btn-primary self-start py-2.5" onfocus={(e) => cancelFocus(e)}>
				Guardar
			</button>
		</form>
	</section>

	<div class="flex flex-col p-3">
		<button
			class="flex flex-row place-items-center gap-1 rounded-md border p-1 hover:text-red-500 focus:text-red-500"
			onfocus={(e) => cancelFocus(e)}
			onclick={() => toggleAddContactModalIsVisible(true)}
		>
			<Icon icon="material-symbols:add-rounded" class="text-3xl" />
			<span style="font-family: 'PT Sans';"> Añadir Contacto </span>
		</button>
	</div>
	<div class="flex flex-wrap justify-center gap-2">
		{#each contacts as contact}
			<ContactCard
				{contact}
				{selectThisContact}
				{toggleEditContactModalIsVisible}
				{toggleDeleteContactModalIsVisible}
			/>
		{/each}
	</div>
</div>

<AddContactModal {setContacts} {addContactModalIsVisible} {toggleAddContactModalIsVisible} />
<EditContactModal
	{setContacts}
	{editContactModalIsVisible}
	{toggleEditContactModalIsVisible}
	{contactSelected}
/>
<DeleteContactModal
	{setContacts}
	{deleteContactModalIsVisible}
	{toggleDeleteContactModalIsVisible}
	{contactSelected}
/>
