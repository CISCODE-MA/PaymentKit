import type { GatewayKey } from '@common/types/gateway.types';
import { PaymentStatus } from '@src/core/entities/payment-status.enum';
import type {
  CreatePaymentCommand,
  CreatePaymentResult,
  GetPaymentStatusQuery,
  GetPaymentStatusResult,
  RefundPaymentCommand,
  RefundPaymentResult,
  PaymentGateway,
} from '@src/core/ports/payment-gateway.port';
import { InMemoryGatewayRegistry } from '@src/core/services/gateway-registry.service';

class FakeGateway implements PaymentGateway {
  constructor(public readonly key: GatewayKey) {}

  createPayment(_command: CreatePaymentCommand): Promise<CreatePaymentResult> {
    void _command; // mark as used for eslint
    return Promise.resolve({
      payment: null,
    });
  }

  getPaymentStatus(_query: GetPaymentStatusQuery): Promise<GetPaymentStatusResult> {
    void _query;
    return Promise.resolve({
      status: PaymentStatus.Pending,
      payment: null,
    });
  }

  refundPayment(_command: RefundPaymentCommand): Promise<RefundPaymentResult> {
    void _command;
    return Promise.resolve({
      refund: null,
    });
  }
}

describe('InMemoryGatewayRegistry', () => {
  it('returns gateways by key when registered', () => {
    const stripe = new FakeGateway('stripe');
    const paypal = new FakeGateway('paypal');

    const registry = new InMemoryGatewayRegistry([stripe, paypal]);

    expect(registry.get('stripe')).toBe(stripe);
    expect(registry.get('paypal')).toBe(paypal);
  });

  it('returns undefined for unknown gateways', () => {
    const stripe = new FakeGateway('stripe');
    const registry = new InMemoryGatewayRegistry([stripe]);

    expect(registry.get('paypal')).toBeUndefined();
  });

  it('list() returns all unique gateways', () => {
    const stripe = new FakeGateway('stripe');
    const paypal = new FakeGateway('paypal');

    const registry = new InMemoryGatewayRegistry([stripe, paypal]);

    const list = registry.list();

    expect(list).toHaveLength(2);
    expect(list).toEqual(expect.arrayContaining([stripe, paypal]));
  });

  it('last registered gateway wins when keys are duplicated', () => {
    const firstStripe = new FakeGateway('stripe');
    const secondStripe = new FakeGateway('stripe');

    const registry = new InMemoryGatewayRegistry([firstStripe, secondStripe]);

    const fromRegistry = registry.get('stripe');
    expect(fromRegistry).toBe(secondStripe);
  });
});
