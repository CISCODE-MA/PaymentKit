import { NormalizedErrorCode } from '@src/common/errors/normalized-error.model';
import { PaymentStatus } from '@src/core/entities/payment-status.enum';
import type {
  StripePaymentsClient,
  CreateStripePaymentInput,
  GetStripePaymentStatusInput,
  RefundStripePaymentInput,
} from '@src/core/gateways/stripe/stripe-payments.client';
import { StripeGateway } from '@src/core/gateways/stripe/stripe.gateway';
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

  createPayment(
    input: CreateStripePaymentInput,
  ): Promise<Awaited<ReturnType<StripePaymentsClient['createPayment']>>> {
    this.createCalls.push(input);
    const next = this.createResponses.shift();
    if (!next) {
      return Promise.reject(new Error('No createPayment response mocked'));
    }
    return Promise.resolve(next);
  }

  getPaymentStatus(
    input: GetStripePaymentStatusInput,
  ): Promise<Awaited<ReturnType<StripePaymentsClient['getPaymentStatus']>>> {
    this.statusCalls.push(input);
    const next = this.statusResponses.shift();
    if (!next) {
      return Promise.reject(new Error('No getPaymentStatus response mocked'));
    }
    return Promise.resolve(next);
  }

  refundPayment(
    input: RefundStripePaymentInput,
  ): Promise<Awaited<ReturnType<StripePaymentsClient['refundPayment']>>> {
    this.refundCalls.push(input);
    const next = this.refundResponses.shift();
    if (!next) {
      return Promise.reject(new Error('No refundPayment response mocked'));
    }
    return Promise.resolve(next);
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

  describe('status mapping', () => {
    const testStatusMapping = (stripeStatus: string, expectedPaymentStatus: PaymentStatus) => {
      it(`maps Stripe status '${stripeStatus}' to '${expectedPaymentStatus}'`, async () => {
        const fake = new FakeStripePaymentsClient();
        fake.statusResponses.push({
          ok: true,
          paymentIntentId: 'pi_test',
          status: stripeStatus,
          raw: {},
        });

        const gateway = new StripeGateway(fake);
        const result = await gateway.getPaymentStatus({
          gateway: 'stripe',
          gatewayPaymentId: 'pi_test',
        });

        expect(result.status).toBe(expectedPaymentStatus);
      });
    };

    testStatusMapping('requires_payment_method', PaymentStatus.Pending);
    testStatusMapping('requires_confirmation', PaymentStatus.Pending);
    testStatusMapping('requires_action', PaymentStatus.Pending);
    testStatusMapping('processing', PaymentStatus.Pending);
    testStatusMapping('requires_capture', PaymentStatus.Authorized);
    testStatusMapping('succeeded', PaymentStatus.Captured);
    testStatusMapping('canceled', PaymentStatus.Canceled);
    testStatusMapping('unknown_status', PaymentStatus.Failed);
    testStatusMapping('', PaymentStatus.Failed);
  });

  describe('createPayment with client secret', () => {
    it('includes nextAction with clientSecret when present', async () => {
      const fake = new FakeStripePaymentsClient();
      fake.createResponses.push({
        ok: true,
        paymentIntentId: 'pi_789',
        status: 'requires_action',
        raw: { client_secret: 'pi_789_secret' },
      });

      const gateway = new StripeGateway(fake);
      const result = await gateway.createPayment({
        gateway: 'stripe',
        amount: makeMoney(2000),
      });

      expect(result.nextAction?.type).toBe('client_secret');
      expect((result.nextAction as any)?.clientSecret).toBe('pi_789_secret');
    });

    it('includes nextAction as none when clientSecret is missing', async () => {
      const fake = new FakeStripePaymentsClient();
      fake.createResponses.push({
        ok: true,
        paymentIntentId: 'pi_789',
        status: 'succeeded',
        raw: {},
      });

      const gateway = new StripeGateway(fake);
      const result = await gateway.createPayment({
        gateway: 'stripe',
        amount: makeMoney(2000),
      });

      expect(result.nextAction?.type).toBe('none');
    });

    it('includes nextAction as none when clientSecret is not a string', async () => {
      const fake = new FakeStripePaymentsClient();
      fake.createResponses.push({
        ok: true,
        paymentIntentId: 'pi_789',
        status: 'processing',
        raw: { client_secret: 123 },
      });

      const gateway = new StripeGateway(fake);
      const result = await gateway.createPayment({
        gateway: 'stripe',
        amount: makeMoney(2000),
      });

      expect(result.nextAction?.type).toBe('none');
    });
  });

  describe('getPaymentStatus uses paymentId fallback', () => {
    it('uses gatewayPaymentId when available', async () => {
      const fake = new FakeStripePaymentsClient();
      fake.statusResponses.push({
        ok: true,
        paymentIntentId: 'pi_gateway_id',
        status: 'succeeded',
        raw: {},
      });

      const gateway = new StripeGateway(fake);
      await gateway.getPaymentStatus({
        gateway: 'stripe',
        gatewayPaymentId: 'pi_gateway_id',
        paymentId: 'pi_should_be_ignored',
      });

      expect(fake.statusCalls[0].paymentIntentId).toBe('pi_gateway_id');
    });

    it('uses paymentId when gatewayPaymentId is not provided', async () => {
      const fake = new FakeStripePaymentsClient();
      fake.statusResponses.push({
        ok: true,
        paymentIntentId: 'pi_payment_id',
        status: 'succeeded',
        raw: {},
      });

      const gateway = new StripeGateway(fake);
      await gateway.getPaymentStatus({
        gateway: 'stripe',
        paymentId: 'pi_payment_id',
      });

      expect(fake.statusCalls[0].paymentIntentId).toBe('pi_payment_id');
    });
  });
});
