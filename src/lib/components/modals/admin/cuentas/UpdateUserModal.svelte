<script lang="ts">
	import type { Contact } from "$lib/interfaces/contact";
	import { fade, scale } from "svelte/transition";
	import ContainerModal from "../../ContainerModal.svelte";
	import { enhance } from "$app/forms";
	import Icon from "@iconify/svelte";
	import type { User } from "$lib/interfaces/user";

    interface Props {
        userSelected?: User
        updateUserModalIsVisible: boolean
        toggleUpdateUserModalIsVisible: (visible?: boolean) => void
        setUsers: (newUsers: User[]) => void
    }

    let { setUsers, updateUserModalIsVisible, toggleUpdateUserModalIsVisible, userSelected }:Props = $props();

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

{#if updateUserModalIsVisible}
    <div transition:fade={{duration: 200}}>
        <ContainerModal toggleModal={toggleUpdateUserModalIsVisible} visible={updateUserModalIsVisible} cancelClick={true}>
            <form action="?/update_user" method="post" use:enhance={() => {
                return async ({ result }) => {
                    if (result.type === "failure") {
                        if (result.data?.message) {
                            formMessage = result.data.message as string;
                        }
                    } else if (result.type === "success") {
                        if (result.data?.users) {
                            setUsers(result.data.users as User[]);
                            toggleUpdateUserModalIsVisible(false);
                        }
                    }
                }
            }}
            class="relative flex flex-col gap-2 text-center bg-stone-900 border border-red-400 py-7 px-9 rounded-md max-w-full max-h-fit"
            >
                <input type="hidden" name="user_id" value={userSelected?.id ?? ''}>
                <input type="hidden" name="admin" value={!userSelected?.admin}>
                {#if userSelected?.admin}
                <p>
                    ¿Desea quitar el rol de administrador al usuario <b style="font-family: 'PT Sans';">{userSelected.username}</b>?
                </p>
                {:else}
                <p>
                    ¿Desea dar rol de administrador al usuario <b style="font-family: 'PT Sans';">{userSelected?.username}</b>?
                </p>
                {/if}
                <div class="flex flex-wrap gap-4 place-items-center justify-center">
                    <button type="button" class="border hover:text-red-500 focus:text-red-500 rounded-md p-2 cursor-pointer" 
                    onclick={() => toggleUpdateUserModalIsVisible(false)}
                    onfocus={(e) => cancelFocus(e)}
                    >
                        Cancelar
                    </button>
                    <button type="submit" class="border font-semibold text-stone-900 bg-red-400 hover:bg-red-500 focus:bg-red-500 rounded-md p-2 cursor-pointer" 
                    onfocus={(e) => cancelFocus(e)}
                    >
                        Actualizar rol
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
                class="absolute top-2 right-2 hover:text-red-500 cursor-pointer" onclick="{() => toggleUpdateUserModalIsVisible(false)}">
                    <Icon icon="material-symbols:close-rounded" class="text-3xl" />
                </div>
            </form>
        </ContainerModal>
    </div>
{/if}