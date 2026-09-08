import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	notFound,
	useNavigate,
} from "@tanstack/react-router";
import { ArrowLeft, Check, PackageOpen, ShoppingCart } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	cartQueryOptions,
	useSetCartItemMutation,
} from "#/features/cart/cart.queries";
import { getProductQueryOptions } from "#/features/catalog/catalog.queries";
import { formatPrice } from "#/features/catalog/catalog.types";
import { backendMediaUrl } from "#/integrations/backend-api";

export const Route = createFileRoute("/_shop/app/products/$productId/")({
	loader: async ({ context, params }) => {
		try {
			await context.queryClient.ensureQueryData(
				getProductQueryOptions(params.productId),
			);
		} catch (error) {
			if (error instanceof Error && "status" in error && error.status === 404) {
				throw notFound();
			}
			throw error;
		}
	},
	component: ProductDetailPage,
	notFoundComponent: ProductNotFoundPage,
});

function ProductNotFoundPage() {
	return (
		<div className="py-20 text-center text-muted-foreground">
			<p>This product does not exist.</p>
			<Button asChild variant="link">
				<Link to="/">Back to catalog</Link>
			</Button>
		</div>
	);
}

function ProductDetailPage() {
	const { productId } = Route.useParams();
	const { data: product } = useSuspenseQuery(getProductQueryOptions(productId));
	const { session } = Route.useRouteContext();
	const navigate = useNavigate();
	const setItem = useSetCartItemMutation();
	// Derived from the cart query cache - no local state needed. Anonymous
	// visitors have no cart, so the query is disabled and reads as empty.
	const { data: cart } = useQuery({
		...cartQueryOptions(),
		enabled: !!session,
	});
	const inCart =
		cart?.items.find((i) => i.product_id === product.id)?.quantity ?? 0;

	const addToCart = () => {
		if (!session) {
			navigate({
				to: "/sign-in",
				search: { redirect: `/app/products/${product.id}` },
			});
			return;
		}
		setItem.mutate({ product_id: product.id, quantity: inCart + 1 });
	};

	return (
		<div className="space-y-6">
			<Button asChild variant="ghost" size="sm">
				<Link to="/">
					<ArrowLeft className="size-4" />
					Catalog
				</Link>
			</Button>
			<div className="grid gap-8 md:grid-cols-2">
				<div className="flex aspect-square items-center justify-center rounded-lg bg-muted text-muted-foreground">
					{product.image ? (
						<img
							src={backendMediaUrl(product.image)}
							alt={product.name}
							className="size-full rounded-lg object-cover"
						/>
					) : (
						<PackageOpen className="size-12" />
					)}
				</div>
				<div className="space-y-4">
					{product.category ? (
						<p className="text-sm text-muted-foreground">{product.category}</p>
					) : null}
					<h1 className="text-2xl font-semibold">{product.name}</h1>
					<p className="text-2xl font-bold">
						{formatPrice(product.current_price)}
					</p>
					<p className="text-sm text-muted-foreground">
						{product.stock > 0
							? `${product.stock} in stock`
							: "Currently out of stock"}
					</p>
					{product.description ? (
						<p className="text-sm leading-relaxed">{product.description}</p>
					) : null}
					<Button
						onClick={addToCart}
						disabled={
							product.stock <= 0 ||
							!product.current_price ||
							setItem.isPending ||
							inCart >= product.stock
						}
						className="w-full md:w-auto"
					>
						{inCart > 0 ? (
							<Check className="size-4" />
						) : (
							<ShoppingCart className="size-4" />
						)}
						{inCart > 0 ? `In cart (${inCart})` : "Add to cart"}
					</Button>
					{setItem.error ? (
						<p className="text-sm text-destructive">{setItem.error.message}</p>
					) : null}
				</div>
			</div>
		</div>
	);
}
