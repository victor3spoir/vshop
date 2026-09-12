import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { z } from "zod";
import { OrderStatusBadge } from "#/components/order-status";
import { PaginationControls } from "#/components/pagination-controls";
import { formatPrice } from "#/features/catalog/catalog.types";
import { listOrdersQueryOptions } from "#/features/orders/orders.queries";

export const Route = createFileRoute("/_shop/app/orders/")({
	validateSearch: z.object({
		page: z.number().int().positive().optional().catch(undefined),
	}),
	beforeLoad: ({ context }) => {
		if (!context.session) {
			throw redirect({ to: "/sign-in", search: { redirect: "/app/orders" } });
		}
	},
	loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
	loader: ({ context, deps }) =>
		context.queryClient.ensureQueryData(listOrdersQueryOptions(deps.page)),
	component: OrdersPage,
});

function OrdersPage() {
	const { page = 1 } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { data: ordersPage } = useSuspenseQuery(listOrdersQueryOptions(page));
	const orders = ordersPage.items;

	const summarize = (o: (typeof orders)[number]) => {
		const names = o.items
			.map((i) => i.product_name)
			.filter((n): n is string => Boolean(n));
		if (names.length === 0) {
			const count = o.items.reduce((sum, i) => sum + i.quantity, 0);
			return count > 0 ? `${count} item${count > 1 ? "s" : ""}` : "Order";
		}
		const head = names.slice(0, 2).join(", ");
		const rest = names.length - 2;
		return rest > 0 ? `${head} +${rest} more` : head;
	};

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
								<p className="truncate text-sm font-medium">{summarize(o)}</p>
								<p className="text-xs text-muted-foreground">
									{new Date(o.created_at).toLocaleDateString(undefined, {
										month: "short",
										day: "numeric",
										year: "numeric",
									})}{" "}
									· Ref <span className="font-mono">{o.id.slice(0, 8)}</span>
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
			<PaginationControls
				page={page}
				pages={ordersPage.pages}
				onPageChange={(next) =>
					navigate({
						search: { page: next === 1 ? undefined : next },
					})
				}
			/>
		</div>
	);
}
