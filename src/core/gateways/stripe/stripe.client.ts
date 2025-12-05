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
   * Request body (will be JSON-encoded by the default client).
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
 * This is infra-level only: no domain, no PaymentKit types here.
 */
export class StripeClient {
  private readonly httpClient: StripeHttpClient;

  private static readonly API_BASE = 'https://api.stripe.com/v1';
  constructor(private readonly options: StripeClientOptions) {
    this.httpClient = options.httpClient ?? this.createDefaultHttpClient();
  }

  /**
   * Perform an HTTP call and parse JSON response.
   */
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
        'Content-Type': 'application/json',
      };

      if (request.idempotencyKey) {
        headers['Idempotency-Key'] = request.idempotencyKey;
      }

      const response = await fetch(url.toString(), {
        method: request.method,
        headers,
        body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
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
}
