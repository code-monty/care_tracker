import { z } from "zod";

/**
 * AGENTS.md Section 8 / DEV-02: the step-up code is always exactly 6
 * digits. Trimmed first so a pasted code with surrounding whitespace (a
 * common email-client artifact) still validates.
 */
export const stepUpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export type StepUpInput = z.infer<typeof stepUpSchema>;
