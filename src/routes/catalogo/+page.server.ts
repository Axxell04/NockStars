import { getCatalogs } from "$lib/server/catalog";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
    const catalogs = await getCatalogs();

    return {
        catalogs: catalogs,
        seo: {
            title: 'Catálogo — NockStars',
            description: 'Explorá el catálogo completo de camisetas NockStars. Encontrá tu estilo, elegí tu talla y hacé tu pedido.',
            type: 'website'
        }
    }
}

export const actions: Actions = {
    view_catalog: async (event) => {
        const formData = await event.request.formData();
        const catalogId = formData.get('catalog_id') as string;

        if (catalogId) {
            event.cookies.set('catalog-id', catalogId, {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                secure: event.url.protocol === 'https:'
            })
        } else {
            event.cookies.delete('catalog-id', {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                secure: event.url.protocol === 'https:'
            })
        }
    }
}