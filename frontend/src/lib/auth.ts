import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins/admin";
import { jwt } from "better-auth/plugins/jwt";
import { prisma } from "#/lib/prisma";

export const auth = betterAuth({
	appName: "vshop",
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	emailAndPassword: {
		enabled: true,
	},
	trustedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
	plugins: [admin(), passkey(), jwt()],
});
