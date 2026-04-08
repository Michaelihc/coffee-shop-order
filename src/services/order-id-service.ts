import { getDb } from "../db/connection";
import { logWarn } from "./logger";

function getLetterPrefixForBusinessDate(businessDate: string): string {
  const [year, month, day] = businessDate.split("-").map((value) => Number.parseInt(value, 10));
  const currentDayUtc = Date.UTC(year, month - 1, day);
  const startOfYearUtc = Date.UTC(year, 0, 0);
  const dayOfYear = Math.floor((currentDayUtc - startOfYearUtc) / 86400000);
  return String.fromCharCode(65 + (dayOfYear % 26));
}

function formatOrderId(businessDate: string, sequence: number): string {
  return `${getLetterPrefixForBusinessDate(businessDate)}${String(sequence).padStart(3, "0")}`;
}

export function parseOrderSequenceForBusinessDate(orderId: string, businessDate: string): number | null {
  const match = /^([A-Z])(\d+)$/.exec(orderId.trim());
  if (!match) {
    return null;
  }

  const [, prefix, rawSequence] = match;
  if (prefix !== getLetterPrefixForBusinessDate(businessDate)) {
    return null;
  }

  const sequence = Number.parseInt(rawSequence, 10);
  return Number.isFinite(sequence) ? sequence : null;
}

export function allocateNextOrderId(businessDate: string): string {
  const db = getDb();

  return db.transaction(() => {
    const existing = db
      .prepare("SELECT next_sequence FROM order_sequences WHERE business_date = ?")
      .get(businessDate) as { next_sequence: number } | undefined;

    const startingSequence = existing?.next_sequence ?? 1;
    let sequence = startingSequence;
    let orderId = formatOrderId(businessDate, sequence);

    while (db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId)) {
      sequence += 1;
      orderId = formatOrderId(businessDate, sequence);
    }

    if (sequence !== startingSequence) {
      logWarn("order.sequence.collision_detected", {
        businessDate,
        startingSequence,
        allocatedSequence: sequence,
        allocatedOrderId: orderId,
      });
    }

    const nextSequence = sequence + 1;

    if (existing) {
      db.prepare(
        "UPDATE order_sequences SET next_sequence = ? WHERE business_date = ?"
      ).run(nextSequence, businessDate);
    } else {
      db.prepare(
        "INSERT INTO order_sequences (business_date, next_sequence) VALUES (?, ?)"
      ).run(businessDate, nextSequence);
    }

    return orderId;
  })();
}
