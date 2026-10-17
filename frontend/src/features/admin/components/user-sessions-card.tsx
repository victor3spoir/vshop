import { useSuspenseQuery } from "@tanstack/react-query";
import { MonitorSmartphone, X } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	useRevokeAllSessionsMutation,
	useRevokeSessionMutation,
	userSessionsQueryOptions,
} from "#/features/admin/admin.queries";

function describeUserAgent(userAgent: string | null | undefined) {
	if (!userAgent) return "Unknown device";
	const browser =
		userAgent.match(/(Edg|OPR|Chrome|Firefox|Safari)\/[\d.]+/)?.[0] ??
		"Unknown browser";
	const os = userAgent
		.match(/\(([^)]+)\)/)?.[1]
		?.split(";")[0]
		?.trim();
	return os ? `${browser} on ${os}` : browser;
}

const dateTime = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

export function UserSessionsCard({ userId }: { userId: string }) {
	const { data: sessions } = useSuspenseQuery(userSessionsQueryOptions(userId));
	const revokeSession = useRevokeSessionMutation(userId);
	const revokeAll = useRevokeAllSessionsMutation(userId);

	const now = Date.now();
	const active = sessions.filter((s) => new Date(s.expiresAt).getTime() > now);

	const error = revokeSession.error?.message ?? revokeAll.error?.message;

	return (
		<section className="rounded-lg border">
			<header className="flex items-center justify-between gap-2 border-b px-4 py-3">
				<div>
					<h2 className="text-sm font-semibold">Sessions</h2>
					<p className="text-xs text-muted-foreground">
						{active.length} active session{active.length === 1 ? "" : "s"}
					</p>
				</div>
				{active.length > 0 ? (
					<Button
						variant="outline"
						size="sm"
						disabled={revokeAll.isPending}
						onClick={() => revokeAll.mutate()}
					>
						<X className="size-4" />
						Revoke all
					</Button>
				) : null}
			</header>
			{error ? (
				<p className="px-4 pt-3 text-sm text-destructive">{error}</p>
			) : null}
			{active.length === 0 ? (
				<p className="px-4 py-6 text-center text-sm text-muted-foreground">
					No active sessions.
				</p>
			) : (
				<ul className="divide-y">
					{active.map((session) => (
						<li key={session.id} className="flex items-center gap-3 px-4 py-3">
							<MonitorSmartphone className="size-4 shrink-0 text-muted-foreground" />
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">
									{describeUserAgent(session.userAgent)}
								</p>
								<p className="truncate text-xs text-muted-foreground">
									{session.ipAddress || "No IP recorded"} - started{" "}
									{dateTime.format(new Date(session.createdAt))} - expires{" "}
									{dateTime.format(new Date(session.expiresAt))}
								</p>
							</div>
							{session.impersonatedBy ? (
								<Badge variant="secondary">Impersonated</Badge>
							) : null}
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								aria-label="Revoke session"
								title="Revoke session"
								disabled={revokeSession.isPending}
								onClick={() => revokeSession.mutate(session.token)}
							>
								<X className="size-4" />
							</Button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
