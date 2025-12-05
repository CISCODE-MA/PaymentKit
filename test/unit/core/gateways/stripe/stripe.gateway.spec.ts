import { StripeGateway } from '@src/core/gateways/stripe/stripe.gateway';
import type {
  StripePaymentsClient,
  CreateStripePaymentInput,
  GetStripePaymentStatusInput,
  RefundStripePaymentInput,
} from '@src/core/gateways/stripe/stripe-payments.client';
import { PaymentStatus } from '@src/core/entities/payment-status.enum';
import { NormalizedErrorCode } from '@src/common/errors/normalized-error.model';
import type {
  CreatePaymentCommand,
  GetPaymentStatusQuery,
  RefundPaymentCommand,
} from '@src/core/ports/payment-gateway.port';
import type { Money } from '@src/core/value-objects/money.value-object';

class FakeStripePaymentsClient implements StripePaymentsClient {
  public readonly createCalls: CreateStripePaymentInput[] = [];
  public readonly statusCalls: GetStripePaymentStatusInput[] = [];
  public readonly refundCalls: RefundStripePaymentInput[] = [];

  createResponses: Array<Awaited<ReturnType<StripePaymentsClient['createPayment']>>> = [];

  statusResponses: Array<Awaited<ReturnType<StripePaymentsClient['getPaymentStatus']>>> = [];

  refundResponses: Array<Awaited<ReturnType<StripePaymentsClient['refundPayment']>>> = [];

  async createPayment(
    input: CreateStripePaymentInput,
  ): Promise<Awaited<ReturnType<StripePaymentsClient['createPayment']>>> {
    this.createCalls.push(input);
    const next = this.createResponses.shift();
    if (!next) {
      throw new Error('No createPayment response mocked');
    }
    return next;
  }

  async getPaymentStatus(
    input: GetStripePaymentStatusInput,
  ): Promise<Awaited<ReturnType<StripePaymentsClient['getPaymentStatus']>>> {
    this.statusCalls.push(input);
    const next = this.statusResponses.shift();
    if (!next) {
      throw new Error('No getPaymentStatus response mocked');
    }
    return next;
  }

  async refundPayment(
    input: RefundStripePaymentInput,
  ): Promise<Awaited<ReturnType<StripePaymentsClient['refundPayment']>>> {
    this.refundCalls.push(input);
    const next = this.refundResponses.shift();
    if (!next) {
      throw new Error('No refundPayment response mocked');
    }
    return next;
  }
}

const makeMoney = (amount: number, currency = 'USD'): Money => ({
  amount,
  currency,
});

