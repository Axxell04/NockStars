import * as table from '$lib/server/db/schema'
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { getDb } from '$lib/server/db';
import { v2 as cloudinary } from 'cloudinary';
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } from '$env/static/private';
import { and, desc, eq, like } from 'drizzle-orm';
import { addProductToCatalog } from './catalog';

cloudinary.config({
	cloud_name: CLOUDINARY_CLOUD_NAME,
	api_key: CLOUDINARY_API_KEY,
	api_secret: CLOUDINARY_API_SECRET
});

type GetProductsOptions = {
    page?: number;
    limit?: number;
    search?: string;
    catalogId?: string;
}

export async function createProduct(name: string, price: number, catalogId?: string) {
    const productId = generateId();
    const product: table.Product = {
        id: productId,
        name: name,
        price: price,
        createdAt: new Date()
    }
    
    await getDb().insert(table.product).values(product).execute();

    if (catalogId) {
        await addProductToCatalog(productId, catalogId);
    }
    return productId;
}

export async function bindImg (productId: string, url: string) {    
    const imgId = generateId();

    await getDb().insert(table.img).values({
        id: imgId,
        url: url,
        productId: productId
    }).execute();
}

export async function getProducts (options: GetProductsOptions = {}) {
    const { page = 1, limit = 10, search, catalogId } = options;
    const offset = (page - 1) * limit;
    let products: table.Product[];
    
    if (search) {
        const searchPattern = `%${search}%`
        products= !catalogId 
                            ? await getDb().select().from(table.product).where(like(table.product.name, searchPattern)).limit(limit).offset(offset).orderBy(desc(table.product.createdAt)).execute() 
                            : await getDb().select({
                                id: table.product.id,
                                name: table.product.name,
                                price: table.product.price,
                                createdAt: table.product.createdAt
                            }).from(table.product).innerJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId)).where(and(eq(table.productCatalog.catalogId, catalogId ?? ''), like(table.product.name, searchPattern))).limit(limit).offset(offset).orderBy(desc(table.product.createdAt)).execute()
    } else {
        products= !catalogId 
                            ? await getDb().select().from(table.product).limit(limit).offset(offset).orderBy(desc(table.product.createdAt)).execute() 
                            : await getDb().select({
                                id: table.product.id,
                                name: table.product.name,
                                price: table.product.price,
                                createdAt: table.product.createdAt
                            }).from(table.product).innerJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId)).where(eq(table.productCatalog.catalogId, catalogId ?? '')).limit(limit).offset(offset).orderBy(desc(table.product.createdAt)).execute()
    }
                        
                        
    const listProducts: {product: table.Product, imgs: table.Img[]}[] = [];

    for (const product of products) {
        const imgs = await getImgs(product.id);
        listProducts.push({
            product: product,
            imgs: imgs
        })

    } 

    let totalProducts: number;
    if (search) {
        const searchPattern = `%${search}%`;
        totalProducts = !catalogId
            ? (await getDb().select().from(table.product).where(like(table.product.name, searchPattern)).execute()).length 
            : (await getDb().select({
                id: table.product.id,
                name: table.product.name,
                price: table.product.price,
                createdAt: table.product.createdAt
            }).from(table.product).innerJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId)).where(and(eq(table.productCatalog.catalogId, catalogId ?? ''), like(table.product.name, searchPattern))).execute()).length
            
    } else {
        totalProducts = !catalogId
            ? (await getDb().select().from(table.product).execute()).length 
            : (await getDb().select({
                id: table.product.id,
                name: table.product.name,
                price: table.product.price,
                createdAt: table.product.createdAt
            }).from(table.product).innerJoin(table.productCatalog, eq(table.product.id, table.productCatalog.productId)).where(eq(table.productCatalog.catalogId, catalogId ?? '')).execute()).length

    }

    const totalPages = Math.ceil(totalProducts / limit);

    return {
        products: listProducts,
        totalPages,
        currentPage: page
    };
}

type UpdateProductOptions = {
    product_id: string;
    name?: string;
    price?: number;
    imgsDelete?: string[];
}

export async function updateProduct (options: UpdateProductOptions) {
    const { product_id, name, price, imgsDelete } = options;
    if (typeof name !== "undefined" && typeof price !== "undefined") await getDb().update(table.product).set({name: name, price: price}).where(eq(table.product.id, product_id)).execute();
    if (typeof imgsDelete !== 'undefined') {
        if (imgsDelete.length > 0) {
            for (const imgId of imgsDelete) {
                await deleteImg(imgId);
            }
        }
    }
}

export async function deleteProduct (id: string) {
    const imgs = await getImgs(id);
    for (const img of imgs) {
        await deleteImg(img.id)
    }
    // await getDb().delete(table.img).where(eq(table.img.productId, id)).execute();
    await getDb().delete(table.product).where(eq(table.product.id, id)).execute();
}

export async function getImgs (productId: string) {
    const imgs = await getDb().select().from(table.img).where(eq(table.img.productId, productId)).execute();
    return imgs;
}

// Complementary Functions

export async function deleteImg (id: string, img?: table.Img) {
    if (typeof img === 'undefined') {
        const imgs = await getDb().select().from(table.img).where(eq(table.img.id, id)).execute();
        if (imgs.length === 0) { return };
        img = imgs[0];
    }
    if (!img) { return }
    try {
        const publicId = extractPublicId(img.url);
        await cloudinary.uploader.destroy(publicId);
    } catch {
        // Cloudinary destroy failed — DB record still deleted (REQ-IMG-011)
    }
    await getDb().delete(table.img).where(eq(table.img.id, id)).execute();
}

function generateId () {
    const bytes = crypto.getRandomValues(new Uint8Array(15));
    const id = encodeBase32LowerCase(bytes);
    return id;
}

function extractPublicId (url: string): string {
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex === -1) return url;
    const afterUpload = url.slice(uploadIndex + '/upload/'.length);
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    return withoutVersion.replace(/\.[^/.]+$/, '');
}