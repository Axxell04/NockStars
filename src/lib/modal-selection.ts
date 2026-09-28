export function openModalWithSelection<T>(
	currentSelection: T | undefined,
	nextSelection: T,
	setSelection: (value: T) => void,
	toggleModal: (visible?: boolean) => void,
	visible = true
): T {
	const selectedValue = (nextSelection ?? currentSelection) as T;
	setSelection(selectedValue);
	toggleModal(visible);
	return selectedValue;
}
