import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	type Cart,
	type CartItem,
	cartCount,
	emptyCart,
} from "#/features/cart/cart.types";

const item: CartItem = {
	product_id: "550e8400-e29b-41d4-a716-446655440000",
	name: "Notebook",
	image: null,
	stock: 10,
	quantity: 1,
	unit_price: "5.00",
};

describe("cartCount", () => {
	test("returns zero for an empty cart", () => {
		assert.equal(cartCount(emptyCart), 0);
	});

	test("counts the quantity of a single product", () => {
		const cart: Cart = {
			items: [{ ...item, quantity: 3 }],
			total: "15.00",
		};

		assert.equal(cartCount(cart), 3);
	});

	test("sums quantities instead of counting distinct products", () => {
		const cart: Cart = {
			items: [
				{ ...item, quantity: 2 },
				{
					...item,
					product_id: "550e8400-e29b-41d4-a716-446655440001",
					quantity: 3,
				},
			],
			total: "25.00",
		};

		assert.equal(cartCount(cart), 5);
	});
});
