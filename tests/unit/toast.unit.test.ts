import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast, dismissToast, getToasts } from '$lib/toast.svelte.js';
import { stockLimitMessage } from '$lib/variant';

function clearToasts(): void {
	for (const entry of [...getToasts()]) {
		dismissToast(entry.id);
	}
}

describe('stockLimitMessage', () => {
	it('stays vague when the server reports no count', () => {
		expect(stockLimitMessage()).toBe('No hay más unidades disponibles');
	});

	it('treats a non-positive count as none left', () => {
		expect(stockLimitMessage(0)).toBe('No hay más unidades disponibles');
	});

	it('uses the singular form for exactly one unit', () => {
		expect(stockLimitMessage(1)).toBe('Solo queda 1 unidad disponible');
	});

	it('uses the plural form with the remaining count', () => {
		expect(stockLimitMessage(5)).toBe('Solo quedan 5 unidades disponibles');
	});
});

describe('toast queue', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		clearToasts();
	});

	afterEach(() => {
		clearToasts();
		vi.useRealTimers();
	});

	it('enqueues a toast exposed through getToasts', () => {
		toast('Solo quedan 2 unidades disponibles');

		const visible = getToasts();
		expect(visible).toHaveLength(1);
		expect(visible[0]?.message).toBe('Solo quedan 2 unidades disponibles');
	});

	it('keeps a toast on screen until the dismiss window elapses', () => {
		toast('No hay más unidades disponibles');

		vi.advanceTimersByTime(4499);
		expect(getToasts()).toHaveLength(1);

		vi.advanceTimersByTime(1);
		expect(getToasts()).toHaveLength(0);
	});

	it('caps the stack at three entries, dropping the oldest', () => {
		toast('first');
		toast('second');
		toast('third');
		toast('fourth');

		const visible = getToasts();
		expect(visible).toHaveLength(3);
		expect(visible.map((entry) => entry.message)).toEqual(['second', 'third', 'fourth']);
	});

	it('dismissToast removes only the requested entry', () => {
		const keptId = toast('kept');
		const removedId = toast('removed');

		dismissToast(removedId);

		const visible = getToasts();
		expect(visible).toHaveLength(1);
		expect(visible[0]?.id).toBe(keptId);
	});
});
