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
				serveMedia(
					new Request(`http://localhost${req.originalUrl ?? req.url ?? ""}`),
				).then(async (response) => {
					res.statusCode = response.status;
					response.headers.forEach((value, name) => {
						res.setHeader(name, value);
					});
					const body = await response.arrayBuffer();
					res.end(Buffer.from(body));
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
