import { z } from "zod";

export const clientIdSchema = z.uuid();
export const procedureIdSchema = z.uuid();
export const procedureNoteIdSchema = z.uuid();

export const procedureDateCreatedSchema = z
  .union([z.iso.date(), z.literal(""), z.null()])
  .transform((value) => (value === "" ? null : value));

export const procedureNoteBodySchema = z
  .string()
  .trim()
  .min(1, "Enter a note.")
  .max(4000, "Keep notes under 4,000 characters.");
