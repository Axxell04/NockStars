import { describe, it, expect } from 'vitest';
import { getDb } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { bindVariantImg, getVariantImgs, reorderVariantImgs } from './product';

const cloudUrl = (name: string) => `https://res.cloudinary.com/demo/image/upload/v1/${name}.jpg`;

async function seedVariant(): Promise<string> {
	const db = getDb();
	const productId = `itest-product-${crypto.randomUUID()}`;
	await db
		.insert(table.product)
		.values({ id: productId, name: 'Variant image order test product', price: 10, stock: 1 })
		.execute();

	const variantId = crypto.randomUUID();
	await db
		.insert(table.productVariant)
		.values({
			id: variantId,
			productId,
			size: 'M',
			color: 'Negro',
			cut: 'oversize',
			sortOrder: 0
		})
		.execute();
	return variantId;
}

async function seedImg(variantId: string, url: string, sortOrder: number): Promise<string> {
	const id = crypto.randomUUID();
	await getDb()
		.insert(table.variantImg)
		.values({ id, variantId, url, alt: '', sortOrder })
		.execute();
	return id;
}

async function urlOrder(variantId: string): Promise<string[]> {
	const imgs = await getVariantImgs(variantId);
	return imgs.map((img) => img.url);
}

async function sortOrderOrder(variantId: string): Promise<number[]> {
	const imgs = await getVariantImgs(variantId);
	return imgs.map((img) => img.sortOrder);
}

describe('variant image order', () => {
	it('stores uploads in the order they were given', async () => {
		const variantId = await seedVariant();
		await bindVariantImg(variantId, cloudUrl('first'));
		await bindVariantImg(variantId, cloudUrl('second'));
		await bindVariantImg(variantId, cloudUrl('third'));

		expect(await urlOrder(variantId)).toEqual([
			cloudUrl('first'),
			cloudUrl('second'),
			cloudUrl('third')
		]);
		expect(await sortOrderOrder(variantId)).toEqual([0, 1, 2]);
	});

	it('applies a full reorder, including a swap the unique index would reject', async () => {
		const variantId = await seedVariant();
		const first = await seedImg(variantId, cloudUrl('first'), 0);
		const second = await seedImg(variantId, cloudUrl('second'), 1);
		const third = await seedImg(variantId, cloudUrl('third'), 2);

		await reorderVariantImgs(variantId, [second, first, third]);

		expect(await urlOrder(variantId)).toEqual([
			cloudUrl('second'),
			cloudUrl('first'),
			cloudUrl('third')
		]);
		expect(await sortOrderOrder(variantId)).toEqual([0, 1, 2]);

		await reorderVariantImgs(variantId, [third, first, second]);

		expect(await urlOrder(variantId)).toEqual([
			cloudUrl('third'),
			cloudUrl('first'),
			cloudUrl('second')
		]);
		expect(await sortOrderOrder(variantId)).toEqual([0, 1, 2]);
	});

	it('appends a new upload after the reordered sequence', async () => {
		const variantId = await seedVariant();
		const first = await seedImg(variantId, cloudUrl('first'), 0);
		const second = await seedImg(variantId, cloudUrl('second'), 1);

		await reorderVariantImgs(variantId, [second, first]);
		await bindVariantImg(variantId, cloudUrl('third'));

		expect(await urlOrder(variantId)).toEqual([
			cloudUrl('second'),
			cloudUrl('first'),
			cloudUrl('third')
		]);
		expect(await sortOrderOrder(variantId)).toEqual([0, 1, 2]);
	});

	it.each([
		['a duplicated id', (first: string) => [first, first]],
		['a partial set', (first: string) => [first]],
		['a foreign id', (first: string) => [first, crypto.randomUUID()]]
	])('rejects %s and leaves the stored order untouched', async (_label, buildOrder) => {
		const variantId = await seedVariant();
		const first = await seedImg(variantId, cloudUrl('first'), 0);
		await seedImg(variantId, cloudUrl('second'), 1);

		await expect(reorderVariantImgs(variantId, buildOrder(first))).rejects.toThrow(/Image order/);

		expect(await urlOrder(variantId)).toEqual([cloudUrl('first'), cloudUrl('second')]);
		expect(await sortOrderOrder(variantId)).toEqual([0, 1]);
	});

	it('rejects an id that belongs to a different variant', async () => {
		const variantId = await seedVariant();
		const otherVariantId = await seedVariant();
		const first = await seedImg(variantId, cloudUrl('first'), 0);
		const foreign = await seedImg(otherVariantId, cloudUrl('foreign'), 0);

		await expect(reorderVariantImgs(variantId, [first, foreign])).rejects.toThrow(/Image order/);

		expect(await sortOrderOrder(variantId)).toEqual([0]);
	});
});
