import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Ban, ShieldCheck, ShieldOff, Undo2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import {
	listUsersQueryOptions,
	useSetRoleMutation,
	useToggleBanMutation,
} from "#/features/admin/admin.queries";

// The admin layout route guards access; this page only loads its data.
export const Route = createFileRoute("/admin/users/")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(listUsersQueryOptions()),
	component: AdminUsersPage,
});

function AdminUsersPage() {
	const { session } = Route.useRouteContext();
	const { data: users } = useSuspenseQuery(listUsersQueryOptions());
	const setRole = useSetRoleMutation();
	const toggleBan = useToggleBanMutation();

	return (
		<div className="space-y-4">
			<div className="flex items-baseline gap-2">
				<h1 className="text-2xl font-bold tracking-tight">Users</h1>
				<span className="text-sm text-muted-foreground">
					{users.length} found
				</span>
			</div>
			{setRole.error || toggleBan.error ? (
				<p className="text-sm text-destructive">
					{setRole.error?.message ?? toggleBan.error?.message}
				</p>
			) : null}
			<div className="overflow-x-auto rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Email</TableHead>
							<TableHead>Role</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{users.map((u) => (
							<TableRow key={u.id}>
								<TableCell>{u.name}</TableCell>
								<TableCell className="text-muted-foreground">
									{u.email}
								</TableCell>
								<TableCell className="capitalize">{u.role ?? "user"}</TableCell>
								<TableCell>
									{u.banned ? (
										<span className="text-destructive">Banned</span>
									) : (
										"Active"
									)}
								</TableCell>
								<TableCell>
									<div className="flex justify-end gap-1">
										{u.id !== session.user.id ? (
											<>
												<Button
													variant="ghost"
													size="icon"
													className="size-7"
													aria-label={
														u.role === "admin" ? "Demote to user" : "Make admin"
													}
													title={
														u.role === "admin" ? "Demote to user" : "Make admin"
													}
													disabled={setRole.isPending}
													onClick={() =>
														setRole.mutate({
															userId: u.id,
															role: u.role === "admin" ? "user" : "admin",
														})
													}
												>
													{u.role === "admin" ? (
														<ShieldOff className="size-4" />
													) : (
														<ShieldCheck className="size-4" />
													)}
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="size-7"
													aria-label={u.banned ? "Unban user" : "Ban user"}
													title={u.banned ? "Unban user" : "Ban user"}
													disabled={toggleBan.isPending}
													onClick={() => toggleBan.mutate(u)}
												>
													{u.banned ? (
														<Undo2 className="size-4" />
													) : (
														<Ban className="size-4" />
													)}
												</Button>
											</>
										) : null}
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
