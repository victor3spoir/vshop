import { Link, useRouter } from "@tanstack/react-router";
import {
	ChevronsUpDown,
	LayoutDashboard,
	LogOut,
	Store,
	Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "#/components/ui/sidebar";
import { signOut } from "#/lib/auth-client";

const NAV_GROUPS = [
	{
		label: "Platform",
		items: [
			{ to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
			{ to: "/admin/users", label: "Users", icon: Users, exact: false },
		],
	},
] as const;

type SidebarUser = { name: string; email: string };

export function AdminSidebar({ user }: { user: SidebarUser }) {
	const router = useRouter();

	const handleSignOut = async () => {
		await signOut();
		await router.invalidate();
		await router.navigate({ to: "/" });
	};

	const initials =
		user.name
			.split(" ")
			.map((part) => part[0])
			.slice(0, 2)
			.join("")
			.toUpperCase() || "?";

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="h-14 justify-center">
				<div className="flex items-center gap-2 px-2">
					<div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<Store className="size-4" />
					</div>
					<span className="font-semibold">Admin</span>
				</div>
			</SidebarHeader>
			<SidebarContent>
				{NAV_GROUPS.map((group) => (
					<SidebarGroup key={group.label}>
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						<SidebarMenu>
							{group.items.map((item) => (
								<SidebarMenuItem key={item.to}>
									<SidebarMenuButton asChild>
										<Link
											to={item.to}
											activeOptions={{ exact: item.exact }}
											activeProps={{ "data-active": true }}
										>
											<item.icon className="size-4" />
											<span>{item.label}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter className="border-t">
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton size="lg">
									<Avatar className="size-7 rounded-lg">
										<AvatarFallback className="rounded-lg text-xs">
											{initials}
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{user.name}</span>
										<span className="truncate text-xs text-muted-foreground">
											{user.email}
										</span>
									</div>
									<ChevronsUpDown className="ml-auto size-4" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								side="top"
								align="start"
								className="w-(--radix-dropdown-menu-trigger-width)"
							>
								<DropdownMenuLabel className="text-xs text-muted-foreground">
									{user.email}
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link to="/">
										<Store className="size-4" />
										Back to shop
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={handleSignOut}>
									<LogOut className="size-4" />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
