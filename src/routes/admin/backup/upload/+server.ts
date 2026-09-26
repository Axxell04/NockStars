import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs';

const IMAGE_TYPES = ['image/webp', 'image/png', 'image/jpeg', 'image/gif', 'image/avif'];

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Acción no autorizada' });
	}

	const formData = await request.formData();
	const file = formData.get('file') as unknown as File;
	if (!file) return json({ success: false, message: 'Parámetro archivo no recibido' });
	try {
		fs.mkdirSync('backups/', { recursive: true });
		fs.mkdirSync('uploads/imgs/', { recursive: true });
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		if (file.type === 'application/json') {
			fs.writeFileSync(`backups/${file.name}`, buffer);
		} else if (IMAGE_TYPES.includes(file.type)) {
			fs.writeFileSync(`uploads/imgs/${file.name}`, buffer);
		}
		return json({ success: true });
	} catch {
		return json({ success: false, message: 'Error al realizar la restauración' });
	}
};
