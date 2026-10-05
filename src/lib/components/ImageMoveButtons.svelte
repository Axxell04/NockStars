<script lang="ts">
	import Icon from '@iconify/svelte';

	interface Props {
		/** 1-based position of the image inside its group. */
		position: number;
		count: number;
		/** Locks the controls while a save is in flight. */
		disabled?: boolean;
		onMove: (offset: -1 | 1) => void;
	}

	let { position, count, disabled = false, onMove }: Props = $props();
</script>

<div
	class="absolute inset-x-0 bottom-2 flex items-center justify-center gap-2"
	role="group"
	aria-label={`Reordenar imagen ${position} de ${count}`}
>
	<button
		type="button"
		class="rounded-full bg-black/65 p-1.5 text-white transition-colors hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30"
		aria-label={`Mover imagen ${position} de ${count} a la izquierda`}
		disabled={disabled || position <= 1}
		onclick={() => onMove(-1)}
	>
		<Icon icon="mingcute:left-fill" class="text-sm" />
	</button>
	<button
		type="button"
		class="rounded-full bg-black/65 p-1.5 text-white transition-colors hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-30"
		aria-label={`Mover imagen ${position} de ${count} a la derecha`}
		disabled={disabled || position >= count}
		onclick={() => onMove(1)}
	>
		<Icon icon="mingcute:right-fill" class="text-sm" />
	</button>
</div>
