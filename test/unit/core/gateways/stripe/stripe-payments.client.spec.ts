import {
  StripePaymentsClient,
  type CreateStripePaymentInput,
  type GetStripePaymentStatusInput,
  type RefundStripePaymentInput,
} from '@src/core/gateways/stripe/stripe-payments.client';
import {
  type StripeHttpRequest,
  type StripeHttpResponse,
  StripeClient,
} from '@src/core/gateways/stripe/stripe.client';
import { NormalizedErrorCode } from '@src/common/errors/normalized-error.model';

class FakeStripeClient {
  public readonly requests: StripeHttpRequest[] = [];
  public responses: StripeHttpResponse[] = [];

  requestJson<T = unknown>(request: StripeHttpRequest): Promise<StripeHttpResponse<T>> {
    this.requests.push(request);

    const next = this.responses.shift();
    if (!next) {
      return Promise.reject(new Error('No fake response queued'));
    }

    return Promise.resolve(next as StripeHttpResponse<T>);
  }
}

const makeClient = (fake: FakeStripeClient): StripePaymentsClient =>
  new StripePaymentsClient(fake as unknown as StripeClient);

describe('StripePaymentsClient', () => {
  it('createPayment: returns success on 2xx and forwards fields', async () => {
    const fake = new FakeStripeClient();
    fake.responses.push({
      status: 200,
      body: {
        id: 'pi_123',
        status: 'succeeded',
      },
      headers: {},
    });

    const client = makeClient(fake);

    const input: CreateStripePaymentInput = {
      amount: 1000,
      currency: 'usd',
      idempotencyKey: 'idem-123',
      metadata: { orderId: 'order-1' },
    };

    const result = await client.createPayment(input);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected ok result');
    }

    expect(result.paymentIntentId).toBe('pi_123');
    expect(result.status).toBe('succeeded');

    expect(fake.requests).toHaveLength(1);
    const req = fake.requests[0];

    expect(req.method).toBe('POST');
    expect(req.path).toBe('/payment_intents');
    expect(req.idempotencyKey).toBe('idem-123');
    expect(req.body).toEqual({
      amount: 1000,
      currency: 'usd',
      metadata: { orderId: 'order-1' },
    });
  });

  it('createPayment: returns normalized error on non-2xx', async () => {
    const fake = new FakeStripeClient();
    fake.responses.push({
      status: 402,
      body: {
        type: 'card_error',
        decline_code: 'insufficient_funds',
        message: 'Not enough money',
      },
      headers: {},
    });

    const client = makeClient(fake);

    const input: CreateStripePaymentInput = {
      amount: 1000,
      currency: 'usd',
    };

    const result = await client.createPayment(input);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected error result');
    }

    expect(result.error.code).toBe(NormalizedErrorCode.InsufficientFunds);
  });

  it('getPaymentStatus: returns success on 2xx', async () => {
    const fake = new FakeStripeClient();
    fake.responses.push({
      status: 200,
      body: {
        id: 'pi_123',
        status: 'processing',
      },
      headers: {},
    });

    const client = makeClient(fake);

    const input: GetStripePaymentStatusInput = {
      paymentIntentId: 'pi_123',
    };

    const result = await client.getPaymentStatus(input);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected ok result');
    }

    expect(result.paymentIntentId).toBe('pi_123');
    expect(result.status).toBe('processing');

    expect(fake.requests).toHaveLength(1);
    const req = fake.requests[0];

    expect(req.method).toBe('GET');
    expect(req.path).toBe('/payment_intents/pi_123');
  });

  it('refundPayment: returns success on 2xx', async () => {
    const fake = new FakeStripeClient();
    fake.responses.push({
      status: 200,
      body: {
        id: 're_123',
        status: 'succeeded',
      },
      headers: {},
    });

    const client = makeClient(fake);

    const input: RefundStripePaymentInput = {
      paymentIntentId: 'pi_123',
      amount: 500,
      idempotencyKey: 'idem-refund',
    };

    const result = await client.refundPayment(input);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected ok result');
    }

    expect(result.refundId).toBe('re_123');
    expect(result.status).toBe('succeeded');

    expect(fake.requests).toHaveLength(1);
    const req = fake.requests[0];

    expect(req.method).toBe('POST');
    expect(req.path).toBe('/refunds');
    expect(req.idempotencyKey).toBe('idem-refund');
    expect(req.body).toEqual({
      payment_intent: 'pi_123',
      amount: 500,
    });
  });

  it('refundPayment: returns normalized error on non-2xx', async () => {
    const fake = new FakeStripeClient();
    fake.responses.push({
      status: 500,
      body: {
        type: 'api_error',
        message: 'Stripe down',
      },
      headers: {},
    });

    const client = makeClient(fake);

    const input: RefundStripePaymentInput = {
      paymentIntentId: 'pi_123',
    };

    const result = await client.refundPayment(input);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected error result');
    }

    expect(result.error.code).toBe(NormalizedErrorCode.NetworkError);
  });
});
