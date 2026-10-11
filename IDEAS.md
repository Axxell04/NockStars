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
- [ ] **Customizable order-status message** — `/pedido/[id]` (the view clients
      see after placing an order) should show a personalized message built
      from a template the admin defines in an admin panel, supporting
      placeholders like the customer's name and order details (status,
      items, totals).

### Admin

- [ ] **Template editor for order-status message** — admin panel UI to
      predefine/edit the message template clients see in `/pedido/[id]`,
      with placeholders for customer name and order details.
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

- [x] **Cart image modal** — clicking a cart line thumbnail opens the same
      lightbox as `/admin/pedido` (arrows, dots, Escape). (2026-10-11)
- [x] **Migrate images to Cloudinary** — verified in code: SDK installed,
      signature endpoint live, local `/imgs` route removed, deletes go
      through Cloudinary. (2026-10-11)
