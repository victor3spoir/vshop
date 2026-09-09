// Single up-fetch client for the vshop FastAPI backend.
// Browser requests go through the /backend server-route proxy
// (src/routes/backend.$.ts) to stay same-origin; during SSR loaders hit the
// backend directly.

import { createIsomorphicFn } from "@tanstack/react-start";
import { up } from "up-fetch";

const baseUrl =
	typeof window === "undefined"
		? (process.env.SERVER_API_URL ?? "http://localhost:8000/api")
		: (import.meta.env.VITE_API_URL ?? "/backend/api");

// --- better-auth JWT -------------------------------------------------------
// The backend verifies bearer tokens against the frontend's JWKS. On the
// client the token is cached until shortly before exp; on the server it is
// resolved per request from the session cookies (never cached - the process
// serves many users).
let clientToken: { value: string; exp: number } | null = null;

function jwtExp(token: string): number {
	try {
		const claims = JSON.parse(atob(token.split(".")[1] ?? ""));
		return typeof claims.exp === "number" ? claims.exp * 1000 : 0;
	} catch {
		return 0;
	}
}

const getJwt = createIsomorphicFn()
	.server(async (): Promise<string | null> => {
		const [{ auth }, { getRequestHeaders }] = await Promise.all([
			import("#/lib/auth"),
			import("@tanstack/react-start/server"),
		]);
		const result = await auth.api
			.getToken({ headers: getRequestHeaders() })
			.catch(() => null);
		return result?.token ?? null;
	})
	.client(async (): Promise<string | null> => {
		if (clientToken && Date.now() < clientToken.exp - 30_000) {
			return clientToken.value;
		}
		const response = await fetch("/api/auth/token");
		if (!response.ok) return null;
		const { token } = (await response.json()) as { token?: string };
		if (!token) return null;
		clientToken = { value: token, exp: jwtExp(token) };
		return token;
	});

export function dropCachedJwt() {
	clientToken = null;
}

const authFetch: typeof fetch = async (input, init) => {
	const token = await getJwt();
	const headers = new Headers(init?.headers);
	if (token && !headers.has("authorization")) {
		headers.set("authorization", `Bearer ${token}`);
	}
	return fetch(input, { ...init, headers });
};

export const backendApi = up(authFetch, () => ({ baseUrl }));

// Product images are proxied by the frontend server route /api/media?key=...
// (src/routes/api/media.ts), so the browser never calls the backend origin.
export function backendMediaUrl(path: string) {
	return `/api/media?key=${encodeURIComponent(path)}`;
}
