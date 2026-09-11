import * as table from '$lib/server/db/schema'
import { generateId } from "$lib/server/functions";
import { getDb } from "$lib/server/db"
import { eq, jaccardDistance } from 'drizzle-orm';

type GetOrderOptions = {
    page?: number;
    limit?: number; 
    completed?: boolean
    cod?: string | null
}

export async function checkOrderExists (cod: string) {
    const [order] = await getDb().select().from(table.order).where(eq(table.order.id, cod)).execute();
    if (order) return true;
    return false;
}

export async function createOrder (content: object, clientName: string) {
    const orderId = generateId(10);
    const order: table.Order = {
        id: orderId,
        content,
        clientName,
        createdAt: new Date(),
    }

    await getDb().insert(table.order).values(order).execute();
    return orderId;
}

export async function getOrders (options: GetOrderOptions = {}) {
    let { page = 1, limit = 10, completed, cod  } = options;
    const offset = (page - 1) * limit;
    let orders: table.Order[] = []
    if (cod) {
        orders = await getDb().select().from(table.order).where(eq(table.order.id, cod)).execute();
        page = 0;
    } else {
        orders = typeof completed === 'undefined' 
            ? await getDb().select().from(table.order).limit(limit).offset(offset).orderBy(table.order.createdAt).execute()
            : await getDb().select().from(table.order).where(eq(table.order.completed, completed)).limit(limit).offset(offset).orderBy(table.order.createdAt).execute()

    }
    
    const totalOrders = typeof completed === 'undefined'
        ? (await getDb().select().from(table.order).execute()).length 
        : (await getDb().select().from(table.order).where(eq(table.order.completed, completed)).execute()).length
    const totalPages = Math.ceil(totalOrders / limit);

    return {
        orders: orders,
        totalPages,
        currentPage: page
    };
}

export async function updateOrder (id: string, content?: object, completed?: boolean, revenueId?: string | null, totalValue?: number | undefined) {
    if (typeof completed !== 'undefined' && typeof revenueId === 'string') {
        await getDb().update(table.order).set({completed, revenueId}).where(eq(table.order.id, id)).execute();
    } else if (typeof completed !== 'undefined' && revenueId === null) {
        const [order] = await getDb().select().from(table.order).where(eq(table.order.id, id));
        await getDb().update(table.order).set({completed, revenueId}).where(eq(table.order.id, id)).execute();
        if (order.revenueId) {
            await getDb().delete(table.revenue).where(eq(table.revenue.id, order.revenueId));
        }
    } else if (typeof content !== 'undefined' && typeof completed !== 'undefined') {
        await getDb().update(table.order).set({content, completed}).where(eq(table.order.id, id)).execute();
    } else if (typeof content !== 'undefined' && typeof totalValue !== 'undefined') {
        const [order] = await getDb().select().from(table.order).where(eq(table.order.id, id)).execute();
        if (order.revenueId) {
            await getDb().update(table.revenue).set({value: totalValue}).where(eq(table.revenue.id, order.revenueId)).execute();
        }
        await getDb().update(table.order).set({content}).where(eq(table.order.id, id)).execute();
    } else if (typeof completed !== 'undefined') {
        await getDb().update(table.order).set({completed}).where(eq(table.order.id, id)).execute();
    }
}

export async function deleteOrder (id: string) {
    const [order] = await getDb().select().from(table.order).where(eq(table.order.id, id)).execute();
    if (order.revenueId) {
        await getDb().delete(table.revenue).where(eq(table.order.revenueId, order.revenueId));
    }
    await getDb().delete(table.order).where(eq(table.order.id, id));
}