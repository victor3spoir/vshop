import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { auth } from "#/lib/auth";
import { prisma } from "#/lib/prisma";

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

export const getUserDetail = createServerFn({ method: "GET" })
	.validator(z.object({ userId: z.string().min(1) }))
	.handler(async ({ data }) => {
		const headers = getRequestHeaders();
		return auth.api.getUser({ headers, query: { id: data.userId } });
	});

export const listUserSessions = createServerFn({ method: "GET" })
	.validator(z.object({ userId: z.string().min(1) }))
	.handler(async ({ data }) => {
		const headers = getRequestHeaders();
		const result = await auth.api.listUserSessions({
			headers,
			body: { userId: data.userId },
		});
		return result.sessions;
	});

export const authStatsPeriodSchema = z.union([
	z.literal(7),
	z.literal(30),
	z.literal(90),
]);
export type AuthStatsPeriod = z.infer<typeof authStatsPeriodSchema>;

export type AuthStatsPoint = {
	date: string; // yyyy-mm-dd (UTC day bucket)
	signups: number;
	signins: number;
};

// Daily sign-up (user.createdAt) and sign-in (session.createdAt) counts.
// Reads Prisma directly, so gate on an admin session first.
export const getAuthStats = createServerFn({ method: "GET" })
	.validator(z.object({ period: authStatsPeriodSchema }))
	.handler(async ({ data }): Promise<AuthStatsPoint[]> => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });
		if (session?.user.role !== "admin") {
			throw new Error("Forbidden");
		}

		const since = new Date();
		since.setUTCHours(0, 0, 0, 0);
		since.setUTCDate(since.getUTCDate() - (data.period - 1));

		const [signups, signins] = await Promise.all([
			prisma.user.findMany({
				where: { createdAt: { gte: since } },
				select: { createdAt: true },
			}),
			prisma.session.findMany({
				where: { createdAt: { gte: since } },
				select: { createdAt: true },
			}),
		]);

		const dayKey = (d: Date) => d.toISOString().slice(0, 10);
		const buckets = new Map<string, AuthStatsPoint>();
		for (let i = 0; i < data.period; i++) {
			const day = new Date(since);
			day.setUTCDate(day.getUTCDate() + i);
			const key = dayKey(day);
			buckets.set(key, { date: key, signups: 0, signins: 0 });
		}
		for (const u of signups) {
			const point = buckets.get(dayKey(u.createdAt));
			if (point) point.signups += 1;
		}
		for (const s of signins) {
			const point = buckets.get(dayKey(s.createdAt));
			if (point) point.signins += 1;
		}
		return [...buckets.values()];
	});
