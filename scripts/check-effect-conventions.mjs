#!/usr/bin/env node
/**
 * Enforces how `$effect` dependencies are expressed in this codebase.
 *
 * Two rules, both mechanical so they cannot drift:
 *
 * 1. No bare-reference dependency markers. Inside an `$effect` body, a
 *    statement that is only a reference (`productPagination;`) exists solely to
 *    make the effect re-run. It is reported by
 *    `@typescript-eslint/no-unused-expressions`, and the usual "fix" is to
 *    silence that report — which trades a real reactivity contract for a
 *    comment nobody reads six months later. Express the dependency as a read of
 *    the value you actually depend on instead.
 *
 * 2. No `no-unused-expressions` eslint-disable comments. A suppression here is
 *    the fingerprint of rule 1, and it is how the pattern survives refactors.
 *
 * Why this matters: `$effect(() => { productPagination; scrollTo(...) })` and
 * `$effect(() => { if (productPagination.currentPage >= 0) scrollTo(...) })`
 * track the same dependency. The second is one line longer and needs no
 * suppression, and it documents what it depends on.
 *
 * Exit code 0 = clean, 1 = violations found.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const EXTENSIONS = new Set(['.svelte', '.ts', '.js']);

// A statement whose entire content is a reference: `foo;`, `a.b;`, `a.b.c;`.
// Deliberately excludes calls (`foo();`), assignments (`a = 1`), mutations
// (`i++`), and keywords, so only true bare-reference markers match.
const BARE_REFERENCE = /^\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*;\s*$/;

// Bare keywords are single-token statements (`return;`, `break;`) and would
// otherwise match BARE_REFERENCE. A marker is always a real binding.
const RESERVED = new Set([
	'return',
	'break',
	'continue',
	'throw',
	'debugger',
	'void',
	'delete',
	'typeof',
	'await',
	'yield',
	'new',
	'let',
	'const',
	'var',
	'if',
	'for',
	'while',
	'switch',
	'do',
	'else',
	'try',
	'catch',
	'finally',
	'function',
	'class',
	'export',
	'import',
	'null',
	'undefined',
	'true',
	'false'
]);

const SUPPRESSION = /eslint-disable(?:-next-line|-line)?[^\n]*no-unused-expressions/;

function walk(dir) {
	const found = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			found.push(...walk(full));
		} else if ([...EXTENSIONS].some((ext) => entry.endsWith(ext))) {
			found.push(full);
		}
	}
	return found;
}

const violations = [];

for (const file of walk(SRC)) {
	const rel = relative(ROOT, file);
	const lines = readFileSync(file, 'utf8').split(/\r?\n/);

	lines.forEach((line, index) => {
		const at = `${rel}:${index + 1}`;

		if (SUPPRESSION.test(line)) {
			violations.push({
				at,
				kind: 'suppression',
				line: line.trim(),
				fix: 'Delete the suppression and express the dependency as a real read.'
			});
			return;
		}

		if (BARE_REFERENCE.test(line) && !/^\s*\/\//.test(line)) {
			const reference = line.match(BARE_REFERENCE)[1].replace(/\s+/g, '');
			if (RESERVED.has(reference)) return;

			violations.push({
				at,
				kind: 'marker',
				line: line.trim(),
				fix: 'Replace with a real read of the value the effect depends on.'
			});
		}
	});
}

if (violations.length === 0) {
	console.log('Effect conventions OK — dependencies are expressed as real reads.');
	process.exit(0);
}

console.error(`\nEffect convention violations (${violations.length}):\n`);
for (const v of violations) {
	console.error(`  ${v.at}  [${v.kind}]  ${v.line}`);
	console.error(`      -> ${v.fix}\n`);
}
console.error(
	'Bare markers and their lint suppressions are not allowed. See AGENTS.md,\n' +
		'"Reactivity: real reads, not markers".\n'
);
process.exit(1);
