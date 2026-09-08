import { queryOptions } from "@tanstack/react-query";
import type { Category, Product } from "#/features/catalog/catalog.types";
import { backendApi } from "#/integrations/backend-api";

export const listCategoriesQueryOptions = () =>
	queryOptions({
		queryKey: ["categories"],
		queryFn: ({ signal }) => backendApi<Category[]>("/categories/", { signal }),
		staleTime: 60_000,
	});

export const listProductsQueryOptions = (categoryId?: string) =>
	queryOptions({
		queryKey: ["products", { categoryId: categoryId ?? null }],
		queryFn: ({ signal }) =>
			backendApi<Product[]>("/products/", {
				params: categoryId ? { category_id: categoryId } : {},
				signal,
			}),
		staleTime: 30_000,
	});

export const getProductQueryOptions = (productId: string) =>
	queryOptions({
		queryKey: ["products", productId],
		queryFn: ({ signal }) =>
			backendApi<Product>(`/products/${productId}`, { signal }),
		staleTime: 30_000,
	});
