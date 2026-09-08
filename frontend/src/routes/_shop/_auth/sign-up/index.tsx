import { useForm } from "@tanstack/react-form";
import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import { Field, FieldError, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { authClient } from "#/lib/auth-client";

const signUpSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: z.string().email("Enter a valid email"),
	password: z.string().min(8, "At least 8 characters"),
});

export const Route = createFileRoute("/_shop/_auth/sign-up/")({
	component: SignUpPage,
});

const fields = [
	{ name: "name", label: "Name", type: "text", autoComplete: "name" },
	{ name: "email", label: "Email", type: "email", autoComplete: "email" },
	{
		name: "password",
		label: "Password",
		type: "password",
		autoComplete: "new-password",
	},
] as const;

function SignUpPage() {
	const navigate = useNavigate();
	const router = useRouter();
	const [formError, setFormError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: { name: "", email: "", password: "" },
		validators: { onSubmit: signUpSchema },
		onSubmit: async ({ value }) => {
			setFormError(null);
			const { error } = await authClient.signUp.email(value);
			if (error) {
				setFormError(error.message ?? "Sign up failed");
			} else {
				await router.invalidate();
				await navigate({ to: "/" });
			}
		},
	});

	return (
		<div className="mx-auto max-w-sm space-y-6 py-10">
			<div className="space-y-1">
				<h1 className="text-xl font-semibold">Create account</h1>
				<p className="text-sm text-muted-foreground">
					Start shopping on vshop.
				</p>
			</div>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				className="space-y-4"
			>
				{fields.map((f) => (
					<form.Field key={f.name} name={f.name}>
						{(field) => {
							const invalid =
								field.state.meta.isTouched &&
								field.state.meta.errors.length > 0;
							return (
								<Field data-invalid={invalid}>
									<FieldLabel htmlFor={field.name}>{f.label}</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type={f.type}
										autoComplete={f.autoComplete}
										value={field.state.value}
										onBlur={field.handleBlur}
										aria-invalid={invalid}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{invalid ? (
										<FieldError>
											{field.state.meta.errors[0]?.message}
										</FieldError>
									) : null}
								</Field>
							);
						}}
					</form.Field>
				))}
				{formError ? (
					<p className="text-sm text-destructive">{formError}</p>
				) : null}
				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(isSubmitting) => (
						<Button type="submit" className="w-full" disabled={isSubmitting}>
							<UserPlus className="size-4" />
							{isSubmitting ? "Creating..." : "Create account"}
						</Button>
					)}
				</form.Subscribe>
			</form>
			<p className="text-center text-sm text-muted-foreground">
				Already have an account?{" "}
				<Link to="/sign-in" className="text-foreground underline">
					Sign in
				</Link>
			</p>
		</div>
	);
}
