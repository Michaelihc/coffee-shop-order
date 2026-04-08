import type { PaymentMethod } from "../../types/models";

export interface ChargeParams {
  studentId: string;
  studentName: string;
  amountCents: number;
  orderId: string;
  method: PaymentMethod;
}

export type PaymentResult =
  | { ok: true; transactionRef: string }
  | { ok: false; reason: string };

export interface PaymentProvider {
  readonly mode?: "stub" | "live";
  charge(params: ChargeParams): Promise<PaymentResult>;
  refund(transactionRef: string, amountCents: number): Promise<PaymentResult>;
}
