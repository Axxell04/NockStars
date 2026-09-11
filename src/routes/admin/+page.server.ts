import * as auth from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createProduct, deleteProduct, getImgs, getProducts, updateProduct } from '$lib/server/product';
import { addProductToCatalog, getCatalogs, removeProductToCatalog } from '$lib/server/catalog';
import type { ProductComplete } from '$lib/interfaces/product';

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user) {
        return redirect(302, '/login');
    }

    const catalogId = event.locals.catalogId;

    const pagination = await getProducts({catalogId});
    const catalogs = await getCatalogs();

    return {
        user: event.locals.user,
        pagination: pagination,
        catalogId: catalogId,
        catalogs: catalogs
    }
}

export const actions: Actions = {
    logout: async (event) => {
        if (!event.locals.session) {
            return fail(401);
        }
        await auth.invalidateSession(event.locals.session.id);
        auth.deleteSessionTokenCookie(event);

        redirect(302, '/login')
    },
    get_products: async (event) => {
        const catalogId = event.locals.catalogId;
        const pagination = await getProducts({limit: 9999999});
        const paginationOfCatalog = await getProducts({limit: 999999, catalogId})

        const totalList: ProductComplete[] = pagination.products;
        const productsInCatalog: ProductComplete[] = paginationOfCatalog.products;

        const products = totalList.filter((p) => {
            const inList = productsInCatalog.some(product => product.product.id === p.product.id)
            return !inList
        })
        

        return {
            products
        }
    },
    get_products_in_catalog: async (event) => {
        const catalogId = event.locals.catalogId;
        const pagination = await getProducts({limit: 999999, catalogId})
        return {
            pagination
        }
    },
    prev_page: async (event) => {
        const formData = await event.request.formData();
        let totalPages = 0;
        let currentPage = 0;
        const catalogId = event.locals.catalogId;
        
        try {
            totalPages = parseInt(formData.get('total_pages') as string);
            currentPage = parseInt(formData.get('current_page') as string);
            if (isNaN(totalPages) || isNaN(currentPage)) {
                return fail(400, { message: 'Invalid pagination params' })
            }
        } catch {
            return fail(400, { message: 'Invalid pagination params' })
        }


        
        if (currentPage <= 1) {
            return fail(404, { message: 'Page not found' })
        }
        const nextPage = currentPage - 1;
        const pagination = await getProducts({page: nextPage, catalogId});

        return {
            pagination: pagination
        }
    },
    next_page: async (event) => {
        const formData = await event.request.formData();
        let totalPages = 0;
        let currentPage = 0;
        const catalogId = event.locals.catalogId;
        
        try {
            totalPages = parseInt(formData.get('total_pages') as string);
            currentPage = parseInt(formData.get('current_page') as string);
            if (isNaN(totalPages) || isNaN(currentPage)) {
                return fail(400, { message: 'Invalid pagination params' })
            }
        } catch {
            return fail(400, { message: 'Invalid pagination params' })
        }


        
        if (currentPage >= totalPages) {
            return fail(404, { message: 'Page not found' })
        }
        const nextPage = currentPage + 1;
        const pagination = await getProducts({page: nextPage, catalogId});

        return {
            pagination: pagination
        }
    },
    goto_page: async (event) => {
        const formData = await event.request.formData();
        let gotoPage = 0;
        const catalogId = event.locals.catalogId;

        try {
            gotoPage = parseInt(formData.get('goto_page') as string);
            if (isNaN(gotoPage)) {
                return fail(400, { message: 'Invalid pagination params' })
            }
        } catch {
            return fail(400, { message: 'Invalid pagination params' })
        }

        const pagination = await getProducts({page: gotoPage, catalogId});

        return {
            pagination: pagination
        }
    },
    set_catalog: async (event) => {
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
        const pagination = await getProducts({catalogId});

        return {
            pagination: pagination
        }
    },
    add_product: async (event) => {
        const formData = await event.request.formData();
        const name = formData.get('name');
        const price = formData.get('price');
        // const imgs = formData.getAll('imgs') as unknown as FileList;

        const catalogId = event.locals.catalogId;

        if (!validateName(name)) {
            return fail(400, { message: 'Invalid name' });
        }

        if (!validatePrice(price)) {
            return fail(400, { message: 'Invalid price' });
        }
        
        try {
            await createProduct(name, price, catalogId ?? undefined);

        } catch (error) {
            console.log(error);
            return fail(500, { message: 'Internal server error' });
        }

        const pagination = await getProducts({catalogId});
        return {pagination: pagination};
    },
    delete_product: async (event) => {
        const formData = await event.request.formData();
        const productId = formData.get('product_id');
        const catalogId = event.locals.catalogId;

        try {
            await deleteProduct(productId as string);
        } catch (error) {
            console.log(error);
            return fail(500, { message: 'Internal server error' })
        }
        
        const pagination = await getProducts({catalogId});
        return {
            pagination: pagination
        }
    },
    edit_product: async (event) => {
        const formData = await event.request.formData();
        const product_id = formData.get('product_id')
        const name = formData.get('name');
        const price = formData.get('price');
        const imgs = formData.getAll('imgs') as unknown as FileList;
        const listDelete = formData.get('list_delete');
        let finalListDelete: string[] | undefined = [];
        const catalogId = event.locals.catalogId;

        if (!validateProductId(product_id)) {
            return fail(400, { message: 'Invalid product id'})
        }

        if (!validateName(name)) {
            return fail(400, { message: 'Invalid name'})
        }

        if (!validatePrice(price)) {
            return fail(400, { message: 'Invalid price'})
        }

        finalListDelete = validateListDelete(listDelete);
        if (!finalListDelete) {
            return fail(400, { message: 'Invalid list delete' })
        } 
        
        if ((await getImgs(product_id)).length <= finalListDelete.length && (imgs.length === 1 && (!imgs[0].name && !imgs[0].size))) {
            return fail(400, { message: 'Se necesita al menos una imagen del producto' })
        }

        try {
            // await updateProduct(product_id, name, price, imgs, finalListDelete)
            await updateProduct({
                product_id,
                name,
                price,
                imgsDelete: finalListDelete
            })
        } catch (error) {
            console.log(error);
            return fail(500, { message: 'Internal server error' })
        }


        const pagination = await getProducts({catalogId});
        return {
            pagination: pagination
        }
    },
    add_product_to_catalog: async (event) => {
        const formData = await event.request.formData();
        const catalogId = formData.get('catalog_id') as string;
        let products: ProductComplete[] = [];

        try {
            const list = formData.get('products_to_add_list') as string;
            if (list && catalogId) {
                products = JSON.parse(list);
                for (const product of products) {
                    await addProductToCatalog(product.product.id, catalogId)
                }
            } else {
                return fail(400, { message: 'Invalid params' });
            }
        } catch (e) {
            console.log(e);
        }   

        const pagination = await getProducts({catalogId});
        return {
            pagination: pagination
        }
    },
    remove_product_to_catalog: async (event) => {
        const formData = await event.request.formData();
        const catalogId = formData.get('catalog_id') as string;
        const productId = formData.get('product_id') as string;

        if (!catalogId || !productId) {
            return fail(400, { message: 'Invalid params' });
        }

        try {
            await removeProductToCatalog(productId, catalogId)
        } catch (error) {
            console.log(error);
            return fail(500, { message: 'Internal server error' })
        }

        const pagination = await getProducts({catalogId});
        return {
            pagination: pagination
        }
    }
}

function validatePrice (price: unknown): price is number {
    return !isNaN(parseFloat(price as string));
}


function validateName (name: unknown): name is string {
    return typeof name === 'string' && name.length > 0;
}

function validateProductId (product_id: unknown): product_id is string {
    return typeof product_id === 'string';
} 

function validateListDelete (list: unknown) {
    if (typeof list === 'undefined') { return undefined };
    return JSON.parse(list as string) as string[]
}