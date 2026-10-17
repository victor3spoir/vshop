import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { orderCreateSchema } from "#/features/orders/orders.types";

const productId = "550e8400-e29b-41d4-a716-446655440000";

describe("orderCreateSchema", () => {
	test("accepts an order with a product and a positive integer quantity", () => {
		const order = { items: [{ product_id: productId, quantity: 1 }] };

		assert.deepEqual(orderCreateSchema.parse(order), order);
	});

	test("rejects an empty order", () => {
		assert.equal(orderCreateSchema.safeParse({ items: [] }).success, false);
	});

	test("rejects an invalid product ID", () => {
		const order = { items: [{ product_id: "not-a-uuid", quantity: 1 }] };

		assert.equal(orderCreateSchema.safeParse(order).success, false);
	});

	for (const quantity of [0, -1, 1.5, "2", undefined]) {
		test(`rejects an invalid quantity (${typeof quantity}: ${String(quantity)})`, () => {
			const order = { items: [{ product_id: productId, quantity }] };

			assert.equal(orderCreateSchema.safeParse(order).success, false);
		});
	}
});
