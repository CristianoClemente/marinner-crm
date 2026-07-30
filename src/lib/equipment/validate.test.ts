import { describe, expect, it } from "vitest";
import { buildEquipmentAlerts } from "./alerts";
import {
  nextEquipmentStatusAfterMaintenance,
  shouldBumpMeter,
} from "./status-sync";
import { validateEquipmentCreate } from "./validate";

describe("validateEquipmentCreate", () => {
  it("aceita veículo sem DPEM", () => {
    const r = validateEquipmentCreate({
      name: "Carro 01",
      kind: "vehicle",
      subtype: "car",
      brand: "Fiat",
      model: "Uno",
      fuel: "flex",
      document_expires_on: "2027-01-01",
      plate_or_registration: "ABC1D23",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.meter_unit).toBe("km");
      expect(r.value.dpem_protocol).toBeNull();
      expect(r.value.engine_cycle).toBeNull();
    }
  });

  it("rejeita DPEM em veículo", () => {
    const r = validateEquipmentCreate({
      name: "Carro 01",
      kind: "vehicle",
      subtype: "car",
      brand: "Fiat",
      model: "Uno",
      fuel: "flex",
      document_expires_on: "2027-01-01",
      plate_or_registration: "ABC1D23",
      dpem_protocol: "123",
      dpem_expires_on: "2027-01-01",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_dpem");
  });

  it("exige DPEM em embarcação", () => {
    expect(
      validateEquipmentCreate({
        name: "Lancha 01",
        kind: "vessel",
        subtype: "boat",
        brand: "Fibra",
        model: "X",
        fuel: "gasoline",
        document_expires_on: "2027-01-01",
        plate_or_registration: "BR-001",
      }).ok,
    ).toBe(false);

    const r = validateEquipmentCreate({
      name: "Lancha 01",
      kind: "vessel",
      subtype: "boat",
      brand: "Fibra",
      model: "X",
      fuel: "gasoline",
      engine_cycle: "4t",
      document_expires_on: "2027-01-01",
      plate_or_registration: "BR-001",
      dpem_expires_on: "2027-06-01",
      dpem_protocol: "PROT-1",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.meter_unit).toBe("hours");
  });

  it("rejeita subtype inválido", () => {
    const r = validateEquipmentCreate({
      name: "X",
      kind: "vehicle",
      subtype: "boat",
      brand: "A",
      model: "B",
      fuel: "flex",
      document_expires_on: "2027-01-01",
      plate_or_registration: "ABC",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_subtype");
  });
});

describe("nextEquipmentStatusAfterMaintenance", () => {
  it("agenda → em manutenção", () => {
    expect(nextEquipmentStatusAfterMaintenance("active", "scheduled")).toBe(
      "in_maintenance",
    );
    expect(
      nextEquipmentStatusAfterMaintenance("active", "in_progress"),
    ).toBe("in_maintenance");
  });

  it("conclui → ativo só se em manutenção", () => {
    expect(
      nextEquipmentStatusAfterMaintenance("in_maintenance", "completed"),
    ).toBe("active");
    expect(nextEquipmentStatusAfterMaintenance("active", "completed")).toBe(
      "active",
    );
  });

  it("preserva inactive e cancelado não mexe", () => {
    expect(
      nextEquipmentStatusAfterMaintenance("inactive", "scheduled"),
    ).toBe("inactive");
    expect(
      nextEquipmentStatusAfterMaintenance("in_maintenance", "cancelled"),
    ).toBe("in_maintenance");
  });

  it("bump de medidor só se maior", () => {
    expect(shouldBumpMeter(100, 120)).toBe(120);
    expect(shouldBumpMeter(100, 90)).toBeNull();
    expect(shouldBumpMeter(100, null)).toBeNull();
  });
});

describe("buildEquipmentAlerts", () => {
  it("classifica vencido / logo / ok", () => {
    const a = buildEquipmentAlerts({
      document_expires_on: "2026-01-01",
      dpem_expires_on: "2026-08-10",
      next_maintenance_due_on: "2027-01-01",
      today: "2026-07-29",
    });
    expect(a.document.level).toBe("overdue");
    expect(a.dpem.level).toBe("soon");
    expect(a.nextMaintenance.level).toBe("ok");
    expect(a.hasAny).toBe(true);
  });
});
