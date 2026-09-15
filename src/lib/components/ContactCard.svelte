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

<a href={contact.url} target="_blank" class="group flex items-center gap-4 py-4 px-5 rounded-xl transition-all duration-400 ease-out
    bg-surface-1/80 border border-white/4 hover:border-brand-400/20 hover:bg-surface-2/80 hover:shadow-glow-sm
    {actualRoute?.includes('/admin') ? 'pointer-events-none' : ''}
    " 
    onclick={actualRoute?.includes('/admin') ? (e) => e.preventDefault() : () => {}}
>
    <!-- Thread-wrapped icon -->
    <span class="relative flex items-center justify-center w-11 h-11 rounded-full bg-surface-2 text-brand-400 transition-all duration-400 group-hover:bg-brand-500/10 group-hover:scale-110">
        <Icon {icon} class="text-xl"/>
        <!-- Thread ring on hover -->
        <span class="absolute inset-0 rounded-full border border-brand-400/0 group-hover:border-brand-400/20 transition-all duration-400 scale-110"></span>
    </span>
    
    <span class="text-base font-medium text-text-secondary transition-colors duration-300 group-hover:text-text-primary font-[var(--font-body)]">
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
