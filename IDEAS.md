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
