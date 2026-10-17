import { useForm } from "@tanstack/react-form";
import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { Fingerprint, LogIn } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import { Field, FieldError, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { authClient } from "#/lib/auth-client";

const signInSchema = z.object({
	email: z.string().email("Enter a valid email"),
	password: z.string().min(1, "Password is required"),
});

export const Route = createFileRoute("/_shop/_auth/sign-in/")({
	validateSearch: z.object({ redirect: z.string().optional() }),
	component: SignInPage,
});

function SignInPage() {
	const navigate = useNavigate();
	const router = useRouter();
	const { redirect } = Route.useSearch();
	const [formError, setFormError] = useState<string | null>(null);

	const done = async () => {
		// Refresh router context so the root beforeLoad re-reads the session.
		await router.invalidate();
		await navigate({ to: redirect ?? "/" });
	};

	const form = useForm({
		defaultValues: { email: "", password: "" },
		validators: { onSubmit: signInSchema },
		onSubmit: async ({ value }) => {
			setFormError(null);
			const { error } = await authClient.signIn.email(value);
			if (error) setFormError(error.message ?? "Sign in failed");
			else await done();
		},
	});

	const withPasskey = async () => {
		setFormError(null);
		const res = await authClient.signIn.passkey();
		if (res?.error) setFormError(res.error.message ?? "Passkey sign in failed");
		else await done();
	};

	return (
		<div className="mx-auto max-w-sm space-y-6 py-10">
			<div className="space-y-1">
				<h1 className="text-xl font-semibold">Sign in</h1>
				<p className="text-sm text-muted-foreground">Welcome back to vshop.</p>
			</div>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				className="space-y-4"
			>
				<form.Field name="email">
					{(field) => {
						const invalid =
							field.state.meta.isTouched && field.state.meta.errors.length > 0;
						return (
							<Field data-invalid={invalid}>
								<FieldLabel htmlFor={field.name}>Email</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="email"
									autoComplete="email webauthn"
									value={field.state.value}
									onBlur={field.handleBlur}
									aria-invalid={invalid}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{invalid ? (
									<FieldError>{field.state.meta.errors[0]?.message}</FieldError>
								) : null}
							</Field>
						);
					}}
				</form.Field>
				<form.Field name="password">
					{(field) => {
						const invalid =
							field.state.meta.isTouched && field.state.meta.errors.length > 0;
						return (
							<Field data-invalid={invalid}>
								<FieldLabel htmlFor={field.name}>Password</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="password"
									autoComplete="current-password webauthn"
									value={field.state.value}
									onBlur={field.handleBlur}
									aria-invalid={invalid}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{invalid ? (
									<FieldError>{field.state.meta.errors[0]?.message}</FieldError>
								) : null}
							</Field>
						);
					}}
				</form.Field>
				{formError ? (
					<p className="text-sm text-destructive">{formError}</p>
				) : null}
				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(isSubmitting) => (
						<Button type="submit" className="w-full" disabled={isSubmitting}>
							<LogIn className="size-4" />
							{isSubmitting ? "Signing in..." : "Sign in"}
						</Button>
					)}
				</form.Subscribe>
			</form>
			<Button variant="outline" className="w-full" onClick={withPasskey}>
				<Fingerprint className="size-4" />
				Sign in with passkey
			</Button>
			<p className="text-center text-sm text-muted-foreground">
				No account?{" "}
				<Link to="/sign-up" className="text-foreground underline">
					Sign up
				</Link>
			</p>
		</div>
	);
}
