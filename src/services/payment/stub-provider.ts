import crypto from "crypto";
import type { PaymentProvider, ChargeParams, PaymentResult } from "./types";

/**
 * Stub payment provider for Phase 1.
 * Always returns success. Replace with the school's real payment adapter in Phase 2.
 */
export class StubPaymentProvider implements PaymentProvider {
  readonly mode = "stub" as const;

  async charge(params: ChargeParams): Promise<PaymentResult> {
    // pay-at-collect orders are always accepted (payment deferred to counter)
    // student-card orders are accepted with a stub reference
    const transactionRef = `STUB-${params.method}-${crypto.randomUUID().slice(0, 8)}`;
    return { ok: true, transactionRef };
  }

  async refund(
    transactionRef: string,
    _amountCents: number
  ): Promise<PaymentResult> {
    return { ok: true, transactionRef: `REFUND-${transactionRef}` };
  }
}
