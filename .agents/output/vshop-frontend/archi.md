# Architecture

## Stack (why)
- TanStack Start + React 19 (already scaffolded), file routes, server routes for auth.
- Prisma 7 + `@prisma/adapter-pg`: plain Postgres driver, so local docker db and
  Neon are interchangeable via `DATABASE_URL` only.
- Postgres `frontend` schema (Prisma multiSchema) — keeps auth tables isolated
  from the backend's Piccolo tables in `public`.
- better-auth 1.7 with prismaAdapter; plugins: admin, passkey (`@better-auth/passkey`),
  jwt (EdDSA, JWKS persisted in db), tanstackStartCookies (last).
- Backend data: FastAPI at `http://localhost:8000/api` fetched from the client
  with bearer JWT for authed endpoints (orders).

## Data model (frontend schema)
better-auth generated: user (+role/banned via admin), session, account,
verification, passkey, jwks. No app tables — catalog/orders live in the backend.

## Boundaries
- Frontend never writes catalog/order tables directly; all commerce goes
  through the backend REST API.
- Cart is client-side (localStorage) until checkout POSTs `/api/orders/`.

## Risks
- Backend JWT verification not implemented yet (auth feature source empty);
  frontend exposes standard JWKS so backend can verify with `jose`/`pyjwt`.
- Neon serverless driver (`@neondatabase/serverless`) removed from runtime path;
  Prisma+pg used everywhere for env interchangeability.
