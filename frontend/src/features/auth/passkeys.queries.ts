import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { listPasskeys } from "#/features/auth/auth.functions";
import { authClient } from "#/lib/auth-client";

export const listPasskeysQueryOptions = () =>
	queryOptions({
		queryKey: ["passkeys"],
		// Server function so the list also resolves during SSR (cookies attached).
		queryFn: () => listPasskeys(),
	});

export function useAddPasskeyMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (name?: string) => {
			const res = await authClient.passkey.addPasskey({ name });
			if (res?.error) {
				throw new Error(res.error.message ?? "Could not register passkey");
			}
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["passkeys"] }),
	});
}

export function useDeletePasskeyMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const res = await authClient.passkey.deletePasskey({ id });
			if (res?.error) {
				throw new Error(res.error.message ?? "Could not delete passkey");
			}
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["passkeys"] }),
	});
}
