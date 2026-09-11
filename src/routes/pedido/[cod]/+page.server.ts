import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { checkOrderExists } from "$lib/server/order";

export const load: PageServerLoad = async (event) => {
    const cod = event.params.cod;
    if (!cod || cod.length !== 10) {
        return {
            message: "El código del pedido es incorrecto"
        }
    } else if (!(await checkOrderExists(cod))) {
        return {
            message: "El pedido ingresado no ha sido encontrado"
        }
    }

    if (event.locals.user) {
        return redirect(307, `/admin/pedidos?cod=${cod}`);
    } else {
        return {
            message: "Su pedido está siendo manejado, gracias por confiar en Murci"
        }
    }

};