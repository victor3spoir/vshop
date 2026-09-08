import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "#/lib/auth";

// Reads go through server functions so SSR carries the session cookies.
// better-auth's admin plugin still enforces the admin role on every call.
export const listUsers = createServerFn({ method: "GET" }).handler(async () => {
	const headers = getRequestHeaders();
	const result = await auth.api.listUsers({
		headers,
		query: { limit: 100, sortBy: "createdAt", sortDirection: "desc" },
	});
	return result.users;
});
