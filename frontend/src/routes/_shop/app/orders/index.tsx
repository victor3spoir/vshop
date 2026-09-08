import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { OrderStatusBadge } from "#/components/order-status";
import { formatPrice } from "#/features/catalog/catalog.types";
import { listOrdersQueryOptions } from "#/features/orders/orders.queries";

export const Route = createFileRoute("/_shop/app/orders/")({
	beforeLoad: ({ context }) => {
		if (!context.session) {
			throw redirect({ to: "/sign-in", search: { redirect: "/app/orders" } });
		}
	},
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(listOrdersQueryOptions()),
	component: OrdersPage,
});

function OrdersPage() {
	const { data: orders } = useSuspenseQuery(listOrdersQueryOptions());

	if (orders.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
				<Package className="size-8" />
				<p>No orders yet.</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-3xl space-y-4">
			<h1 className="text-xl font-semibold">Orders</h1>
			<ul className="divide-y rounded-lg border">
				{orders.map((o) => (
					<li key={o.id}>
						<Link
							to="/app/orders/$orderId"
							params={{ orderId: o.id }}
							className="flex items-center gap-4 p-4 hover:bg-muted/50"
						>
							<div className="min-w-0 flex-1">
								<p className="truncate font-mono text-xs text-muted-foreground">
									{o.id}
								</p>
								<p className="text-sm">
									{new Date(o.created_at).toLocaleString()}
								</p>
							</div>
							<OrderStatusBadge status={o.status} />
							<span className="w-24 text-right text-sm font-medium tabular-nums">
								{formatPrice(o.total_amount)}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
