import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { cart, cartTotal, useCart } from "#/features/cart/cart.store";
import { formatPrice } from "#/features/catalog/catalog.types";
import { useCreateOrderMutation } from "#/features/orders/orders.queries";

export const Route = createFileRoute("/_shop/app/cart/")({
	component: CartPage,
});

function CartPage() {
	const items = useCart();
	const { session } = Route.useRouteContext();
	const navigate = useNavigate();
	const createOrder = useCreateOrderMutation();

	const checkout = () => {
		if (!session) {
			navigate({ to: "/sign-in", search: { redirect: "/app/cart" } });
			return;
		}
		createOrder.mutate(
			{
				items: items.map((i) => ({
					product_id: i.productId,
					quantity: i.quantity,
				})),
			},
			{
				onSuccess: (order) => {
					cart.clear();
					navigate({
						to: "/app/orders/$orderId",
						params: { orderId: order.id },
					});
				},
			},
		);
	};

	if (items.length === 0) {
		return (
			<div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
				<ShoppingCart className="size-8" />
				<p>Your cart is empty.</p>
				<Button asChild variant="outline" size="sm">
					<Link to="/">Browse the catalog</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<h1 className="text-xl font-semibold">Cart</h1>
			<ul className="divide-y rounded-lg border">
				{items.map((i) => (
					<li key={i.productId} className="flex items-center gap-3 p-4">
						<div className="min-w-0 flex-1">
							<Link
								to="/app/products/$productId"
								params={{ productId: i.productId }}
								className="truncate text-sm font-medium hover:underline"
							>
								{i.name}
							</Link>
							<p className="text-xs text-muted-foreground">
								{formatPrice(i.price)} each
							</p>
						</div>
						<div className="flex items-center gap-1">
							<Button
								variant="outline"
								size="icon"
								className="size-7"
								aria-label="Decrease quantity"
								onClick={() => cart.setQuantity(i.productId, i.quantity - 1)}
							>
								<Minus className="size-3.5" />
							</Button>
							<span className="w-8 text-center text-sm tabular-nums">
								{i.quantity}
							</span>
							<Button
								variant="outline"
								size="icon"
								className="size-7"
								aria-label="Increase quantity"
								onClick={() => cart.setQuantity(i.productId, i.quantity + 1)}
							>
								<Plus className="size-3.5" />
							</Button>
						</div>
						<span className="w-20 text-right text-sm font-medium tabular-nums">
							{formatPrice(
								i.price ? Number.parseFloat(i.price) * i.quantity : null,
							)}
						</span>
						<Button
							variant="ghost"
							size="icon"
							className="size-7"
							aria-label="Remove item"
							onClick={() => cart.remove(i.productId)}
						>
							<Trash2 className="size-4" />
						</Button>
					</li>
				))}
			</ul>
			<div className="flex items-center justify-between">
				<span className="text-sm text-muted-foreground">Total</span>
				<span className="text-lg font-semibold tabular-nums">
					{formatPrice(cartTotal(items))}
				</span>
			</div>
			{createOrder.error ? (
				<p className="text-sm text-destructive">{createOrder.error.message}</p>
			) : null}
			<Button
				className="w-full"
				onClick={checkout}
				disabled={createOrder.isPending}
			>
				{createOrder.isPending
					? "Placing order..."
					: session
						? "Place order"
						: "Sign in to checkout"}
			</Button>
		</div>
	);
}
