<script lang="ts">
	import type { Contact } from '$lib/interfaces/contact';
	import { fade, scale } from 'svelte/transition';
	import ContainerModal from '../../ContainerModal.svelte';
	import { enhance } from '$app/forms';
	import Icon from '@iconify/svelte';

	interface Props {
		addContactModalIsVisible: boolean;
		toggleAddContactModalIsVisible: (visible?: boolean) => void;
		setContacts: (newContacts: Contact[]) => void;
	}

	let { setContacts, addContactModalIsVisible, toggleAddContactModalIsVisible }: Props = $props();

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

{#if addContactModalIsVisible}
	<div transition:fade={{ duration: 200 }}>
		<ContainerModal toggleModal={toggleAddContactModalIsVisible} cancelClick={true}>
			<form
				action="?/create_contact"
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
								toggleAddContactModalIsVisible(false);
							}
						}
					};
				}}
				class="relative flex max-h-fit max-w-full flex-col gap-2 rounded-md border border-red-400 bg-stone-900 px-4 py-3"
			>
				<div class="flex flex-col place-items-center gap-2">
					<label for="icon">Icono</label>
					<input
						type="text"
						name="icon"
						id="icon"
						required
						autocomplete="off"
						class="max-w-full rounded-md border border-red-400 px-1 outline-none"
					/>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="text">Texto</label>
					<input
						type="text"
						name="text"
						id="text"
						required
						autocomplete="off"
						class="max-w-full rounded-md border border-red-400 px-1 outline-none"
					/>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<label for="url">URL</label>
					<input
						type="text"
						name="url"
						id="url"
						required
						autocomplete="off"
						class="max-w-full rounded-md border border-red-400 px-1 outline-none"
					/>
				</div>
				<div class="flex flex-col place-items-center gap-2">
					<button
						type="submit"
						class="cursor-pointer rounded-md border p-2 hover:text-red-500 focus:text-red-500"
						onfocus={(e) => cancelFocus(e)}
					>
						Añadir
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
					onclick={() => toggleAddContactModalIsVisible(false)}
				>
					<Icon icon="material-symbols:close-rounded" class="text-3xl" />
				</button>
			</form>
		</ContainerModal>
	</div>
{/if}
