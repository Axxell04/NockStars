import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createVariant, getVariantsByProduct } from '$lib/server/product';
import { bindVariantImg } from '$lib/server/product';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Acción no autorizada' });
	}

	const formData = await request.formData();
	const phase = formData.get('phase') as string;
	if (!phase) return json({ success: false, message: "Parámetro 'phase' no encontrado" });

	if (phase === '1') {
		// Create variant
		const productId = formData.get('productId') as string;
		const size = formData.get('size') as string;
		const color = formData.get('color') as string;
		const cut = formData.get('cut') as 'oversize' | 'recto';
		const description = formData.get('description') as string | null;
		const stock = parseInt(formData.get('stock') as string) || 0;
		const priceOverride = formData.get('priceOverride') as string;
		const sortOrder = parseInt(formData.get('sortOrder') as string) || 0;

		if (!productId || !size || !color || !cut) {
			return json({ success: false, message: 'Faltan campos obligatorios' });
		}

		try {
			const result = await createVariant({
				productId,
				size,
				color,
				cut,
				description: description ?? undefined,
				stock,
				priceOverride: priceOverride ? parseFloat(priceOverride) : undefined,
				sortOrder
			});

			if (!result.success) {
				return json({ success: false, message: result.error.message });
			}

			return json({ success: true, variantId: result.data.id });
		} catch (e) {
			console.error('Variant creation error:', e);
			return json({ success: false, message: 'Error interno del servidor' });
		}
	} else if (phase === '2') {
		// Upload image for variant
		const url = formData.get('url') as string;
		const variantId = formData.get('variant-id') as string;
		if (!url) return json({ success: false, message: "Parámetro 'url' no encontrado" });
		if (!variantId)
			return json({ success: false, message: "Parámetro 'variant-id' no encontrado" });

		try {
			await bindVariantImg(variantId, url);
			return json({ success: true });
		} catch (e) {
			console.error('Variant image bind error:', e);
			return json({ success: false, message: 'Error al guardar la imagen' });
		}
	} else if (phase === '3') {
		// Finalize - return updated variants list
		const productId = formData.get('productId') as string;
		if (!productId) return json({ success: false, message: "Parámetro 'productId' no encontrado" });

		try {
			const variants = await getVariantsByProduct(productId);
			return json({ success: true, variants });
		} catch (e) {
			console.error('Variant list fetch error:', e);
			return json({ success: false, message: 'Error al cargar variantes' });
		}
	}

	return json({ success: false, message: "Parámetro 'phase' es incorrecto" });
};
