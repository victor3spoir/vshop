import { useForm } from "@tanstack/react-form";
import { KeyRound, Pencil } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import type { AdminUser } from "#/features/admin/admin.queries";
import {
	useSetPasswordMutation,
	useUpdateUserMutation,
} from "#/features/admin/admin.queries";

const profileSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: z.string().email("Enter a valid email"),
});

export function EditUserDialog({ user }: { user: AdminUser }) {
	const [open, setOpen] = useState(false);
	const updateUser = useUpdateUserMutation(user.id);

	const form = useForm({
		defaultValues: { name: user.name, email: user.email },
		validators: { onSubmit: profileSchema },
		onSubmit: async ({ value }) => {
			await updateUser.mutateAsync(value);
			setOpen(false);
		},
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) form.reset();
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Pencil className="size-4" />
					Edit profile
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit profile</DialogTitle>
					<DialogDescription>
						Update the name and email for {user.name}.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<form.Field name="name">
						{(field) => {
							const invalid =
								field.state.meta.isTouched &&
								field.state.meta.errors.length > 0;
							return (
								<Field data-invalid={invalid}>
									<FieldLabel htmlFor={field.name}>Name</FieldLabel>
									<Input
										id={field.name}
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
					<form.Field name="email">
						{(field) => {
							const invalid =
								field.state.meta.isTouched &&
								field.state.meta.errors.length > 0;
							return (
								<Field data-invalid={invalid}>
									<FieldLabel htmlFor={field.name}>Email</FieldLabel>
									<Input
										id={field.name}
										type="email"
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
					{updateUser.error ? (
						<p className="text-sm text-destructive">
							{updateUser.error.message}
						</p>
					) : null}
					<DialogFooter>
						<form.Subscribe selector={(s) => s.isSubmitting}>
							{(isSubmitting) => (
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? "Saving..." : "Save changes"}
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

const passwordSchema = z.object({
	newPassword: z.string().min(8, "Use at least 8 characters"),
});

export function SetPasswordDialog({ user }: { user: AdminUser }) {
	const [open, setOpen] = useState(false);
	const setPassword = useSetPasswordMutation(user.id);

	const form = useForm({
		defaultValues: { newPassword: "" },
		validators: { onSubmit: passwordSchema },
		onSubmit: async ({ value }) => {
			await setPassword.mutateAsync(value.newPassword);
			setOpen(false);
		},
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) form.reset();
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<KeyRound className="size-4" />
					Set password
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Set password</DialogTitle>
					<DialogDescription>
						Set a new password for {user.email}. The user is not notified.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<form.Field name="newPassword">
						{(field) => {
							const invalid =
								field.state.meta.isTouched &&
								field.state.meta.errors.length > 0;
							return (
								<Field data-invalid={invalid}>
									<FieldLabel htmlFor={field.name}>New password</FieldLabel>
									<Input
										id={field.name}
										type="password"
										autoComplete="new-password"
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
					{setPassword.error ? (
						<p className="text-sm text-destructive">
							{setPassword.error.message}
						</p>
					) : null}
					<DialogFooter>
						<form.Subscribe selector={(s) => s.isSubmitting}>
							{(isSubmitting) => (
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? "Saving..." : "Set password"}
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
