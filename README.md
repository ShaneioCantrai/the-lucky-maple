# The Lucky Maple

A deliberately simple internet object: one enormous interactive maple tree, permanent $1 leaves, and a separately funded Canada-only weekly promotional giveaway.

## Product rule

The tree **is** the website. No dashboard, feed, profile system, or mandatory account creation.

### Visitor flow

1. Land directly on the tree.
2. Drag / zoom around it.
3. Click a claimed leaf to see its public card.
4. Click an available leaf to plant it for $1 CAD.
5. Canadian residents can separately enter the weekly giveaway without buying anything.

## Prototype

Open `index.html` directly or serve this directory with any static HTTP server.

Current prototype includes:
- interactive SVG maple tree
- 1,000+ clickable leaves
- pan / wheel zoom / zoom controls
- claimed leaf cards and shareable leaf IDs
- mock $1 plant flow
- separate free giveaway entry flow
- responsive mobile layout

Payments, persistence, email, fraud controls, draw administration and production contest rules are intentionally not wired yet.
## No-login ownership model

A purchaser should not need a password or traditional account.

Production design:
- checkout collects email for receipt/recovery
- backend creates a leaf plus a long random ownership capability token
- browser receives a signed HttpOnly ownership cookie
- receipt email contains a magic `manage leaf` recovery URL
- public leaf page exposes only display name/message, never email or token
- opening the magic URL on another device restores that leaf to the browser
- token rotation/revocation is supported if a recovery link is abused

Contest entry is a separate record from leaf ownership. Buying a leaf does not create better odds or additional entries.

## Likely tiny stack

- static frontend: Cloudflare Pages
- API: Cloudflare Worker
- persistence: D1 or Postgres
- email: transactional provider TBD
- payment provider: TBD after contest/payment-policy review
- analytics: privacy-respecting first-party events

## Important

The `rules.html` included here is a product placeholder, not final legal contest rules. Final production rules should be reviewed before launch.
