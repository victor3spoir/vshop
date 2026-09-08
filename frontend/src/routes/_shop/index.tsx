import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageOpen } from "lucide-react";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import {
	listCategoriesQueryOptions,
	listProductsQueryOptions,
} from "#/features/catalog/catalog.queries";
import { formatPrice } from "#/features/catalog/catalog.types";
import { backendMediaUrl } from "#/integrations/backend-api";

const catalogSearchSchema = z.object({
	category: z.string().optional(),
});

export const Route = createFileRoute("/_shop/")({
	validateSearch: catalogSearchSchema,
	loaderDeps: ({ search }) => ({ category: search.category }),
	loader: ({ context, deps }) =>
		Promise.all([
			context.queryClient.ensureQueryData(listCategoriesQueryOptions()),
			context.queryClient.ensureQueryData(
				listProductsQueryOptions(deps.category),
			),
		]),
	component: CatalogPage,
});

function CatalogPage() {
	const { category } = Route.useSearch();
	const { data: categories } = useSuspenseQuery(listCategoriesQueryOptions());
	const { data: products } = useSuspenseQuery(
		listProductsQueryOptions(category),
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-2">
				<Button
					asChild
					variant={category === undefined ? "default" : "outline"}
					size="sm"
				>
					<Link to="/" search={{}}>
						All
					</Link>
				</Button>
				{categories.map((c) => (
					<Button
						key={c.id}
						asChild
						variant={category === c.id ? "default" : "outline"}
						size="sm"
					>
						<Link to="/" search={{ category: c.id }}>
							{c.name}
						</Link>
					</Button>
				))}
			</div>

			{products.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
					<PackageOpen className="size-8" />
					<p>No products in this category yet.</p>
				</div>
			) : (
				<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
					{products.map((p) => (
						<Link
							key={p.id}
							to="/app/products/$productId"
							params={{ productId: p.id }}
							className="group flex flex-col overflow-hidden rounded-lg border transition-colors hover:border-foreground/30"
						>
							<div className="flex aspect-square items-center justify-center bg-muted text-muted-foreground">
								{p.image ? (
									<img
										src={backendMediaUrl(p.image)}
										alt={p.name}
										className="size-full object-cover"
									/>
								) : (
									<PackageOpen className="size-8" />
								)}
							</div>
							<div className="flex flex-1 flex-col gap-1 p-3">
								<span className="line-clamp-2 text-sm font-medium group-hover:underline">
									{p.name}
								</span>
								<span className="mt-auto text-sm font-semibold">
									{formatPrice(p.current_price)}
								</span>
								<span className="text-xs text-muted-foreground">
									{p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
								</span>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
