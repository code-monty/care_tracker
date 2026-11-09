import { z } from "zod";

const requiredText = z.string().trim().min(1, "This field is required");
const mobile = z.string().trim().regex(/^09\d{2}-?\d{3}-?\d{4}$/, "Use a Philippine mobile number (09XX-XXX-XXXX)");
const email = z.email("Enter a valid email address");
const todayInManila = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const birthdate = z.iso.date().refine((value) => value <= todayInManila(), "Birthdate cannot be in the future");
export const sexOptions = ["Male", "Female", "Non-Binary", "Prefer not to Say"] as const;
const sex = z.enum(sexOptions);
export type SexOption = z.infer<typeof sex>;

export const clientFieldSchemas = {
  petitionerName: requiredText,
  petitionerBirthdate: birthdate,
  petitionerSex: sex,
  petitionerContact: mobile,
  petitionerEmail: email,
  petitionerAddress: requiredText,
  attorneyName: requiredText,
  attorneyContact: mobile,
  attorneyEmail: email,
  respondentName: requiredText,
  respondentBirthdate: birthdate,
  respondentSex: sex,
  respondentContact: mobile,
  respondentEmail: email,
  respondentAddress: requiredText,
} as const;

export const addClientSchema = z.object(clientFieldSchemas);
export const editClientSchema = addClientSchema.extend({ petitionerSex: sex.nullable(), respondentSex: sex.nullable() });
export const clientDetailsSchema = editClientSchema.omit({ attorneyName: true, attorneyContact: true, attorneyEmail: true });
export type ClientField = keyof typeof clientFieldSchemas;
export type ClientInput = z.infer<typeof addClientSchema>;
export type EditClientInput = z.infer<typeof editClientSchema>;
export type AttorneyChoice = { mode: "keep" } | { mode: "existing"; attorneyId: string } | { mode: "new" };

export function ageFromBirthdate(birthdateValue: string, today = todayInManila()): number | null {
  if (!z.iso.date().safeParse(birthdateValue).success || birthdateValue > today) return null;
  const [year, month, day] = birthdateValue.split("-").map(Number);
  const [currentYear, currentMonth, currentDay] = today.split("-").map(Number);
  return currentYear - year - (currentMonth < month || (currentMonth === month && currentDay < day) ? 1 : 0);
}
