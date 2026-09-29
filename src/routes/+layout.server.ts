import type { LayoutServerLoad } from './$types';
import { getCartItemCount } from '$lib/server/cart';
// import type { Config } from '@sveltejs/adapter-vercel';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const cartCount = await getCartItemCount(cookies.get('cart_session_id'));
	return {
		user: locals.user,
		cartCount: cartCount
	};
};

// export const config: Config = {
//     runtime: 'nodejs22.x'
// }
