import type { RequestHandler } from './$types';
import { promisify } from 'util';
import { exec } from 'child_process';
import { json } from '@sveltejs/kit';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Acción no autorizada' });
	}

	try {
		await execAsync('node scripts/resetData.js');
		return json({ success: true });
	} catch (error) {
		return json({ success: false, message: 'Error al limpiar los datos' });
	}
};
