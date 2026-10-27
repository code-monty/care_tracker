import { describe, expect, it } from "vitest";
import { deadlineStatus, manilaToday } from "./deadlines";

describe("deadline status", () => {
  it("uses a three-day inclusive window and preserves done tasks", () => {
    expect(deadlineStatus("2026-10-25", "open", "2026-10-26")).toBe("Overdue");
    expect(deadlineStatus("2026-10-26", "open", "2026-10-26")).toBe("Due Soon");
    expect(deadlineStatus("2026-10-29", "open", "2026-10-26")).toBe("Due Soon");
    expect(deadlineStatus("2026-10-30", "open", "2026-10-26")).toBe("Upcoming");
    expect(deadlineStatus("2026-10-25", "done", "2026-10-26")).toBe("Done");
  });
  it("switches dates at Manila midnight", () => {
    expect(manilaToday(new Date("2026-10-25T15:59:59Z"))).toBe("2026-10-25");
    expect(manilaToday(new Date("2026-10-25T16:00:00Z"))).toBe("2026-10-26");
  });
});
