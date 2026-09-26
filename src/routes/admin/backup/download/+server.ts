import type { RequestHandler } from './$types';
import { spawn } from 'child_process';
import { json } from '@sveltejs/kit';
import path from 'path';
import fs from 'fs';

import AdminZip from 'adm-zip';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ success: false, message: 'Acción no autorizada' });
	}
	const scriptPath = path.resolve('scripts/backup.js');

	return new Promise((resolve) => {
		const process = spawn('node', [scriptPath]);
		let output = '';
		process.stdout.on('data', (data) => {
			output += data.toString();
		});
		process.stderr.on('data', (data) => {
			console.error('Error: ', data.toString());
		});
		process.on('close', (code) => {
			console.log(`Script finalizado con código ${code}`);
			// const backup = fs.readFileSync("backups/data.json", "utf-8");
			const backup = compressFolder();
			resolve(
				new Response(backup as BodyInit, {
					headers: {
						'Content-Type': 'application/zip',
						'Content-Disposition': `attachment; filename="MurciBackup-${new Date().toISOString()}.zip"`
					}
				})
			);
		});
	});
};

function compressFolder() {
	const zip = new AdminZip();
	zip.addLocalFolder('backups', 'backup');
	zip.addLocalFolder('uploads/imgs', 'backup/imgs');
	return zip.toBuffer();
}
