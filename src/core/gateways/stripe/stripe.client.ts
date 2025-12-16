import { StripeInternalConfig } from '@src/config/gateways/stripe.config';

export interface StripeHttpRequest {
  method: 'GET' | 'POST' | 'DELETE';
  /**
   * Path relative to Stripe API base, e.g. "/payment_intents"
   */
  path: string;
  /**
   * Optional query string parameters.
   */
  query?: Record<string, string | number | undefined>;
  /**
   * Request body (will be form-encoded by the default client).
   */
  body?: unknown;
  /**
   * Optional idempotency key for safely retryable requests.
   */
  idempotencyKey?: string;
}

export interface StripeHttpResponse<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, string>;
}

export type StripeHttpClient = <T = unknown>(
  request: StripeHttpRequest,
) => Promise<StripeHttpResponse<T>>;

export interface StripeClientOptions {
  config: StripeInternalConfig;
  /**
   * Optional override for HTTP client - used in tests.
   * If omitted, a default fetch-based implementation is used.
   */
  httpClient?: StripeHttpClient;
}

/**
 * Thin HTTP client around the Stripe Rest API.
 * Stripe v1 expects application/x-www-form-urlencoded bodies.
 * Infra-level only: no PaymentKit domain types here.
 */
export class StripeClient {
  private readonly httpClient: StripeHttpClient;

  private static readonly API_BASE = 'https://api.stripe.com/v1';

  constructor(private readonly options: StripeClientOptions) {
    this.httpClient = options.httpClient ?? this.createDefaultHttpClient();
  }

  async requestJson<T = unknown>(request: StripeHttpRequest): Promise<StripeHttpResponse<T>> {
    return this.httpClient<T>(request);
  }

  // ------------- PRIVATE HELPERS --------------- \\
  private createDefaultHttpClient(): StripeHttpClient {
    const { config } = this.options;

    return async <T = unknown>(request: StripeHttpRequest): Promise<StripeHttpResponse<T>> => {
      const url = new URL(
        request.path.startsWith('/')
          ? `${StripeClient.API_BASE}${request.path}`
          : `${StripeClient.API_BASE}/${request.path}`,
      );

      if (request.query) {
        for (const [key, value] of Object.entries(request.query)) {
          if (value === undefined) continue;
          url.searchParams.set(key, String(value));
        }
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      if (request.idempotencyKey) {
        headers['Idempotency-Key'] = request.idempotencyKey;
      }

      let encodedBody: string | undefined;

      if (request.body !== undefined && request.body !== null) {
        const params = new URLSearchParams();

        if (this.isPlainObject(request.body)) {
          // Normal Stripe case: object of params
          for (const [k, v] of Object.entries(request.body)) {
            this.appendParams(params, k, v);
          }
          encodedBody = params.toString();
        } else if (Array.isArray(request.body)) {
          // If a top-level array is ever passed (rare), encode as value[]
          this.appendParams(params, 'value', request.body);
          encodedBody = params.toString();
        } else if (this.isPrimitive(request.body)) {
          // Only stringify primitives (safe for no-base-to-string)
          params.append('value', String(request.body));
          encodedBody = params.toString();
        } else {
          // Symbols/functions/etc should never be sent
          throw new Error(`StripeClient: Unsupported request.body type: ${typeof request.body}`);
        }
      }

      const response = await fetch(url.toString(), {
        method: request.method,
        headers,
        body: encodedBody,
      });

      const text = await response.text();
      let parsed: unknown;

      try {
        parsed = text.length ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }

      const headersObject: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headersObject[key] = value;
      });

      return {
        status: response.status,
        body: parsed as T,
        headers: headersObject,
      };
    };
  }

  /**
   * Recursively append values to URLSearchParams using Stripe bracket notation:
   * - nested objects: metadata[key]=value
   * - arrays: payment_method_types[]=card
   */
  private appendParams(params: URLSearchParams, key: string, value: unknown): void {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      for (const item of value) {
        this.appendParams(params, `${key}[]`, item);
      }
      return;
    }

    if (this.isPlainObject(value)) {
      for (const [k, v] of Object.entries(value)) {
        this.appendParams(params, `${key}[${k}]`, v);
      }
      return;
    }

    if (this.isPrimitive(value)) {
      params.append(key, String(value));
      return;
    }

    // Anything else (function/symbol) is invalid for Stripe params
    throw new Error(`StripeClient: Unsupported param type at "${key}": ${typeof value}`);
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isPrimitive(value: unknown): value is string | number | boolean | bigint {
    const t = typeof value;
    return t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint';
  }
}
