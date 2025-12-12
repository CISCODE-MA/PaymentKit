import { Injectable } from '@nestjs/common';
import {
  CreatePaymentCommand,
  CreatePaymentResult,
  GetPaymentStatusQuery,
  GetPaymentStatusResult,
  RefundPaymentCommand,
  RefundPaymentResult,
} from '@src/core/ports/payment-gateway.port';
import { DefaultPaymentEngine } from '@src/core/services/payment-engine.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly engine: DefaultPaymentEngine) {}

  createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
    return this.engine.createPayment(command);
  }

  getPaymentStatus(query: GetPaymentStatusQuery): Promise<GetPaymentStatusResult> {
    return this.engine.getPaymentStatus(query);
  }

  refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult> {
    return this.engine.refundPayment(command);
  }
}
