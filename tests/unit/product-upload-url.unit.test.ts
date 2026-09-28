import { describe, it, expect } from 'vitest';
import { normalizeCloudinaryImageUrl } from '$lib/server/product';

describe('Cloudinary image URL validation', () => {
	it('accepts valid Cloudinary HTTPS URLs', () => {
		const url = 'https://res.cloudinary.com/demo/image/upload/v1710000000/sample.jpg';
		expect(normalizeCloudinaryImageUrl(url)).toBe(url);
	});

	it('rejects non Cloudinary URLs', () => {
		expect(() => normalizeCloudinaryImageUrl('https://example.com/image.jpg')).toThrow(
			/Cloudinary/i
		);
	});
});
