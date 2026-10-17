import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import type { Cart } from "#/features/cart/cart.types";
import { backendApi } from "#/integrations/backend-api";

export const cartQueryOptions = () =>
	queryOptions({
		queryKey: ["cart"],
		queryFn: ({ signal }) => backendApi<Cart>("/cart/", { signal }),
		staleTime: 10_000,
	});

export const cartItemSetSchema = z.object({
	product_id: z.uuid(),
	quantity: z.number().int().min(0),
});
export type CartItemSet = z.infer<typeof cartItemSetSchema>;

// PUT returns the fresh cart; write it straight into the cache.
export function useSetCartItemMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CartItemSet) =>
			backendApi<Cart>("/cart/items", {
				method: "PUT",
				body: cartItemSetSchema.parse(input),
			}),
		onSuccess: (cart) =>
			queryClient.setQueryData(cartQueryOptions().queryKey, cart),
	});
}

// Checkout consumes the server-side cart and returns the created order.
export function useCheckoutMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () =>
			backendApi<{ id: string }>("/orders/checkout", { method: "POST" }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["cart"] });
			queryClient.invalidateQueries({ queryKey: ["orders"] });
		},
	});
}
