import type { RequestHandler } from './$types';

/**
 * robots.txt is a route rather than a static file: the `Sitemap:` line has to
 * carry this deployment's own origin, and a file in `static/` has no request
 * to read it from. A hardcoded domain would silently point at the wrong host
 * the first time the app moves.
 *
 * Behind a reverse proxy, set ORIGIN on the node adapter; otherwise the origin
 * is derived from the Host header and the protocol can fall back to http.
 */
export const GET: RequestHandler = ({ url }) => {
	const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /login
Disallow: /carrito
Disallow: /pedido/

Sitemap: ${url.origin}/sitemap.xml
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
