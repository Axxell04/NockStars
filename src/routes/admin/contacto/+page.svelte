<script lang="ts">
	import { fade } from "svelte/transition";
	import type { PageProps } from "./$types";
	import ContactCard from "$lib/components/ContactCard.svelte";
	import type { Contact } from "$lib/interfaces/contact";
	import AddContactModal from "$lib/components/modals/admin/contacto/AddContactModal.svelte";
	import EditContactModal from "$lib/components/modals/admin/contacto/EditContactModal.svelte";
	import DeleteContactModal from "$lib/components/modals/admin/contacto/DeleteContactModal.svelte";
	import Icon from "@iconify/svelte";

    let { data }:PageProps = $props();

    let contacts = $state(data.contacts);
    let contactSelected: Contact | undefined = $state();

    // Visible Elements
    let addContactModalIsVisible = $state(false);
    let editContactModalIsVisible = $state(false);
    let deleteContactModalIsVisible = $state(false);

    // Toggle Visible Elements 
    function toggleAddContactModalIsVisible (visible?: boolean) {
        if (typeof visible === 'undefined') {
            addContactModalIsVisible = !addContactModalIsVisible;
        } else {
            addContactModalIsVisible = visible;
        }
    }
    function toggleEditContactModalIsVisible (visible?: boolean) {
        if (typeof visible === 'undefined') {
            editContactModalIsVisible = !editContactModalIsVisible;
        } else {
            editContactModalIsVisible = visible;
        }
    }
    function toggleDeleteContactModalIsVisible (visible?: boolean) {
        if (typeof visible === 'undefined') {
            deleteContactModalIsVisible = !deleteContactModalIsVisible;
        } else {
            deleteContactModalIsVisible = visible;
        }
    }


    function setContacts (newContacts: Contact[]) {
        contacts = newContacts;
    }

    function selectThisContact (contact: Contact) {
        contactSelected = contact;
    }

    function cancelFocus (e: FocusEvent) {
        const target = e.target as HTMLButtonElement;
        if (target) {
            setTimeout(() => {
                target.blur();
            }, 200)
        }
    }

    $inspect(contacts);

</script>

<div in:fade class="flex flex-col gap-2 px-5 py-5 place-items-center">
    <div class="flex flex-col p-3">
        <button class="flex flex-row gap-1 border p-1 rounded-md hover:text-red-500 focus:text-red-500 place-items-center"
        onfocus={(e) => cancelFocus(e)}
        onclick={() => toggleAddContactModalIsVisible(true)}
        >
            <Icon icon="material-symbols:add-rounded" class="text-3xl" />
            <span style="font-family: 'PT Sans';">
                Añadir Contacto
            </span>
        </button>
    </div>
    <div class="flex flex-wrap gap-2 justify-center">
        {#each contacts as contact}
        <ContactCard {contact} {selectThisContact} {toggleEditContactModalIsVisible} {toggleDeleteContactModalIsVisible} />
        {/each}
    </div>
</div>

<AddContactModal {setContacts} {addContactModalIsVisible} {toggleAddContactModalIsVisible} />
<EditContactModal {setContacts} {editContactModalIsVisible} {toggleEditContactModalIsVisible} {contactSelected} />
<DeleteContactModal {setContacts} {deleteContactModalIsVisible} {toggleDeleteContactModalIsVisible} {contactSelected} />