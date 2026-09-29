/**
 * App-wide toast queue backed by module-level Svelte state.
 *
 * Reassigned `$state` cannot be exported from a `.svelte.ts` module (the
 * compiler only rewrites references inside one file, so importers would see
 * the raw signal instead of the value). The queue therefore stays private and
 * is read through `getToasts()` — the documented accessor pattern.
 *
 * The single consumer is `Toaster.svelte`, mounted once in the root layout;
 * presentation (styling, stacking, transitions) lives there.
 */

export interface Toast {
	id: number;
	message: string;
}

/** Stacked toasts kept on screen at once; the oldest entry is dropped. */
const MAX_VISIBLE = 3;

/** Auto-dismiss delay — long enough to read a one-line message. */
const DISMISS_AFTER_MS = 4500;

let toasts = $state<Toast[]>([]);
let nextId = 0;

/**
 * Queues a toast for display and schedules its auto-dismiss.
 * Call from client-side event handlers only (never during SSR).
 */
export function toast(message: string): number {
	const id = ++nextId;
	toasts = [...toasts, { id, message }].slice(-MAX_VISIBLE);
	setTimeout(() => dismissToast(id), DISMISS_AFTER_MS);
	return id;
}

export function dismissToast(id: number): void {
	toasts = toasts.filter((entry) => entry.id !== id);
}

export function getToasts(): Toast[] {
	return toasts;
}
