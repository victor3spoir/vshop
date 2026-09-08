import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Header } from "#/components/header";

// Shop shell: storefront chrome shared by catalog, cart, orders, account
// and the auth pages. The admin area has its own sidebar layout.
export const Route = createFileRoute("/_shop")({
	component: ShopLayout,
});

function ShopLayout() {
	return (
		<>
			<Header />
			<main className="mx-auto w-full max-w-6xl px-4 py-6">
				<Outlet />
			</main>
		</>
	);
}
