# Backlog

Not in scope for the MVP — documented, not built (see `02-BUILD-SPEC.md`,
"Phase 6+"). The MVP rule: once it's done, use it on the truck for two weeks
before adding anything.

## Phase 6+ ideas (from the build spec)

- **Native POS screen** with the Stripe Terminal SDK + BBPOS WisePad 3 — the next
  Strangler Fig step: take payments without Square.
- **Receipt printing** via the generic ESC/POS printer (node-thermal-printer over
  Bluetooth).
- **Customer QR-code ordering.**
- **Inventory tracking + low-stock alerts.**
- **Employee management + time tracking.**
- **Uber Eats / DoorDash integration.**
- **Kanto Fud / multi-store.** The schema already has `businesses → stores`; the
  app currently assumes one store.
- **Cross-business dashboard** (pallets, mini-splits, rentals).

## Follow-ups noticed while building

- **"Orders closed" counts Square-closed orders, not kitchen-finished ones.** A paid
  order is marked fulfilled by Square immediately, while its ticket may still be
  cooking. Consider counting completed kitchen tickets instead.
- **Menu sync is last-write-wins.** Square accepts stale catalog versions, so edits
  made on the POS/dashboard can be overwritten by a later save here. A catalog
  webhook (`catalog.version.updated`) could trigger an automatic pull.
- **Modifier lists are per item.** Square lets one list be shared by many items; a
  pull duplicates a shared list's modifiers onto each item, and a push from one item
  rewrites the shared list.
- **Turbopack dev cache is disabled** (`next.config.ts`) to work around an idle
  memory leak in Next 16.2 (vercel/next.js#94915). Re-enable after upgrading Next
  and re-checking memory.
- **Docker image is ~1.4 GB** because it ships dev dependencies (tsx runs the
  TypeScript server). Compiling `server.ts` ahead of time would shrink it.
- **Unused email settings** (`EMAIL_FROM`, `SMTP_*`, `nodemailer`) remain from the
  magic-link login; remove if email notifications never materialize.
