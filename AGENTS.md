# AGENTS.md — NockStars (Murci)

Conventions for this repository. Read before changing code.

## Verification

Every change must pass all three, in this order:

```bash
npm run lint    # prettier --check + eslint + effect-convention guard
npm run check   # svelte-check: 0 errors, 0 warnings
npm run build   # SvelteKit build
```

A green gate is necessary, never sufficient. See "What the gates cannot see".

## Svelte: load the skill first

**Before any edit to a `.svelte`, `.svelte.ts` or `.svelte.js` file, read
`.agents/skills/svelte5-best-practices/SKILL.md` and the reference it points to
for the topic at hand** (`references/runes.md` for reactivity,
`references/sveltekit.md` for data loading, `references/performance.md` for
rendering cost).

`.agents/skills/svelte-code-writer/SKILL.md` is also available, but read its
"Project notes" section first. Its autofixer is a **review signal, not a
toolbox**: it invites a fix loop that is destructive in this codebase.

## Reactivity: real reads, not markers

Inside an `$effect`, a dependency is expressed by **reading the value you
depend on**. Never by a bare reference statement.

```js
// Forbidden — a marker whose only purpose is to be read by the effect
$effect(() => {
	// eslint-disable-next-line @typescript-eslint/no-unused-expressions
	productPagination;
	scrollTo({ top: 170 });
});

// Correct — the dependency and its meaning are both visible
$effect(() => {
	if (productPagination.products) {
		scrollTo({ top: 170 });
	}
});
```

Both track the same dependency. The second needs no lint suppression, and it
documents _what_ it depends on. A suppression comment is a marker that outlived
its author, and it is the reason this rule is mechanically enforced.

If an effect genuinely needs to re-run on a binding it does not otherwise use,
that is a signal the effect's condition is incomplete — widen the condition
until the real dependency is visible. Do not paper over it.

**Never invent a condition to satisfy this rule.** A guard like
`currentPage >= 0` is a tautology that reads like validation: it implies the
page number is being checked when nothing checks it anywhere in this codebase.
Read the value the effect actually acts on — the rendered list, not the page
counter — and let the body stay unconditional. A comment that says what the
condition really is worth more than a condition that looks safer than it is.

**Enforced by `npm run check:effects`** (also runs inside `npm run lint` and in
the `pre-commit` hook). It rejects both bare markers and
`no-unused-expressions` suppressions under `src/`.

## Storefront state is cookie-backed — do not "fix" it into `$derived`

`src/routes/+page.server.ts` keeps state in **httpOnly cookies**
(`event.locals.catalogId`, `event.locals.cart`) and never reads
`url.searchParams`. Its `load` therefore returns a **bootstrap payload, not a
live source**.

`productPagination`, `catalogId` and `cart` in `src/routes/+page.svelte` are
deliberately seeded once with `$state(data.x)` and re-seeded explicitly by their
form-action handlers via `setProductPagination(result.data.pagination)`.

Converting any of them to `$derived` — which both the svelte autofixer and a
static reading of the runes docs suggest — breaks pagination, catalog selection
and the cart. `data` only refreshes on a real navigation, which remounts the
component and re-seeds the state anyway.

Bindings that are genuinely read-only (`catalogs`) _are_ `$derived`, because
there is no local mutation to preserve. The distinction is whether the binding
is ever assigned locally.

## What the gates cannot see

**TypeScript accepts an array spread into an object literal.**
`const x: T[] = { ...arr }` compiles with zero errors. In `OrderCard.svelte` this
produced `{0: …, 1: …}` instead of a copy, and it stayed invisible because the
next effect reassigned a real reference and repaired it by accident. `npm run
check` reported 0 errors both before and after the fix, and never will for this
class. Read assignment shapes; do not infer correctness from a green gate.

**`svelte-check` does not audit `$effect` semantics.** It will not tell you that
an effect both reads and writes the same state, or that a timer has no cleanup.
Audit effects deliberately when you touch them.

## Effects: known-safe structures

Some effects look wrong and are load-bearing. Do not restructure them without
runtime proof.

- **Cross-component loop termination.** The previous-value tracker in
  `OrderCard.svelte` self-triggers once and converges, but only because an
  effect in `admin/pedidos/+page.svelte` clears `orderSelected`. The ordering
  dependency is invisible from either file alone.
- **Auto-submit effects.** Effects that call `element.click()` to submit a
  hidden form are how pagination, catalog switching and cart sync reach the
  server. Removing one silently breaks the feature with no error.

## Structured data: one serializer, never a hand-built string

Schema.org JSON-LD must be rendered with `renderJsonLdScript` from
`src/lib/json-ld.ts`. Never build the `<script type="application/ld+json">` string
at the call site, and never interpolate into `{@html}` directly.

Svelte's text interpolation escapes `&` and `<`, which corrupts JSON, so
structured data has to be injected as raw markup. That makes the escaping the
author's job, and `JSON.stringify` does not do it: it escapes for JSON, not for
HTML, and leaves `<` and `/` untouched. A single `<` reaching the output closes
the `<script>` element early and turns the rest of the payload into live markup.

`renderJsonLdScript` replaces every `<` with `<`, its JSON escape. The payload
stays valid JSON-LD and no tag boundary survives. It is also the only place that
needs auditing, so new structured data gets the same protection for free. It
warns in dev when a value carries a raw `<`, which means user input is reaching
structured data and the source is worth fixing.

The same reasoning applies to any future `{@html}`: it disables Svelte's
escaping, so the value must be escaped or validated by the code that builds it.

## Commit hygiene

- Conventional commits, English, one concern per commit.
- Never add AI attribution or `Co-Authored-By`.
- Never run repo-wide `prettier --write .`. It rewrites vendored skills and
  generated Drizzle metadata; `.prettierignore` already excludes them. If you
  must format, target the specific files you edited.
- Never commit `dist/`, `.svelte-kit/`, or environment files.
