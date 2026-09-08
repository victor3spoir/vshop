import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_shop/_auth")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div>
			<Outlet />
		</div>
	);
}
