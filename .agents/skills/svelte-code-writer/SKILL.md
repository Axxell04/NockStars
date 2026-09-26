---
name: svelte-code-writer
description: CLI tools for Svelte 5 documentation lookup and code analysis. MUST be used whenever creating, editing or analyzing any Svelte component (.svelte) or Svelte module (.svelte.ts/.svelte.js). Run it inside the general agent via skill-path injection, which keeps component edits in a bounded context.
---

# Svelte 5 Code Writer

## CLI Tools

You have access to `@sveltejs/mcp` CLI for Svelte-specific assistance. Use these commands via `npx`:

### List Documentation Sections

```bash
npx @sveltejs/mcp list-sections
```

Lists all available Svelte 5 and SvelteKit documentation sections with titles and paths.

### Get Documentation

```bash
npx @sveltejs/mcp get-documentation "<section1>,<section2>,..."
```

Retrieves full documentation for specified sections. Use after `list-sections` to fetch relevant docs.

**Example:**

```bash
npx @sveltejs/mcp get-documentation "$state,$derived,$effect"
```

### Svelte Autofixer

```bash
npx @sveltejs/mcp svelte-autofixer "<code_or_path>" [options]
```

Analyzes Svelte code and suggests fixes for common issues.

**Options:**

- `--async` - Enable async Svelte mode (default: false)
- `--svelte-version` - Target version: 4 or 5 (default: 5)

**Examples:**

```bash
# Analyze inline code (escape $ as \$)
npx @sveltejs/mcp svelte-autofixer '<script>let count = \$state(0);</script>'

# Analyze a file
npx @sveltejs/mcp svelte-autofixer ./src/lib/Component.svelte

# Target Svelte 4
npx @sveltejs/mcp svelte-autofixer ./Component.svelte --svelte-version 4
```

**Important:** When passing code with runes (`$state`, `$derived`, etc.) via the terminal, escape the `$` character as `\$` to prevent shell variable substitution.

## Workflow

1. **Uncertain about syntax?** Run `list-sections` then `get-documentation` for relevant topics
2. **Reviewing/debugging?** Run `svelte-autofixer` on the code to detect issues
3. **Always validate** - Run `svelte-autofixer` before finalizing any Svelte component

## Project notes (Murci)

`@sveltejs/mcp` is pinned as a devDependency, so `npx` resolves the local copy.

**Treat `svelte-autofixer` output as a review signal requiring human judgement, never as
an automatic fix.** It reports `require_another_tool_call_after_fixing: true`, which invites
a fix loop. In this codebase that loop is actively destructive:

- It flags `state_referenced_locally` on `$state(data.x)` seeds and implies `$derived`.
  This app keeps storefront state in **httpOnly cookies**, so `load` returns a bootstrap
  payload, not a live source. Pagination, catalog selection and cart are all form actions
  that re-seed explicitly via `setProductPagination(result.data.pagination)`. Converting
  `productPagination`, `catalogId` or `cart` to `$derived` breaks pagination, catalog
  selection and the cart.
- It does **not** load the TypeScript ESLint plugin set, so it echoes
  `Definition for rule '@typescript-eslint/no-unused-expressions' was not found` for our
  suppression comments. That is expected. Those comments guard `$effect` dependency
  markers (`productPagination;`, `cart;`, `isSelected;`) which are load-bearing for
  reactivity — never delete them.
- Bare statements inside `$effect` are the Svelte 5 idiom for declaring a dependency,
  not dead code.

What the tool IS reliably good for: `Each block should have a key`, `bind:this` that could
be an `{@attach}`, and catching real reactivity mistakes that `svelte-check` misses.

