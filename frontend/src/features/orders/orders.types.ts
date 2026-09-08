import { z } from "zod";

export type OrderStatus =
	| "pending"
	| "paid"
	| "shipped"
	| "delivered"
	| "cancelled";

export type OrderItem = {
	id: string;
	product: string;
	quantity: number;
	price_at_purchase: string;
};

export type Order = {
	id: string;
	status: OrderStatus;
	total_amount: string;
	created_at: string;
	updated_at: string;
	items: OrderItem[];
};

export const orderCreateSchema = z.object({
	items: z
		.array(
			z.object({
				product_id: z.string().uuid(),
				quantity: z.number().int().positive(),
			}),
		)
		.min(1),
});

export type OrderCreate = z.infer<typeof orderCreateSchema>;
