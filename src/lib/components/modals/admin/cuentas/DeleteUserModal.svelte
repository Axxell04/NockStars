<script lang="ts">
	import type { Contact } from "$lib/interfaces/contact";
	import { fade, scale } from "svelte/transition";
	import ContainerModal from "../../ContainerModal.svelte";
	import { enhance } from "$app/forms";
	import Icon from "@iconify/svelte";
	import type { User } from "$lib/interfaces/user";

    interface Props {
        userSelected?: User
        deleteUserModalIsVisible: boolean
        toggleDeleteUserModalIsVisible: (visible?: boolean) => void
        setUsers: (newUsers: User[]) => void
    }

    let { setUsers, deleteUserModalIsVisible, toggleDeleteUserModalIsVisible, userSelected }:Props = $props();

    let formMessage = $state('');

    function cancelFocus (e: FocusEvent) {
        const target = e.target as HTMLButtonElement;
        if (target) {
            setTimeout(() => {
                target.blur();
            }, 300)
        }
    }

    $effect(() => {
        if (formMessage) {
            setTimeout(() => {
                formMessage = '';
            }, 4000)
        }
    })

</script>

{#if deleteUserModalIsVisible}
    <div transition:fade={{duration: 200}}>
        <ContainerModal toggleModal={toggleDeleteUserModalIsVisible} visible={deleteUserModalIsVisible} cancelClick={true}>
            <form action="?/delete_user" method="post" use:enhance={() => {
                return async ({ result }) => {
                    if (result.type === "failure") {
                        if (result.data?.message) {
                            formMessage = result.data.message as string;
                        }
                    } else if (result.type === "success") {
                        if (result.data?.users) {
                            setUsers(result.data.users as User[]);
                            toggleDeleteUserModalIsVisible(false);
                        }
                    }
                }
            }}
            class="relative flex flex-col gap-2 text-center bg-stone-900 border border-red-400 py-7 px-9 rounded-md max-w-full max-h-fit"
            >
                <input type="hidden" name="user_id" value={userSelected?.id ?? ''}>
                <div class="flex flex-col gap-2 place-items-center">
                    <label for="username">Username</label>
                    <span class="text-red-300" style="font-family: 'PT Sans';">
                        {userSelected?.username ?? ''}
                    </span>
                </div>
                <div class="flex flex-col gap-2 place-items-center">
                    <label for="admin">Admin</label>
                    <span class="text-red-300" style="font-family: 'PT Sans';">
                        {userSelected?.admin ? 'Sí' : 'No'}
                    </span>
                </div>
                <div class="flex flex-col gap-2 place-items-center">
                    <button type="submit" class="border hover:text-red-500 focus:text-red-500 rounded-md p-2 cursor-pointer" 
                    onfocus={(e) => cancelFocus(e)}
                    >
                        Eliminar
                    </button>
                </div>
                {#if formMessage}
                <div transition:scale>
                    <p class="text-red-400 text-center">
                        {formMessage}
                    </p>
                </div>
                {/if}
                <div role="button" tabindex="0" onkeydown={()=>{}}
                class="absolute top-2 right-2 hover:text-red-500 cursor-pointer" onclick="{() => toggleDeleteUserModalIsVisible(false)}">
                    <Icon icon="material-symbols:close-rounded" class="text-3xl" />
                </div>
            </form>
        </ContainerModal>
    </div>
{/if}