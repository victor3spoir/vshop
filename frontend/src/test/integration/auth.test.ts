import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
	createPublicKey,
	type JsonWebKey,
	randomUUID,
	verify,
} from "node:crypto";
import { after, before, beforeEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

const origin = "http://localhost:3000";
const password = "integration-password-123";
let container: StartedPostgreSqlContainer | undefined;
let auth: typeof import("#/lib/auth").auth;
let prisma: typeof import("#/lib/prisma").prisma;
const previousEnv = Object.fromEntries(
	["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET", "NODE_ENV"].map(
		(key) => [key, process.env[key]],
	),
);

// Call the production auth HTTP handler, including middleware, cookies and
// Prisma adapter. No session, credential or database implementation is mocked.
function request(path: string, cookie = "", body?: Record<string, unknown>) {
	return auth.handler(
		new Request(`${origin}/api/auth${path}`, {
			method: body ? "POST" : "GET",
			headers: {
				origin,
				cookie,
				...(body ? { "content-type": "application/json" } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		}),
	);
}

function cookies(response: Response) {
	const values = response.headers.getSetCookie();
	assert.ok(values.length, "authentication must issue session cookies");
	return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function signup(role: "user" | "admin" = "user") {
	const email = `${randomUUID()}@example.test`;
	const response = await request("/sign-up/email", "", {
		name: "Integration User",
		email,
		password,
	});
	assert.equal(response.status, 200, await response.clone().text());
	const { user } = (await response.json()) as { user: { id: string } };
	let cookie = cookies(response);
	if (role === "admin") {
		// Trusted fixture bootstrap, after Better Auth creates real credentials.
		await prisma.user.update({ where: { id: user.id }, data: { role } });
		const signin = await request("/sign-in/email", "", { email, password });
		assert.equal(signin.status, 200, await signin.clone().text());
		cookie = cookies(signin);
	}
	return { id: user.id, email, cookie };
}

describe("frontend authentication with real Postgres", {
	concurrency: false,
}, () => {
	before(
		async () => {
			container = await new PostgreSqlContainer("postgres:18-alpine")
				.withDatabase("vshop_frontend_test")
				.withStartupTimeout(120_000)
				.start();
			// Always override inherited .env values before importing production modules.
			process.env.DATABASE_URL = container.getConnectionUri();
			process.env.BETTER_AUTH_URL = origin;
			process.env.BETTER_AUTH_SECRET =
				"test-only-secret-with-at-least-32-characters";
			process.env.NODE_ENV = "test";
			const frontend = fileURLToPath(new URL("../../../", import.meta.url));
			await promisify(execFile)(
				process.execPath,
				[`${frontend}/node_modules/prisma/build/index.js`, "migrate", "deploy"],
				{ cwd: frontend, env: process.env, timeout: 60_000 },
			);
			({ prisma } = await import("#/lib/prisma"));
			({ auth } = await import("#/lib/auth"));
		},
		{ timeout: 180_000 },
	);

	beforeEach(async () => {
		await prisma.$executeRawUnsafe(
			'TRUNCATE TABLE frontend."user", frontend.verification, frontend.jwks CASCADE',
		);
	});

	after(async () => {
		try {
			await prisma?.$disconnect();
		} finally {
			try {
				await container?.stop();
			} finally {
				for (const [key, value] of Object.entries(previousEnv)) {
					if (value === undefined) delete process.env[key];
					else process.env[key] = value;
				}
			}
		}
	});

	test("signup persists credentials and authenticates only the matching session", async () => {
		const user = await signup();
		const stored = await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
		});
		assert.equal(stored.email, user.email);
		assert.equal(stored.role, "user");
		const account = await prisma.account.findFirstOrThrow({
			where: { userId: user.id },
		});
		assert.equal(account.providerId, "credential");
		assert.ok(account.password);
		assert.notEqual(account.password, password);
		const session = await request("/get-session", user.cookie);
		assert.equal(session.status, 200);
		assert.equal((await session.json()).user.id, user.id);
		assert.equal(await (await request("/get-session")).json(), null);
	});

	test("signin rejects a wrong password and accepts the stored credentials", async () => {
		const user = await signup();
		const denied = await request("/sign-in/email", "", {
			email: user.email,
			password: "wrong-password",
		});
		assert.equal(denied.status, 401);
		assert.equal(await prisma.session.count({ where: { userId: user.id } }), 1);
		const allowed = await request("/sign-in/email", "", {
			email: user.email,
			password,
		});
		assert.equal(allowed.status, 200, await allowed.clone().text());
		const session = await request("/get-session", cookies(allowed));
		assert.equal((await session.json()).user.id, user.id);
	});

	test("signout revokes the persisted session and rejects its old cookie", async () => {
		const user = await signup();
		assert.equal((await request("/sign-out", user.cookie, {})).status, 200);
		assert.equal(await prisma.session.count({ where: { userId: user.id } }), 0);
		assert.equal(
			await (await request("/get-session", user.cookie)).json(),
			null,
		);
	});

	test("signup rejects a client-supplied admin role without creating credentials", async () => {
		const response = await request("/sign-up/email", "", {
			name: "Untrusted signup",
			email: "untrusted@example.test",
			password,
			role: "admin",
		});
		assert.equal(response.status, 400, await response.clone().text());
		assert.equal((await response.json()).code, "FIELD_NOT_ALLOWED");
		assert.equal(await prisma.user.count(), 0);
		assert.equal(await prisma.account.count(), 0);
		assert.equal(await prisma.session.count(), 0);
	});

	test("an expired persisted session cannot authenticate", async () => {
		const user = await signup();
		await prisma.session.updateMany({
			where: { userId: user.id },
			data: { expiresAt: new Date(Date.now() - 60_000) },
		});
		assert.equal(
			await (await request("/get-session", user.cookie)).json(),
			null,
		);
		assert.equal((await request("/token", user.cookie)).status, 401);
	});

	const adminRequests = [
		{ path: "/admin/list-users", body: undefined },
		{ path: "/admin/get-user", query: true, body: undefined },
		{ path: "/admin/list-user-sessions", body: {} },
		{ path: "/admin/set-role", body: { role: "admin" } },
		{ path: "/admin/ban-user", body: {} },
		{ path: "/admin/unban-user", body: {} },
		{ path: "/admin/update-user", body: { data: { name: "Changed" } } },
		{
			path: "/admin/set-user-password",
			body: { newPassword: "replacement-password-123" },
		},
		{ path: "/admin/revoke-user-sessions", body: {} },
		{ path: "/admin/revoke-user-session", body: {} },
		{ path: "/admin/remove-user", body: {} },
		{ path: "/admin/impersonate-user", body: {} },
	];
	for (const identity of ["anonymous", "customer"] as const) {
		for (const endpoint of adminRequests) {
			test(`rejects ${identity} access to ${endpoint.path}`, async () => {
				const target = await signup();
				const caller = identity === "customer" ? await signup() : undefined;
				const path = endpoint.query
					? `${endpoint.path}?id=${target.id}`
					: endpoint.path;
				let body: Record<string, unknown> | undefined = endpoint.body
					? { ...endpoint.body, userId: target.id }
					: undefined;
				if (endpoint.path === "/admin/revoke-user-session") {
					const session = await prisma.session.findFirstOrThrow({
						where: { userId: target.id },
					});
					body = { sessionToken: session.token };
				}
				const response = await request(path, caller?.cookie, body);
				assert.equal(
					response.status,
					identity === "anonymous" ? 401 : 403,
					await response.clone().text(),
				);
				const user = await prisma.user.findUniqueOrThrow({
					where: { id: target.id },
				});
				assert.equal(user.role, "user");
				assert.equal(user.banned, false);
				assert.equal(user.name, "Integration User");
				assert.equal(
					await prisma.session.count({ where: { userId: target.id } }),
					1,
				);
			});
		}
	}

	test("an admin can read users and ban a customer, revoking their session and signin", async () => {
		const admin = await signup("admin");
		const customer = await signup();
		const listed = await request("/admin/list-users", admin.cookie);
		assert.equal(listed.status, 200, await listed.clone().text());
		assert.equal((await listed.json()).total, 2);
		const banned = await request("/admin/ban-user", admin.cookie, {
			userId: customer.id,
		});
		assert.equal(banned.status, 200, await banned.clone().text());
		assert.equal(
			(await prisma.user.findUniqueOrThrow({ where: { id: customer.id } }))
				.banned,
			true,
		);
		assert.equal(
			await prisma.session.count({ where: { userId: customer.id } }),
			0,
		);
		assert.equal(
			await (await request("/get-session", customer.cookie)).json(),
			null,
		);
		const signin = await request("/sign-in/email", "", {
			email: customer.email,
			password,
		});
		assert.equal(signin.status, 403);
	});

	test("an admin can unban a customer and restore signin", async () => {
		const admin = await signup("admin");
		const customer = await signup();
		assert.equal(
			(await request("/admin/ban-user", admin.cookie, { userId: customer.id }))
				.status,
			200,
		);
		assert.equal(
			(
				await request("/admin/unban-user", admin.cookie, {
					userId: customer.id,
				})
			).status,
			200,
		);
		const signin = await request("/sign-in/email", "", {
			email: customer.email,
			password,
		});
		assert.equal(signin.status, 200, await signin.clone().text());
		assert.equal(
			(await (await request("/get-session", cookies(signin))).json()).user.id,
			customer.id,
		);
	});

	test("issues a JWT verifiable with the public JWKS and denies anonymous token requests", async () => {
		const user = await signup();
		assert.equal((await request("/token")).status, 401);
		const response = await request("/token", user.cookie);
		assert.equal(response.status, 200, await response.clone().text());
		const { token } = (await response.json()) as { token: string };
		const [header, payload, signature] = token.split(".");
		const metadata = JSON.parse(Buffer.from(header, "base64url").toString());
		const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
		const jwksResponse = await request("/jwks");
		assert.equal(jwksResponse.status, 200);
		const { keys } = (await jwksResponse.json()) as {
			keys: (JsonWebKey & { kid: string })[];
		};
		const jwk = keys.find((key) => key.kid === metadata.kid);
		assert.ok(jwk, "JWT must match a published signing key");
		assert.equal(metadata.alg, "EdDSA");
		assert.equal(
			verify(
				null,
				Buffer.from(`${header}.${payload}`),
				createPublicKey({ key: jwk, format: "jwk" }),
				Buffer.from(signature, "base64url"),
			),
			true,
		);
		assert.equal(claims.sub, user.id);
		assert.equal(claims.email, user.email);
		assert.ok(claims.exp > Date.now() / 1000);
		assert.equal(await prisma.jwks.count(), 1);
	});
});
