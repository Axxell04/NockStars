<script lang="ts">
	import { enhance } from "$app/forms";
	import ContactCard from "$lib/components/ContactCard.svelte";
	import { fade, scale, slide } from "svelte/transition";
	import type { PageProps } from "./$types";
	import Icon from "@iconify/svelte";

    let { data }: PageProps = $props();

    let contacts = $state(data.contacts);

    let formMessage = $state('');

    // Visible Elements
    let formSendMailIsVisible = $state(false);

    // Toggle Visible Elements
    function toggleFormSendMailIsVisible (visible?: boolean) {
        if (typeof visible === 'undefined') {
            formSendMailIsVisible = !formSendMailIsVisible;
        } else {
            formSendMailIsVisible = visible;
        }
    }

    function cancelFocus (e: FocusEvent) {
        const target = e.target as HTMLButtonElement;
        if (target) {
            setTimeout(() => {
                target.blur();
            }, 200)
        }
    }

    $effect(() => {
        if (formMessage) {
            setTimeout(() => {
                formMessage = ''
            }, 4000)
        }
    })

</script>

<div in:fade class="flex flex-col items-center gap-8 py-8">
    <!-- Contacts grid -->
    <div class="flex flex-wrap gap-3 justify-center max-w-2xl">
        {#each contacts as contact}
        <ContactCard {contact} />
        {/each}
    </div>

    <!-- Divider -->
    <div class="w-full max-w-md flex items-center gap-4">
        <div class="flex-1 h-px bg-white/10"></div>
        <span class="text-xs text-text-muted uppercase tracking-widest">o</span>
        <div class="flex-1 h-px bg-white/10"></div>
    </div>

    <!-- Contact form toggle -->
    <button 
        class="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-text-secondary transition-all duration-200 hover:border-brand-400/30 hover:text-brand-400 hover:bg-brand-400/10"
        onclick={() => toggleFormSendMailIsVisible()}
        onfocus={(e) => cancelFocus(e)}
        aria-expanded={formSendMailIsVisible}
        aria-haspopup="true"
    >
        <Icon icon="mdi:email-outline" class="text-lg" />
        Enviar correo
    </button>

    <!-- Contact form -->
    {#if formSendMailIsVisible}
    <form 
        transition:slide={{ duration: 300, easing: (t) => 1 - Math.pow(1 - t, 3) }}
        action="?/send_message" 
        method="post" 
        use:enhance={({ formElement }) => {
            return async ({ result }) => {
                if (result.type === "failure") {
                    if (result.data?.message) {
                        formMessage = result.data.message as string;
                    }
                } else if (result.type === "success") {
                    formElement.reset();
                    formMessage = "¡Mensaje enviado con éxito!";
                }
            }
        }}
        class="w-full max-w-md flex flex-col gap-4 p-6 rounded-2xl bg-surface-1 border border-white/5"
    >
        <div class="flex flex-col gap-2">
            <label for="from" class="text-sm font-medium text-text-secondary">
                Remitente
            </label>
            <input 
                type="text" 
                id="from" 
                name="from" 
                autocomplete="off"
                class="px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-text-primary placeholder:text-text-muted/50 outline-none transition-all duration-200 focus:border-brand-400/30 focus:ring-2 focus:ring-brand-400/10"
                placeholder="tu@email.com"
                required
            />
        </div>
        <div class="flex flex-col gap-2">
            <label for="message" class="text-sm font-medium text-text-secondary">
                Mensaje
            </label>
            <textarea 
                name="message" 
                id="message"
                rows="4"
                class="px-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-text-primary placeholder:text-text-muted/50 outline-none transition-all duration-200 focus:border-brand-400/30 focus:ring-2 focus:ring-brand-400/10 resize-none"
                placeholder="Escribí tu mensaje..."
                required
            ></textarea>
        </div>
        <button 
            class="w-full py-3 rounded-xl bg-brand-500 text-surface-0 font-semibold text-sm transition-all duration-200 hover:bg-brand-600 shadow-lg shadow-brand-500/20 active:scale-[0.98]"
            onfocus={(e) => cancelFocus(e)}
        >
            Enviar mensaje
        </button>
    </form>
    {/if}

    <!-- Form feedback -->
    {#if formMessage}
    <div transition:scale={{ duration: 200, start: 0.9 }} class="flex items-center gap-2 px-4 py-2.5 rounded-full bg-brand-500/10 text-brand-400 text-sm font-medium">
        <Icon icon="mdi:check-circle" class="text-lg" />
        {formMessage}
    </div>
    {/if}
</div>