<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import ContainerModal from '../../ContainerModal.svelte';
	import { enhance } from '$app/forms';
	import Icon from '@iconify/svelte';
	import type { User } from '$lib/interfaces/user';

	interface Props {
		userSelected?: User;
		deleteUserModalIsVisible: boolean;
		toggleDeleteUserModalIsVisible: (visible?: boolean) => void;
		setUsers: (newUsers: User[]) => void;
	}

	let { setUsers, deleteUserModalIsVisible, toggleDeleteUserModalIsVisible, userSelected }: Props =
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

{#if deleteUserModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal
			toggleModal={toggleDeleteUserModalIsVisible}
			visible={deleteUserModalIsVisible}
			cancelClick={true}
		>
			<form
				action="?/delete_user"
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
								toggleDeleteUserModalIsVisible(false);
							}
						}
					};
				}}
				class="relative flex max-h-fit max-w-full flex-col gap-2 rounded-md border border-red-400 bg-stone-900 px-9 py-7 text-center"
			>
				<input type="hidden" name="user_id" value={userSelected?.id ?? ''} />
				<div class="flex flex-col place-items-center gap-2">
					<label for="username">Username</label>
					<span class="text-red-300" style="font-family: 'PT Sans';">
						{userSelected?.username ?? ''}
					</span>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="admin">Admin</label>
					<span class="text-red-300" style="font-family: 'PT Sans';">
						{userSelected?.admin ? 'Sí' : 'No'}
					</span>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<button
						type="submit"
						class="cursor-pointer rounded-md border p-2 hover:text-red-500 focus:text-red-500"
						onfocus={(e) => cancelFocus(e)}
					>
						Eliminar
					</button>
				</div>
				{#if formMessage}
					<div transition:scale>
						<p class="text-center text-red-400">
							{formMessage}
						</p>
					</div>
				{/if}
				<div
					role="button"
					tabindex="0"
					onkeydown={() => {}}
					class="absolute top-2 right-2 cursor-pointer hover:text-red-500"
					onclick={() => toggleDeleteUserModalIsVisible(false)}
				>
					<Icon icon="material-symbols:close-rounded" class="text-3xl" />
				</div>
			</form>
		</ContainerModal>
	</div>
{/if}
