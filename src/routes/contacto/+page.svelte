<script lang="ts">
	import { enhance } from "$app/forms";
	import ContactCard from "$lib/components/ContactCard.svelte";
	import { fade, scale, slide } from "svelte/transition";
	import type { PageProps } from "./$types";

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

<div in:fade class="flex flex-col gap-2 px-5 py-5 place-items-center">
    <div class="flex flex-wrap gap-2 justify-center">
        {#each contacts as contact}
        <ContactCard {contact} />
        {/each}
    </div>
    <div class="pt-3 mt-5 border-t w-full text-center text-red-300">
        <button class="border py-2 px-3 rounded-md hover:text-red-400 focus:text-red-400 focus:bg-stone-800" 
        onclick={() => toggleFormSendMailIsVisible()}
        onfocus={(e) => cancelFocus(e)}
        aria-expanded={formSendMailIsVisible}
        aria-haspopup="true"
        >
            Enviar correo
        </button>
    </div>
    {#if formSendMailIsVisible}
    <form transition:slide={{axis: 'y'}} action="?/send_message" method="post" use:enhance={({ formElement }) => {
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
    class="flex flex-col gap-3 py-3 px-4"
    >
    
        <div class="flex flex-col gap-2">
            <label for="from">
                Remitente
            </label>
            <input type="text" id="from" name="from" autocomplete="off"
            class="p-2 border bg-transparent outline-none rounded" style="text-align: left;" required/>
        </div>
        <div class="flex flex-col gap-2">
            <label for="message">
                Mensaje
            </label>
            <textarea name="message" id="message"
            class="p-2 border bg-transparent outline-none rounded" style="text-align: left; font-family: Nunito" required
            ></textarea>
        </div>
        <div>
            <button class="border py-1 px-2 font-semibold rounded-md w-full bg-red-400 text-stone-900 hover:bg-red-500 focus:bg-red-500"
            onfocus={(e) => cancelFocus(e)}
            >
                Enviar
            </button>
        </div>
    </form>
    {/if}
    {#if formMessage}
    <div transition:scale class="flex flex-col place-items-center place-content-center py-2 px-3">
        <span>
            {formMessage}
        </span>
    </div>
    {/if}
</div>