/**
 * Pure helpers for the WhatsApp deep link used at checkout.
 *
 * `wa.me/{number}` only accepts bare international digits: any space, dash,
 * parenthesis, or a leading `+` produces a link WhatsApp resolves as
 * `not-found`. The admin form is a free-text field, so normalization happens
 * here — once — and both the save action and the checkout modal use the same
 * rule. Nothing here touches the database or the request.
 */

/**
 * Reduce a user-typed phone number to the bare digits `wa.me` expects.
 *
 * Drops `+`, `00` international prefixes, and every separator, so
 * `+593 99 773 3619` and `593997733619` normalize to the same value.
 */
export function normalizeWhatsAppNumber(input: string): string {
	let digits = input.replace(/\D/g, '');

	// `00` is the IDD prefix; WhatsApp wants the country code directly.
	if (digits.startsWith('00')) {
		digits = digits.slice(2);
	}

	return digits;
}

/**
 * Whether a normalized number is plausible enough to save or dial.
 *
 * E.164 caps a subscriber number at 15 digits; the floor is the shortest
 * unambiguous international number. Rejecting here is what stops a broken
 * checkout link from ever being persisted — the modal does not second-guess
 * a value the server already accepted.
 */
export function isValidWhatsAppNumber(normalized: string): boolean {
	return normalized.length >= 8 && normalized.length <= 15;
}
