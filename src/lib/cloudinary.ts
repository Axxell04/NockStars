/**
 * Inserts a Cloudinary delivery transformation right after `/upload/`.
 *
 * Shared by server and client code on purpose: it must stay free of
 * `$env` / server-only imports so components can size their images
 * without shipping the original asset.
 *
 * URLs that already carry the exact same transformation are returned
 * untouched, so calling this twice is safe.
 */
export function withCloudinaryTransform(url: string, transform: string): string {
	const uploadIndex = url.indexOf('/upload/');
	if (uploadIndex === -1) {
		return url;
	}

	const insertAt = uploadIndex + '/upload/'.length;
	const rest = url.slice(insertAt);
	if (rest.startsWith(`${transform}/`)) {
		return url;
	}

	return `${url.slice(0, insertAt)}${transform}/${rest}`;
}

/**
 * Delivery presets. One place to decide how wide each context renders, so a
 * thumbnail never downloads the original asset and the sizes cannot drift
 * apart between screens.
 *
 * `f_auto` negotiates the codec per requesting browser, which is why the
 * stored format is irrelevant to what the visitor downloads.
 */
export const IMAGE_PRESETS = {
	/** Small inline thumbnails: cart lines, order lines, admin grids. */
	thumb: 'w_256,f_auto,q_auto',
	/** Catalog cards. */
	card: 'w_576,f_auto,q_auto',
	/** Product gallery / lightbox, and the LCP image on the detail page. */
	hero: 'w_1200,f_auto,q_auto'
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export function imageUrl(url: string, preset: ImagePreset): string {
	return withCloudinaryTransform(url, IMAGE_PRESETS[preset]);
}
