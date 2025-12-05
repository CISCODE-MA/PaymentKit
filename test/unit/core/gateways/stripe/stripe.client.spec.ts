// test/unit/core/gateways/stripe.client.spec.ts
import {
  StripeClient,
  type StripeHttpRequest,
  type StripeHttpResponse,
  type StripeHttpClient,
} from '@src/core/gateways/stripe/stripe.client';
import type { StripeInternalConfig } from '@config/gateways/stripe.config';

class FakeHttpClient {
  public readonly requests: StripeHttpRequest[] = [];
  public responses: StripeHttpResponse[] = [];

  handle: StripeHttpClient = <T = unknown>(
    request: StripeHttpRequest,
  ): Promise<StripeHttpResponse<T>> => {
    this.requests.push(request);

    const next = this.responses.shift();
    if (!next) {
      return Promise.reject(new Error('No fake response queued'));
    }

    return Promise.resolve(next as StripeHttpResponse<T>);
  };
}

const makeConfig = (): StripeInternalConfig =>
  ({
    apiKey: 'sk_test_123',
    // any extra fields in StripeInternalConfig are ok (structural typing)
  }) as StripeInternalConfig;

const makeClient = (fakeHttp: FakeHttpClient): StripeClient =>
  new StripeClient({
    config: makeConfig(),
    httpClient: fakeHttp.handle,
  });

describe('StripeClient', () => {
  it('forwards method, path and body to the underlying http client', async () => {
    const fake = new FakeHttpClient();

    fake.responses.push({
      status: 200,
      body: { ok: true },
      headers: {},
    });

    const client = makeClient(fake);

    const request: StripeHttpRequest = {
      method: 'POST',
      path: '/payment_intents',
      body: { amount: 1000, currency: 'usd' },
      idempotencyKey: 'idem-123',
    };

    const response = await client.requestJson<{ ok: boolean }>(request);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);

    expect(fake.requests).toHaveLength(1);
    const recorded = fake.requests[0];

    expect(recorded.method).toBe('POST');
    expect(recorded.path).toBe('/payment_intents');
    expect(recorded.body).toEqual({ amount: 1000, currency: 'usd' });
    expect(recorded.idempotencyKey).toBe('idem-123');
  });

  it('supports GET requests with query params', async () => {
    const fake = new FakeHttpClient();

    fake.responses.push({
      status: 200,
      body: { id: 'pi_123' },
      headers: {},
    });

    const client = makeClient(fake);

    const request: StripeHttpRequest = {
      method: 'GET',
      path: '/payment_intents',
      query: { limit: 1 },
    };

    const response = await client.requestJson<{ id: string }>(request);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe('pi_123');

    expect(fake.requests).toHaveLength(1);
    const recorded = fake.requests[0];

    expect(recorded.method).toBe('GET');
    expect(recorded.query).toEqual({ limit: 1 });
  });
});
