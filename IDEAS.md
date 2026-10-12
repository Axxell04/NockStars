# Pending ideas

Ideas and improvements pending for NockStars (Murci). Add yours below; when
something ships, move it to "Done" with the date.

## In progress

_None._

## Ideas

### Bugs

- [ ] **Order marked Completado still shows in Pendientes** — `/admin/pedidos`
      keeps listing an order after it is marked complete.
      **Root cause:** `getOrders()` drops the `completed` filter entirely
      whenever `cod` is set (`src/lib/server/order.ts`, the `if (cod)`
      single-order lookup matches by id only), while the page load always
      passes `{ completed: false, cod }`. Reachable via `/pedido/[cod]`, which
      redirects a logged-in admin to `/admin/pedidos?cod=…` and leaves `cod`
      in the URL, so the filter is silently discarded.
      **Secondary:** that `load` hardcodes `completed: false` and never reads
      `locals.orderViewState`, so the Pendientes/Completados toggle resets on
      reload even though the cookie is written and read into locals.
      **Also dead:** the `done` and `update_order_state` actions in
      `/admin/pedidos/+page.server.ts` are never referenced by the page — the
      only completion toggle lives in `/admin/pedido/[id]`.

- [ ] **Every real order 404s on `/pedido/[cod]`** — the page always renders
      "Pedido no encontrado" even though the order exists. No order in the
      database passes.
      **Root cause:** the load rejects any code whose length is not exactly 10
      (`src/routes/pedido/[cod]/+page.server.ts`, `cod.length !== 10`) before
      querying. But live checkout generates
      `` `ORD-${Date.now()}-${random6}` `` (`src/lib/server/cart.ts:699`) = **24
      chars**. Verified against the DB: 13/13 orders fail the guard — 6 real
      ones at 24 chars, 7 `itest-order-<uuid>` rows at 48.
      The 10-char expectation comes from `generateId(10)` inside `createOrder()`,
      which is **dead code** — never called by any route, only referenced in a
      comment in `order-content.ts` that says "now dead code".
      **Fix:** drop the length guard entirely; `checkOrderExists()` already does
      the real lookup. (Consider also dropping the `itest-order-*` rows, which
      are integration-test debris sitting in the live database.)
      **Secondary:** the template never renders `data.message`, so the
      "código incorrecto" and "pedido no encontrado" branches look identical to
      the user — which is why this read as "not found" rather than "bad code".

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

- [ ]

### UX / Design

- [ ]

## Done

- [x] **Customizable order-status message** — `/pedido/[cod]` now shows a
      message built from an admin template, rendered server-side with 8
      placeholders (`{cliente}`, `{estado}`, `{codigo}`, `{fecha}`, `{total}`,
      `{envio}`, `{items}`, `{unidades}`). Unconfigured = no block.
      (2026-10-11)
- [x] **Template editor for order-status message** — `/admin/estado-pedido`
      edits one template per status with live preview through the same
      builder and renderer the storefront uses. (2026-10-11)
- [x] **Cart image modal** — clicking a cart line thumbnail opens the same
      lightbox as `/admin/pedido` (arrows, dots, Escape). (2026-10-11)
- [x] **Migrate images to Cloudinary** — verified in code: SDK installed,
      signature endpoint live, local `/imgs` route removed, deletes go
      through Cloudinary. (2026-10-11)
