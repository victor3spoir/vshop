import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	type Order,
	type OrderCreate,
	orderCreateSchema,
} from "#/features/orders/orders.types";
import { backendApi } from "#/integrations/backend-api";

export const listOrdersQueryOptions = () =>
	queryOptions({
		queryKey: ["orders"],
		queryFn: ({ signal }) => backendApi<Order[]>("/orders/", { signal }),
		staleTime: 10_000,
	});

export const getOrderQueryOptions = (orderId: string) =>
	queryOptions({
		queryKey: ["orders", orderId],
		queryFn: ({ signal }) =>
			backendApi<Order>(`/orders/${orderId}`, { signal }),
		staleTime: 10_000,
	});

export function useCreateOrderMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: OrderCreate) =>
			backendApi<Order>("/orders/", {
				method: "POST",
				body: orderCreateSchema.parse(input),
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
	});
}

export function useCancelOrderMutation(orderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () =>
			backendApi<Order>(`/orders/${orderId}/cancel`, { method: "POST" }),
		onSuccess: (order) => {
			queryClient.setQueryData(getOrderQueryOptions(orderId).queryKey, order);
			queryClient.invalidateQueries({ queryKey: ["orders"] });
		},
	});
}
