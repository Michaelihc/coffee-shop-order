import { getDb } from "../db/connection";
import type { StaffMember } from "../types/models";

export function listStaffMembers(): StaffMember[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT aad_id, display_name, role FROM staff ORDER BY display_name")
    .all() as { aad_id: string; display_name: string; role: StaffMember["role"] }[];

  return rows.map((row) => ({
    aadId: row.aad_id,
    displayName: row.display_name,
    role: row.role,
  }));
}

export function getManagedStaffMember(aadId: string): StaffMember | null {
  const db = getDb();
  const row = db
    .prepare("SELECT aad_id, display_name, role FROM staff WHERE aad_id = ?")
    .get(aadId) as { aad_id: string; display_name: string; role: StaffMember["role"] } | undefined;

  if (!row) {
    return null;
  }

  return {
    aadId: row.aad_id,
    displayName: row.display_name,
    role: row.role,
  };
}

export function staffMemberExists(aadId: string): boolean {
  const db = getDb();
  return Boolean(db.prepare("SELECT 1 FROM staff WHERE aad_id = ?").get(aadId));
}

export function countStaffMembersByRole(role: StaffMember["role"]): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as n FROM staff WHERE role = ?")
    .get(role) as { n: number };

  return row.n;
}

export function addStaffMember(aadId: string, displayName: string, role: StaffMember["role"]): void {
  const db = getDb();
  db.prepare("INSERT INTO staff (aad_id, display_name, role) VALUES (?, ?, ?)")
    .run(aadId, displayName, role);
}

export function updateStaffMemberRole(aadId: string, role: StaffMember["role"]): boolean {
  const db = getDb();
  const result = db
    .prepare("UPDATE staff SET role = ? WHERE aad_id = ?")
    .run(role, aadId);

  return result.changes > 0;
}

export function removeStaffMember(aadId: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM staff WHERE aad_id = ?").run(aadId);
  return result.changes > 0;
}
