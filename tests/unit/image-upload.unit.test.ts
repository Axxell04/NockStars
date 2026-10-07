import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, MAX_IMAGE_EDGE, needsPreprocessing } from '$lib/image-upload';

describe('needsPreprocessing', () => {
	it('resizes anything whose longest edge exceeds the delivery preset', () => {
		expect(needsPreprocessing({ width: 4000, height: 3000 }, 1024)).toBe(true);
		expect(needsPreprocessing({ width: 1201, height: 800 }, 1024)).toBe(true);
	});

	it('keeps images already within the delivery preset', () => {
		expect(needsPreprocessing({ width: MAX_IMAGE_EDGE, height: 800 }, 1024)).toBe(false);
		expect(needsPreprocessing({ width: 800, height: 1000 }, 1024)).toBe(false);
	});

	it('re-encodes an undersized-but-heavy file, such as a flat 1000px PNG', () => {
		expect(needsPreprocessing({ width: 1000, height: 1000 }, MAX_IMAGE_BYTES + 1)).toBe(true);
	});

	it('leaves a small file completely alone', () => {
		expect(needsPreprocessing({ width: 640, height: 480 }, 80 * 1024)).toBe(false);
	});
});
