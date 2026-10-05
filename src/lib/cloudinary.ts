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
