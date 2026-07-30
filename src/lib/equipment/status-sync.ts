/**
 * Sync do status do equipamento a partir do status da manutenção.
 */

import type { EquipmentStatus, MaintenanceStatus } from "./validate";

export function nextEquipmentStatusAfterMaintenance(
  current: EquipmentStatus,
  maintenanceStatus: MaintenanceStatus,
): EquipmentStatus {
  if (current === "inactive" || current === "decommissioned") {
    return current;
  }

  if (
    maintenanceStatus === "scheduled" ||
    maintenanceStatus === "in_progress"
  ) {
    if (current === "active" || current === "in_maintenance") {
      return "in_maintenance";
    }
  }

  if (maintenanceStatus === "completed" && current === "in_maintenance") {
    return "active";
  }

  return current;
}

export function shouldBumpMeter(
  currentMeter: number,
  meterAt: number | null | undefined,
): number | null {
  if (meterAt === null || meterAt === undefined) return null;
  if (meterAt > currentMeter) return meterAt;
  return null;
}
