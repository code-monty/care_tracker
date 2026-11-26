import { describe, expect, it } from "vitest";
import { activityDescription, formatLogDateTime, logActorRole } from "./activity-logs";

describe("activity log presentation", () => {
  it("describes a task status event without copying task details", () => {
    expect(activityDescription({ action: "complete", entity_type: "tasks" })).toBe("Completed task");
    expect(activityDescription({ action: "assign", entity_type: "tasks" })).toBe("Assigned task");
    expect(activityDescription({ action: "update", entity_type: "notes" })).toBe("Updated note");
    expect(activityDescription({ action: "delete", entity_type: "note_replies" })).toBe("Deleted note reply");
    expect(activityDescription({ action: "complete", entity_type: "client_procedures" })).toBe("Completed client procedure");
    expect(activityDescription({ action: "status_change", entity_type: "client_procedures" })).toBe("Reopened client procedure");
    expect(activityDescription({ action: "pin", entity_type: "client_procedure_notes" })).toBe("Pinned procedure note");
  });
  it("shows Manila time in 12-hour format without seconds", () => {
    expect(formatLogDateTime("2026-10-28T05:53:03.123Z").time).toBe("1:53 PM");
    expect(formatLogDateTime("2026-10-28T01:02:03.123Z").time).toBe("9:02 AM");
  });
  it("shows the actor's current role or a neutral fallback", () => {
    expect(logActorRole({ actor_id: "actor", profiles: { full_name: "Admin", role: "admin" } })).toBe("Admin");
    expect(logActorRole({ actor_id: "actor", profiles: { full_name: "Secretary", role: "secretary" } })).toBe("Secretary");
    expect(logActorRole({ actor_id: "actor", profiles: { full_name: "Staff", role: "staff" } })).toBe("Staff");
    expect(logActorRole({ actor_id: "actor", profiles: null })).toBe("Unknown role");
    expect(logActorRole({ actor_id: null, profiles: null })).toBe("Unknown role");
  });
});
