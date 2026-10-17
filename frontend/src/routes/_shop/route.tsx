import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { Header } from "#/components/header";
import { ShopFooter } from "#/components/shop-footer";

// Shop shell: storefront chrome shared by catalog, cart, orders, account
// and the auth pages. The admin area has its own sidebar layout.
export const Route = createFileRoute("/_shop")({
	component: ShopLayout,
});

function ShopLayout() {
	const isHome = useLocation({
		select: (location) => location.pathname === "/",
	});

	return (
		<div className="flex min-h-screen flex-col">
			<Header />
			<main
				className={
					isHome
						? "flex-1"
						: "mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10"
				}
			>
				<Outlet />
			</main>
			<ShopFooter />
		</div>
	);
}
