# vshop storefront — PRD (MVP)

## What it is
Customer-facing storefront + minimal admin for the existing vshop FastAPI
backend (categories, products, orders). Frontend owns identity (better-auth)
and issues JWTs the backend verifies via the frontend JWKS endpoint.

## MVP pages (must have)
| Page | Route | Story | Acceptance |
|---|---|---|---|
| Catalog | `/` | Browse products, filter by category | Grid renders backend products; category filter works; empty/error states |
| Product detail | `/products/$id` | See details, add to cart | Shows price, description; add-to-cart updates badge |
| Cart | `/cart` | Review items, adjust qty, checkout | Line totals, qty stepper, remove; checkout requires sign-in |
| Orders | `/orders` | See my orders and status | List with status; links to detail |
| Order detail | `/orders/$id` | Inspect items, cancel pending | Items with price snapshots; cancel action on pending |
| Sign in | `/sign-in` | Email/password or passkey | Both flows work; errors surfaced |
| Sign up | `/sign-up` | Create account | Creates user, signs in, redirects |
| Account | `/account` | Profile + passkey management | Shows profile; register/list/delete passkeys |
| Admin users | `/admin` | Admin lists/manages users | Admin-only; list users, ban/unban, set role |

## Auth requirements
- Email/password enabled; passkey sign-in; admin plugin (roles, ban).
- JWT plugin: `GET /api/auth/token` returns JWT; `GET /api/auth/jwks` public keys.
- Backend consumes `Authorization: Bearer <jwt>`, verifies against JWKS (backend work, out of scope here).

## Non-goals (Later)
- Organizations/teams, 2FA, email verification/reset emails, payments,
  product management UI (backend Piccolo admin covers it), search, wishlists.
