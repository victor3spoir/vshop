import { createFileRoute } from "@tanstack/react-router";
import { serveMedia } from "#/integrations/media-proxy";

export const Route = createFileRoute("/api/media")({
	server: { handlers: { GET: ({ request }) => serveMedia(request) } },
});
