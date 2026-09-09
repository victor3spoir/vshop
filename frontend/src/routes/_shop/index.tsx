import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowRight,
	PackageOpen,
	Plus,
	RotateCcw,
	ShieldCheck,
	Truck,
} from "lucide-react";
import { z } from "zod";
import { PaginationControls } from "#/components/pagination-controls";
import { Button } from "#/components/ui/button";
import {
	cartQueryOptions,
	useSetCartItemMutation,
} from "#/features/cart/cart.queries";
import {
	listCategoriesQueryOptions,
	listProductsQueryOptions,
} from "#/features/catalog/catalog.queries";
import { formatPrice, type Product } from "#/features/catalog/catalog.types";
import { backendMediaUrl } from "#/integrations/backend-api";

const catalogSearchSchema = z.object({
	category: z.string().optional(),
	page: z.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/_shop/")({
	validateSearch: catalogSearchSchema,
	loaderDeps: ({ search }) => ({
		category: search.category,
		page: search.page ?? 1,
	}),
	loader: ({ context, deps }) =>
		Promise.all([
			context.queryClient.ensureQueryData(listCategoriesQueryOptions()),
			context.queryClient.ensureQueryData(listProductsQueryOptions()),
			context.queryClient.ensureQueryData(
				listProductsQueryOptions(deps.category, deps.page),
			),
		]),
	head: () => ({
		meta: [
			{ title: "vshop | Everything you need, in one cart" },
			{
				name: "description",
				content:
					"Browse a curated catalog with clear prices, live stock, and secure checkout.",
			},
		],
	}),
	component: CatalogPage,
});

