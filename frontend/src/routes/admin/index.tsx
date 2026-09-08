import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Package, ShieldCheck, Users } from "lucide-react";
import { Button } from "#/components/ui/button";
import { listUsersQueryOptions } from "#/features/admin/admin.queries";
import { listOrdersQueryOptions } from "#/features/orders/orders.queries";

// The admin layout route guards access; this page only loads its data.
export const Route = createFileRoute("/admin/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.ensureQueryData(listUsersQueryOptions()),
			context.queryClient.ensureQueryData(listOrdersQueryOptions()),
		]),
	component: AdminOverviewPage,
});

function AdminOverviewPage() {
	const { data: users } = useSuspenseQuery(listUsersQueryOptions());
	const { data: orders } = useSuspenseQuery(listOrdersQueryOptions());

	const admins = users.filter((u) => u.role === "admin").length;
	const pending = orders.filter((o) => o.status === "pending").length;

	const stats = [
		{ label: "Users", value: users.length, icon: Users },
		{ label: "Admins", value: admins, icon: ShieldCheck },
		{ label: "Pending orders", value: pending, icon: Package },
	];

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold tracking-tight">Overview</h1>
			<dl className="grid gap-4 sm:grid-cols-3">
				{stats.map((stat) => (
					<div key={stat.label} className="rounded-lg border p-4">
						<dt className="flex items-center gap-2 text-sm text-muted-foreground">
							<stat.icon className="size-4" />
							{stat.label}
						</dt>
						<dd className="mt-2 text-3xl font-semibold tabular-nums">
							{stat.value}
						</dd>
					</div>
				))}
			</dl>
			<Button asChild variant="outline" size="sm">
				<Link to="/admin/users">
					Manage users
					<ArrowRight className="size-4" />
				</Link>
			</Button>
		</div>
	);
}
