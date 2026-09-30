<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import ContainerModal from '../../ContainerModal.svelte';
	import { enhance } from '$app/forms';
	import Icon from '@iconify/svelte';
	import type { User } from '$lib/interfaces/user';

	interface Props {
		userSelected?: User;
		updateUserModalIsVisible: boolean;
		toggleUpdateUserModalIsVisible: (visible?: boolean) => void;
		setUsers: (newUsers: User[]) => void;
	}

	let { setUsers, updateUserModalIsVisible, toggleUpdateUserModalIsVisible, userSelected }: Props =
		$props();

	let formMessage = $state('');

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 300);
		}
	}

	$effect(() => {
		if (formMessage) {
			const timeout = setTimeout(() => {
				formMessage = '';
			}, 4000);
			return () => clearTimeout(timeout);
		}
	});
</script>

{#if updateUserModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleUpdateUserModalIsVisible} cancelClick={true}>
			<form
				action="?/update_user"
				method="post"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'failure') {
							if (result.data?.message) {
								formMessage = result.data.message as string;
							}
						} else if (result.type === 'success') {
							if (result.data?.users) {
								setUsers(result.data.users as User[]);
								toggleUpdateUserModalIsVisible(false);
							}
						}
					};
				}}
				class="relative flex max-h-fit max-w-full flex-col gap-2 rounded-md border border-red-400 bg-stone-900 px-9 py-7 text-center"
			>
				<input type="hidden" name="user_id" value={userSelected?.id ?? ''} />
				<input type="hidden" name="admin" value={!userSelected?.admin} />
				{#if userSelected?.admin}
					<p>
						¿Desea quitar el rol de administrador al usuario <b style="font-family: 'PT Sans';"
							>{userSelected.username}</b
						>?
					</p>
				{:else}
					<p>
						¿Desea dar rol de administrador al usuario <b style="font-family: 'PT Sans';"
							>{userSelected?.username}</b
						>?
					</p>
				{/if}
				<div class="flex flex-wrap place-items-center justify-center gap-4">
					<button
						type="button"
						class="cursor-pointer rounded-md border p-2 hover:text-red-500 focus:text-red-500"
						onclick={() => toggleUpdateUserModalIsVisible(false)}
						onfocus={(e) => cancelFocus(e)}
					>
						Cancelar
					</button>
					<button
						type="submit"
						class="cursor-pointer rounded-md border bg-red-400 p-2 font-semibold text-stone-900 hover:bg-red-500 focus:bg-red-500"
						onfocus={(e) => cancelFocus(e)}
					>
						Actualizar rol
					</button>
				</div>
				{#if formMessage}
					<div transition:scale>
						<p class="text-center text-red-400">
							{formMessage}
						</p>
					</div>
				{/if}
				<button
					type="button"
					aria-label="Cerrar"
					class="absolute top-2 right-2 cursor-pointer hover:text-red-500"
					onclick={() => toggleUpdateUserModalIsVisible(false)}
				>
					<Icon icon="material-symbols:close-rounded" class="text-3xl" />
				</button>
			</form>
		</ContainerModal>
	</div>
{/if}
