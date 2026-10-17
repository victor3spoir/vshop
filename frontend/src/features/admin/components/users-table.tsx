import { useNavigate } from "@tanstack/react-router";
import {
	type ColumnDef,
	columnFilteringFeature,
	createFilteredRowModel,
	createSortedRowModel,
	filterFn_equalsString,
	filterFn_includesString,
	flexRender,
	globalFilteringFeature,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_datetime,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import {
	ArrowUpDown,
	Ban,
	Eye,
	MoreHorizontal,
	Search,
	ShieldCheck,
	ShieldOff,
	Undo2,
	UserRound,
	VenetianMask,
} from "lucide-react";
import { useMemo } from "react";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import type { AdminUser } from "#/features/admin/admin.queries";

const features = tableFeatures({
	rowSortingFeature,
	columnFilteringFeature,
	globalFilteringFeature,
	filteredRowModel: createFilteredRowModel(),
	sortedRowModel: createSortedRowModel(),
	filterFns: {
		includesString: filterFn_includesString,
		equalsString: filterFn_equalsString,
	},
	sortFns: { alphanumeric: sortFn_alphanumeric, datetime: sortFn_datetime },
});

export function userInitials(name: string) {
	return (
		name
			.split(" ")
			.map((part) => part[0])
			.slice(0, 2)
			.join("")
			.toUpperCase() || "?"
	);
}

export function UsersTable({
	users,
	currentUserId,
	onSetRole,
	onToggleBan,
	onImpersonate,
}: {
	users: AdminUser[];
	currentUserId: string;
	onSetRole: (user: AdminUser, role: "admin" | "user") => void;
	onToggleBan: (user: AdminUser) => void;
	onImpersonate: (user: AdminUser) => void;
}) {
	const navigate = useNavigate();

	const columns = useMemo(
		(): ColumnDef<typeof features, AdminUser>[] => [
			{
				id: "user",
				accessorFn: (row) => `${row.name} ${row.email}`,
				header: "User",
				filterFn: "includesString",
				sortFn: "alphanumeric",
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<Avatar className="size-8">
							<AvatarFallback className="text-xs">
								{userInitials(row.original.name)}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0">
							<p className="truncate font-medium">{row.original.name}</p>
							<p className="truncate text-xs text-muted-foreground">
								{row.original.email}
							</p>
						</div>
					</div>
				),
			},
			{
				id: "role",
				accessorFn: (row) => row.role ?? "user",
				header: "Role",
				filterFn: "equalsString",
				sortFn: "alphanumeric",
				cell: ({ getValue }) => (
					<Badge
						variant={getValue() === "admin" ? "default" : "secondary"}
						className="capitalize"
					>
						{String(getValue())}
					</Badge>
				),
			},
			{
				id: "status",
				accessorFn: (row) => (row.banned ? "banned" : "active"),
				header: "Status",
				filterFn: "equalsString",
				sortFn: "alphanumeric",
				cell: ({ getValue }) =>
					getValue() === "banned" ? (
						<Badge variant="destructive">Banned</Badge>
					) : (
						<Badge variant="outline">Active</Badge>
					),
			},
			{
				id: "createdAt",
				accessorFn: (row) => row.createdAt,
				header: "Joined",
				sortFn: "datetime",
				enableColumnFilter: false,
				cell: ({ row }) =>
					new Date(row.original.createdAt).toLocaleDateString(undefined, {
						year: "numeric",
						month: "short",
						day: "numeric",
					}),
			},
		],
		[],
	);

	const table = useTable(
		{ features, columns, data: users, getRowId: (row) => row.id },
		(state) => ({
			globalFilter: state.globalFilter,
			columnFilters: state.columnFilters,
			sorting: state.sorting,
		}),
	);

	const roleFilter =
		(table.getColumn("role")?.getFilterValue() as string | undefined) ?? "all";
	const statusFilter =
		(table.getColumn("status")?.getFilterValue() as string | undefined) ??
		"all";
	const rows = table.getRowModel().rows;

	const openUser = (userId: string) =>
		navigate({ to: "/admin/users/$userId", params: { userId } });

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative min-w-52 flex-1">
					<Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search name or email..."
						className="pl-8"
						value={(table.state.globalFilter as string | undefined) ?? ""}
						onChange={(e) => table.setGlobalFilter(e.target.value)}
					/>
				</div>
				<Select
					value={roleFilter}
					onValueChange={(value) =>
						table
							.getColumn("role")
							?.setFilterValue(value === "all" ? undefined : value)
					}
				>
					<SelectTrigger className="w-32" aria-label="Filter by role">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All roles</SelectItem>
						<SelectItem value="admin">Admin</SelectItem>
						<SelectItem value="user">User</SelectItem>
					</SelectContent>
				</Select>
				<Select
					value={statusFilter}
					onValueChange={(value) =>
						table
							.getColumn("status")
							?.setFilterValue(value === "all" ? undefined : value)
					}
				>
					<SelectTrigger className="w-32" aria-label="Filter by status">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="active">Active</SelectItem>
						<SelectItem value="banned">Banned</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="overflow-x-auto rounded-lg border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder ? null : header.column.getCanSort() ? (
											<button
												type="button"
												className="inline-flex items-center gap-1 hover:text-foreground"
												onClick={header.column.getToggleSortingHandler()}
											>
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
												<ArrowUpDown className="size-3.5" />
											</button>
										) : (
											flexRender(
												header.column.columnDef.header,
												header.getContext(),
											)
										)}
									</TableHead>
								))}
								<TableHead className="w-12" aria-label="Actions" />
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{rows.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={columns.length + 1}
									className="h-24 text-center text-muted-foreground"
								>
									No users match the current filters.
								</TableCell>
							</TableRow>
						) : (
							rows.map((row) => {
								const user = row.original;
								const isSelf = user.id === currentUserId;
								return (
									<TableRow
										key={row.id}
										className="cursor-pointer"
										onClick={() => openUser(user.id)}
									>
										{row.getAllCells().map((cell) => (
											<TableCell key={cell.id}>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
										<TableCell onClick={(e) => e.stopPropagation()}>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="size-7"
														aria-label={`Actions for ${user.name}`}
													>
														<MoreHorizontal className="size-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuLabel className="text-xs text-muted-foreground">
														{user.email}
													</DropdownMenuLabel>
													<DropdownMenuItem onClick={() => openUser(user.id)}>
														<Eye className="size-4" />
														View details
													</DropdownMenuItem>
													{!isSelf ? (
														<>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																onClick={() =>
																	onSetRole(
																		user,
																		user.role === "admin" ? "user" : "admin",
																	)
																}
															>
																{user.role === "admin" ? (
																	<ShieldOff className="size-4" />
																) : (
																	<ShieldCheck className="size-4" />
																)}
																{user.role === "admin"
																	? "Demote to user"
																	: "Make admin"}
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() => onImpersonate(user)}
															>
																<VenetianMask className="size-4" />
																Impersonate
															</DropdownMenuItem>
															<DropdownMenuItem
																variant={
																	user.banned ? "default" : "destructive"
																}
																onClick={() => onToggleBan(user)}
															>
																{user.banned ? (
																	<Undo2 className="size-4" />
																) : (
																	<Ban className="size-4" />
																)}
																{user.banned ? "Unban user" : "Ban user"}
															</DropdownMenuItem>
														</>
													) : (
														<DropdownMenuItem disabled>
															<UserRound className="size-4" />
															This is you
														</DropdownMenuItem>
													)}
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</div>
			<p className="text-xs text-muted-foreground">
				{rows.length} of {users.length} users
			</p>
		</div>
	);
}
