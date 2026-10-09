import type { LayoutServerLoad } from './$types';
import { getCartItemCount } from '$lib/server/cart';
import { getShippingFee } from '$lib/server/shipping';
// import type { Config } from '@sveltejs/adapter-vercel';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const cartCount = await getCartItemCount(cookies.get('cart_session_id'));
	const fee = await getShippingFee();

	return {
		user: locals.user,
		cartCount: cartCount,
		// Read here so SSR renders public prices (base + fee) on the very
		// first HTML byte — no client round trip.
		shipping: { fee }
	};
};

// export const config: Config = {
//     runtime: 'nodejs22.x'
// }
