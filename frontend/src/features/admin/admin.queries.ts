import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { listUsers } from "#/features/admin/admin.functions";
import { authClient } from "#/lib/auth-client";

export type AdminUser = Awaited<ReturnType<typeof listUsers>>[number];

export const listUsersQueryOptions = () =>
	queryOptions({
		queryKey: ["admin", "users"],
		queryFn: () => listUsers(),
	});

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
