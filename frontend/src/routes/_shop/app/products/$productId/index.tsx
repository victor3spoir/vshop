import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, PackageOpen, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { cart } from "#/features/cart/cart.store";
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
	// Ephemeral UI feedback only - allowed useState.
	const [added, setAdded] = useState(false);

	const addToCart = () => {
		cart.add({
			productId: product.id,
			name: product.name,
			price: product.current_price,
		});
		setAdded(true);
		setTimeout(() => setAdded(false), 1500);
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
						disabled={product.stock <= 0 || !product.current_price}
						className="w-full md:w-auto"
					>
						{added ? (
							<Check className="size-4" />
						) : (
							<ShoppingCart className="size-4" />
						)}
						{added ? "Added" : "Add to cart"}
					</Button>
				</div>
			</div>
		</div>
	);
}
