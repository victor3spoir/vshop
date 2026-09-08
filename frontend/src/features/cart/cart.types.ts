export type CartItem = {
	product_id: string;
	name: string;
	image: string | null;
	stock: number;
	quantity: number;
	unit_price: string | null;
};

export type Cart = {
	items: CartItem[];
	total: string;
};

export const emptyCart: Cart = { items: [], total: "0" };

export function cartCount(cart: Cart) {
	return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}
