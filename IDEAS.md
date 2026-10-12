# Pending ideas

Ideas and improvements pending for NockStars (Murci). Add yours below; when
something ships, move it to "Done" with the date.

## In progress

_None._

## Ideas

### Storefront

- [ ] **Design skills for catalog cards** — install design skills (e.g.
      Impeccable, Emil) and use them to improve the design of the catalog
      product cards in the client view.

### Admin

- [ ] **Assign existing products to a catalog** — allow adding products that
      already exist to a catalog, instead of only creating new ones from
      scratch.
- [ ] **Pre-select catalog in the add-product form** — when coming from the
      select-catalog → add-product flow, the catalog should arrive
      pre-selected in the form input of that view.

### Infra / DX

- [ ] **Unify the duplicated `cancelFocus` helper** — the same 6-line
      blur-after-200ms helper is copy-pasted into **36 files** across
      `src/routes/**` and `src/lib/components/**` (page layouts, cards, and
      nearly every admin modal). It exists so a focused button still fires
      its click instead of being blurred away first.
      **Fix:** extract it once, e.g. into `src/lib/focus.ts`, and import it
      where needed.
      **Caveat:** the 200 ms delay is the whole trick — it has to survive the
      move, and because so many files are involved this is better done as its
      own focused pass than folded into another change.

### UX / Design

- [ ]

## Done

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