describe('StripeGateway', () => {
  it('createPayment: returns Payment on success and forwards inputs', async () => {
    const fake = new FakeStripePaymentsClient();
    fake.createResponses.push({
      ok: true,
      paymentIntentId: 'pi_123',
      status: 'succeeded',
      raw: {},
    });

    const gateway = new StripeGateway(fake);

    const command: CreatePaymentCommand = {
      gateway: 'stripe',
      amount: makeMoney(1000, 'USD'),
      idempotencyKey: 'idem-123',
      metadata: { orderId: 'order-1' },
    };

    const result = await gateway.createPayment(command);

    expect(result.payment).not.toBeNull();
    expect(result.error).toBeUndefined();

    const payment = result.payment!;
    expect(payment.gateway).toBe('stripe');
    expect(payment.gatewayPaymentId).toBe('pi_123');
    expect(payment.status).toBe(PaymentStatus.Captured);

    expect(fake.createCalls).toHaveLength(1);
    const call = fake.createCalls[0];
    expect(call.amount).toBe(1000);
    expect(call.currency).toBe('usd'); // lowercased
    expect(call.idempotencyKey).toBe('idem-123');
    expect(call.metadata).toEqual({ orderId: 'order-1' });
  });

  it('createPayment: returns error when Stripe client fails', async () => {
    const fake = new FakeStripePaymentsClient();
    fake.createResponses.push({
      ok: false,
      error: {
        code: NormalizedErrorCode.CardDeclined,
        message: 'Declined',
      },
    });

    const gateway = new StripeGateway(fake);

    const command: CreatePaymentCommand = {
      gateway: 'stripe',
      amount: makeMoney(500),
    };

    const result = await gateway.createPayment(command);

    expect(result.payment).toBeNull();
    expect(result.error?.code).toBe(NormalizedErrorCode.CardDeclined);
  });

  it('getPaymentStatus: requires paymentId or gatewayPaymentId', async () => {
    const fake = new FakeStripePaymentsClient();
    const gateway = new StripeGateway(fake);

    const query = {} as GetPaymentStatusQuery;

    const result = await gateway.getPaymentStatus(query);

    expect(result.status).toBeNull();
    expect(result.payment).toBeNull();
    expect(result.error?.code).toBe(NormalizedErrorCode.InvalidRequest);
  });

  it('getPaymentStatus: returns Payment + status on success', async () => {
    const fake = new FakeStripePaymentsClient();
    fake.statusResponses.push({
      ok: true,
      paymentIntentId: 'pi_456',
      status: 'processing',
      raw: {},
    });

    const gateway = new StripeGateway(fake);

    const query: GetPaymentStatusQuery = {
      gateway: 'stripe',
      gatewayPaymentId: 'pi_456',
    };

    const result = await gateway.getPaymentStatus(query);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(PaymentStatus.Pending);
    expect(result.payment?.gatewayPaymentId).toBe('pi_456');

    expect(fake.statusCalls).toHaveLength(1);
    expect(fake.statusCalls[0].paymentIntentId).toBe('pi_456');
  });

  it('getPaymentStatus: propagates error from Stripe client', async () => {
    const fake = new FakeStripePaymentsClient();
    fake.statusResponses.push({
      ok: false,
      error: {
        code: NormalizedErrorCode.NetworkError,
        message: 'Stripe down',
      },
    });

    const gateway = new StripeGateway(fake);

    const query: GetPaymentStatusQuery = {
      gateway: 'stripe',
      gatewayPaymentId: 'pi_999',
    };

    const result = await gateway.getPaymentStatus(query);

    expect(result.status).toBeNull();
    expect(result.payment).toBeNull();
    expect(result.error?.code).toBe(NormalizedErrorCode.NetworkError);
  });

  it('refundPayment: returns Refund on success', async () => {
    const fake = new FakeStripePaymentsClient();
    fake.refundResponses.push({
      ok: true,
      refundId: 're_123',
      status: 'succeeded',
      raw: {},
    });

    const gateway = new StripeGateway(fake);

    const command: RefundPaymentCommand = {
      gateway: 'stripe',
      paymentId: 'pi_123',
      amount: makeMoney(500),
      idempotencyKey: 'idem-refund',
    };

    const result = await gateway.refundPayment(command);

    expect(result.error).toBeUndefined();
    expect(result.refund).not.toBeNull();

    const refund = result.refund!;
    expect(refund.paymentId).toBe('pi_123');
    expect(refund.amount.amount).toBe(500);

    expect(fake.refundCalls).toHaveLength(1);
    const call = fake.refundCalls[0];
    expect(call.paymentIntentId).toBe('pi_123');
    expect(call.amount).toBe(500);
    expect(call.idempotencyKey).toBe('idem-refund');
  });

  it('refundPayment: returns error when Stripe client fails', async () => {
    const fake = new FakeStripePaymentsClient();
    fake.refundResponses.push({
      ok: false,
      error: {
        code: NormalizedErrorCode.InternalError,
        message: 'Oops',
      },
    });

    const gateway = new StripeGateway(fake);

    const command: RefundPaymentCommand = {
      gateway: 'stripe',
      paymentId: 'pi_456',
    };

    const result = await gateway.refundPayment(command);

    expect(result.refund).toBeNull();
    expect(result.error?.code).toBe(NormalizedErrorCode.InternalError);
  });
});
