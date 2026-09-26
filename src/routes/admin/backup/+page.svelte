<script lang="ts">
	import Icon from '@iconify/svelte';
	import { fade, scale } from 'svelte/transition';
	import JSZip from 'jszip';

	let resMessage = $state('');
	let resMessageType: 'success' | 'error' = $state('success');
	let loading = $state(false);

	let filesOfBackup: File[] = $state([]);

	let inputBackupFile: HTMLInputElement | undefined;

	const mapTypes: Record<string, string> = {
		webp: 'image/webp',
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		gif: 'image/gif',
		avif: 'image/avif',
		json: 'application/json'
	};

	async function handleFile(e: Event) {
		const target = e.target as HTMLInputElement;
		const f = target.files?.[0];
		if (!f) return;

		const arrayBuffer = await f.arrayBuffer();
		const zip = await JSZip.loadAsync(arrayBuffer);

		for (const file of Object.values(zip.files)) {
			if (file.dir) continue;
			const content = await file.async('blob');
			const name = file.name.split('/').pop() as string;
			const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
			const type = mapTypes[ext] ?? 'application/octet-stream';
			filesOfBackup.push(new File([content], name, { type }));
		}
	}

	async function sendFiles() {
		if (!filesOfBackup.length || loading) return;
		loading = true;
		resMessage = '';

		try {
			// Phase 1: Reset existing data
			const resReset = await fetch('/admin/backup/upload/reset_data', { method: 'POST' });
			const jsonReset = await resReset.json();
			if (!jsonReset.success) {
				resMessage = jsonReset.message || 'Error al limpiar datos actuales';
				resMessageType = 'error';
				return;
			}

			// Phase 2: Upload all files
			for (const file of filesOfBackup) {
				const formData = new FormData();
				formData.append('file', file);
				const res = await fetch('/admin/backup/upload', {
					method: 'POST',
					body: formData
				});
				const data = await res.json();
				if (!data.success) {
					resMessage = data.message || 'Error al subir archivos';
					resMessageType = 'error';
					return;
				}
			}

			// Phase 3: Restore data into DB
			const resRestore = await fetch('/admin/backup/upload/restore_data', { method: 'POST' });
			const jsonRestore = await resRestore.json();
			if (jsonRestore.success) {
				resMessage = 'Respaldo restaurado con éxito';
				resMessageType = 'success';
			} else {
				resMessage = jsonRestore.message || 'Error al restaurar datos';
				resMessageType = 'error';
			}
		} catch {
			resMessage = 'Error de conexión al restaurar el respaldo';
			resMessageType = 'error';
		} finally {
			loading = false;
			filesOfBackup = [];
			if (inputBackupFile) inputBackupFile.value = '';
		}
	}

	$effect(() => {
		if (resMessage) {
			const timeout = setTimeout(() => {
				resMessage = '';
			}, 5000);
			return () => clearTimeout(timeout);
		}
	});
</script>

<div in:fade class="flex flex-col gap-2 px-5 py-5">
	<h2 class="text-center text-xl">Backup</h2>
	<div class="flex flex-col items-center gap-3 px-10 py-5">
		<a
			href="/admin/backup/download"
			class="flex flex-row items-center gap-2 rounded-md border px-3 py-1 transition-transform duration-200 hover:text-red-500 active:scale-90"
		>
			<span> Descargar </span>
			<Icon icon="clarity:backup-solid" class="text-3xl" />
		</a>
		<div class="flex flex-col items-center gap-2 rounded-md bg-stone-800 p-3">
			<input
				type="file"
				name="backup"
				accept=".zip"
				required
				onchange={handleFile}
				bind:this={inputBackupFile}
			/>
			<button
				class="flex flex-row items-center gap-2 rounded-md border px-3 py-1 transition-transform duration-200 hover:text-red-500 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={loading || !filesOfBackup.length}
				onclick={sendFiles}
			>
				<span>
					{loading ? 'Restaurando...' : 'Subir'}
				</span>
				<Icon icon="clarity:backup-restore-solid" class="text-3xl" />
			</button>
		</div>
		{#if loading}
			<div
				transition:scale={{ duration: 200 }}
				class="h-10 w-10 animate-spin rounded-full border-4 border-red-400 border-t-transparent"
			></div>
		{/if}

		{#if resMessage}
			<span transition:scale class={resMessageType === 'error' ? 'text-red-400' : 'text-green-400'}>
				{resMessage}
			</span>
		{/if}
	</div>
</div>
