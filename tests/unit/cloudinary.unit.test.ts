import { describe, expect, it } from 'vitest';
import { IMAGE_PRESETS, imageUrl, withCloudinaryTransform } from '$lib/cloudinary';

const CLOUDINARY_URL =
	'https://res.cloudinary.com/demo/image/upload/v1710000000/murci/products/shirt';

describe('IMAGE_PRESETS', () => {
	it('always negotiates format and quality alongside the width', () => {
		for (const preset of Object.values(IMAGE_PRESETS)) {
			expect(preset).toContain('f_auto');
			expect(preset).toContain('q_auto');
		}
	});
});

describe('withCloudinaryTransform', () => {
	it('inserts the transformation right after /upload/', () => {
		expect(withCloudinaryTransform(CLOUDINARY_URL, 'w_576')).toBe(
			`${CLOUDINARY_URL.replace('/upload/', '/upload/w_576/')}`
		);
	});

	it('is idempotent when the same transformation is already present', () => {
		const once = withCloudinaryTransform(CLOUDINARY_URL, 'w_576');
		expect(withCloudinaryTransform(once, 'w_576')).toBe(once);
	});

	it('leaves URLs that are not Cloudinary uploads untouched', () => {
		expect(withCloudinaryTransform('/nock-logo.png', 'w_576')).toBe('/nock-logo.png');
	});
});

describe('imageUrl', () => {
	it('applies the requested preset', () => {
		expect(imageUrl(CLOUDINARY_URL, 'card')).toBe(
			`${CLOUDINARY_URL.replace('/upload/', `/upload/${IMAGE_PRESETS.card}/`)}`
		);
	});

	it('produces a distinct variant per preset so contexts cannot collide', () => {
		expect(imageUrl(CLOUDINARY_URL, 'thumb')).not.toBe(imageUrl(CLOUDINARY_URL, 'hero'));
	});
});
