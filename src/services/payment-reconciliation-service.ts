import { getDb } from "../db/connection";
import { toSqlTimestamp } from "./business-time-service";

export function recordPaymentReconciliationIncident(input: {
  orderId?: string | null;
  transactionRef: string;
  amountCents: number;
  incidentType: string;
  details: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO payment_reconciliation_incidents
      (order_id, transaction_ref, amount_cents, incident_type, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    input.orderId ?? null,
    input.transactionRef,
    input.amountCents,
    input.incidentType,
    input.details,
    toSqlTimestamp()
  );
}
