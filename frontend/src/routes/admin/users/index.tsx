import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	listUsersQueryOptions,
	useImpersonateMutation,
	useSetRoleMutation,
	useToggleBanMutation,
} from "#/features/admin/admin.queries";
import { UsersTable } from "#/features/admin/components/users-table";

// The admin layout route guards access; this page only loads its data.
export const Route = createFileRoute("/admin/users/")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(listUsersQueryOptions()),
	component: AdminUsersPage,
});

function AdminUsersPage() {
	const { session } = Route.useRouteContext();
	const router = useRouter();
	const { data: users } = useSuspenseQuery(listUsersQueryOptions());
	const setRole = useSetRoleMutation();
	const toggleBan = useToggleBanMutation();
	const impersonate = useImpersonateMutation();

	const handleImpersonate = async (userId: string) => {
		await impersonate.mutateAsync(userId);
		// Session cookie changed: re-resolve the router context and go home.
		await router.invalidate();
		await router.navigate({ to: "/" });
	};

	const error =
		setRole.error?.message ??
		toggleBan.error?.message ??
		impersonate.error?.message;

	return (
		<div className="space-y-4">
			<div className="flex items-baseline gap-2">
				<h1 className="text-2xl font-bold tracking-tight">Users</h1>
				<span className="text-sm text-muted-foreground">
					{users.length} found
				</span>
			</div>
			{error ? <p className="text-sm text-destructive">{error}</p> : null}
			<UsersTable
				users={users}
				currentUserId={session.user.id}
				onSetRole={(user, role) => setRole.mutate({ userId: user.id, role })}
				onToggleBan={(user) => toggleBan.mutate(user)}
				onImpersonate={(user) => handleImpersonate(user.id)}
			/>
		</div>
	);
}
