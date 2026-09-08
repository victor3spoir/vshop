import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext, useRouter } from "@tanstack/react-router";
import { LogOut, ShoppingCart, User } from "lucide-react";
import { Button } from "#/components/ui/button";
import { cartQueryOptions } from "#/features/cart/cart.queries";
import { cartCount } from "#/features/cart/cart.types";
import { dropCachedJwt } from "#/integrations/backend-api";
import { signOut } from "#/lib/auth-client";

export function Header() {
	// Session comes from the root route's beforeLoad via router context.
	const { session } = useRouteContext({ from: "__root__" });
	const router = useRouter();
	// Server-side cart; anonymous visitors have none.
	const { data: cart } = useQuery({
		...cartQueryOptions(),
		enabled: !!session,
	});
	const count = cart ? cartCount(cart) : 0;

	const handleSignOut = async () => {
		await signOut();
		dropCachedJwt();
		await router.invalidate();
	};

	return (
		<header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
			<div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
				<Link to="/" className="flex items-center gap-2 font-semibold">
					<img src="/brand/logo.svg" alt="vshop logo" className="size-6" />
					vshop
				</Link>
				<nav className="flex items-center gap-1 text-sm">
					<Link
						to="/"
						className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground [&.active]:text-foreground [&.active]:font-medium"
					>
						Catalog
					</Link>
					{session ? (
						<Link
							to="/app/orders"
							className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground [&.active]:text-foreground [&.active]:font-medium"
						>
							Orders
						</Link>
					) : null}
					{session?.user.role === "admin" ? (
						<Link
							to="/admin"
							className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground [&.active]:text-foreground [&.active]:font-medium"
						>
							Admin
						</Link>
					) : null}
				</nav>
				<div className="ml-auto flex items-center gap-2">
					<Button asChild variant="ghost" size="icon" aria-label="Cart">
						<Link to="/app/cart" className="relative">
							<ShoppingCart className="size-5" />
							{count > 0 ? (
								<span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
									{count > 9 ? "9+" : count}
								</span>
							) : null}
						</Link>
					</Button>
					{session ? (
						<>
							<Button asChild variant="ghost" size="icon" aria-label="Account">
								<Link to="/app/account">
									<User className="size-5" />
								</Link>
							</Button>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Sign out"
								onClick={handleSignOut}
							>
								<LogOut className="size-5" />
							</Button>
						</>
					) : (
						<Button asChild variant="outline" size="sm">
							<Link to="/sign-in">Sign in</Link>
						</Button>
					)}
				</div>
			</div>
		</header>
	);
}
