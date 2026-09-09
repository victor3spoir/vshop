import { queryOptions } from "@tanstack/react-query";
import type { Category, Page, Product } from "#/features/catalog/catalog.types";
import { backendApi } from "#/integrations/backend-api";

export const listCategoriesQueryOptions = () =>
	queryOptions({
		queryKey: ["categories"],
		queryFn: async ({ signal }) => {
			const page = await backendApi<Page<Category>>("/categories/", {
				params: { size: 100 },
				signal,
			});
			return page.items;
		},
		staleTime: 60_000,
	});

export const PRODUCTS_PAGE_SIZE = 12;

export const listProductsQueryOptions = (categoryId?: string, page = 1) =>
	queryOptions({
		queryKey: ["products", { categoryId: categoryId ?? null, page }],
		queryFn: ({ signal }) =>
			backendApi<Page<Product>>("/products/", {
				params: {
					page,
					size: PRODUCTS_PAGE_SIZE,
					...(categoryId ? { category_id: categoryId } : {}),
				},
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
