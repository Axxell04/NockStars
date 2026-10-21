import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { desc, isNull } from 'drizzle-orm';

/**
 * Public storefront routes with no per-entity page behind them. `/carrito`,
 * `/login`, `/pedido/[cod]` and the whole `/admin` tree are deliberately
 * absent: they are transactional or private, and robots.txt disallows them.
 */
const STATIC_PATHS = ['/', '/catalogo', '/contacto'];

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

type SitemapEntry = {
	loc: string;
	lastmod?: string;
};

export const GET: RequestHandler = async ({ url }) => {
	// Active products only. A deactivated product 404s on the storefront, so
	// listing it would hand crawlers a sitemap full of dead URLs.
	const products = await getDb()
		.select({ id: table.product.id, createdAt: table.product.createdAt })
		.from(table.product)
		.where(isNull(table.product.deactivatedAt))
		.orderBy(desc(table.product.createdAt))
		.execute();

	const entries: SitemapEntry[] = [
		...STATIC_PATHS.map((path) => ({ loc: `${url.origin}${path}` })),
		...products.map((product) => ({
			loc: `${url.origin}/producto/${product.id}`,
			// `product` has no updatedAt column; createdAt is the only honest
			// date available, and it is better than omitting lastmod entirely.
			lastmod: product.createdAt.toISOString()
		}))
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
	.map((entry) =>
		entry.lastmod
			? `\t<url>\n\t\t<loc>${escapeXml(entry.loc)}</loc>\n\t\t<lastmod>${entry.lastmod}</lastmod>\n\t</url>`
			: `\t<url>\n\t\t<loc>${escapeXml(entry.loc)}</loc>\n\t</url>`
	)
	.join('\n')}
</urlset>
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			// Products are added rarely; an hour of edge/browser caching keeps
			// crawler traffic off the database without staling the list.
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
