<script lang="ts">
	import type { Contact } from '$lib/interfaces/contact';
	import { fade, scale } from 'svelte/transition';
	import ContainerModal from '../../ContainerModal.svelte';
	import { enhance } from '$app/forms';
	import Icon from '@iconify/svelte';

	interface Props {
		contactSelected?: Contact;
		deleteContactModalIsVisible: boolean;
		toggleDeleteContactModalIsVisible: (visible?: boolean) => void;
		setContacts: (newContacts: Contact[]) => void;
	}

	let {
		setContacts,
		deleteContactModalIsVisible,
		toggleDeleteContactModalIsVisible,
		contactSelected
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
			setTimeout(() => {
				formMessage = '';
			}, 4000);
		}
	});
</script>

{#if deleteContactModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal
			toggleModal={toggleDeleteContactModalIsVisible}
			visible={deleteContactModalIsVisible}
			cancelClick={true}
		>
			<form
				action="?/delete_contact"
				method="post"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'failure') {
							if (result.data?.message) {
								formMessage = result.data.message as string;
							}
						} else if (result.type === 'success') {
							if (result.data?.contacts) {
								setContacts(result.data.contacts as Contact[]);
								toggleDeleteContactModalIsVisible(false);
							}
						}
					};
				}}
				class="relative flex max-h-fit max-w-full flex-col gap-2 rounded-md border border-red-400 bg-stone-900 px-4 py-3 text-center"
			>
				<input type="hidden" name="id_contact" value={contactSelected?.id ?? ''} />
				<div class="flex flex-col place-items-center gap-2">
					<label for="icon">Icono</label>
					<span class="text-red-300" style="font-family: 'PT Sans';">
						{contactSelected?.icon ?? ''}
					</span>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="text">Texto</label>
					<span class="text-red-300" style="font-family: 'PT Sans';">
						{contactSelected?.text ?? ''}
					</span>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="url">URL</label>
					<span class="text-red-300" style="font-family: 'PT Sans';">
						{contactSelected?.url ?? ''}
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
					onclick={() => toggleDeleteContactModalIsVisible(false)}
				>
					<Icon icon="material-symbols:close-rounded" class="text-3xl" />
				</div>
			</form>
		</ContainerModal>
	</div>
{/if}
