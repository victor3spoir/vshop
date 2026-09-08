// Client-side cart persisted in localStorage, exposed through
// useSyncExternalStore. Genuinely local UI state - not server data.
import { useSyncExternalStore } from "react";

export type CartItem = {
	productId: string;
	name: string;
	price: string | null;
	quantity: number;
};

const STORAGE_KEY = "vshop.cart";
const listeners = new Set<() => void>();

let items: CartItem[] = load();

function load(): CartItem[] {
	if (typeof window === "undefined") return [];
	try {
		return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
	} catch {
		return [];
	}
}

function commit(next: CartItem[]) {
	items = next;
	if (typeof window !== "undefined") {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	}
	for (const l of listeners) l();
}

export const cart = {
	add(item: Omit<CartItem, "quantity">, quantity = 1) {
		const existing = items.find((i) => i.productId === item.productId);
		if (existing) {
			commit(
				items.map((i) =>
					i.productId === item.productId
						? { ...i, quantity: i.quantity + quantity }
						: i,
				),
			);
		} else {
			commit([...items, { ...item, quantity }]);
		}
	},
	setQuantity(productId: string, quantity: number) {
		if (quantity <= 0) {
			cart.remove(productId);
			return;
		}
		commit(
			items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
		);
	},
	remove(productId: string) {
		commit(items.filter((i) => i.productId !== productId));
	},
	clear() {
		commit([]);
	},
};

const emptyCart: CartItem[] = [];

export function useCart(): CartItem[] {
	return useSyncExternalStore(
		(cb) => {
			listeners.add(cb);
			return () => listeners.delete(cb);
		},
		() => items,
		() => emptyCart,
	);
}

export function cartTotal(list: CartItem[]) {
	return list.reduce(
		(sum, i) => sum + (i.price ? Number.parseFloat(i.price) : 0) * i.quantity,
		0,
	);
}

export function cartCount(list: CartItem[]) {
	return list.reduce((sum, i) => sum + i.quantity, 0);
}
