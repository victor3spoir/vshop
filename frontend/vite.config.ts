import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";
import { serveMedia } from "./src/integrations/media-proxy.ts";

// Dev-only: Vite handles requests with Sec-Fetch-Dest: image itself and they
// never reach TanStack Start server routes, so <img src="/api/media?..."> 404s
// in dev. This middleware answers them first; production uses the server route.
function mediaProxyDevPlugin(): Plugin {
	return {
		name: "vshop:media-proxy-dev",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use("/api/media", (req, res) => {
				// Fully handled promise chain: an unhandled rejection here (e.g.
				// backend down) would crash the Vite dev worker and surface as
				// 'Vite environment "ssr" is unavailable' on every request.
				(async () => {
					const response = await serveMedia(
						new Request(`http://localhost${req.originalUrl ?? req.url ?? ""}`),
					);
					res.statusCode = response.status;
					response.headers.forEach((value, name) => {
						res.setHeader(name, value);
					});
					const body = await response.arrayBuffer();
					res.end(Buffer.from(body));
				})().catch(() => {
					if (!res.headersSent) {
						res.statusCode = 502;
						res.setHeader("content-type", "text/plain");
					}
					res.end("Media upstream unavailable");
				});
			});
		},
	};
}

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		mediaProxyDevPlugin(),
		devtools(),
		nitro({ rollupConfig: { external: [/^@sentry\//] } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
	],
});

export default config;
