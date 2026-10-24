<script lang="ts">
	import { page } from '$app/state';
	import type { Contact } from '$lib/interfaces/contact';

	import Icon from '@iconify/svelte';
	import { untrack } from 'svelte';
	import { scale } from 'svelte/transition';
	import { cancelFocus } from '$lib/focus';

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
	let isAdmin = $derived(actualRoute?.includes('/admin'));

	let icon = $derived(`simple-icons:${contact.icon}`);

	toggleDeleteContactModalIsVisible = untrack(
		() => toggleDeleteContactModalIsVisible ?? (() => {})
	);

	toggleEditContactModalIsVisible = untrack(() => toggleEditContactModalIsVisible ?? (() => {}));

	selectThisContact = untrack(() => selectThisContact ?? (() => {}));

	function openContactUrl(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		window.open(contact.url, '_blank');
	}
</script>

{#if isAdmin}
	<!-- Admin: the card is a selectable row, NOT a link. The contact URL is
	     a separate button so edit/delete clicks never fight navigation. -->
	<div
		class="group bg-surface-1/80 hover:border-brand-400/20 hover:bg-surface-2/80 hover:shadow-glow-sm flex items-center gap-4 rounded-xl border
     border-white/4 px-5 py-4 transition-all duration-400 ease-out"
		role="button"
		tabindex="0"
		onclick={() => selectThisContact(contact)}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				selectThisContact(contact);
			}
		}}
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

		<!-- Open link button — only in admin, separate from the card click -->
		<button
			class="text-text-muted hover:text-brand-400 hover:bg-surface-3 flex-shrink-0 rounded-lg p-1.5 transition-colors"
			onclick={openContactUrl}
			onfocus={(e) => cancelFocus(e)}
			aria-label="Abrir enlace del contacto"
			title="Abrir enlace"
		>
			<Icon icon="mdi:open-in-new" class="text-xl" />
		</button>

		<!-- Edit / Delete buttons — always visible in admin (no hover gate) -->
		<div
			transition:scale={{ duration: 150, start: 0.9 }}
			class="ml-auto flex items-center gap-1 text-xl opacity-100"
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
	</div>
{:else}
	<!-- Public: the whole card IS the link, same as before. -->
	<a
		href={contact.url}
		target="_blank"
		class="group bg-surface-1/80 hover:border-brand-400/20 hover:bg-surface-2/80 hover:shadow-glow-sm flex items-center gap-4 rounded-xl border
     border-white/4 px-5 py-4 transition-all duration-400 ease-out"
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
	</a>
{/if}
