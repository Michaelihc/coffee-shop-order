import { getDb } from "../db/connection";

export interface StaffRow {
  aad_id: string;
  display_name: string;
  role: "staff" | "admin";
}

export function getStaffMember(userId: string): StaffRow | null {
  const db = getDb();
  const staff = db
    .prepare("SELECT aad_id, display_name, role FROM staff WHERE aad_id = ?")
    .get(userId) as StaffRow | undefined;

  return staff ?? null;
}

export function isAdmin(userId: string): boolean {
  return getStaffMember(userId)?.role === "admin";
}
