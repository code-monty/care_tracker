import { describe, expect, it } from "vitest";
import { activityDescription, formatLogDateTime } from "./activity-logs";

describe("activity log presentation", () => {
  it("describes a task status event without copying task details", () => {
    expect(activityDescription({ action: "complete", entity_type: "tasks", entity_id: "aaaaaaaa-0000-0000-0000-000000000000" })).toBe("Completed task #aaaaaaaa");
  });
  it("shows Manila time with milliseconds", () => {
    expect(formatLogDateTime("2026-10-28T01:02:03.123Z").time).toBe("09:02:03.123");
  });
});