function CatalogPage() {
	const { category, page = 1 } = Route.useSearch();
	const { session } = Route.useRouteContext();
	const navigate = useNavigate();
	const { data: categories } = useSuspenseQuery(listCategoriesQueryOptions());
	const { data: firstPage } = useSuspenseQuery(listProductsQueryOptions());
	const { data: productsPage } = useSuspenseQuery(
		listProductsQueryOptions(category, page),
	);
	// Category tiles pick a representative image from the first catalog page.
	const allProducts = firstPage.items;
	const products = productsPage.items;
	const { data: cart } = useQuery({
		...cartQueryOptions(),
		enabled: !!session,
	});
	const setItem = useSetCartItemMutation();
	const activeCategory = categories.find((item) => item.id === category);

	const addToCart = (product: Product) => {
		if (!session) {
			navigate({
				to: "/sign-in",
				search: { redirect: `/app/products/${product.id}` },
			});
			return;
		}
		const currentQuantity =
			cart?.items.find((item) => item.product_id === product.id)?.quantity ?? 0;
		setItem.mutate({
			product_id: product.id,
			quantity: Math.min(currentQuantity + 1, product.stock),
		});
	};

	return (
		<div className="bg-background">
			<section className="storefront-hero relative isolate overflow-hidden text-white">
				<div className="mx-auto flex min-h-[31rem] w-full max-w-6xl items-center px-4 py-16 sm:min-h-[35rem] sm:py-20">
					<div className="relative z-10 max-w-xl space-y-6">
						<p className="w-fit rounded-full border border-white/30 bg-black/20 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
							Free shipping on orders over $50
						</p>
						<div className="space-y-4">
							<h1 className="text-5xl font-extrabold leading-none sm:text-7xl">
								vshop
							</h1>
							<p className="max-w-[58ch] text-base leading-7 text-white/85 sm:text-lg">
								Everything you need, in one cart. Browse a curated catalog with
								clear pricing, live stock, and fast order processing.
							</p>
						</div>
						<div className="flex flex-wrap gap-3">
							<Button asChild size="lg">
								<a href="#catalog">
									Shop the catalog
									<ArrowRight className="size-4" />
								</a>
							</Button>
							<Button
								asChild
								size="lg"
								variant="outline"
								className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
							>
								<a href="#categories">Browse categories</a>
							</Button>
						</div>
					</div>
				</div>
			</section>

			<section aria-label="Shopping benefits" className="border-b bg-muted/50">
				<div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-5 gap-y-4 px-4 py-5 text-xs text-muted-foreground md:grid-cols-4">
					<Benefit icon={RotateCcw} title="30-day" detail="free returns" />
					<Benefit icon={Truck} title="Same-day" detail="dispatch before 2pm" />
					<Benefit
						icon={ShieldCheck}
						title="Secure"
						detail="protected checkout"
					/>
					<Benefit
						icon={PackageOpen}
						title="Live stock"
						detail="clear availability"
					/>
				</div>
			</section>

			<section id="categories" className="scroll-mt-20 py-14 sm:py-16">
				<div className="mx-auto w-full max-w-6xl space-y-6 px-4">
					<div className="flex items-end justify-between gap-4">
						<h2 className="text-2xl font-bold sm:text-3xl">Shop by category</h2>
						{category ? (
							<Link
								to="/"
								search={{}}
								className="text-sm font-semibold text-primary hover:underline"
							>
								View all categories
							</Link>
						) : null}
					</div>
					<div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
						{categories.slice(0, 4).map((item) => {
							const representative = allProducts.find(
								(product) => product.category_id === item.id && product.image,
							);
							return (
								<Link
									key={item.id}
									to="/"
									search={{ category: item.id }}
									className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-muted ring-1 ring-border"
								>
									{representative?.image ? (
										<img
											src={backendMediaUrl(representative.image)}
											alt=""
											className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
										/>
									) : (
										<div className="grid size-full place-items-center bg-muted text-muted-foreground">
											<PackageOpen className="size-9" />
										</div>
									)}
									<div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
									<span className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2.5 py-1.5 text-sm font-semibold text-white">
										{item.name}
									</span>
								</Link>
							);
						})}
					</div>
				</div>
			</section>

			<section id="catalog" className="scroll-mt-20 pb-20">
				<div className="mx-auto w-full max-w-6xl space-y-6 px-4">
					<div className="flex items-end justify-between gap-4">
						<div>
							<h2 className="text-2xl font-bold sm:text-3xl">
								{activeCategory ? activeCategory.name : "Featured products"}
							</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								{productsPage.total}{" "}
								{productsPage.total === 1 ? "product" : "products"}
							</p>
						</div>
						{activeCategory ? (
							<Button asChild variant="ghost" size="sm">
								<Link to="/" search={{}}>
									Clear filter
								</Link>
							</Button>
						) : null}
					</div>

					{products.length === 0 ? (
						<div className="flex flex-col items-center gap-3 border-y py-20 text-muted-foreground">
							<PackageOpen className="size-9" />
							<p>No products in this category yet.</p>
							<Button asChild variant="outline">
								<Link to="/" search={{}}>
									Browse every product
								</Link>
							</Button>
						</div>
					) : (
						<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
							{products.map((product) => {
								const inCart =
									cart?.items.find((item) => item.product_id === product.id)
										?.quantity ?? 0;
								const unavailable =
									product.stock <= 0 ||
									!product.current_price ||
									inCart >= product.stock;
								return (
									<article
										key={product.id}
										className="group overflow-hidden rounded-lg border bg-card"
									>
										<Link
											to="/app/products/$productId"
											params={{ productId: product.id }}
											className="block aspect-square overflow-hidden bg-muted"
										>
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
										</Link>
										<div className="flex min-h-36 flex-col gap-1 p-3 sm:p-4">
											<p className="text-xs text-muted-foreground">
												{product.category ?? "Catalog"}
											</p>
											<Link
												to="/app/products/$productId"
												params={{ productId: product.id }}
												className="line-clamp-2 text-sm font-semibold leading-5 hover:underline"
											>
												{product.name}
											</Link>
											<div className="mt-auto flex items-end justify-between gap-2 pt-3">
												<div>
													<p className="font-bold">
														{formatPrice(product.current_price)}
													</p>
													<p className="text-xs text-muted-foreground">
														{product.stock > 0
															? `${product.stock} in stock`
															: "Out of stock"}
													</p>
												</div>
												<Button
													size="icon-sm"
													disabled={unavailable || setItem.isPending}
													onClick={() => addToCart(product)}
													aria-label={`Add ${product.name} to cart`}
												>
													<Plus className="size-4" />
												</Button>
											</div>
										</div>
									</article>
								);
							})}
						</div>
					)}
					{setItem.error ? (
						<p role="alert" className="text-sm text-destructive">
							{setItem.error.message}
						</p>
					) : null}
					<PaginationControls
						page={page}
						pages={productsPage.pages}
						onPageChange={(next) =>
							navigate({
								to: "/",
								search: (prev) => ({
									...prev,
									page: next === 1 ? undefined : next,
								}),
								hash: "catalog",
							})
						}
					/>
				</div>
			</section>
		</div>
	);
}

function Benefit({
	icon: Icon,
	title,
	detail,
}: {
	icon: typeof RotateCcw;
	title: string;
	detail: string;
}) {
	return (
		<div className="flex items-center justify-center gap-2">
			<Icon className="size-4 shrink-0 text-primary" />
			<p>
				<strong className="font-semibold text-foreground">{title}</strong>{" "}
				{detail}
			</p>
		</div>
	);
}
