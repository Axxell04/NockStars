# Pending ideas

Ideas and improvements pending for NockStars (Murci). Add yours below; when
something ships, move it to "Done" with the date.

## In progress

_None._

## Ideas

### UX / Design

- [ ]

## Done

- [x] **Unify the duplicated `cancelFocus` helper** — extracted once into
      `src/lib/focus.ts`, imported by all 37 files that had a local copy.
      The copies were not identical: 22 blurred at 200 ms, 13 had drifted to
      300 ms, and one (carrito) carried a `:focus-visible` guard so keyboard
      focus survives. The unified helper adopts the guarded 200 ms variant —
      the delay is what lets the click fire before the blur, the guard is
      what keeps tab order from restarting — so the other 36 files now stop
      stealing keyboard focus at every tab stop. (2026-10-14)
- [x] **Design skills for catalog cards** — the Impeccable/Emil design-eng
      pass on `ProductCard.svelte` was applied on 2026-10-11 (invisible
      keyboard focus fixed with `focus-visible:outline-brand-400`, the dead
      `transition: all` on `.card-thread` replaced with explicit scoped
      transitions, auto-carousel gated behind `prefers-reduced-motion`);
      verified intact today — the checkbox had just never been ticked.
      (2026-10-11)
- [x] **Pre-select catalog in the add-product form** — both "Añadir Producto"
      links in `/admin/catalogo` (header and empty state) now pass
      `?catalogId=<id>` when a catalog is selected; the `producto/nuevo` load
      validates the param against the real catalog list (a stale or mistyped
      id falls back to "Sin catálogo" instead of posting a membership that
      would violate the `product_catalog` foreign key) and the select seeds
      its state from the validated value. The admin can still change it — it
      is a pre-selection, not a constraint. (2026-10-14)
- [x] **Assign existing products to a catalog** — the Productos tab of
      `/admin/catalogo` now has an "Asignar existente" button (only when a
      catalog is selected). It opens a modal listing every product outside
      the current catalog, tagged with its origin ("Sin catálogo" or the
      catalog name). Assigning MOVES the product: `moveProductToCatalog`
      deletes the old `product_catalog` row and inserts the new one in one
      transaction, keeping the one-catalog-per-product rule true by
      construction. Multi-select, server-validated ids (`assign_product_to_catalog`
      action checks the target catalog exists). The candidate rows show the
      product thumbnail (Cloudinary `thumb` preset, placeholder icon when the
      product has no images), price, sellable stock (variant totals when the
      product has variants) and an origin badge; selection is a check indicator,
      not color alone. (2026-10-14)

- [x] **Every real order 404s on `/pedido/[cod]`** — the load rejected any
      code whose length was not exactly 10 (`cod.length !== 10`), a fossil of
      the dead `createOrder()`/`generateId(10)` path, while live checkout mints
      24-char ids. Removed the guard and collapsed `checkOrderExists()` into
      `getOrderWithItems()` (one query instead of two — it already returns
      `null` for a missing row). The template now renders `data.message` too,
      so the error branch is no longer a hardcoded "Pedido no encontrado".
      Also deleted the orphaned `checkOrderExists()`. (2026-10-11)
- [x] **Order marked Completado still shows in Pendientes** — `getOrders()`
      dropped the `completed` filter whenever `cod` was set; it now composes
      `and(id = cod, completed = …)`. The `load` reads
      `locals.orderViewState` instead of hardcoding `false`, and the page
      seeds its toggle label from the server and no longer auto-submits
      `set_view_state` on mount (that click rewrote the cookie to `pending`
      on every load, which is why the toggle never stuck). `prev_page` and
      `next_page` now pass `completed` as `goto_page` already did. Removed the
      dead `done`, `delete_order`, `edit_order`, `update_order_state` actions,
      the orphaned `isNumber` helper, and the `?/get_orders` form that pointed
      at a non-existent action. (2026-10-11)
- [x] **Customizable order-status message** — `/pedido/[cod]` now shows a
      message built from an admin template, rendered server-side with 8
      placeholders (`{cliente}`, `{estado}`, `{codigo}`, `{fecha}`, `{total}`,
      `{envio}`, `{items}`, `{unidades}`). Unconfigured = no block.
      (2026-10-11)
- [x] **Template editor for order-status message** — `/admin/estado-pedido`
      edits one template per status with live preview through the same
      builder and renderer the storefront uses. (2026-10-11)
- [x] **Cart image modal** — clicking a cart line thumbnail opens the
      lightbox (arrows, dots, Escape). Since the third consumer landed, the
      viewer lives in `src/lib/components/ImageLightbox.svelte` instead of
      being pasted inline per page; it takes `bind:viewer` and owns the
      arrow-key effect, so a page only assigns the state from its trigger.
      (2026-10-11)
- [x] **Order image modal** — `/pedido/[cod]` line thumbnails open the same
      lightbox. The `<div>` became a `<button>` with `cursor-zoom-in`,
      `disabled` when the line has no images, and an `aria-label`. The list
      prefers the product gallery and falls back to the checkout
      `imageUrls`, so it can hold more images than the single thumbnail
      shown. (2026-10-11)
- [x] **Migrate images to Cloudinary** — verified in code: SDK installed,
      signature endpoint live, local `/imgs` route removed, deletes go
      through Cloudinary. (2026-10-11)
