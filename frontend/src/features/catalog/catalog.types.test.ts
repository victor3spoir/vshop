import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatPrice } from "#/features/catalog/catalog.types";

describe("formatPrice", () => {
	test("formats numbers as USD with thousands separators", () => {
		assert.equal(formatPrice(1234.5), "$1,234.50");
	});

	test("formats decimal strings returned by the API", () => {
		assert.equal(formatPrice("19.90"), "$19.90");
	});

	test("rounds prices to two decimal places", () => {
		assert.equal(formatPrice(12.345), "$12.35");
	});

	for (const value of [0, "0"]) {
		test(`formats ${typeof value} zero as a price`, () => {
			assert.equal(formatPrice(value), "$0.00");
		});
	}

	for (const value of [null, undefined, Number.NaN, "", "not-a-price"]) {
		test(`shows a placeholder for a missing or invalid price (${String(value)})`, () => {
			assert.equal(formatPrice(value), "—");
		});
	}
});
