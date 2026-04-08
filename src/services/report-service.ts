import { getDb } from "../db/connection";
import { getCurrentBusinessDate } from "./business-time-service";

export interface StudentBalance {
  studentAadId: string;
  studentName: string;
  totalDueCents: number;
  orderCount: number;
}

export interface StudentSpending {
  studentAadId: string;
  studentName: string;
  totalSpendCents: number;
  todaySpendCents: number;
  orderCount: number;
}

function csvSafe(value: string): string {
  const normalized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

export function getStudentBalances(): StudentBalance[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT student_aad_id, student_name, SUM(total_cents) as total_due_cents, COUNT(*) as order_count
       FROM orders
       WHERE payment_method = 'pay-at-collect'
         AND status != 'cancelled'
       GROUP BY student_aad_id
       ORDER BY total_due_cents DESC`
    )
    .all() as {
    student_aad_id: string;
    student_name: string;
    total_due_cents: number;
    order_count: number;
  }[];

  return rows.map((row) => ({
    studentAadId: row.student_aad_id,
    studentName: row.student_name,
    totalDueCents: row.total_due_cents,
    orderCount: row.order_count,
  }));
}

export function getStudentSpending(date = getCurrentBusinessDate()): StudentSpending[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         student_aad_id,
         MAX(student_name) as student_name,
         COUNT(*) as order_count,
         COALESCE(SUM(total_cents), 0) as total_spend_cents,
         COALESCE(SUM(CASE WHEN business_date = ? THEN total_cents ELSE 0 END), 0) as today_spend_cents
       FROM orders
       WHERE status != 'cancelled'
       GROUP BY student_aad_id
       ORDER BY total_spend_cents DESC, today_spend_cents DESC`
    )
    .all(date) as {
    student_aad_id: string;
    student_name: string;
    order_count: number;
    total_spend_cents: number;
    today_spend_cents: number;
  }[];

  return rows.map((row) => ({
    studentAadId: row.student_aad_id,
    studentName: row.student_name,
    orderCount: row.order_count,
    totalSpendCents: row.total_spend_cents,
    todaySpendCents: row.today_spend_cents,
  }));
}

export function balancesToCsv(balances: StudentBalance[]): string {
  const header = "Student Name,Student AAD ID,Amount Due (¥),Order Count";
  const rows = balances.map(
    (b) =>
      `${csvSafe(b.studentName)},${csvSafe(b.studentAadId)},${(b.totalDueCents / 100).toFixed(2)},${b.orderCount}`
  );
  return [header, ...rows].join("\n");
}

export function spendingToCsv(spending: StudentSpending[]): string {
  const header = "Student Name,Student AAD ID,Orders,Spent Today (¥),Lifetime Spend (¥)";
  const rows = spending.map(
    (row) =>
      `${csvSafe(row.studentName)},${csvSafe(row.studentAadId)},${row.orderCount},${(row.todaySpendCents / 100).toFixed(2)},${(row.totalSpendCents / 100).toFixed(2)}`
  );
  return [header, ...rows].join("\n");
}
