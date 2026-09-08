import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "#/lib/auth";

// Session or null - for anonymous-friendly reads and route guards.
export const getCurrentSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const headers = getRequestHeaders();
		return auth.api.getSession({ headers });
	},
);

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
	async () => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });
		return session?.user ?? null;
	},
);

// Passkeys are listed server-side so SSR carries the session cookies.
export const listPasskeys = createServerFn({ method: "GET" }).handler(
	async () => {
		const headers = getRequestHeaders();
		return auth.api.listPasskeys({ headers });
	},
);
