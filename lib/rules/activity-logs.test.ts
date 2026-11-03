import { describe, expect, it } from "vitest";
import { activityDescription, formatLogDateTime, logActorRole } from "./activity-logs";

describe("activity log presentation", () => {
  it("describes a task status event without copying task details", () => {
    expect(activityDescription({ action: "complete", entity_type: "tasks", entity_id: "aaaaaaaa-0000-0000-0000-000000000000" })).toBe("Completed task #aaaaaaaa");
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
