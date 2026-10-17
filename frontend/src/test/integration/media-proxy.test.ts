import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import {
	GenericContainer,
	type StartedTestContainer,
	Wait,
} from "testcontainers";
import { serveMedia } from "#/integrations/media-proxy";

const image = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
	"base64",
);
let container: StartedTestContainer | undefined;
const previousOrigin = process.env.BACKEND_ORIGIN;

const nginxConfig = `
server {
  listen 80;
  absolute_redirect off;
  location = /health { return 200 "ready"; }
  location = /static/product.png { return 307 /signed/product.png?signature=test; }
  location = /signed/product.png {
    root /usr/share/nginx/html;
    add_header Set-Cookie "upstream=private";
    add_header X-Upstream-Secret "private";
  }
  location = /static/missing.png { return 404 "upstream detail"; }
  location = /static/unavailable.png { return 503 "upstream detail"; }
  location / { return 418 "unexpected upstream request"; }
}`;

function mediaRequest(key: string, signal?: AbortSignal) {
	return new Request(
		`http://localhost:3000/api/media?key=${encodeURIComponent(key)}`,
		{ signal },
	);
}

describe("media proxy with a containerized HTTP upstream", {
	concurrency: false,
}, () => {
	before(
		async () => {
			container = await new GenericContainer("nginx:alpine")
				.withExposedPorts(80)
				.withCopyContentToContainer([
					{ content: nginxConfig, target: "/etc/nginx/conf.d/default.conf" },
					{
						content: image,
						target: "/usr/share/nginx/html/signed/product.png",
					},
				])
				.withWaitStrategy(Wait.forHttp("/health", 80).forStatusCode(200))
				.withStartupTimeout(120_000)
				.start();
			process.env.BACKEND_ORIGIN = `http://${container.getHost()}:${container.getMappedPort(80)}`;
		},
		{ timeout: 180_000 },
	);

	after(async () => {
		try {
			await container?.stop();
		} finally {
			if (previousOrigin === undefined) delete process.env.BACKEND_ORIGIN;
			else process.env.BACKEND_ORIGIN = previousOrigin;
		}
	});

	test("follows the signed media redirect and streams the exact image with safe caching headers", async () => {
		const response = await serveMedia(mediaRequest("product.png"));
		assert.equal(response.status, 200);
		assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
		assert.equal(response.headers.get("content-type"), "image/png");
		assert.equal(response.headers.get("content-length"), String(image.length));
		assert.equal(
			response.headers.get("cache-control"),
			"public, max-age=31536000, immutable",
		);
		assert.equal(response.headers.get("set-cookie"), null);
		assert.equal(response.headers.get("x-upstream-secret"), null);
		assert.equal(response.headers.get("location"), null);
	});

	for (const [key, status] of [
		["missing.png", 404],
		["unavailable.png", 503],
	] as const) {
		test(`preserves upstream ${status} without caching or leaking its body`, async () => {
			const response = await serveMedia(mediaRequest(key));
			assert.equal(response.status, status);
			assert.equal(await response.text(), "Not found");
			assert.equal(response.headers.get("cache-control"), null);
		});
	}

	for (const key of [
		"",
		"../product.png",
		"folder/product.png",
		"a\\b.png",
		"https://example.test/image.png",
		"a".repeat(301),
	]) {
		test(`rejects invalid media key ${JSON.stringify(key.slice(0, 40))} before fetching`, async () => {
			// The upstream returns 418 for unexpected paths, so 404 proves validation.
			assert.equal((await serveMedia(mediaRequest(key))).status, 404);
		});
	}

	test("rejects requests without a media key", async () => {
		assert.equal(
			(await serveMedia(new Request("http://localhost:3000/api/media"))).status,
			404,
		);
	});

	test("honors request cancellation", async () => {
		const controller = new AbortController();
		controller.abort();
		await assert.rejects(
			serveMedia(mediaRequest("product.png", controller.signal)),
			{ name: "AbortError" },
		);
	});
});
