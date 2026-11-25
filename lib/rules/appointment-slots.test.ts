import { describe, expect, it } from "vitest";
import { APPOINTMENT_SLOTS, isPassedAppointmentSlot, isPastAppointmentDate, occupiedAppointmentSlots, todayInManila } from "./appointment-slots";

describe("appointment slots", () => {
  it("offers nine one-hour slots from 8 AM to 5 PM", () => {
    expect(APPOINTMENT_SLOTS).toHaveLength(9);
    expect(APPOINTMENT_SLOTS[0]).toEqual({ value: "08:00", label: "8:00 AM - 9:00 AM" });
    expect(APPOINTMENT_SLOTS[8]).toEqual({ value: "16:00", label: "4:00 PM - 5:00 PM" });
  });

  it("blocks both slots overlapping an existing off-slot appointment", () => {
    expect(occupiedAppointmentSlots(["10:30"])).toEqual(["10:00", "11:00"]);
    expect(occupiedAppointmentSlots(["09:00"])).toEqual(["09:00"]);
  });

  it("computes today in Asia/Manila across UTC midnight", () => {
    expect(todayInManila(new Date("2026-11-25T16:30:00Z"))).toBe("2026-11-26");
    expect(isPastAppointmentDate("2026-11-25", new Date("2026-11-25T16:30:00Z"))).toBe(true);
    expect(isPastAppointmentDate("2026-11-26", new Date("2026-11-25T16:30:00Z"))).toBe(false);
  });

  it("marks slots at or before the current Manila time as passed", () => {
    const now = new Date("2026-11-25T09:00:00+08:00");
    expect(isPassedAppointmentSlot("2026-11-25", "08:00", now)).toBe(true);
    expect(isPassedAppointmentSlot("2026-11-25", "09:00", now)).toBe(true);
    expect(isPassedAppointmentSlot("2026-11-25", "10:00", now)).toBe(false);
    expect(isPassedAppointmentSlot("2026-11-26", "08:00", now)).toBe(false);
  });
});
