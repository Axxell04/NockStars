import { encodeBase32LowerCase } from '@oslojs/encoding';

export function generateId(length: number = 24) {
	const totalBits = length * 5;
	const byteLength = Math.ceil(totalBits / 8);
	const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
	const id = encodeBase32LowerCase(bytes).slice(0, length);
	return id;
}
