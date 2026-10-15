import { redirect } from '@sveltejs/kit';

/**
 * Shared auth gate for admin routes: the same redirect-to-/login semantics
 * every admin `load` already applies inline. Form actions must call this too —
 * an unguarded action is reachable by any POST regardless of the page's load.
 */
export function requireUser(locals: App.Locals) {
	if (!locals.user) {
		redirect(302, '/login');
	}
	return locals.user;
}
