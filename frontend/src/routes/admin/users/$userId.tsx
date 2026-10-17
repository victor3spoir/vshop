import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
	ArrowLeft,
	BadgeCheck,
	Ban,
	ShieldCheck,
	ShieldOff,
	Trash2,
	Undo2,
	VenetianMask,
} from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "#/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	useImpersonateMutation,
	useRemoveUserMutation,
	userDetailQueryOptions,
	userSessionsQueryOptions,
	useSetRoleMutation,
	useToggleBanMutation,
} from "#/features/admin/admin.queries";
import {
	EditUserDialog,
	SetPasswordDialog,
} from "#/features/admin/components/user-edit-dialogs";
import { UserSessionsCard } from "#/features/admin/components/user-sessions-card";
import { userInitials } from "#/features/admin/components/users-table";

// The admin layout route guards access; this page only loads its data.
export const Route = createFileRoute("/admin/users/$userId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.ensureQueryData(
				userDetailQueryOptions(params.userId),
			),
			context.queryClient.ensureQueryData(
				userSessionsQueryOptions(params.userId),
			),
		]),
	component: AdminUserDetailPage,
});

const dateTime = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

function AdminUserDetailPage() {
	const { userId } = Route.useParams();
	const { session } = Route.useRouteContext();
	const router = useRouter();
	const { data: user } = useSuspenseQuery(userDetailQueryOptions(userId));
	const setRole = useSetRoleMutation();
	const toggleBan = useToggleBanMutation();
	const impersonate = useImpersonateMutation();
	const removeUser = useRemoveUserMutation();

	const isSelf = user.id === session.user.id;
	const isAdmin = user.role === "admin";

	const handleImpersonate = async () => {
		await impersonate.mutateAsync(user.id);
		await router.invalidate();
		await router.navigate({ to: "/" });
	};

	const handleRemove = async () => {
		await removeUser.mutateAsync(user.id);
		await router.navigate({ to: "/admin/users" });
	};

	const error =
		setRole.error?.message ??
		toggleBan.error?.message ??
		impersonate.error?.message ??
		removeUser.error?.message;

	const infoRows = [
		{ label: "User ID", value: user.id },
		{ label: "Email", value: user.email },
		{
			label: "Email verified",
			value: user.emailVerified ? "Yes" : "No",
		},
		{ label: "Created", value: dateTime.format(new Date(user.createdAt)) },
		{ label: "Updated", value: dateTime.format(new Date(user.updatedAt)) },
		...(user.banned
			? [
					{ label: "Ban reason", value: user.banReason || "Not specified" },
					{
						label: "Ban expires",
						value: user.banExpires
							? dateTime.format(new Date(user.banExpires))
							: "Never",
					},
				]
			: []),
	];

	return (
		<div className="space-y-6">
			<Button asChild variant="ghost" size="sm" className="-ml-2">
				<Link to="/admin/users">
					<ArrowLeft className="size-4" />
					Users
				</Link>
			</Button>

			<header className="flex flex-wrap items-center gap-4">
				<Avatar className="size-14">
					<AvatarFallback className="text-lg">
						{userInitials(user.name)}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
						<Badge variant={isAdmin ? "default" : "secondary"}>
							{isAdmin ? "Admin" : "User"}
						</Badge>
						{user.banned ? <Badge variant="destructive">Banned</Badge> : null}
						{user.emailVerified ? (
							<Badge variant="outline">
								<BadgeCheck className="size-3" />
								Verified
							</Badge>
						) : null}
						{isSelf ? <Badge variant="outline">You</Badge> : null}
					</div>
					<p className="truncate text-sm text-muted-foreground">{user.email}</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<EditUserDialog user={user} />
					<SetPasswordDialog user={user} />
				</div>
			</header>

			{error ? <p className="text-sm text-destructive">{error}</p> : null}

			<div className="grid gap-6 lg:grid-cols-2">
				<section className="rounded-lg border">
					<header className="border-b px-4 py-3">
						<h2 className="text-sm font-semibold">Details</h2>
					</header>
					<dl className="divide-y">
						{infoRows.map((row) => (
							<div
								key={row.label}
								className="flex items-baseline justify-between gap-4 px-4 py-2.5"
							>
								<dt className="text-sm text-muted-foreground">{row.label}</dt>
								<dd className="truncate text-sm font-medium">{row.value}</dd>
							</div>
						))}
					</dl>
				</section>

				<UserSessionsCard userId={user.id} />
			</div>

			{!isSelf ? (
				<section className="rounded-lg border">
					<header className="border-b px-4 py-3">
						<h2 className="text-sm font-semibold">Actions</h2>
					</header>
					<div className="flex flex-wrap items-center gap-2 p-4">
						<Button
							variant="outline"
							size="sm"
							disabled={setRole.isPending}
							onClick={() =>
								setRole.mutate({
									userId: user.id,
									role: isAdmin ? "user" : "admin",
								})
							}
						>
							{isAdmin ? (
								<ShieldOff className="size-4" />
							) : (
								<ShieldCheck className="size-4" />
							)}
							{isAdmin ? "Demote to user" : "Make admin"}
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={impersonate.isPending}
							onClick={handleImpersonate}
						>
							<VenetianMask className="size-4" />
							Impersonate
						</Button>
						<Button
							variant={user.banned ? "outline" : "destructive"}
							size="sm"
							disabled={toggleBan.isPending}
							onClick={() => toggleBan.mutate(user)}
						>
							{user.banned ? (
								<Undo2 className="size-4" />
							) : (
								<Ban className="size-4" />
							)}
							{user.banned ? "Unban user" : "Ban user"}
						</Button>
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									variant="destructive"
									size="sm"
									disabled={removeUser.isPending}
								>
									<Trash2 className="size-4" />
									Delete user
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
									<AlertDialogDescription>
										This permanently deletes the account, sessions, and passkeys
										for {user.email}. This cannot be undone.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction onClick={handleRemove}>
										Delete user
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</section>
			) : null}
		</div>
	);
}
