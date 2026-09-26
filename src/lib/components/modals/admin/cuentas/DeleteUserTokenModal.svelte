<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import ContainerModal from '../../ContainerModal.svelte';
	import { enhance } from '$app/forms';
	import Icon from '@iconify/svelte';
	import type { UserToken } from '$lib/interfaces/user';

	interface Props {
		userTokenSelected?: UserToken;
		deleteUserTokenModalIsVisible: boolean;
		toggleDeleteUserTokenModalIsVisible: (visible?: boolean) => void;
		setUserTokens: (newUserTokens: UserToken[]) => void;
	}

	let {
		setUserTokens,
		deleteUserTokenModalIsVisible,
		toggleDeleteUserTokenModalIsVisible,
		userTokenSelected
	}: Props = $props();

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

{#if deleteUserTokenModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal
			toggleModal={toggleDeleteUserTokenModalIsVisible}
			visible={deleteUserTokenModalIsVisible}
			cancelClick={true}
		>
			<form
				action="?/delete_user_token"
				method="post"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'failure') {
							if (result.data?.message) {
								formMessage = result.data.message as string;
							}
						} else if (result.type === 'success') {
							if (result.data?.userTokens) {
								setUserTokens(result.data.userTokens as UserToken[]);
								toggleDeleteUserTokenModalIsVisible(false);
							}
						}
					};
				}}
				class="relative flex max-h-fit max-w-full flex-col gap-2 rounded-md border border-red-400 bg-stone-900 px-9 py-7 text-center"
			>
				<input type="hidden" name="token_id" value={userTokenSelected?.id ?? ''} />
				<div class="flex flex-col place-items-center gap-2">
					<label for="token">Token</label>
					<span class="text-red-300" style="font-family: 'PT Sans';">
						{userTokenSelected?.text ?? ''}
					</span>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="used">Usado</label>
					<span class="text-red-300" style="font-family: 'PT Sans';">
						{userTokenSelected?.active ? 'No' : 'Sí'}
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
					onclick={() => toggleDeleteUserTokenModalIsVisible(false)}
				>
					<Icon icon="material-symbols:close-rounded" class="text-3xl" />
				</div>
			</form>
		</ContainerModal>
	</div>
{/if}
