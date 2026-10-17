import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import type { Page } from "#/features/catalog/catalog.types";
import type { Order } from "#/features/orders/orders.types";
import { backendApi } from "#/integrations/backend-api";

export const ORDERS_PAGE_SIZE = 10;

export const listOrdersQueryOptions = (page = 1) =>
	queryOptions({
		queryKey: ["orders", { page }],
		queryFn: ({ signal }) =>
			backendApi<Page<Order>>("/orders/", {
				params: { page, size: ORDERS_PAGE_SIZE },
				signal,
			}),
		staleTime: 10_000,
	});

// Admin dashboard: only the total matters, so ask for the smallest page.
export const pendingOrdersCountQueryOptions = () =>
	queryOptions({
		queryKey: ["orders", "pending-count"],
		queryFn: async ({ signal }) => {
			const page = await backendApi<Page<Order>>("/orders/", {
				params: { order_status: "pending", page: 1, size: 1 },
				signal,
			});
			return page.total;
		},
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
