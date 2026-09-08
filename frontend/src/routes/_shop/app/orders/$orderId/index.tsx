import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, Ban } from "lucide-react";
import { OrderStatusBadge } from "#/components/order-status";
import { Button } from "#/components/ui/button";
import { formatPrice } from "#/features/catalog/catalog.types";
import {
	getOrderQueryOptions,
	useCancelOrderMutation,
} from "#/features/orders/orders.queries";

export const Route = createFileRoute("/_shop/app/orders/$orderId/")({
	beforeLoad: ({ context, params }) => {
		if (!context.session) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: `/app/orders/${params.orderId}` },
			});
		}
	},
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(getOrderQueryOptions(params.orderId)),
	component: OrderDetailPage,
});

function OrderDetailPage() {
	const { orderId } = Route.useParams();
	const { data: order } = useSuspenseQuery(getOrderQueryOptions(orderId));
	const cancelOrder = useCancelOrderMutation(orderId);

	const cancellable = order.status === "pending" || order.status === "paid";

	return (
		<div className="mx-auto max-w-3xl space-y-6">
			<Button asChild variant="ghost" size="sm">
				<Link to="/app/orders">
					<ArrowLeft className="size-4" />
					Orders
				</Link>
			</Button>
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="text-xl font-semibold">Order</h1>
				<OrderStatusBadge status={order.status} />
				<span className="font-mono text-xs text-muted-foreground">
					{order.id}
				</span>
			</div>
			<p className="text-sm text-muted-foreground">
				Placed {new Date(order.created_at).toLocaleString()}
			</p>
			<ul className="divide-y rounded-lg border">
				{order.items.map((i) => (
					<li key={i.id} className="flex items-center gap-4 p-4 text-sm">
						<Link
							to="/app/products/$productId"
							params={{ productId: i.product }}
							className="min-w-0 flex-1 truncate font-mono text-xs hover:underline"
						>
							{i.product}
						</Link>
						<span className="tabular-nums">x{i.quantity}</span>
						<span className="w-24 text-right font-medium tabular-nums">
							{formatPrice(i.price_at_purchase)}
						</span>
					</li>
				))}
			</ul>
			<div className="flex items-center justify-between">
				<span className="text-sm text-muted-foreground">Total</span>
				<span className="text-lg font-semibold tabular-nums">
					{formatPrice(order.total_amount)}
				</span>
			</div>
			{cancelOrder.error ? (
				<p className="text-sm text-destructive">{cancelOrder.error.message}</p>
			) : null}
			{cancellable ? (
				<Button
					variant="destructive"
					onClick={() => cancelOrder.mutate()}
					disabled={cancelOrder.isPending}
				>
					<Ban className="size-4" />
					{cancelOrder.isPending ? "Cancelling..." : "Cancel order"}
				</Button>
			) : null}
		</div>
	);
}
