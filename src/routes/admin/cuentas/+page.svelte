<script lang="ts">
	import { fade, fly, scale } from "svelte/transition";
	import type { PageProps } from "./$types";
	import { enhance } from "$app/forms";
	import type { User, UserToken } from "$lib/interfaces/user";
	import Icon from "@iconify/svelte";
	import DeleteUserModal from "$lib/components/modals/admin/cuentas/DeleteUserModal.svelte";
	import UpdateUserModal from "$lib/components/modals/admin/cuentas/UpdateUserModal.svelte";
	import DeleteUserTokenModal from "$lib/components/modals/admin/cuentas/DeleteUserTokenModal.svelte";

    let { data }: PageProps = $props()

    let userTokens = $state(data.userTokens);
    let users = $state(data.users);
    let sessionUser = $state(data.user)

    let viewState = $state('users')

    let userSelected: User | undefined = $state();
    let userTokenSelected: UserToken | undefined = $state();

    // HTML ELements
    let btnGetUserTokens: HTMLButtonElement | undefined = $state();
    let btnGetUsers: HTMLButtonElement | undefined = $state();

    // Visible Elements
    let deleteUserModalIsVisible = $state(false);
    let deleteUserTokenModalIsVisible = $state(false);
    let updateUserModalIsVisible = $state(false);

    let formMessage = $state('');


    // Toggle Visible Elements
    function toggleDeleteUserModalIsVisible (visible?: boolean) {
        if (typeof visible !== 'undefined') {
            deleteUserModalIsVisible = visible;
        } else {
            deleteUserModalIsVisible = !deleteUserModalIsVisible;
        }
    }
    function toggleDeleteUserTokenModalIsVisible (visible?: boolean) {
        if (typeof visible !== 'undefined') {
            deleteUserTokenModalIsVisible = visible;
        } else {
            deleteUserTokenModalIsVisible = !deleteUserTokenModalIsVisible;
        }
    }
    function toggleUpdateUserModalIsVisible (visible?: boolean) {
        if (typeof visible !== 'undefined') {
            updateUserModalIsVisible = visible;
        } else {
            updateUserModalIsVisible = !updateUserModalIsVisible;
        }
    }


    function setUsers (newUsers: User[]) {
        users = newUsers;
    }

    function setUserTokens (newUserTokens: UserToken[]) {
        userTokens = newUserTokens;
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
        if (viewState === 'tokens') {
            if (typeof btnGetUserTokens !== 'undefined') {
                btnGetUserTokens.click();
            }
        } else if (viewState === 'users') {
            if (typeof btnGetUsers !== 'undefined') {
                btnGetUsers.click();
            }
        }
    })

</script>

