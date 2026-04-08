import { getDb } from "../db/connection";
import { toSqlTimestamp } from "./business-time-service";

export interface PaymentReconciliationIncidentInput {
  orderId?: string | null;
  transactionRef: string;
  amountCents: number;
  incidentType: string;
  details: string;
}

export function createPaymentReconciliationIncident(
  input: PaymentReconciliationIncidentInput
): number {
  const db = getDb();
  const result = db.prepare(
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

  return result.lastInsertRowid;
}

export function updatePaymentReconciliationIncident(
  incidentId: number,
  input: Partial<PaymentReconciliationIncidentInput>
): void {
  const db = getDb();
  db.prepare(
    `UPDATE payment_reconciliation_incidents
     SET order_id = COALESCE(?, order_id),
         transaction_ref = COALESCE(?, transaction_ref),
         amount_cents = COALESCE(?, amount_cents),
         incident_type = COALESCE(?, incident_type),
         details = COALESCE(?, details)
     WHERE id = ?`
  ).run(
    input.orderId ?? null,
    input.transactionRef ?? null,
    input.amountCents ?? null,
    input.incidentType ?? null,
    input.details ?? null,
    incidentId
  );
}

export function deletePaymentReconciliationIncident(incidentId: number): void {
  const db = getDb();
  db.prepare("DELETE FROM payment_reconciliation_incidents WHERE id = ?").run(incidentId);
}

export function recordPaymentReconciliationIncident(
  input: PaymentReconciliationIncidentInput
): void {
  createPaymentReconciliationIncident(input);
}
