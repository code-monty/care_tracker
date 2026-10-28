import { z } from "zod";

export const accountIdSchema = z.uuid();
export const accountDetailsSchema = z.object({
  fullName: z.string().trim().min(1, "Enter a name").max(120),
  email: z.email("Enter a valid email address").transform((value) => value.trim().toLowerCase()),
  role: z.enum(["admin", "staff"]),
});
export const createAccountSchema = accountDetailsSchema;
export const updateAccountSchema = accountDetailsSchema.extend({ id: accountIdSchema });
export const statusActionSchema = z.object({ id: accountIdSchema, status: z.enum(["active", "disabled"]) });
export const passwordChangeSchema = z.object({
  password: z.string().min(10, "Use at least 10 characters").max(128),
  confirmation: z.string(),
}).refine((value) => value.password === value.confirmation, {
  message: "Passwords do not match", path: ["confirmation"],
});
