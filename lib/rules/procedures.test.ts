import { describe, expect, it } from "vitest";
import {
  PROCEDURE_DEFINITIONS,
  canEditProcedureTracking,
  canManageProcedureNote,
  procedureLabel,
  sortProcedureNotes,
} from "./procedures";
import {
  procedureDateCreatedSchema,
  procedureNoteBodySchema,
} from "@/lib/validation/procedures";

describe("client procedures rules and validation", () => {
  it("exposes the six canonical procedures in display order", () => {
    expect(PROCEDURE_DEFINITIONS.map((item) => item.label)).toEqual([
      "Battery of Exams",
      "Marital History",
      "Witnesses",
      "Home Visit",
      "Letter of Invitation",
      "Judicial Affidavit",
    ]);
    expect(procedureLabel("judicial_affidavit")).toBe("Judicial Affidavit");
  });

  it("restricts date/status tracking edits to Admin and Secretary", () => {
    expect(canEditProcedureTracking("admin")).toBe(true);
    expect(canEditProcedureTracking("secretary")).toBe(true);
    expect(canEditProcedureTracking("staff")).toBe(false);
  });

  it("allows note editing/deletion for authors and Admin only", () => {
    expect(canManageProcedureNote({ id: "u1", role: "staff" }, "u1")).toBe(true);
    expect(canManageProcedureNote({ id: "u1", role: "staff" }, "u2")).toBe(false);
    expect(canManageProcedureNote({ id: "u1", role: "secretary" }, "u2")).toBe(false);
    expect(canManageProcedureNote({ id: "u1", role: "admin" }, "u2")).toBe(true);
    expect(canManageProcedureNote(null, "u1")).toBe(false);
  });

  it("sorts pinned procedure notes first, then newest created_at descending", () => {
    const sorted = sortProcedureNotes([
      { id: "1", pinned: false, created_at: "2026-11-26T08:00:00Z" },
      { id: "2", pinned: true, created_at: "2026-11-25T08:00:00Z" },
      { id: "3", pinned: false, created_at: "2026-11-26T09:00:00Z" },
      { id: "4", pinned: true, created_at: "2026-11-26T07:00:00Z" },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["4", "2", "3", "1"]);
  });

  it("validates manual date_created and trimmed note body", () => {
    expect(procedureDateCreatedSchema.parse("2026-11-18")).toBe("2026-11-18");
    expect(procedureDateCreatedSchema.parse("")).toBeNull();
    expect(procedureDateCreatedSchema.parse(null)).toBeNull();
    expect(() => procedureDateCreatedSchema.parse("18/11/2026")).toThrow();

    expect(procedureNoteBodySchema.parse("  Checked records  ")).toBe("Checked records");
    expect(() => procedureNoteBodySchema.parse("   ")).toThrow();
  });
});