<div in:fade class="flex flex-col gap-5">
    <section class="flex flex-row gap-5 place-content-center">
        <button class="p-2 hover:text-red-500 focus:text-red-500 {viewState === 'users' ? 'border-b' : 'opacity-95'}"
        onclick={() => viewState = 'users'}
        onfocus={(e) => cancelFocus(e)}
        >
            Usuarios
        </button>
        <button class="p-2 hover:text-red-500 focus:text-red-500 {viewState === 'tokens' ? 'border-b' : 'opacity-95'}"
        onclick={() => viewState = 'tokens'}
        onfocus={(e) => cancelFocus(e)}
        >
            Tokens
        </button>
    </section>
    {#if viewState === 'users'}
    <section in:fade class="flex flex-col gap-2 place-items-center px-4">
        {#each users as user}
            <div class="flex flex-row gap-2 p-2 place-items-center">
                <span class="text-xl" style="font-family: 'PT Sans';">
                    {user.username}
                </span>
                {#if user.admin}
                    {#if user.id !== sessionUser.id}
                    <button class="p-1 rounded-full hover:text-red-500 focus:text-red-500 focus:bg-stone-800"
                    onclick={() => {userSelected = user; toggleUpdateUserModalIsVisible(true)}}
                    onfocus={(e) => cancelFocus(e)}
                    >
                        <Icon icon="fluent:person-star-48-filled" class="text-3xl" />
                    </button>
                    {:else}
                    <button class="p-1 rounded-full opacity-70"
                    >
                        <Icon icon="fluent:person-star-48-filled" class="text-3xl" />
                    </button>
                    {/if}
                {:else}
                    {#if user.id !== sessionUser.id}                    
                    <button class="p-1 rounded-full hover:text-red-500 focus:text-red-500 focus:bg-stone-800"
                    onclick={() => {userSelected = user; toggleUpdateUserModalIsVisible(true)}}
                    onfocus={(e) => cancelFocus(e)}
                    >
                        <Icon icon="fluent:person-star-48-regular" class="text-3xl" />
                    </button>
                    {:else}
                    <button class="p-1 rounded-full opacity-70"
                    >
                        <Icon icon="fluent:person-star-48-regular" class="text-3xl" />
                    </button>
                    {/if}
                {/if}
                {#if user.id !== sessionUser.id}                    
                <button class="p-1 rounded-full hover:text-red-500 focus:text-red-500 focus:bg-stone-800"
                onclick={() => { userSelected = user; toggleDeleteUserModalIsVisible(true)}}
                onfocus={(e) => cancelFocus(e)}
                >
                    <Icon icon="famicons:trash" class="text-3xl" />
                </button>
                {:else}
                <button class="p-1 rounded-full opacity-70"
                disabled
                >
                    <Icon icon="famicons:trash" class="text-3xl" />
                </button>
                {/if}
            </div>
            {/each}
        </section>
        {:else if viewState === 'tokens'}
        <section in:fade class="flex flex-col gap-3 place-items-center px-4">
            <form action="?/generate_user_token" method="post" use:enhance={() => {
                return async ({ result }) => {
                    if (result.type === "failure") {
                        formMessage = result.data?.message as string ?? ''
                    } else if (result.type === "success") {
                        userTokens = result.data?.userTokens as UserToken[];
                }
            }
        }} 
        
        >
            <button class="border rounded-md py-1 px-2 hover:text-red-500 focus:text-red-500 focus:bg-stone-800"
            onfocus={(e) => cancelFocus(e)}
            >
                Generar Token de Usuario
            </button>
        </form>
        <div class="flex flex-col gap-2 place-items-center">
            {#each userTokens as token}
                <div transition:fly={{delay: userTokens.indexOf(token) + 100}} class="flex flex-row gap-2 place-items-center">
                    <span>
                        {token.text}
                    </span>
                    <button class="p-1 rounded-full hover:text-red-500 focus:text-red-500 focus:bg-stone-800"
                    onclick={() => navigator.clipboard.writeText(token.text)}
                    onfocus={(e) => cancelFocus(e)}
                    >
                        <Icon icon="heroicons-outline:clipboard-copy" class="text-3xl" />
                    </button>
                    {#if token.active}
                    <button class="p-1 rounded-full"
                    >
                        <Icon icon="akar-icons:circle-check" class="text-3xl" />
                    </button>
                    {:else}
                    <button class="p-1 rounded-full"
                    >
                        <Icon icon="akar-icons:circle-check-fill" class="text-3xl" />
                    </button>
                    {/if}
                    <button class="p-1 rounded-full hover:text-red-500 focus:text-red-500 focus:bg-stone-800"
                    onclick={() => { userTokenSelected = token; toggleDeleteUserTokenModalIsVisible(true)}}
                    onfocus={(e) => cancelFocus(e)}
                    >
                        <Icon icon="famicons:trash" class="text-3xl" />
                    </button>
                </div>
            {/each}
        </div>
    </section>
    {/if}
</div>

<form action="?/get_user_tokens" method="post" use:enhance={() => {
    return async ({ result }) => {
        if (result.type === "success") {
            if (result.data?.userTokens) {
                userTokens = result.data.userTokens as UserToken[];
            }
        }
    }
}}
class="hidden"
>
    <button bind:this={btnGetUserTokens} type="submit">
        Get User Tokens
    </button>
</form>
<form action="?/get_users" method="post" use:enhance={() => {
    return async ({ result }) => {
        if (result.type === "success") {
            if (result.data?.users) {
                users = result.data.users as User[];
            }
        }
    }
}}
class="hidden"
>
    <button bind:this={btnGetUsers} type="submit">
        Get Users
    </button>
</form>

<DeleteUserModal {setUsers} {deleteUserModalIsVisible} {toggleDeleteUserModalIsVisible} {userSelected} />
<DeleteUserTokenModal {setUserTokens} {deleteUserTokenModalIsVisible} {toggleDeleteUserTokenModalIsVisible} {userTokenSelected} />
<UpdateUserModal {setUsers} {updateUserModalIsVisible} {toggleUpdateUserModalIsVisible} {userSelected} />