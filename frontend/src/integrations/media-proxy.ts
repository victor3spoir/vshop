// Shared media proxy handler. The browser only ever talks to the frontend:
// the backend's /static/{key} endpoint 307-redirects to a signed S3 URL,
// which we follow server-side, streaming the image back with long caching
// (keys are content-unique, so responses are safe to cache as immutable).
//
// Used by two entry points:
// - src/routes/api/media.ts (TanStack Start server route - production)
// - the mediaProxyDevPlugin in vite.config.ts (dev only: Vite serves
//   Sec-Fetch-Dest:image requests itself and never reaches server routes)
import { z } from "zod";

// Media keys are slugified file names; reject anything that could traverse.
const keySchema = z
	.string()
	.min(1)
	.max(300)
	.regex(/^[\w.-]+$/, "invalid media key");

export async function serveMedia(request: Request): Promise<Response> {
	const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://localhost:8000";
	const url = new URL(request.url);
	const parsed = keySchema.safeParse(url.searchParams.get("key"));
	if (!parsed.success) return new Response("Not found", { status: 404 });

	const upstream = await fetch(`${backendOrigin}/static/${parsed.data}`, {
		redirect: "follow",
		signal: request.signal,
	});
	if (!upstream.ok) {
		return new Response("Not found", { status: upstream.status });
	}

	const headers = new Headers();
	const contentType = upstream.headers.get("content-type");
	if (contentType) headers.set("content-type", contentType);
	const contentLength = upstream.headers.get("content-length");
	if (contentLength) headers.set("content-length", contentLength);
	headers.set("cache-control", "public, max-age=31536000, immutable");

	return new Response(upstream.body, { status: 200, headers });
}
