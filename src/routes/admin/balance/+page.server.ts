import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { createRevenue, deleteRevenue, getRevenues, getTotalRevenue, updateRevenue } from "$lib/server/revenue";
import { createCost, deleteCost, getCosts, getTotalCost, updateCost } from "$lib/server/cost";
import { createExpense, deleteExpense, getExpenses, getTotalExpense, updateExpense } from "$lib/server/expense";
import type { BalanceDetailPagination } from "$lib/interfaces/balance";

export const load: PageServerLoad = async (event) => {
    if (!event.locals.user) {
        return redirect(302, '/login')
    }

    const totalRevenue = await getTotalRevenue();
    const totalCost = await getTotalCost();
    const totalExpense = await getTotalExpense();

    return {
        totalRevenue,
        totalCost,
        totalExpense
    }
};

export const actions: Actions = {
    set_view_state: async (event) => {
        const formData = await event.request.formData();
        const viewState = formData.get('view_state') as string;

        if (!viewState) { return fail(400, { message: 'Error en los parámetros de la petición' }) }

        event.cookies.set('balance_view_state', viewState, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: event.url.protocol === 'https:'
        })

        let balanceDetailPagination: BalanceDetailPagination | undefined;
        if (viewState === 'revenue') {
            const res = await getRevenues();
            balanceDetailPagination = {
                balanceDetails: res.revenues,
                totalPages: res.totalPages,
                currentPage: res.currentPage
            }
        } else if (viewState === 'cost') {
            const res = await getCosts();
            balanceDetailPagination = {
                balanceDetails: res.costs,
                totalPages: res.totalPages,
                currentPage: res.currentPage
            }
        } else if (viewState === 'expense') {
            const res = await getExpenses();
            balanceDetailPagination = {
                balanceDetails: res.expenses,
                totalPages: res.totalPages,
                currentPage: res.currentPage
            }
        }
        
        return {
            balanceDetailPagination
        }
    },
    add_balance: async (event) => {
        const formData = await event.request.formData();
        const reason = formData.get('reason') as string;
        const value = parseFloat(formData.get('value') as string);

        if (!reason || !isNumber(value)) {
            return fail(400, { message: 'Error en los parámetros de la petición' })
        }

        const viewState = event.locals.balanceViewSatate;
        let balanceDetailPagination: BalanceDetailPagination | undefined;
        try {
            if (viewState === 'revenue') {
                await createRevenue(value, reason);
                const res = await getRevenues()
                balanceDetailPagination = {...res, balanceDetails: res.revenues};
            } else if (viewState === 'cost') {
                await createCost(value, reason); 
                const res = await getCosts();
                balanceDetailPagination = {...res, balanceDetails: res.costs};
            } else if (viewState === 'expense') {
                await createExpense(value, reason);
                const res = await getExpenses();
                balanceDetailPagination = {...res, balanceDetails: res.expenses};
            } 
            
        } catch {
            return fail(500, { message: 'A ocurrido un error en el servidor' })
        }

        return {
            balanceDetailPagination
        }
    },
    delete_balance: async (event) => {
        const formData = await event.request.formData();
        const balanceId = formData.get('balance_id') as string;

        if (!balanceId) {
            return fail(400, { message: 'Error en los parámetros de la petición' });
        }

        const viewState = event.locals.balanceViewSatate;
        let balanceDetailPagination: BalanceDetailPagination | undefined;

        try {
            if (viewState === 'revenue') {
                await deleteRevenue(balanceId);
                const res = await getRevenues()
                balanceDetailPagination = {...res, balanceDetails: res.revenues};
            } else if (viewState === 'cost') {
                await deleteCost(balanceId);
                const res = await getCosts();
                balanceDetailPagination = {...res, balanceDetails: res.costs};
            } else if (viewState === 'expense') {
                await deleteExpense(balanceId);
                const res = await getExpenses();
                balanceDetailPagination = {...res, balanceDetails: res.expenses};
            }
            
        } catch {
            return fail(500, { message: 'A ocurrido un error en el servidor' })
        }

        return {
            balanceDetailPagination
        }
    },
    edit_balance: async (event) => {
        const formData = await event.request.formData();
        const balanceId = formData.get('balance_id') as string;
        const newReason = formData.get('new_reason') as string;
        const newValue = parseFloat(formData.get('new_value') as string);

        if (!balanceId || !newReason || !isNumber(newValue)) {
            return fail(400, { message: 'Error en los parámetros de la petición' });
        }

        const viewState = event.locals.balanceViewSatate;
        let balanceDetailPagination: BalanceDetailPagination | undefined;

        try {
            if (viewState === 'revenue') {
                await updateRevenue(balanceId, newValue, newReason);
                const res = await getRevenues()
                balanceDetailPagination = {...res, balanceDetails: res.revenues};
            } else if (viewState === 'cost') {
                await updateCost(balanceId, newValue, newReason);
                const res = await getCosts();
                balanceDetailPagination = {...res, balanceDetails: res.costs};
            } else if (viewState === 'expense') {
                await updateExpense(balanceId, newValue, newReason);
                const res = await getExpenses();
                balanceDetailPagination = {...res, balanceDetails: res.expenses};
            }
            
        } catch {
            return fail(500, { message: 'A ocurrido un error en el servidor' })
        }

        return {
            balanceDetailPagination
        }
    },
    refresh_totals: async () => {
        const totalRevenue = await getTotalRevenue();
        const totalCost = await getTotalCost();
        const totalExpense = await getTotalExpense();

        return {
            totalRevenue,
            totalCost,
            totalExpense
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

        const viewState = event.locals.balanceViewSatate;
        const prevPage = currentPage - 1;

        let balanceDetailPagination: BalanceDetailPagination | undefined;

        if (viewState === 'revenue') {
            const res = await getRevenues(prevPage);
            balanceDetailPagination = {...res, balanceDetails: res.revenues};
        } else if (viewState === 'cost') {
            const res = await getCosts(prevPage);
            balanceDetailPagination = {...res, balanceDetails: res.costs};
        } else if (viewState === 'expense') {
            const res = await getExpenses(prevPage);
            balanceDetailPagination = {...res, balanceDetails: res.expenses};
        }

        return {
            balanceDetailPagination
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

        const viewState = event.locals.balanceViewSatate;
        const nextPage = currentPage + 1;

        let balanceDetailPagination: BalanceDetailPagination | undefined;

        if (viewState === 'revenue') {
            const res = await getRevenues(nextPage);
            balanceDetailPagination = {...res, balanceDetails: res.revenues};
        } else if (viewState === 'cost') {
            const res = await getCosts(nextPage);
            balanceDetailPagination = {...res, balanceDetails: res.costs};
        } else if (viewState === 'expense') {
            const res = await getExpenses(nextPage);
            balanceDetailPagination = {...res, balanceDetails: res.expenses};
        }

        return {
            balanceDetailPagination
        }
    },
    goto_page: async (event) => {
        const formData = await event.request.formData();
        let gotoPage = 0;

        try {
            gotoPage = parseInt(formData.get('goto_page') as string);
            if (isNaN(gotoPage)) {
                return fail(400, { message: 'Invalid pagination params' })
            }
        } catch {
            return fail(400, { message: 'Invalid pagination params' })
        }

        const viewState = event.locals.balanceViewSatate;

        let balanceDetailPagination: BalanceDetailPagination | undefined;

        if (viewState === 'revenue') {
            const res = await getRevenues(gotoPage);
            balanceDetailPagination = {...res, balanceDetails: res.revenues};
        } else if (viewState === 'cost') {
            const res = await getCosts(gotoPage);
            balanceDetailPagination = {...res, balanceDetails: res.costs};
        } else if (viewState === 'expense') {
            const res = await getExpenses(gotoPage);
            balanceDetailPagination = {...res, balanceDetails: res.expenses};
        }

        return {
            balanceDetailPagination
        }
    },
};

function isNumber (value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value) && value > 0 
}