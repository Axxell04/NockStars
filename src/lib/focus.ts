/**
 * Removes the sticky pointer-focus outline a control keeps after being
 * clicked or tapped, without breaking keyboard navigation.
 *
 * Why the 200 ms delay: blurring synchronously inside the focus handler
 * would cancel the click that is already in flight (mousedown focuses, then
 * mouseup fires the click) — the control would never activate. The delay IS
 * the mechanism; do not remove it or "simplify" it to a synchronous blur.
 *
 * Why the `:focus-visible` guard: keyboard focus must survive, otherwise
 * tabbing through a page restarts from the top every time focus is stolen
 * 200 ms after landing. Pointer focus still blurs, which is the whole point
 * of the helper.
 *
 * Extracted from 37 copy-pasted component-local definitions (a mix of
 * 200 ms, 300 ms and guarded variants) so this behavior lives in exactly
 * one place.
 */
export function cancelFocus(e: FocusEvent) {
	const target = e.target as HTMLButtonElement;
	if (!target || target.matches(':focus-visible')) {
		return;
	}
	setTimeout(() => {
		target.blur();
	}, 200);
}
