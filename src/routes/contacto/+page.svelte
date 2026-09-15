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

<div in:fade class="flex flex-col items-center gap-10 py-10">
    <!-- Section header -->
    <div class="flex flex-col items-center gap-3">
        <div class="w-1 h-6 bg-brand-400 rounded-full"></div>
        <h2 class="text-3xl font-bold text-text-primary tracking-wide text-center">Contacto</h2>
        <p class="text-text-muted text-center max-w-md">Conectá con nosotros a través de nuestros canales</p>
    </div>

    <!-- Contacts grid — Thread-woven -->
    <div class="flex flex-wrap gap-4 justify-center max-w-2xl">
        {#each contacts as contact, index}
        <div class="animate-thread-appear" style="--stagger-delay: {80 * index}ms">
            <ContactCard {contact} />
        </div>
        {/each}
    </div>

    <!-- Thread divider -->
    <div class="w-full max-w-md flex items-center gap-4">
        <div class="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        <span class="text-xs text-text-muted uppercase tracking-widest">o</span>
        <div class="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
    </div>

    <!-- Contact form toggle — Thread-wrapped button -->
    <button 
        class="flex items-center gap-2 px-6 py-3 rounded-xl border border-white/8 text-sm font-medium text-text-secondary transition-all duration-300 hover:border-brand-400/25 hover:text-brand-400 hover:bg-brand-400/5 hover:shadow-glow-sm"
        onclick={() => toggleFormSendMailIsVisible()}
        onfocus={(e) => cancelFocus(e)}
        aria-expanded={formSendMailIsVisible}
        aria-haspopup="true"
    >
        <Icon icon="mdi:email-outline" class="text-lg" />
        Enviar correo
    </button>

    <!-- Contact form — Thread-wrapped card -->
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
        class="relative w-full max-w-md flex flex-col gap-5 p-8 rounded-2xl bg-surface-1/80 border border-white/4"
    >
        <!-- Thread corner accents -->
        <div class="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-brand-400/15 rounded-tl-2xl pointer-events-none"></div>
        <div class="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-brand-400/15 rounded-br-2xl pointer-events-none"></div>

        <div class="flex flex-col gap-2">
            <label for="from" class="text-sm font-medium text-text-secondary">
                Remitente
            </label>
            <input 
                type="text" 
                id="from" 
                name="from" 
                autocomplete="off"
                class="input-thread"
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
                class="input-thread resize-none"
                placeholder="Escribí tu mensaje..."
                required
            ></textarea>
        </div>
        <button 
            class="btn-primary w-full"
            onfocus={(e) => cancelFocus(e)}
        >
            Enviar mensaje
        </button>
    </form>
    {/if}

    <!-- Form feedback — Thread-wrapped toast -->
    {#if formMessage}
    <div transition:scale={{ duration: 200, start: 0.9 }} class="flex items-center gap-2 px-5 py-3 rounded-full bg-brand-500/10 text-brand-400 text-sm font-medium border border-brand-400/15">
        <Icon icon="mdi:check-circle" class="text-lg" />
        {formMessage}
    </div>
    {/if}
</div>
