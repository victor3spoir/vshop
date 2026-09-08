import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import type { Order } from "#/features/orders/orders.types";
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
