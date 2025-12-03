// test/unit/core/gateways/paypal-payments.client.spec.ts
import {
  PaypalPaymentsClient,
  type CreatePaypalPaymentInput,
  type RefundPaypalPaymentInput,
} from '@src/core/gateways/paypal/paypal-payments.client';
import {
  PaypalClient,
  type PaypalHttpRequest,
  type PaypalHttpResponse,
  type PaypalHttpClient,
} from '@src/core/gateways/paypal/paypal.client';
import type { PaypalInternalConfig } from '@config/gateways/paypal.config';
import { NormalizedErrorCode } from '@src/common/errors/normalized-error.model';

class FakeHttpClient {
  public readonly requests: PaypalHttpRequest[] = [];
  public responses: PaypalHttpResponse[] = [];

  handle: PaypalHttpClient = <T = unknown>(
    request: PaypalHttpRequest,
  ): Promise<PaypalHttpResponse<T>> => {
    this.requests.push(request);

    const next = this.responses.shift();
    if (!next) {
      return Promise.reject(new Error('No fake response queued'));
    }

    return Promise.resolve(next as PaypalHttpResponse<T>);
  };
}

const makeConfig = (): PaypalInternalConfig => ({
  clientId: 'client_123',
  clientSecret: 'secret_456',
  webhookId: 'webhook_789',
});

const makeClient = (fakeHttp: FakeHttpClient): PaypalClient =>
  new PaypalClient({
    config: makeConfig(),
    environment: 'sandbox',
    httpClient: fakeHttp.handle,
  });

describe('PaypalPaymentsClient', () => {
  it('creates a payment and returns order id and status on success', async () => {
    const fakeHttp = new FakeHttpClient();

    // OAuth token
    fakeHttp.responses.push({
      status: 200,
      body: {
        access_token: 'token_123',
        expires_in: 3600,
      },
      headers: {},
    });

    // Order creation
    fakeHttp.responses.push({
      status: 201,
      body: {
        id: 'ORDER-1',
        status: 'CREATED',
      },
      headers: {},
    });

    const paypalClient = makeClient(fakeHttp);
    const paymentsClient = new PaypalPaymentsClient(paypalClient);

    const input: CreatePaypalPaymentInput = {
      amount: { value: '10.00', currencyCode: 'USD' },
      idempotencyKey: 'idem-123',
    };

    const result = await paymentsClient.createPayment(input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success result');

    expect(result.orderId).toBe('ORDER-1');
    expect(result.status).toBe('CREATED');

    const apiCall = fakeHttp.requests.find((r) => r.url.endsWith('/v2/checkout/orders'));
    expect(apiCall).toBeDefined();
    expect(apiCall?.headers['PayPal-Request-Id']).toBe('idem-123');
  });

  it('returns normalized error when PayPal responds with non-2xx status on create', async () => {
    const fakeHttp = new FakeHttpClient();

    fakeHttp.responses.push({
      status: 200,
      body: {
        access_token: 'token_123',
        expires_in: 3600,
      },
      headers: {},
    });

    fakeHttp.responses.push({
      status: 400,
      body: {
        name: 'VALIDATION_ERROR',
        message: 'Bad request',
      },
      headers: {},
    });

    const paypalClient = makeClient(fakeHttp);
    const paymentsClient = new PaypalPaymentsClient(paypalClient);

    const input: CreatePaypalPaymentInput = {
      amount: { value: '10.00', currencyCode: 'USD' },
    };

    const result = await paymentsClient.createPayment(input);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure result');

    expect(result.error.code).toBe(NormalizedErrorCode.InvalidRequest);
  });

  it('returns normalized error when refund fails with non-2xx status', async () => {
    const fakeHttp = new FakeHttpClient();

    fakeHttp.responses.push({
      status: 200,
      body: {
        access_token: 'token_123',
        expires_in: 3600,
      },
      headers: {},
    });

    fakeHttp.responses.push({
      status: 500,
      body: {
        name: 'INTERNAL_SERVER_ERROR',
        message: 'Oops',
      },
      headers: {},
    });

    const paypalClient = makeClient(fakeHttp);
    const paymentsClient = new PaypalPaymentsClient(paypalClient);

    const input: RefundPaypalPaymentInput = {
      captureId: 'CAPTURE-1',
    };

    const result = await paymentsClient.refundPayment(input);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure result');

    expect(result.error.code).toBe(NormalizedErrorCode.InternalError);
    expect(result.error.isRetriable).toBe(true);
  });

  it('refunds successfully and returns refund id and status', async () => {
    const fakeHttp = new FakeHttpClient();

    fakeHttp.responses.push({
      status: 200,
      body: {
        access_token: 'token_123',
        expires_in: 3600,
      },
      headers: {},
    });

    fakeHttp.responses.push({
      status: 201,
      body: {
        id: 'REFUND-1',
        status: 'COMPLETED',
      },
      headers: {},
    });

    const paypalClient = makeClient(fakeHttp);
    const paymentsClient = new PaypalPaymentsClient(paypalClient);

    const input: RefundPaypalPaymentInput = {
      captureId: 'CAPTURE-1',
      amount: { value: '5.00', currencyCode: 'USD' },
      idempotencyKey: 'idem-refund',
    };

    const result = await paymentsClient.refundPayment(input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success result');

    expect(result.refundId).toBe('REFUND-1');
    expect(result.status).toBe('COMPLETED');

    const refundCall = fakeHttp.requests.find((r) => r.url.includes('/v2/payments/captures/'));

    expect(refundCall).toBeDefined();
    expect(refundCall?.headers['PayPal-Request-Id']).toBe('idem-refund');
  });
});
