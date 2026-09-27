import { json, type RequestHandler } from '@sveltejs/kit';
import { v2 as cloudinary } from 'cloudinary';
import {
	CLOUDINARY_CLOUD_NAME,
	CLOUDINARY_API_KEY,
	CLOUDINARY_API_SECRET
} from '$env/static/private';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
		return json(
			{ error: 'Server misconfiguration: Cloudinary credentials are not set' },
			{ status: 500 }
		);
	}

	cloudinary.config({
		cloud_name: CLOUDINARY_CLOUD_NAME,
		api_key: CLOUDINARY_API_KEY,
		api_secret: CLOUDINARY_API_SECRET
	});

	const timestamp = Math.round(Date.now() / 1000);
	// Support variant-specific folders: ?type=variant&variantId=xxx
	const type = url.searchParams.get('type');
	const variantId = url.searchParams.get('variantId');
	const folder = type === 'variant' && variantId ? `murci/variants/${variantId}` : 'murci/products';

	const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, CLOUDINARY_API_SECRET);

	return json({
		signature,
		timestamp,
		api_key: CLOUDINARY_API_KEY,
		cloud_name: CLOUDINARY_CLOUD_NAME,
		folder
	});
};
