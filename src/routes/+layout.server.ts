import type { LayoutServerLoad } from './$types';
import { getCartItemCount } from '$lib/server/cart';
import { getShippingFee } from '$lib/server/shipping';
import { getContactConfig } from '$lib/server/contact-config';
// import type { Config } from '@sveltejs/adapter-vercel';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const cartCount = await getCartItemCount(cookies.get('cart_session_id'));
	const fee = await getShippingFee();
	const contact = await getContactConfig();

	return {
		user: locals.user,
		cartCount: cartCount,
		// Read here so SSR renders public prices (base + fee) on the very
		// first HTML byte — no client round trip.
		shipping: { fee },
		// Same reason: the browser needs the WhatsApp number client-side
		// (SendCartModal) with no extra fetch, and it must be present in the
		// very first render after checkout.
		contactConfig: { whatsappNumber: contact?.whatsappNumber ?? '' }
	};
};

// export const config: Config = {
//     runtime: 'nodejs22.x'
// }
