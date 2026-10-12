<script lang="ts">
	import { fade } from 'svelte/transition';
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

	let contacts = $state(data.contacts);
	let contactSelected: Contact | undefined = $state();

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

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
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
					required
					value={data.contactConfig?.whatsappNumber ?? ''}
					class="modal-input"
				/>
				<p class="text-text-muted text-xs">
					Número que se abre en WhatsApp cuando un cliente finaliza el pedido.
				</p>
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
