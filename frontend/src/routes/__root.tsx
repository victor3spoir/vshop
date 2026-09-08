import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import type { auth } from "#/lib/auth";
import appCss from "../styles.css?url";

type Session = typeof auth.$Infer.Session;

export interface RouterAppContext {
	queryClient: QueryClient;
	auth: {
		getSession: () => Promise<Session | null>;
		getUser: () => Promise<Session["user"] | null>;
	};
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	// Session resolved once here; child routes and Header read it from context.
	beforeLoad: async ({ context }) => {
		const session = await context.auth.getSession();
		return { session };
	},
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "vshop",
			},
			{ name: "theme-color", content: "#2563eb" },
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{ rel: "icon", href: "/brand/favicon.ico", sizes: "48x48" },
			{ rel: "icon", href: "/brand/logo.svg", type: "image/svg+xml" },
			{ rel: "apple-touch-icon", href: "/brand/logo-192.png" },
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
