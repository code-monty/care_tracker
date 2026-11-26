export const PROCEDURE_DEFINITIONS = [
  { key: "battery_of_exams", label: "Battery of Exams", sortOrder: 1 },
  { key: "marital_history", label: "Marital History", sortOrder: 2 },
  { key: "witnesses", label: "Witnesses", sortOrder: 3 },
  { key: "home_visit", label: "Home Visit", sortOrder: 4 },
  { key: "letter_of_invitation", label: "Letter of Invitation", sortOrder: 5 },
  { key: "judicial_affidavit", label: "Judicial Affidavit", sortOrder: 6 },
] as const;

export type ProcedureKey = (typeof PROCEDURE_DEFINITIONS)[number]["key"];

const procedureLabelMap = new Map<string, string>(
  PROCEDURE_DEFINITIONS.map((item) => [item.key, item.label]),
);

export function procedureLabel(key: string): string {
  return procedureLabelMap.get(key) ?? key;
}

export function canEditProcedureTracking(role: string): boolean {
  return role === "admin" || role === "secretary";
}

export function canManageProcedureNote(
  user: { id: string; role: string } | null,
  authorId: string,
): boolean {
  return Boolean(user && (user.role === "admin" || authorId === user.id));
}

export function sortProcedureNotes<T extends { pinned: boolean; created_at: string; id: string }>(
  notes: readonly T[],
): T[] {
  return [...notes].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.created_at.localeCompare(a.created_at) ||
      b.id.localeCompare(a.id),
  );
}
