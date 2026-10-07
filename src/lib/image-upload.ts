import imageCompression from 'browser-image-compression';

/**
 * Client-only image pipeline: every admin surface runs the same resize and the
 * same signed upload, so neither lives duplicated in five components again.
 *
 * Deliberately no `format` conversion here. Delivery URLs carry `f_auto`, which
 * negotiates AVIF/WebP per requesting browser, so the stored codec does not
 * change a single byte the visitor downloads — while a canvas re-encode would
 * cost a second lossy pass, extra client CPU, and silently fall back to PNG on
 * browsers that cannot encode WebP (Safari).
 */

/** Longest edge kept on the stored asset. Matches the `hero` delivery preset. */
export const MAX_IMAGE_EDGE = 1200;

/**
 * A file this heavy is worth re-encoding even when its dimensions are already
 * within `MAX_IMAGE_EDGE` — a flattened 1000px PNG can still weigh megabytes.
 */
export const MAX_IMAGE_BYTES = 512 * 1024;

/**
 * Canvas would rasterise an SVG (losing the vector) and keep only the first
 * frame of an animated GIF, so these are uploaded untouched.
 */
const PASSTHROUGH_TYPES = new Set(['image/svg+xml', 'image/gif']);

/** Pure size policy, kept separate so it can be asserted without a DOM. */
export function needsPreprocessing(
	size: { width: number; height: number },
	bytes: number
): boolean {
	return Math.max(size.width, size.height) > MAX_IMAGE_EDGE || bytes > MAX_IMAGE_BYTES;
}

/**
 * Resizes an oversized image down to `MAX_IMAGE_EDGE`, preserving the source
 * format. Anything that cannot be decoded is returned unchanged rather than
 * blocking the upload.
 */
export async function preprocessImage(file: File): Promise<File> {
	if (!file.type.startsWith('image/') || PASSTHROUGH_TYPES.has(file.type)) return file;

	try {
		const bitmap = await createImageBitmap(file);
		const size = { width: bitmap.width, height: bitmap.height };
		bitmap.close();

		if (!needsPreprocessing(size, file.size)) return file;

		return await imageCompression(file, {
			maxWidthOrHeight: MAX_IMAGE_EDGE,
			useWebWorker: true
		});
	} catch {
		return file;
	}
}

interface UploadSignature {
	signature: string;
	timestamp: number;
	api_key: string;
	cloud_name: string;
	folder: string;
}

/**
 * Signs the upload on our server and posts the bytes straight to Cloudinary.
 * Pass `variantId` to route the asset into `murci/variants/<id>` instead of the
 * shared products folder.
 */
export async function uploadToCloudinary(file: File, variantId?: string): Promise<string> {
	const signatureUrl = variantId
		? `/api/cloudinary/signature?type=variant&variantId=${encodeURIComponent(variantId)}`
		: '/api/cloudinary/signature';

	const sigRes = await fetch(signatureUrl);
	if (!sigRes.ok) throw new Error('Failed to get upload signature');
	const sig = (await sigRes.json()) as UploadSignature;

	const formData = new FormData();
	formData.append('file', file);
	formData.append('api_key', sig.api_key);
	formData.append('timestamp', String(sig.timestamp));
	formData.append('folder', sig.folder);
	formData.append('signature', sig.signature);

	const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, {
		method: 'POST',
		body: formData
	});
	if (!uploadRes.ok) throw new Error('Cloudinary upload failed');

	const data = (await uploadRes.json()) as { secure_url: string };
	return data.secure_url;
}
