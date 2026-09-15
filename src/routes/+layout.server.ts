import type { LayoutServerLoad } from "./$types";
// import type { Config } from '@sveltejs/adapter-vercel';

export const load: LayoutServerLoad = async ({locals}) => {
    const cartCount = (locals.cart ?? []).reduce((acc, item) => acc + item.amount, 0);
    return {
        user: locals.user,
        cartCount: cartCount
    };
}

// export const config: Config = {
//     runtime: 'nodejs22.x'
// }

