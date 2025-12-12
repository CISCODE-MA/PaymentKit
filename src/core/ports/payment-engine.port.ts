/**
 * Core engine API internally used by the PaymentKit.
 * Concrete gateways and t he Nest layer talk to this.
 */

import {
  CreatePaymentCommand,
  CreatePaymentResult,
  GetPaymentStatusQuery,
  GetPaymentStatusResult,
  RefundPaymentCommand,
  RefundPaymentResult,
} from '@src/core/ports/payment-gateway.port';

export interface PaymentEngine {
  createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult>;
  getPaymentStatus(command: GetPaymentStatusQuery): Promise<GetPaymentStatusResult>;
  refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult>;
}
