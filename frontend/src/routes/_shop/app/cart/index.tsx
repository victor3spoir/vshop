import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	cartQueryOptions,
	useCheckoutMutation,
	useSetCartItemMutation,
} from "#/features/cart/cart.queries";
import { formatPrice } from "#/features/catalog/catalog.types";
import { backendMediaUrl } from "#/integrations/backend-api";

// The cart lives server-side, scoped to the authenticated user.
export const Route = createFileRoute("/_shop/app/cart/")({
	beforeLoad: ({ context }) => {
		if (!context.session) {
			throw redirect({ to: "/sign-in", search: { redirect: "/app/cart" } });
		}
	},
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(cartQueryOptions()),
	component: CartPage,
});

function CartPage() {
	const { data: cart } = useSuspenseQuery(cartQueryOptions());
	const navigate = useNavigate();
	const setItem = useSetCartItemMutation();
	const checkoutMutation = useCheckoutMutation();

	const checkout = () => {
		checkoutMutation.mutate(undefined, {
			onSuccess: (order) =>
				navigate({ to: "/app/orders/$orderId", params: { orderId: order.id } }),
		});
	};

	if (cart.items.length === 0) {
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
				{cart.items.map((i) => (
					<li key={i.product_id} className="flex items-center gap-3 p-4">
						<div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
							{i.image ? (
								<img
									src={backendMediaUrl(i.image)}
									alt={i.name}
									className="size-full object-cover"
								/>
							) : (
								<ShoppingCart className="size-4 text-muted-foreground" />
							)}
						</div>
						<div className="min-w-0 flex-1">
							<Link
								to="/app/products/$productId"
								params={{ productId: i.product_id }}
								className="truncate text-sm font-medium hover:underline"
							>
								{i.name}
							</Link>
							<p className="text-xs text-muted-foreground">
								{formatPrice(i.unit_price)} each
							</p>
						</div>
						<div className="flex items-center gap-1">
							<Button
								variant="outline"
								size="icon"
								className="size-7"
								aria-label="Decrease quantity"
								disabled={setItem.isPending}
								onClick={() =>
									setItem.mutate({
										product_id: i.product_id,
										quantity: i.quantity - 1,
									})
								}
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
								disabled={setItem.isPending || i.quantity >= i.stock}
								onClick={() =>
									setItem.mutate({
										product_id: i.product_id,
										quantity: i.quantity + 1,
									})
								}
							>
								<Plus className="size-3.5" />
							</Button>
						</div>
						<span className="w-20 text-right text-sm font-medium tabular-nums">
							{formatPrice(
								i.unit_price
									? Number.parseFloat(i.unit_price) * i.quantity
									: null,
							)}
						</span>
						<Button
							variant="ghost"
							size="icon"
							className="size-7"
							aria-label="Remove item"
							disabled={setItem.isPending}
							onClick={() =>
								setItem.mutate({ product_id: i.product_id, quantity: 0 })
							}
						>
							<Trash2 className="size-4" />
						</Button>
					</li>
				))}
			</ul>
			<div className="flex items-center justify-between">
				<span className="text-sm text-muted-foreground">Total</span>
				<span className="text-lg font-semibold tabular-nums">
					{formatPrice(cart.total)}
				</span>
			</div>
			{setItem.error || checkoutMutation.error ? (
				<p className="text-sm text-destructive">
					{setItem.error?.message ?? checkoutMutation.error?.message}
				</p>
			) : null}
			<Button
				className="w-full"
				onClick={checkout}
				disabled={checkoutMutation.isPending}
			>
				{checkoutMutation.isPending ? "Placing order..." : "Place order"}
			</Button>
		</div>
	);
}
