import { Link } from "@tanstack/react-router";

export function ShopFooter() {
	return (
		<footer className="border-t bg-[oklch(0.18_0.035_260)] text-[oklch(0.76_0.025_255)]">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-7 sm:flex-row sm:items-center sm:justify-between">
				<Link
					to="/"
					className="flex items-center gap-2 text-sm font-bold text-white"
				>
					<img src="/brand/logo-v2.svg" alt="" className="size-6" />
					vshop
				</Link>
				<nav
					aria-label="Footer navigation"
					className="flex flex-wrap gap-x-6 gap-y-2 text-xs"
				>
					<Link to="/" search={{}} className="hover:text-white">
						Catalog
					</Link>
					<Link to="/app/orders" className="hover:text-white">
						Orders
					</Link>
					<Link to="/app/account" className="hover:text-white">
						Account
					</Link>
				</nav>
				<p className="text-xs">© 2026 vshop</p>
			</div>
		</footer>
	);
}
