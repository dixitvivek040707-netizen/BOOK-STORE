# Enginuity Books — feature guide

Enginuity Books is an engineering-student-focused bookstore inspired by common bookstore discovery and shopping patterns. It uses its own layout, wording, and visual identity rather than copying Crossword's branding or page design.

## Storefront and discovery
- Responsive homepage with editorial-style 3D textbook artwork and reduced-motion support.
- Browse by engineering discipline and search the current catalogue by title, author, subject, branch, or tags.
- Filter by academic year and sort by featured, price low-to-high, price high-to-low, or title.
- Dedicated quick subject shortcuts for mathematics, programming/DSA, circuits/electronics, mechanics/design, and physics.
- Value-picks shelf based on real catalogue prices and original prices, showing calculated savings rather than invented sales claims.
- Book cards with branch/year labels, price, original price, computed savings, and a wishlist control.
- Wishlist persists in the current browser using local storage.

## Shopping and fulfilment
- Shopping bag with quantity controls, remove action, and calculated subtotal.
- Checkout captures customer name, email, delivery address, and an optional browser-permission-based delivery location.
- Server recalculates prices from its own catalogue; it does not trust client-supplied prices.
- Order tracking requires both order ID and checkout email.
- Tracking shows the latest status saved by the bookstore. It is not live courier GPS tracking.
- Demo checkout records an order but does not process payment. Payment-provider integration is not included.

## Retention and support
- Newsletter signup saved by the backend with basic request rate limiting and email validation.
- Mail link for requesting a specific book or edition.
- Privacy policy, terms and conditions, and favicon.
- Security headers, request-size limits, origin checks for browser POST requests, and rate limits on selected API endpoints.
- Optional admin authentication and order-status management from the existing secured backend routes.

## Not included / future production work
- ISBN search (the current sample catalogue does not store ISBN fields).
- Live stock/inventory, reviews, ratings, loyalty rewards, gift cards, blog CMS, physical store locator, courier integration, online payments, and customer accounts.
- Real email campaign sending or unsubscribe/preferences management. The newsletter endpoint only stores addresses; add consent wording, unsubscribe flow, retention policy, and an email provider before production.
- Replace local JSON file storage with a managed database before concurrent or public production use.
