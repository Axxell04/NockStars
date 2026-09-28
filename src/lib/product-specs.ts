/**
 * Product spec sheet ("ficha técnica") helpers.
 *
 * Specs are persisted as a `jsonb` object (`{ [key: string]: value }`) so admins
 * can add attributes without a migration per attribute. Everything that turns
 * raw form input into that shape — or that shape into display rows — lives here,
 * so the admin form, the storefront sheet and the JSON-LD serializer cannot
 * drift apart.
 *
 * Plain TypeScript: no server-only imports, so it is safe on both sides of the
 * SvelteKit boundary.
 */

export type ProductSpecs = Record<string, string>;

/**
 * Human labels for the keys we expect to see. The declaration order is also the
 * display order, so put the most important attributes first. Unknown keys are
 * still supported — they are humanized and sorted alphabetically after these.
 */
export const SPEC_LABELS: Record<string, string> = {
	material: 'Material',
	composicion: 'Composición',
	peso: 'Peso',
	origen: 'Origen',
	cuidados: 'Cuidados',
	marca: 'Marca',
	temporada: 'Temporada',
	genero: 'Género',
	sku: 'SKU',
	referencia: 'Referencia'
};

const SPEC_LABEL_ORDER = Object.keys(SPEC_LABELS);
const KNOWN_SPEC_KEYS = new Set(SPEC_LABEL_ORDER);

/** Upper bounds for a single spec sheet. Also enforced when reading form input. */
export const MAX_SPEC_ROWS = 40;
export const MAX_SPEC_KEY_LENGTH = 60;
export const MAX_SPEC_VALUE_LENGTH = 300;

/** Upper bound for the product-level prose description. */
export const MAX_PRODUCT_DESCRIPTION_LENGTH = 4000;

/** Form field names, matching the repo convention of `formData.getAll(name)`. */
export const SPEC_KEY_FIELD = 'specKey';
export const SPEC_VALUE_FIELD = 'specValue';

export interface SpecEntry {
	key: string;
	label: string;
	value: string;
}

/**
 * Coerces a form field to trimmed text. `File` entries become an empty string so
 * a mis-typed input can never serialize `[object File]` into the specs column.
 */
function toText(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	return '';
}

/**
 * Reads a stored spec value. Non-scalar jsonb values (objects, arrays, null) are
 * dropped rather than stringified: `specs` is typed as `Record<string, string>`
 * and a value that is not text is a data bug, not a display concern.
 */
function toStoredValue(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	return '';
}

/**
 * Normalizes a free-text attribute name into a stable key: lowercase, no
 * accents, non-alphanumerics collapsed to `_`, no leading or trailing `_`.
 */
export function slugifySpecKey(raw: string): string {
	return toText(raw)
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, MAX_SPEC_KEY_LENGTH)
		.replace(/_+$/g, '');
}

/**
 * Display label for a key: the declared label when known, otherwise a humanized
 * version of the key itself (`tela_algodon` -> `Tela algodon`).
 */
export function humanizeSpecKey(key: string): string {
	const known = SPEC_LABELS[key];
	if (known) return known;

	const words = key.replace(/_+/g, ' ').trim();
	if (!words) return key;
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Server-side: turns submitted (key, value) rows into the persisted shape.
 *
 * Rows with an empty key or an empty value are dropped — a half-filled row is a
 * form the admin has not finished, not data. Keys are slugified, and a later
 * duplicate key overwrites an earlier one. Length and row-count caps are the
 * backstop that keeps the column well-formed; the action layer rejects oversized
 * input up front so an admin is told instead of silently losing the tail.
 */
export function normalizeSpecs(rows: Array<[string, string]>): ProductSpecs {
	const specs: ProductSpecs = {};
	let accepted = 0;

	for (const [rawKey, rawValue] of rows) {
		const key = slugifySpecKey(toText(rawKey));
		const value = toStoredValue(rawValue).slice(0, MAX_SPEC_VALUE_LENGTH).trim();
		if (!key || !value) continue;

		if (!(key in specs)) {
			if (accepted >= MAX_SPEC_ROWS) break;
			accepted += 1;
		}
		specs[key] = value;
	}

	return specs;
}

/**
 * Client-safe: the stored shape as ordered display rows. Known keys come first
 * in their declared order, everything else alphabetically, and rows with an
 * empty value are dropped.
 */
export function specEntries(specs: ProductSpecs | null | undefined): SpecEntry[] {
	if (!specs || typeof specs !== 'object') return [];

	const entries: SpecEntry[] = [];

	for (const key of SPEC_LABEL_ORDER) {
		const value = toStoredValue(specs[key]);
		if (value) entries.push({ key, label: SPEC_LABELS[key], value });
	}

	const extraKeys = Object.keys(specs)
		.filter((key) => !KNOWN_SPEC_KEYS.has(key))
		.sort((a, b) => a.localeCompare(b, 'es'));

	for (const key of extraKeys) {
		const value = toStoredValue(specs[key]);
		if (value) entries.push({ key, label: humanizeSpecKey(key), value });
	}

	return entries;
}

/**
 * Reads the repeatable `specKey` / `specValue` form fields produced by the admin
 * spec editor. Rows are returned positionally, blanks included, so the caller
 * can count them; `normalizeSpecs` is what drops the incomplete ones.
 */
export function parseSpecRows(formData: FormData): Array<[string, string]> {
	const keys = formData.getAll(SPEC_KEY_FIELD);
	const values = formData.getAll(SPEC_VALUE_FIELD);
	const rows: Array<[string, string]> = [];

	for (let i = 0; i < Math.max(keys.length, values.length); i++) {
		rows.push([toText(keys[i]), toText(values[i])]);
	}

	return rows;
}

/** The stored shape as editable rows, in the same order the storefront shows. */
export function toSpecRows(
	specs: ProductSpecs | null | undefined
): Array<{ key: string; value: string }> {
	return specEntries(specs).map(({ key, value }) => ({ key, value }));
}
