import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { deleteOrder, getOrders, updateOrder } from "$lib/server/order";
import { createRevenue } from "$lib/server/revenue";
import type { OrderPagination } from "$lib/interfaces/order";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user) {
        return redirect(302, '/login')
    }
    const query = event.url.searchParams;
    const cod = query.get("cod");
    console.log(cod);
    // const pendingOrders = await getOrders(undefined, undefined, false);
    // const completedOrders = await getOrders(undefined, undefined, true);

    const orderPagination = (await getOrders({completed: false, cod})) as OrderPagination;

    return {
        orderPagination
    }
};

export const actions: Actions = {
    set_view_state: async (event) => {
        const formData = await event.request.formData();
        const viewState = formData.get('view_state') as string;
        const cod = formData.get('cod') as string;

        if (!viewState) { return fail(400, { message: 'Error en los parámetros de la petición' }) }

        event.cookies.set('order_view_state', viewState, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: event.url.protocol === 'https:'
        })

        
        const completed = viewState ? (viewState === 'completed' ? true : false) : false;  
        const orderPagination = await getOrders({completed, cod});

        return {
            orderPagination
        }
    },
    done: async (event) => {
        event.url.href = event.url.href.replace(event.url.search, '');
    },
    delete_order: async (event) => {
        const formData = await event.request.formData();
        const orderId = formData.get('order_id') as string;

        if (!orderId) { return fail(400, { message: 'Error en los parámetros de la petición' }) }

        try {
            await deleteOrder(orderId);
        } catch (error) {
            console.log(error);
            return fail(500, { message: 'A ocurrido un error en el servidor' })
        }

        const completed = event.locals.orderViewState ? (event.locals.orderViewState === 'completed' ? true : false) : false;
        const orderPagination = await getOrders({completed});

        return {
            orderPagination
        }
    },
    edit_order: async (event) => {
        const formData = await event.request.formData();
        const orderId = formData.get('order_id') as string;
        const totalValue = parseFloat(formData.get('total_value') as string);
        let content: object;
        try {
            content = JSON.parse(formData.get('content') as string);
            if (!content || !orderId || !isNumber(totalValue)) { return fail(400, { message: 'Error en los parámetros de la petición' }) }
        } catch {
            return fail(400, { message: 'Error en los parámetros de la petición' })
        }

        await updateOrder(orderId, content, undefined, undefined, totalValue);

        const completed = event.locals.orderViewState ? (event.locals.orderViewState === 'completed' ? true : false) : false;

        const orderPagination = await getOrders({completed})

        return {
            orderPagination
        }

    },
    update_order_state: async (event) => {
        const formData = await event.request.formData();
        const orderId = formData.get('order_id') as string;
        const totalValue = parseFloat(formData.get('total_value') as string);

        if (!orderId || !isNumber(totalValue)) {
            return fail(400, { message: 'Error en los parámetros de la petición' })
        }

        const completed = event.locals.orderViewState ? (event.locals.orderViewState === 'completed' ? true : false) : false;

        try {
            if (!completed === true) {
                const revenueId = await createRevenue(parseFloat(totalValue.toFixed(2)), 'Orden completada');
                await updateOrder(orderId, undefined, !completed, revenueId);
            } else {
                await updateOrder(orderId, undefined, !completed, null);
            }
            
        } catch {
            return fail(500, { message: 'A ocurrido un error en el servidor' })
        }
        
        const orderPagination = await getOrders({completed});

        return {
            orderPagination
        }
        
    },
    prev_page: async (event) => {
        const formData = await event.request.formData();
        let totalPages = 0;
        let currentPage = 0;
        
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
        const orderPagination = await getOrders({page: nextPage});

        return {
            orderPagination
        }
    },
    next_page: async (event) => {
        const formData = await event.request.formData();
        let totalPages = 0;
        let currentPage = 0;
        
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
        const orderPagination = await getOrders({page: nextPage});

        return {
            orderPagination
        }
    },
    goto_page: async (event) => {
        const formData = await event.request.formData();
        let gotoPage = 0;
        const completed = event.locals.orderViewState ? (event.locals.orderViewState === 'completed' ? true : false) : false;

        try {
            gotoPage = parseInt(formData.get('goto_page') as string);
            if (isNaN(gotoPage)) {
                return fail(400, { message: 'Invalid pagination params' })
            }
        } catch {
            return fail(400, { message: 'Invalid pagination params' })
        }

        const orderPagination = await getOrders({page: gotoPage, completed});

        return {
            orderPagination
        }
    },
};

function isNumber (value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value) && value > 0 
}