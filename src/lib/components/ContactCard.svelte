<script lang="ts">
	import { page } from '$app/state';
	import type { Contact } from '$lib/interfaces/contact';

	import Icon from '@iconify/svelte';
	import { scale } from 'svelte/transition';

	interface Props {
		contact: Contact;
		toggleDeleteContactModalIsVisible?: (visible?: boolean) => void;
		toggleEditContactModalIsVisible?: (visible?: boolean) => void;
		selectThisContact?: (contact: Contact) => void;
	}

	let {
		contact,
		toggleDeleteContactModalIsVisible,
		toggleEditContactModalIsVisible,
		selectThisContact
	}: Props = $props();

	let actualRoute = $state(page.route.id);

	let icon = $derived(`simple-icons:${contact.icon}`);

	if (typeof toggleDeleteContactModalIsVisible === 'undefined') {
		toggleDeleteContactModalIsVisible = () => {};
	}

	if (typeof toggleEditContactModalIsVisible === 'undefined') {
		toggleEditContactModalIsVisible = () => {};
	}

	if (typeof selectThisContact === 'undefined') {
		selectThisContact = () => {};
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

<a
	href={contact.url}
	target="_blank"
	class="group bg-surface-1/80 hover:border-brand-400/20 hover:bg-surface-2/80 hover:shadow-glow-sm flex items-center gap-4 rounded-xl border
    border-white/4 px-5 py-4 transition-all duration-400 ease-out
    {actualRoute?.includes('/admin') ? 'pointer-events-none' : ''}
    "
	onclick={actualRoute?.includes('/admin') ? (e) => e.preventDefault() : () => {}}
>
	<!-- Thread-wrapped icon -->
	<span
		class="bg-surface-2 text-brand-400 group-hover:bg-brand-500/10 relative flex h-11 w-11 items-center justify-center rounded-full transition-all duration-400 group-hover:scale-110"
	>
		<Icon {icon} class="text-xl" />
		<!-- Thread ring on hover -->
		<span
			class="border-brand-400/0 group-hover:border-brand-400/20 absolute inset-0 scale-110 rounded-full border transition-all duration-400"
		></span>
	</span>

	<span
		class="text-text-secondary group-hover:text-text-primary min-w-0 text-base font-[var(--font-body)] font-medium break-words transition-colors duration-300"
	>
		{contact.text}
	</span>

	{#if actualRoute?.includes('/admin')}
		<div
			transition:scale={{ duration: 150, start: 0.9 }}
			class="ml-auto flex items-center gap-1 text-xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
		>
			<button
				class="text-text-muted hover:text-brand-400 hover:bg-surface-3 rounded-lg p-1.5 transition-colors"
				onclick={(e) => {
					e.stopPropagation();
					selectThisContact(contact);
					toggleDeleteContactModalIsVisible(true);
				}}
				onfocus={(e) => cancelFocus(e)}
				aria-label="Eliminar contacto"
			>
				<Icon icon="mdi:delete-outline" />
			</button>
			<button
				class="text-text-muted hover:text-brand-400 hover:bg-surface-3 rounded-lg p-1.5 transition-colors"
				onclick={(e) => {
					e.stopPropagation();
					selectThisContact(contact);
					toggleEditContactModalIsVisible(true);
				}}
				onfocus={(e) => cancelFocus(e)}
				aria-label="Editar contacto"
			>
				<Icon icon="mdi:pencil-outline" />
			</button>
		</div>
	{/if}
</a>
