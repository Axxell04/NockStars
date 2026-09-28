import { describe, expect, it } from 'vitest';
import { openModalWithSelection } from '$lib/modal-selection';

describe('openModalWithSelection', () => {
	it('sets the selected entity before opening the modal', () => {
		let selected: { id: string; name: string } | undefined;
		const toggles: boolean[] = [];

		const result = openModalWithSelection(
			selected,
			{ id: 'prod-1', name: 'Camisa' },
			(value) => {
				selected = value;
			},
			(visible = true) => {
				toggles.push(visible);
			},
			true
		);

		expect(result).toEqual({ id: 'prod-1', name: 'Camisa' });
		expect(selected).toEqual({ id: 'prod-1', name: 'Camisa' });
		expect(toggles).toEqual([true]);
	});
});
