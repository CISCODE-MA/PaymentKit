import type { PaypalInternalConfig } from '@config/gateways/paypal.config';
import {
  PaypalClient,
  type PaypalHttpRequest,
  type PaypalHttpResponse,
  type PaypalHttpClient,
} from '@src/core/gateways/paypal/paypal.client';

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
  clientId: 'client_id_123',
  clientSecret: 'secret_456',
});

describe('PaypalClient', () => {
  it('obtains an access token and uses it for subsequent JSON requests', async () => {
    const fakeHttp = new FakeHttpClient();

    // 1) OAuth token response
    fakeHttp.responses.push({
      status: 200,
      body: {
        access_token: 'access_token_abc',
        expires_in: 3600,
      },
      headers: {},
    });

    // 2) Actual API call response
    fakeHttp.responses.push({
      status: 201,
      body: { ok: true },
      headers: {},
    });

    const client = new PaypalClient({
      config: makeConfig(),
      environment: 'sandbox',
      httpClient: fakeHttp.handle,
    });

    const result = await client.requestJson<{ ok: boolean }>({
      method: 'POST',
      path: '/v2/checkout/orders',
      body: { foo: 'bar' },
      idempotencyKey: 'idem-123',
    });

    expect(result.status).toBe(201);
    expect(result.body.ok).toBe(true);

    // first request: OAuth
    const tokenReq = fakeHttp.requests[0];
    expect(tokenReq.url).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
    expect(tokenReq.method).toBe('POST');
    expect(tokenReq.headers.Authorization).toMatch(/^Basic /);
    expect(tokenReq.body).toBe('grant_type=client_credentials');

    // second request: actual API call with Bearer + idempotency header
    const apiReq = fakeHttp.requests[1];
    expect(apiReq.url).toBe('https://api-m.sandbox.paypal.com/v2/checkout/orders');
    expect(apiReq.method).toBe('POST');
    expect(apiReq.headers.Authorization).toBe('Bearer access_token_abc');
    expect(apiReq.headers['PayPal-Request-Id']).toBe('idem-123');
    expect(apiReq.headers['Content-Type']).toBe('application/json');
    expect(apiReq.body).toBe(JSON.stringify({ foo: 'bar' }));
  });

  it('caches access token until near expiry', async () => {
    const fakeHttp = new FakeHttpClient();

    // OAuth: short-lived token but still enough
    fakeHttp.responses.push({
      status: 200,
      body: {
        access_token: 'cached_token',
        expires_in: 3600,
      },
      headers: {},
    });

    // two API calls
    fakeHttp.responses.push({
      status: 200,
      body: { call: 1 },
      headers: {},
    });
    fakeHttp.responses.push({
      status: 200,
      body: { call: 2 },
      headers: {},
    });

    const client = new PaypalClient({
      config: makeConfig(),
      environment: 'production',
      httpClient: fakeHttp.handle,
    });

    await client.requestJson({ method: 'GET', path: '/v2/payments/test-1' });
    await client.requestJson({ method: 'GET', path: '/v2/payments/test-2' });

    // Only one OAuth request should be made
    const oauthCalls = fakeHttp.requests.filter((r) => r.url.endsWith('/v1/oauth2/token'));
    expect(oauthCalls).toHaveLength(1);

    const apiCalls = fakeHttp.requests.filter((r) => r.url.includes('/v2/payments/'));
    expect(apiCalls).toHaveLength(2);
    apiCalls.forEach((r) => expect(r.headers.Authorization).toBe('Bearer cached_token'));
  });

  it('throws when it cannot obtain an access token', async () => {
    const fakeHttp = new FakeHttpClient();

    // OAuth failure
    fakeHttp.responses.push({
      status: 400,
      body: { error: 'invalid_client' },
      headers: {},
    });

    const client = new PaypalClient({
      config: makeConfig(),
      environment: 'sandbox',
      httpClient: fakeHttp.handle,
    });

    await expect(client.requestJson({ method: 'GET', path: '/v2/payments/test' })).rejects.toThrow(
      'Failed to obtain PayPal access token',
    );
  });
});
