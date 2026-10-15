import type { ActionResult } from '@sveltejs/kit';

/**
 * Picks the human-facing message out of a failed action result.
 *
 * Actions `fail()` with `{ message }`; thrown errors surface through
 * `result.error.message`; anything else falls back to `fallback` (the
 * Spanish-neutral copy owned by each call site). Returns `null` for results
 * that are not failures, so callers can branch on "did this fail?" too.
 *
 * Shared by the admin pages that show failures through the toast queue —
 * the same extraction logic must not drift per page.
 */
export function actionFailureMessage(result: ActionResult, fallback: string): string | null {
	if (result.type === 'failure') {
		const message = result.data?.message;
		return typeof message === 'string' && message.length > 0 ? message : fallback;
	}
	if (result.type === 'error') {
		const message = result.error?.message;
		return typeof message === 'string' && message.length > 0 ? message : fallback;
	}
	return null;
}
