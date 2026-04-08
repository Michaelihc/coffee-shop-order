import type { PaymentProvider } from "./types";
import { StubPaymentProvider } from "./stub-provider";

export type { PaymentProvider, ChargeParams, PaymentResult } from "./types";

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    // Phase 1: always use the stub.
    // Phase 2: read from config and return the real adapter.
    provider = new StubPaymentProvider();
  }
  return provider;
}

export function setPaymentProvider(nextProvider: PaymentProvider | null): void {
  provider = nextProvider;
}
