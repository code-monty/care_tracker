import { describe, expect, it } from "vitest";
import { dashboardTaskStats, deadlineStatus, manilaToday } from "./deadlines";

describe("deadline status", () => {
  it("uses a three-day inclusive window and preserves done tasks", () => {
    expect(deadlineStatus("2026-10-25", "open", "2026-10-26")).toBe("Overdue");
    expect(deadlineStatus("2026-10-26", "open", "2026-10-26")).toBe("Due Soon");
    expect(deadlineStatus("2026-10-29", "open", "2026-10-26")).toBe("Due Soon");
    expect(deadlineStatus("2026-10-30", "open", "2026-10-26")).toBe("Upcoming");
    expect(deadlineStatus("2026-10-25", "done", "2026-10-26")).toBe("Done");
    expect(deadlineStatus("2026-10-25", "awaiting_approval", "2026-10-26")).toBe("Overdue");
    expect(deadlineStatus("2026-10-25", "needs_changes", "2026-10-26")).toBe("Overdue");
  });
  it("switches dates at Manila midnight", () => {
    expect(manilaToday(new Date("2026-10-25T15:59:59Z"))).toBe("2026-10-25");
    expect(manilaToday(new Date("2026-10-25T16:00:00Z"))).toBe("2026-10-26");
  });
});

describe("Admin dashboard task statistics", () => {
  it("counts current deadline states and Staff approvals without counting done or inactive-client tasks", () => {
    expect(dashboardTaskStats([
      { status: "open", deadlineStatus: "Upcoming", clientStatus: "active" },
      { status: "needs_changes", deadlineStatus: "Due Soon", clientStatus: "active" },
      { status: "open", deadlineStatus: "Overdue", clientStatus: "active" },
      { status: "awaiting_approval", deadlineStatus: "Overdue", clientStatus: "active" },
      { status: "awaiting_approval", deadlineStatus: "Upcoming", clientStatus: "active" },
      { status: "done", deadlineStatus: "Done", clientStatus: "active" },
      { status: "open", deadlineStatus: "Overdue", clientStatus: "inactive" },
    ])).toEqual({ upcoming: 2, dueSoon: 1, overdue: 2, awaitingApproval: 2 });
  });
});
