import type { PaymentKitEnvironment } from '@config/paymentKit.config';
import type { PaypalInternalConfig } from '@config/gateways/paypal.config';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface PaypalHttpRequest {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface PaypalHttpResponse<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, string>;
}

export type PaypalHttpClient = <T = unknown>(
  request: PaypalHttpRequest,
) => Promise<PaypalHttpResponse<T>>;

export interface PaypalClientOptions {
  config: PaypalInternalConfig;
  environment: PaymentKitEnvironment;
  /**
   * Optional low-level HTTP client (useful for tests).
   * Defaults to a fetch-based implementation.
   */
  httpClient?: PaypalHttpClient;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

export class PaypalClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly httpClient: PaypalHttpClient;
  private tokenCache?: TokenCache;

  constructor(options: PaypalClientOptions) {
    this.clientId = options.config.clientId;
    this.clientSecret = options.config.clientSecret;
    this.baseUrl = mapEnvironmentToPaypalBaseUrl(options.environment);
    this.httpClient = options.httpClient ?? defaultHttpClient;
  }

  /**
   * Generic JSON request helper that:
   * - ensures a bearer token exists (OAuth client_credentials)
   * - sends JSON body
   * - optionally sets an idempotency key header
   */
  async requestJson<TResponse = unknown>(options: {
    method: HttpMethod;
    path: string;
    body?: unknown;
    idempotencyKey?: string;
  }): Promise<PaypalHttpResponse<TResponse>> {
    const accessToken = await this.getAccessToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    if (options.idempotencyKey) {
      headers['PayPal-Request-Id'] = options.idempotencyKey;
    }

    const url = `${this.baseUrl}${options.path}`;
    const body = options.body !== undefined ? JSON.stringify(options.body) : undefined;

    return this.httpClient<TResponse>({
      method: options.method,
      url,
      headers,
      body,
    });
  }

  /**
   * Lazily obtains and caches an OAuth access token.
   */
  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 30_000) {
      return this.tokenCache.accessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`, 'utf8').toString('base64');

    const response = await this.httpClient<{
      access_token?: string;
      expires_in?: number;
    }>({
      method: 'POST',
      url: `${this.baseUrl}/v1/oauth2/token`,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (response.status < 200 || response.status >= 300 || !response.body.access_token) {
      throw new Error('Failed to obtain PayPal access token');
    }

    const expiresInSeconds = response.body.expires_in ?? 300;
    this.tokenCache = {
      accessToken: response.body.access_token,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    };

    return this.tokenCache.accessToken;
  }
}

/**
 * Map PaymentKit environment to PayPal REST API base URL.
 */
export function mapEnvironmentToPaypalBaseUrl(env: PaymentKitEnvironment): string {
  if (env === 'sandbox') {
    return 'https://api-m.sandbox.paypal.com';
  }

  // production
  return 'https://api-m.paypal.com';
}

/**
 * Default HTTP client based on global fetch.
 * In tests we inject a fake httpClient instead.
 */
const defaultHttpClient: PaypalHttpClient = async <T = unknown>(
  request: PaypalHttpRequest,
): Promise<PaypalHttpResponse<T>> => {
  if (typeof fetch !== 'function') {
    throw new Error('global fetch is not available; provide a custom httpClient');
  }

  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  const text = await response.text();
  let parsed: unknown = null;

  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    status: response.status,
    body: parsed as T,
    headers,
  };
};
