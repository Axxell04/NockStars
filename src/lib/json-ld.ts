import { dev } from '$app/environment';

/**
 * Renders a schema.org payload as a complete `<script type="application/ld+json">`
 * element, safe to inject with `{@html}`.
 *
 * ## Why this is not just `JSON.stringify`
 *
 * Svelte's text interpolation escapes `&` and `<`, which corrupts JSON, so
 * structured data has to reach the document as raw markup. Every `{@html}` is
 * therefore a place where escaping becomes the author's job, and for JSON-LD
 * that job is unforgiving: one `<` reaching the output can close the `<script>`
 * element early and turn the rest of the payload into live markup.
 *
 * `JSON.stringify` escapes for JSON, not for HTML. It leaves `<` and `/`
 * untouched, so a value carrying `</script>` serializes with the closing tag
 * intact and breaks straight out of the element.
 *
 * ## The invariant
 *
 * `<` is replaced with `<`, its JSON escape. The payload stays valid
 * JSON-LD — `JSON.parse` and Google's parser both resolve it to the same
 * character — while the HTML parser can no longer see a tag boundary. It is the
 * only character that needs handling: every tag, and therefore every
 * `</script>`, starts with `<`.
 *
 * Route new structured data through this function instead of building the
 * string at the call site, so the escaping has exactly one implementation to
 * audit.
 */
export function renderJsonLdScript(data: unknown): string {
	const json = JSON.stringify(data);

	if (dev && json.includes('<')) {
		console.warn(
			'renderJsonLdScript: the payload contained a raw `<` before escaping. It is ' +
				'escaped, so it cannot inject markup, but structured data is not the place ' +
				'for user input. Check where this value comes from.'
		);
	}

	return `<script type="application/ld+json">${json.replace(/</g, '\\u003c')}</script>`;
}
