import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	notFound,
	useNavigate,
} from "@tanstack/react-router";
import {
	ArrowLeft,
	Check,
	Minus,
	PackageOpen,
	Plus,
	RotateCcw,
	ShieldCheck,
	ShoppingCart,
	Truck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	cartQueryOptions,
	useSetCartItemMutation,
} from "#/features/cart/cart.queries";
import {
	getProductQueryOptions,
	listProductsQueryOptions,
} from "#/features/catalog/catalog.queries";
import { formatPrice, type Product } from "#/features/catalog/catalog.types";
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
	const [quantity, setQuantity] = useState(1);
	// Derived from the cart query cache - no local state needed. Anonymous
	// visitors have no cart, so the query is disabled and reads as empty.
	const { data: cart } = useQuery({
		...cartQueryOptions(),
		enabled: !!session,
	});
	const inCart =
		cart?.items.find((i) => i.product_id === product.id)?.quantity ?? 0;
	// Similar products from the same category, excluding the current one.
	const { data: relatedPage } = useQuery({
		...listProductsQueryOptions(product.category_id ?? undefined),
		enabled: !!product.category_id,
	});
	const related = (relatedPage?.items ?? [])
		.filter((p) => p.id !== product.id)
		.slice(0, 4);

	const remaining = Math.max(product.stock - inCart, 0);
	const clampedQuantity = Math.min(quantity, Math.max(remaining, 1));

	const addToCart = () => {
		if (!session) {
			navigate({
				to: "/sign-in",
				search: { redirect: `/app/products/${product.id}` },
			});
			return;
		}
		setItem.mutate(
			{
				product_id: product.id,
				quantity: Math.min(inCart + clampedQuantity, product.stock),
			},
			{ onSuccess: () => setQuantity(1) },
		);
	};

	return (
		<div className="space-y-12">
			<Button asChild variant="ghost" size="sm">
				<Link to="/">
					<ArrowLeft className="size-4" />
					Catalog
				</Link>
			</Button>
			<div className="grid gap-8 md:grid-cols-2 lg:gap-12">
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
				<div className="flex flex-col gap-5">
					<div className="space-y-2">
						{product.category && product.category_id ? (
							<Link
								to="/"
								search={{ category: product.category_id }}
								className="text-sm font-medium text-primary hover:underline"
							>
								{product.category}
							</Link>
						) : null}
						<h1 className="text-2xl font-semibold sm:text-3xl">
							{product.name}
						</h1>
					</div>
					<div className="flex items-baseline gap-3">
						<p className="text-3xl font-bold">
							{formatPrice(product.current_price)}
						</p>
						<p
							className={
								product.stock > 0
									? "text-sm font-medium text-emerald-600"
									: "text-sm font-medium text-destructive"
							}
						>
							{product.stock > 0
								? `${product.stock} in stock`
								: "Currently out of stock"}
						</p>
					</div>
					{product.description ? (
						<p className="text-sm leading-relaxed text-muted-foreground">
							{product.description}
						</p>
					) : null}
					<div className="flex flex-wrap items-center gap-3 pt-1">
						<div className="flex items-center rounded-md border">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Decrease quantity"
								disabled={clampedQuantity <= 1}
								onClick={() => setQuantity(Math.max(clampedQuantity - 1, 1))}
							>
								<Minus className="size-4" />
							</Button>
							<span
								aria-live="polite"
								className="w-10 text-center text-sm font-semibold tabular-nums"
							>
								{clampedQuantity}
							</span>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Increase quantity"
								disabled={clampedQuantity >= remaining}
								onClick={() =>
									setQuantity(Math.min(clampedQuantity + 1, remaining))
								}
							>
								<Plus className="size-4" />
							</Button>
						</div>
						<Button
							onClick={addToCart}
							size="lg"
							disabled={
								product.stock <= 0 ||
								!product.current_price ||
								setItem.isPending ||
								inCart >= product.stock
							}
							className="flex-1 sm:flex-none sm:min-w-48"
						>
							{inCart > 0 ? (
								<Check className="size-4" />
							) : (
								<ShoppingCart className="size-4" />
							)}
							{inCart >= product.stock && product.stock > 0
								? `In cart (${inCart})`
								: inCart > 0
									? `Add more · ${inCart} in cart`
									: "Add to cart"}
						</Button>
					</div>
					{setItem.error ? (
						<p role="alert" className="text-sm text-destructive">
							{setItem.error.message}
						</p>
					) : null}
					<dl className="mt-2 space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
						<ReassuranceRow
							icon={Truck}
							title="Same-day dispatch"
							detail="Orders placed before 2pm ship the same day."
						/>
						<ReassuranceRow
							icon={RotateCcw}
							title="30-day free returns"
							detail="Changed your mind? Send it back, no questions asked."
						/>
						<ReassuranceRow
							icon={ShieldCheck}
							title="Secure checkout"
							detail="Your payment details are always protected."
						/>
					</dl>
				</div>
			</div>
			{related.length > 0 ? (
				<section aria-label="Similar products" className="space-y-4">
					<div className="flex items-end justify-between gap-4">
						<h2 className="text-xl font-bold sm:text-2xl">
							More in {product.category}
						</h2>
						{product.category_id ? (
							<Link
								to="/"
								search={{ category: product.category_id }}
								className="text-sm font-semibold text-primary hover:underline"
							>
								View all
							</Link>
						) : null}
					</div>
					<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
						{related.map((item) => (
							<RelatedProductCard key={item.id} product={item} />
						))}
					</div>
				</section>
			) : null}
		</div>
	);
}

function ReassuranceRow({
	icon: Icon,
	title,
	detail,
}: {
	icon: typeof Truck;
	title: string;
	detail: string;
}) {
	return (
		<div className="flex gap-3">
			<Icon className="mt-0.5 size-4 shrink-0 text-primary" />
			<div>
				<dt className="font-semibold text-foreground">{title}</dt>
				<dd className="text-muted-foreground">{detail}</dd>
			</div>
		</div>
	);
}

function RelatedProductCard({ product }: { product: Product }) {
	return (
		<Link
			to="/app/products/$productId"
			params={{ productId: product.id }}
			className="group overflow-hidden rounded-lg border bg-card"
		>
			<div className="aspect-square overflow-hidden bg-muted">
				{product.image ? (
					<img
						src={backendMediaUrl(product.image)}
						alt={product.name}
						loading="lazy"
						className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
					/>
				) : (
					<div className="grid size-full place-items-center text-muted-foreground">
						<PackageOpen className="size-9" />
					</div>
				)}
			</div>
			<div className="space-y-1 p-3">
				<p className="line-clamp-2 text-sm font-semibold leading-5 group-hover:underline">
					{product.name}
				</p>
				<p className="text-sm font-bold">
					{formatPrice(product.current_price)}
				</p>
			</div>
		</Link>
	);
}
