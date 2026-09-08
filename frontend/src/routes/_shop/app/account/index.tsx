import { useForm } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Fingerprint, Plus, Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Field, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import {
	listPasskeysQueryOptions,
	useAddPasskeyMutation,
	useDeletePasskeyMutation,
} from "#/features/auth/passkeys.queries";

export const Route = createFileRoute("/_shop/app/account/")({
	beforeLoad: ({ context }) => {
		if (!context.session) {
			throw redirect({ to: "/sign-in", search: { redirect: "/app/account" } });
		}
		return { session: context.session };
	},
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(listPasskeysQueryOptions()),
	component: AccountPage,
});

function AccountPage() {
	const { session } = Route.useRouteContext();
	const { data: passkeys } = useSuspenseQuery(listPasskeysQueryOptions());
	const addPasskey = useAddPasskeyMutation();
	const deletePasskey = useDeletePasskeyMutation();

	const form = useForm({
		defaultValues: { name: "" },
		onSubmit: async ({ value, formApi }) => {
			await addPasskey.mutateAsync(value.name || undefined);
			formApi.reset();
		},
	});

	return (
		<div className="mx-auto max-w-lg space-y-8">
			<section className="space-y-2">
				<h1 className="text-xl font-semibold">Account</h1>
				<div className="rounded-lg border p-4 text-sm">
					<p className="font-medium">{session.user.name}</p>
					<p className="text-muted-foreground">{session.user.email}</p>
					{session.user.role ? (
						<p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
							{session.user.role}
						</p>
					) : null}
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="flex items-center gap-2 font-medium">
					<Fingerprint className="size-4" />
					Passkeys
				</h2>
				{passkeys.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No passkeys registered yet.
					</p>
				) : (
					<ul className="divide-y rounded-lg border">
						{passkeys.map((p) => (
							<li key={p.id} className="flex items-center gap-3 p-3 text-sm">
								<span className="flex-1">{p.name || "Unnamed passkey"}</span>
								<Button
									variant="ghost"
									size="icon"
									className="size-7"
									aria-label="Delete passkey"
									disabled={deletePasskey.isPending}
									onClick={() => deletePasskey.mutate(p.id)}
								>
									<Trash2 className="size-4" />
								</Button>
							</li>
						))}
					</ul>
				)}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="flex items-end gap-2"
				>
					<form.Field name="name">
						{(field) => (
							<Field className="flex-1">
								<FieldLabel htmlFor={field.name}>New passkey name</FieldLabel>
								<Input
									id={field.name}
									placeholder="e.g. Laptop"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</Field>
						)}
					</form.Field>
					<form.Subscribe selector={(s) => s.isSubmitting}>
						{(isSubmitting) => (
							<Button type="submit" disabled={isSubmitting}>
								<Plus className="size-4" />
								Register
							</Button>
						)}
					</form.Subscribe>
				</form>
				{addPasskey.error ? (
					<p className="text-sm text-destructive">{addPasskey.error.message}</p>
				) : null}
			</section>
		</div>
	);
}
