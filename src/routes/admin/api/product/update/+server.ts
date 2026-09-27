import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bindImg, getImgs, getProducts } from '$lib/server/product';
import { updateProduct } from '$lib/server/product';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Acción no autorizada' });
	}

	const formData = await request.formData();
	const phase = formData.get('phase') as string;
	const catalogId = locals.catalogId;
	if (!phase) return json({ success: false, message: "Parámetro 'phase' no encontrado" });

	if (phase === '1') {
		const product_id = formData.get('product_id') as string;
		const name = formData.get('name') as string;
		const price = parseFloat(formData.get('price') as string);

		if (!product_id || !name || !price)
			return json({ success: false, message: 'Error el los parámetros de la petición' });

		try {
			await updateProduct({ product_id, name, price });
			return json({ success: true });
		} catch {
			return json({ success: false, message: 'Internal server error' });
		}
	} else if (phase === '2') {
		const url = formData.get('url') as string;
		const product_id = formData.get('product_id') as string;

		if (!product_id || !url)
			return json({ success: false, message: 'Error el los parámetros de la petición' });

		await bindImg(product_id, url);
		return json({ success: true });
	} else if (phase === '3') {
		const product_id = formData.get('product_id') as string;
		const listDelete = formData.get('list_delete');
		let finalListDelete: string[] | undefined = [];

		finalListDelete = validateListDelete(listDelete);
		if (!finalListDelete) {
			return json({ success: false, message: 'Invalid list delete' });
		}

		if ((await getImgs(product_id)).length <= finalListDelete.length) {
			return json({ success: false, message: 'Se necesita al menos una imagen del producto' });
		}

		try {
			await updateProduct({ product_id, imgsDelete: finalListDelete });
		} catch {
			return json({ success: false, message: 'Error en la actualización del producto' });
		}

		const pagination = await getProducts({ catalogId });
		return json({ success: true, pagination: pagination });
	}
	return json({ success: false, message: "Parámetro 'phase' es incorrecto" });

	// const formData = await event.request.formData();
	// const product_id = formData.get('product_id')
	// const name = formData.get('name');
	// const price = formData.get('price');
	// const imgs = formData.getAll('imgs') as unknown as FileList;
	// const listDelete = formData.get('list_delete');
	// let finalListDelete: string[] | undefined = [];
	// const catalogId = event.locals.catalogId;

	// if (!validateProductId(product_id)) {
	//     return fail(400, { message: 'Invalid product id'})
	// }

	// if (!validateName(name)) {
	//     return fail(400, { message: 'Invalid name'})
	// }

	// if (!validatePrice(price)) {
	//     return fail(400, { message: 'Invalid price'})
	// }

	// finalListDelete = validateListDelete(listDelete);
	// if (!finalListDelete) {
	//     return fail(400, { message: 'Invalid list delete' })
	// }

	// if ((await getImgs(product_id)).length <= finalListDelete.length && (imgs.length === 1 && (!imgs[0].name && !imgs[0].size))) {
	//     return fail(400, { message: 'Se necesita al menos una imagen del producto' })
	// }

	// try {
	//     await updateProduct({product_id, name, price, imgs, finalListDelete})
	// } catch (error) {
	//     console.log(error);
	//     return fail(500, { message: 'Internal server error' })
	// }

	// const pagination = await getProducts({catalogId});
	// return {
	//     pagination: pagination
	// }
};

function validateListDelete(list: unknown) {
	if (typeof list === 'undefined') {
		return undefined;
	}
	return JSON.parse(list as string) as string[];
}
