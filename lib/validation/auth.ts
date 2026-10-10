import { z } from "zod";

/**
 * AGENTS.md Section 9: one Zod schema per form, shared between the client
 * form and the server check. This one only validates shape (is it an
 * email, is a password present) — it intentionally does NOT check
 * password length/strength here, since that's enforced at account
 * creation (Admin-created, Section 8: minimum length 10) and re-checking
 * it at login would leak information about why a login failed.
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type LoginInput = z.infer<typeof loginSchema>;
