import { createFileRoute } from "@tanstack/react-router";

// Same-origin proxy to the FastAPI backend (API + static media).
// Browser calls /backend/...; this forwards them server-side so no CORS is
// needed and the backend origin stays configurable per environment.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:8000";

async function proxy({ request }: { request: Request }) {
	// Use the raw pathname (not params._splat) so trailing slashes survive;
	// FastAPI 307-redirects slash mismatches to its own origin otherwise.
	const url = new URL(request.url);
	const path = url.pathname.replace(/^\/backend/, "");
	const target = `${BACKEND_ORIGIN}${path}${url.search}`;
	const response = await fetch(target, {
		method: request.method,
		headers: request.headers,
		body:
			request.method === "GET" || request.method === "HEAD"
				? undefined
				: await request.arrayBuffer(),
		redirect: "manual",
	});
	return new Response(response.body, {
		status: response.status,
		headers: response.headers,
	});
}

export const Route = createFileRoute("/backend/$")({
	server: {
		handlers: {
			GET: proxy,
			POST: proxy,
			PUT: proxy,
			PATCH: proxy,
			DELETE: proxy,
		},
	},
});
