import { describe, it, expect } from 'vitest';
import { getDb } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { bindImg, getImgs, reorderImgs } from './product';

const cloudUrl = (name: string) => `https://res.cloudinary.com/demo/image/upload/v1/${name}.jpg`;

async function seedProduct(): Promise<string> {
	const productId = `itest-product-${crypto.randomUUID()}`;
	await getDb()
		.insert(table.product)
		.values({ id: productId, name: 'Image order test product', price: 10, stock: 1 })
		.execute();
	return productId;
}

async function seedImg(productId: string, url: string, sortOrder: number): Promise<string> {
	const id = crypto.randomUUID();
	await getDb().insert(table.img).values({ id, url, productId, sortOrder }).execute();
	return id;
}

async function urlOrder(productId: string): Promise<string[]> {
	const imgs = await getImgs(productId);
	return imgs.map((img) => img.url);
}

async function sortOrderOrder(productId: string): Promise<number[]> {
	const imgs = await getImgs(productId);
	return imgs.map((img) => img.sortOrder);
}

describe('product image order', () => {
	it('stores uploads in the order they were given', async () => {
		const productId = await seedProduct();
		await bindImg(productId, cloudUrl('first'));
		await bindImg(productId, cloudUrl('second'));
		await bindImg(productId, cloudUrl('third'));

		expect(await urlOrder(productId)).toEqual([
			cloudUrl('first'),
			cloudUrl('second'),
			cloudUrl('third')
		]);
		expect(await sortOrderOrder(productId)).toEqual([0, 1, 2]);
	});

	it('appends after the highest stored position, not after the row count', async () => {
		const productId = await seedProduct();
		await seedImg(productId, cloudUrl('first'), 0);
		await seedImg(productId, cloudUrl('second'), 5);

		await bindImg(productId, cloudUrl('third'));

		expect(await sortOrderOrder(productId)).toEqual([0, 5, 6]);
	});

	it('applies a full reorder to the given id sequence', async () => {
		const productId = await seedProduct();
		const first = await seedImg(productId, cloudUrl('first'), 0);
		const second = await seedImg(productId, cloudUrl('second'), 1);
		const third = await seedImg(productId, cloudUrl('third'), 2);

		await reorderImgs(productId, [third, first, second]);

		expect(await urlOrder(productId)).toEqual([
			cloudUrl('third'),
			cloudUrl('first'),
			cloudUrl('second')
		]);
		expect(await sortOrderOrder(productId)).toEqual([0, 1, 2]);
	});

	it.each([
		['a duplicated id', (first: string) => [first, first]],
		['a partial set', (first: string) => [first]],
		['a foreign id', (first: string) => [first, crypto.randomUUID()]]
	])('rejects %s and leaves the stored order untouched', async (_label, buildOrder) => {
		const productId = await seedProduct();
		const first = await seedImg(productId, cloudUrl('first'), 0);
		await seedImg(productId, cloudUrl('second'), 1);

		await expect(reorderImgs(productId, buildOrder(first))).rejects.toThrow(/Image order/);

		expect(await urlOrder(productId)).toEqual([cloudUrl('first'), cloudUrl('second')]);
		expect(await sortOrderOrder(productId)).toEqual([0, 1]);
	});
});
