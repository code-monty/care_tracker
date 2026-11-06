import { describe, expect, it } from "vitest";
import { APPOINTMENT_SLOTS, occupiedAppointmentSlots } from "./appointment-slots";

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
});
