// Single up-fetch client for the vshop FastAPI backend.
// Browser requests go through the /backend server-route proxy
// (src/routes/backend.$.ts) to stay same-origin; during SSR loaders hit the
// backend directly.
import { up } from "up-fetch";

const baseUrl =
	typeof window === "undefined"
		? (process.env.SERVER_API_URL ?? "http://localhost:8000/api")
		: (import.meta.env.VITE_API_URL ?? "/backend/api");

export const backendApi = up(fetch, () => ({ baseUrl }));

// Product images are proxied by the frontend server route /api/media?key=...
// (src/routes/api/media.ts), so the browser never calls the backend origin.
export function backendMediaUrl(path: string) {
	return `/api/media?key=${encodeURIComponent(path)}`;
}
