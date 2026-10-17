import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import {
	type AuthStatsPeriod,
	getAuthStats,
	getUserDetail,
	listUserSessions,
	listUsers,
} from "#/features/admin/admin.functions";
import { authClient } from "#/lib/auth-client";

export type AdminUser = Awaited<ReturnType<typeof listUsers>>[number];
export type AdminUserSession = Awaited<
	ReturnType<typeof listUserSessions>
>[number];

export const listUsersQueryOptions = () =>
	queryOptions({
		queryKey: ["admin", "users"],
		queryFn: () => listUsers(),
	});

export const userDetailQueryOptions = (userId: string) =>
	queryOptions({
		queryKey: ["admin", "users", userId],
		queryFn: () => getUserDetail({ data: { userId } }),
	});

export const userSessionsQueryOptions = (userId: string) =>
	queryOptions({
		queryKey: ["admin", "users", userId, "sessions"],
		queryFn: () => listUserSessions({ data: { userId } }),
	});

export const authStatsQueryOptions = (period: AuthStatsPeriod) =>
	queryOptions({
		queryKey: ["admin", "auth-stats", period],
		queryFn: () => getAuthStats({ data: { period } }),
		staleTime: 30_000,
	});

function useInvalidateUser(userId?: string) {
	const queryClient = useQueryClient();
	return () =>
		queryClient.invalidateQueries({
			queryKey: userId ? ["admin", "users", userId] : ["admin", "users"],
		});
}

export function useSetRoleMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: { userId: string; role: "admin" | "user" }) => {
			const { error } = await authClient.admin.setRole(input);
			if (error) throw new Error(error.message ?? "Failed to set role");
		},
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
	});
}

export function useToggleBanMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (user: AdminUser) => {
			const res = user.banned
				? await authClient.admin.unbanUser({ userId: user.id })
				: await authClient.admin.banUser({ userId: user.id });
			if (res.error)
				throw new Error(res.error.message ?? "Failed to update ban");
		},
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
	});
}

export function useUpdateUserMutation(userId: string) {
	const invalidate = useInvalidateUser();
	return useMutation({
		mutationFn: async (data: { name?: string; email?: string }) => {
			const { error } = await authClient.admin.updateUser({ userId, data });
			if (error) throw new Error(error.message ?? "Failed to update user");
		},
		onSuccess: invalidate,
	});
}

export function useSetPasswordMutation(userId: string) {
	return useMutation({
		mutationFn: async (newPassword: string) => {
			const { error } = await authClient.admin.setUserPassword({
				userId,
				newPassword,
			});
			if (error) throw new Error(error.message ?? "Failed to set password");
		},
	});
}

export function useRevokeSessionMutation(userId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (sessionToken: string) => {
			const { error } = await authClient.admin.revokeUserSession({
				sessionToken,
			});
			if (error) throw new Error(error.message ?? "Failed to revoke session");
		},
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: ["admin", "users", userId, "sessions"],
			}),
	});
}

export function useRevokeAllSessionsMutation(userId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const { error } = await authClient.admin.revokeUserSessions({ userId });
			if (error) throw new Error(error.message ?? "Failed to revoke sessions");
		},
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: ["admin", "users", userId, "sessions"],
			}),
	});
}

export function useRemoveUserMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (userId: string) => {
			const { error } = await authClient.admin.removeUser({ userId });
			if (error) throw new Error(error.message ?? "Failed to remove user");
		},
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
	});
}

export function useImpersonateMutation() {
	return useMutation({
		mutationFn: async (userId: string) => {
			const { error } = await authClient.admin.impersonateUser({ userId });
			if (error) throw new Error(error.message ?? "Failed to impersonate");
		},
	});
}
