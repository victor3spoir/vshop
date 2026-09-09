// Pagination envelope returned by fastapi-pagination on every list endpoint.
export type Page<T> = {
	items: T[];
	total: number;
	page: number;
	size: number;
	pages: number;
};

export type Category = {
	id: string;
	name: string;
	slug: string;
	created_at: string;
	updated_at: string;
};

export type Product = {
	id: string;
	name: string;
	description: string | null;
	stock: number;
	image: string | null;
	category: string | null;
	category_id: string | null;
	current_price: string | null;
	created_at: string;
	updated_at: string;
};

export function formatPrice(value: string | number | null | undefined) {
	if (value === null || value === undefined) return "—";
	const n = typeof value === "string" ? Number.parseFloat(value) : value;
	if (Number.isNaN(n)) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(n);
}
