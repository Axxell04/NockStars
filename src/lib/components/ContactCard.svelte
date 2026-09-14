<script lang="ts">
	import { page } from "$app/state";
	import type { Contact } from "$lib/interfaces/contact";


	import Icon from "@iconify/svelte";
	import { scale } from "svelte/transition";

    interface Props {
        contact: Contact
        toggleDeleteContactModalIsVisible?: (visible?: boolean) => void
        toggleEditContactModalIsVisible?: (visible?: boolean) => void
        selectThisContact?: (contact: Contact) => void
    }

    let { contact, toggleDeleteContactModalIsVisible, toggleEditContactModalIsVisible, selectThisContact }:Props = $props();

    let actualRoute = $state(page.route.id);

    let icon = $derived(`simple-icons:${contact.icon}`)

    if (typeof toggleDeleteContactModalIsVisible === 'undefined') {
        toggleDeleteContactModalIsVisible = () => {}
    }

    if (typeof toggleEditContactModalIsVisible === 'undefined') {
        toggleEditContactModalIsVisible = () => {}
    }

    if (typeof selectThisContact === 'undefined') {
        selectThisContact = (contact: Contact) => {}
    }

    function cancelFocus (e: FocusEvent) {
        const target = e.target as HTMLButtonElement;
        if (target) {
            setTimeout(() => {
                target.blur();
            }, 200)
        }
    }

</script>

<a href={contact.url} target="_blank" class="group flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-300
    bg-surface-1 border border-white/5 hover:border-white/10 hover:bg-surface-2
    {actualRoute?.includes('/admin') ? 'pointer-events-none' : ''}
    " 
    onclick={actualRoute?.includes('/admin') ? (e) => e.preventDefault() : () => {}}
>
    <span class="flex items-center justify-center w-10 h-10 rounded-full bg-surface-2 text-brand-400 transition-colors group-hover:bg-brand-500/10">
        <Icon {icon} class="text-xl"/>
    </span>
    <span class="text-base font-medium text-text-secondary transition-colors group-hover:text-text-primary font-[var(--font-body)]">
        {contact.text}
    </span>
    {#if actualRoute?.includes('/admin')}        
    <div transition:scale={{ duration: 150, start: 0.9 }} class="flex items-center gap-1 ml-auto text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button class="p-1.5 rounded-lg text-text-muted transition-colors hover:text-brand-400 hover:bg-surface-3" 
        onclick={(e)=>{ e.stopPropagation(); selectThisContact(contact); toggleDeleteContactModalIsVisible(true) }}
        onfocus={(e) => cancelFocus(e)}
        aria-label="Eliminar contacto"
        >
            <Icon icon="mdi:delete-outline" />
        </button>
        <button class="p-1.5 rounded-lg text-text-muted transition-colors hover:text-brand-400 hover:bg-surface-3" 
        onclick={(e)=>{ e.stopPropagation(); selectThisContact(contact); toggleEditContactModalIsVisible(true) }}
        onfocus={(e) => cancelFocus(e)}
        aria-label="Editar contacto"
        >
            <Icon icon="mdi:pencil-outline" />
        </button>
    </div>
    {/if}
</a>