import type { OrderStatus } from "#/features/orders/orders.types";
import { cn } from "#/lib/utils";

const styles: Record<OrderStatus, string> = {
	pending: "bg-amber-100 text-amber-800",
	paid: "bg-blue-100 text-blue-800",
	shipped: "bg-violet-100 text-violet-800",
	delivered: "bg-emerald-100 text-emerald-800",
	cancelled: "bg-red-100 text-red-800",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
	return (
		<span
			className={cn(
				"rounded-full px-2 py-0.5 text-xs font-medium capitalize",
				styles[status] ?? "bg-muted text-muted-foreground",
			)}
		>
			{status}
		</span>
	);
}
