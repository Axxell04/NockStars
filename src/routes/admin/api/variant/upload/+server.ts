import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createVariant } from '$lib/server/product';
import { bindVariantImg } from '$lib/server/product';
import { deleteVariantImg } from '$lib/server/product';
import { reorderVariantImgs } from '$lib/server/product';

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
		const colorHex = (formData.get('colorHex') as string | null)?.trim() ?? '';
		const cut = formData.get('cut') as 'oversize' | 'recto';
		const description = formData.get('description') as string | null;
		const stock = Number(formData.get('stock'));
		const priceRaw = (formData.get('priceOverride') as string) ?? '';
		const priceOverride = priceRaw.trim() === '' ? undefined : Number(priceRaw);
		const sortOrder = Number(formData.get('sortOrder'));

		if (!productId || !size || !color || !cut) {
			return json({ success: false, message: 'Faltan campos obligatorios' });
		}
		if (colorHex !== '' && !/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
			return json({ success: false, message: 'Color de muestra inválido' });
		}
		if (
			!Number.isInteger(stock) ||
			stock < 0 ||
			!Number.isInteger(sortOrder) ||
			(priceOverride !== undefined && !Number.isFinite(priceOverride))
		) {
			return json({ success: false, message: 'Valores numéricos inválidos' });
		}

		try {
			const result = await createVariant({
				productId,
				size,
				color,
				colorHex: colorHex || undefined,
				cut,
				description: description ?? undefined,
				stock,
				priceOverride,
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
	} else if (phase === '4') {
		// Remove one existing image from a variant
		const variantImgId = formData.get('variant-img-id') as string;
		if (!variantImgId) {
			return json({ success: false, message: "Parámetro 'variant-img-id' no encontrado" });
		}

		try {
			await deleteVariantImg(variantImgId);
			return json({ success: true });
		} catch (e) {
			console.error('Variant image delete error:', e);
			return json({ success: false, message: 'Error al eliminar la imagen' });
		}
	} else if (phase === '5') {
		// Reorder the variant's saved images
		const variantId = formData.get('variant-id') as string;
		const rawIds = formData.get('image-ids') as string | null;
		if (!variantId) {
			return json({ success: false, message: "Parámetro 'variant-id' no encontrado" });
		}

		let imageIds: unknown[] = [];
		if (rawIds) {
			try {
				const parsed = JSON.parse(rawIds);
				imageIds = Array.isArray(parsed) ? parsed : [];
			} catch {
				return json({ success: false, message: 'Orden de imágenes inválido' });
			}
		}
		if (imageIds.length === 0 || !imageIds.every((id) => typeof id === 'string')) {
			return json({ success: false, message: 'Orden de imágenes inválido' });
		}

		try {
			await reorderVariantImgs(variantId, imageIds as string[]);
			return json({ success: true });
		} catch (e) {
			console.error('Variant image reorder error:', e);
			return json({ success: false, message: 'Error al guardar el orden' });
		}
	}

	return json({ success: false, message: "Parámetro 'phase' es incorrecto" });
};
