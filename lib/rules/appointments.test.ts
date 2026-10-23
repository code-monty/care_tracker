import { describe, expect, it } from "vitest";
import { Appointment, filterAppointments, getCalendarDays, sortAppointments } from "./appointments";

const records: Appointment[] = [
  { id: "1", clientName: "Fake Client A", date: "2026-10-25", time: "10:00", reason: "Assessment", status: "Pending" },
  { id: "2", clientName: "Fake Client B", date: "2026-11-02", time: "09:00", reason: "Follow-up", status: "Confirmed" },
];

describe("appointment presentation rules", () => {
  it("filters by search, month, and status", () => {
    expect(filterAppointments(records, { search: "assessment", dateFilter: "month", statusFilter: "Pending", today: "2026-10-23" })).toEqual([records[0]]);
  });
  it("sorts date and time without mutating the source", () => {
    expect(sortAppointments(records, { key: "date", direction: "desc" }).map((item) => item.id)).toEqual(["2", "1"]);
    expect(records.map((item) => item.id)).toEqual(["1", "2"]);
  });
  it("builds a six-week calendar including surrounding dates", () => {
    const days = getCalendarDays("2026-10");
    expect(days).toHaveLength(42);
    expect(days.find((day) => day.date === "2026-10-01")?.inMonth).toBe(true);
    expect(days.some((day) => !day.inMonth)).toBe(true);
  });
});
