import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "#/components/ui/sidebar";
import { AdminSidebar } from "#/features/admin/components/admin-sidebar";

// Admin shell: guard once, sidebar + content frame for every /admin page.
// better-auth's admin plugin still enforces authorization on each API call.
export const Route = createFileRoute("/admin")({
	beforeLoad: ({ context, location }) => {
		if (!context.session) {
			throw redirect({ to: "/sign-in", search: { redirect: location.href } });
		}
		if (context.session.user.role !== "admin") {
			throw redirect({ to: "/" });
		}
		return { session: context.session };
	},
	component: AdminLayout,
});

function AdminLayout() {
	const { session } = Route.useRouteContext();

	return (
		<SidebarProvider>
			<AdminSidebar user={session.user} />
			<SidebarInset>
				<header className="sticky top-0 z-30 bg-background/80 py-3 backdrop-blur">
					<div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-6">
						<SidebarTrigger className="size-8 rounded-lg border" />
					</div>
				</header>
				<main className="mx-auto w-full max-w-7xl flex-1 px-6 pt-2 pb-12">
					<Outlet />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
