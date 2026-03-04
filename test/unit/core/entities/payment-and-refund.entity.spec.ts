import type { GatewayKey } from '@common/types/gateway.types';
import { PaymentStatus } from '@src/core/entities/payment-status.enum';
import type { Payment } from '@src/core/entities/payment.entity';
import type { Refund } from '@src/core/entities/refund.entity';
import type { Money } from '@src/core/value-objects/money.value-object';

describe('Payment and Refund entities', () => {
  const gateway: GatewayKey = 'stripe';
  const amount: Money = { currency: 'USD', amount: 1000 };

  it('creates a Payment shape correctly', () => {
    const now = new Date();

    const payment: Payment = {
      id: 'pay_123',
      gateway,
      gatewayPaymentId: 'pi_abc',
      amount,
      status: PaymentStatus.Pending,
      createdAt: now,
      updatedAt: now,
      metadata: { orderId: 'order_1' },
    };

    expect(payment.gateway).toBe('stripe');
    expect(payment.amount.amount).toBe(1000);
    expect(payment.status).toBe(PaymentStatus.Pending);
    expect(payment.metadata?.orderId).toBe('order_1');
  });

  it('creates a Refund shape correctly', () => {
    const now = new Date();

    const refund: Refund = {
      id: 're_123',
      paymentId: 'pay_123',
      gateway,
      gatewayRefundId: 'rfn_abc',
      amount,
      status: PaymentStatus.Refunded,
      createdAt: now,
      updatedAt: now,
      metadata: { reason: 'customer_request' },
    };

    expect(refund.gateway).toBe('stripe');
    expect(refund.paymentId).toBe('pay_123');
    expect(refund.amount.currency).toBe('USD');
    expect(refund.status).toBe(PaymentStatus.Refunded);
    expect(refund.metadata?.reason).toBe('customer_request');
  });
});
