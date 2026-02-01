# PaymentKit - Payment Gateway Instructions

**Last updated: February 2026**

## Gateway Architecture Overview

PaymentKit uses a **gateway pattern** to abstract payment provider implementations behind a common interface. This allows the package to support multiple payment processors (Stripe, PayPal, etc.) while presenting a unified API.

### Key Concepts

- **PaymentGateway Port**: Core interface all gateways implement ([payment-gateway.port.ts](../../../src/core/ports/payment-gateway.port.ts))
- **Gateway Implementations**: Provider-specific logic in [src/core/gateways/](../../../src/core/gateways/)
- **Gateway Registry**: Central service managing gateway instances ([gateway-registry.service.ts](../../../src/core/services/gateway-registry.service.ts))
- **Payment Engine**: Orchestrates operations across gateways ([payment-engine.service.ts](../../../src/core/services/payment-engine.service.ts))

### Gateway Responsibilities

Each gateway implementation must:

1. **Implement PaymentGateway interface** with all required methods
2. **Normalize errors** to `NormalizedError` format
3. **Handle webhook verification** and normalization
4. **Map provider data** to PaymentKit entities (`Payment`, `Refund`)
5. **Manage HTTP communication** with provider APIs

---

## Supported Gateways

### Stripe

**Location**: [src/core/gateways/stripe/](../../../src/core/gateways/stripe/)

**Components**:

- `stripe.gateway.ts` - Main gateway implementation
- `stripe.client.ts` - Low-level HTTP client for Stripe API
- `stripe-payments.client.ts` - Payment-specific operations
- `stripe-error.mapper.ts` - Error normalization
- `stripe-webhook-verifier.ts` - Webhook signature verification
- `stripe-webhook-normalizer.ts` - Webhook event normalization
- `stripe-webhook.handler.ts` - Webhook processing logic

**Configuration**: [src/config/gateways/stripe.config.ts](../../../src/config/gateways/stripe.config.ts)

**Key Features**:

- Supports Payment Intents API
- Full webhook signature verification (HMAC SHA256)
- Comprehensive error mapping
- Idempotency key support

**Stripe-Specific Patterns**:

```typescript
// Stripe uses cents for amounts
const amountInCents = 1050; // $10.50

// Payment Intent statuses
type StripeStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'succeeded'
  | 'canceled';

// Webhook signature format
const signature =
  't=1492774577,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd';
```

### PayPal

**Location**: [src/core/gateways/paypal/](../../../src/core/gateways/paypal/)

**Components**:

- `paypal.gateway.ts` - Main gateway implementation
- `paypal.client.ts` - Low-level HTTP client for PayPal API
- `paypal-payments.client.ts` - Payment-specific operations
- `paypal-error.mapper.ts` - Error normalization
- `paypal-webhook-verifier.ts` - Webhook signature verification
- `paypal-webhook-normalizer.ts` - Webhook event normalization
- `paypal-webhook.handler.ts` - Webhook processing logic

**Configuration**: [src/config/gateways/paypal.config.ts](../../../src/config/gateways/paypal.config.ts)

**Key Features**:

- Supports Orders API v2
- OAuth 2.0 token management
- Webhook verification via PayPal API
- Automatic token refresh

**PayPal-Specific Patterns**:

```typescript
// PayPal uses dollars for amounts
const amountInDollars = '10.50'; // Must be string

// PayPal has Orders and Captures
interface PayPalOrder {
  id: string; // Order ID (e.g., '5O190127TN364715T')
  status: 'CREATED' | 'APPROVED' | 'COMPLETED';
}

interface PayPalCapture {
  id: string; // Capture ID (e.g., '3C679366H7976362F')
  status: 'COMPLETED' | 'DECLINED' | 'PENDING';
}

// Orders must be captured to complete payment
// 1. Create Order → 2. Customer Approves → 3. Capture Order → Payment Complete
```

---

## Gateway Comparison

| Feature                  | Stripe                    | PayPal                       |
| ------------------------ | ------------------------- | ---------------------------- |
| **Amount Format**        | Integer (cents)           | String (dollars)             |
| **Currency Support**     | 135+ currencies           | 25+ currencies               |
| **Payment Flow**         | Single-step               | Multi-step (Order → Capture) |
| **Webhook Verification** | HMAC SHA256               | API verification call        |
| **Token Management**     | Bearer token (secret key) | OAuth 2.0 (access token)     |
| **API Complexity**       | Medium                    | Higher                       |
| **Error Granularity**    | Very detailed             | Moderate                     |
| **Idempotency**          | Built-in                  | Custom implementation        |

---

## Adding a New Gateway

### Complete Checklist

Follow this 8-step process to add a new payment gateway:

#### 1. Create Gateway Configuration

**File**: `src/config/gateways/{gateway}.config.ts`

```typescript
// Example: src/config/gateways/square.config.ts

export interface SquareGatewayConfig {
  enabled: boolean;
  accessToken: string;
  locationId: string;
  environment: 'sandbox' | 'production';
  apiVersion?: string;
}

export function validateSquareConfig(raw: unknown): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = [];

  if (typeof raw !== 'object' || raw === null) {
    issues.push({
      path: 'gateways.square',
      message: 'square config must be an object',
      code: 'SQUARE_NOT_OBJECT',
    });
    return { valid: false, issues };
  }

  const obj = raw as Record<string, unknown>;

  // Validate enabled
  if (typeof obj.enabled !== 'boolean') {
    issues.push({
      path: 'gateways.square.enabled',
      message: 'enabled must be a boolean',
      code: 'SQUARE_ENABLED_INVALID',
    });
  }

  // Validate accessToken
  if (obj.enabled === true && typeof obj.accessToken !== 'string') {
    issues.push({
      path: 'gateways.square.accessToken',
      message: 'accessToken is required when square is enabled',
      code: 'SQUARE_ACCESS_TOKEN_MISSING',
    });
  }

  // Validate locationId
  if (obj.enabled === true && typeof obj.locationId !== 'string') {
    issues.push({
      path: 'gateways.square.locationId',
      message: 'locationId is required when square is enabled',
      code: 'SQUARE_LOCATION_ID_MISSING',
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
```

**Update main config**: Add to [src/config/paymentKit.config.ts](../../../src/config/paymentKit.config.ts)

```typescript
export interface PaymentKitGatewaysConfig {
  stripe?: StripeGatewayConfig;
  paypal?: PaypalGatewayConfig;
  square?: SquareGatewayConfig; // ← Add new gateway
}
```

#### 2. Update Gateway Types

**File**: [src/common/types/gateway.types.ts](../../../src/common/types/gateway.types.ts)

```typescript
/**
 * Union of all supported gateway keys.
 * Add new gateways here.
 */
export type GatewayKey = 'stripe' | 'paypal' | 'square'; // ← Add new gateway
```

#### 3. Create HTTP Client

**File**: `src/core/gateways/square/square.client.ts`

```typescript
// Low-level HTTP client for gateway API

export interface SquareClientOptions {
  config: SquareGatewayConfig;
  httpClient?: SquareHttpClient;
}

export interface SquareHttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}

export interface SquareHttpResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  body: T;
}

export type SquareHttpClient = <T = unknown>(
  request: SquareHttpRequest,
) => Promise<SquareHttpResponse<T>>;

export class SquareClient {
  private readonly httpClient: SquareHttpClient;
  private readonly baseUrl: string;

  constructor(private readonly options: SquareClientOptions) {
    this.httpClient = options.httpClient ?? this.createDefaultHttpClient();
    this.baseUrl =
      options.config.environment === 'production'
        ? 'https://connect.squareup.com'
        : 'https://connect.squareupsandbox.com';
  }

  async requestJson<T = unknown>(request: SquareHttpRequest): Promise<SquareHttpResponse<T>> {
    return this.httpClient<T>(request);
  }

  private createDefaultHttpClient(): SquareHttpClient {
    return async <T = unknown>(request: SquareHttpRequest): Promise<SquareHttpResponse<T>> => {
      const url = new URL(request.path, this.baseUrl);

      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.options.config.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': this.options.config.apiVersion ?? '2024-02-20',
      };

      if (request.idempotencyKey) {
        headers['Idempotency-Key'] = request.idempotencyKey;
      }

      let encodedBody: string | undefined;
      if (request.body !== undefined) {
        encodedBody = JSON.stringify(request.body);
      }

      const response = await fetch(url.toString(), {
        method: request.method,
        headers,
        body: encodedBody,
      });

      const responseBody = await response.json();

      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody as T,
      };
    };
  }
}
```

#### 4. Create Payment Operations Client

**File**: `src/core/gateways/square/square-payments.client.ts`

```typescript
// Payment-specific operations

export interface CreateSquarePaymentInput {
  amount: number; // cents
  currency: string;
  sourceId: string; // payment source (card token)
  locationId: string;
  idempotencyKey?: string;
}

export interface CreateSquarePaymentResult {
  ok: boolean;
  paymentId?: string;
  status?: string;
  error?: NormalizedError;
}

export interface GetSquarePaymentInput {
  paymentId: string;
}

export interface GetSquarePaymentResult {
  ok: boolean;
  payment?: SquarePayment;
  error?: NormalizedError;
}

export interface RefundSquarePaymentInput {
  paymentId: string;
  amount: number; // cents
  idempotencyKey?: string;
}

export interface RefundSquarePaymentResult {
  ok: boolean;
  refundId?: string;
  error?: NormalizedError;
}

export class SquarePaymentsClient {
  constructor(private readonly client: SquareClient) {}

  async createPayment(input: CreateSquarePaymentInput): Promise<CreateSquarePaymentResult> {
    try {
      const response = await this.client.requestJson<SquarePaymentResponse>({
        method: 'POST',
        path: '/v2/payments',
        body: {
          source_id: input.sourceId,
          idempotency_key: input.idempotencyKey ?? this.generateIdempotencyKey(),
          amount_money: {
            amount: input.amount,
            currency: input.currency,
          },
          location_id: input.locationId,
        },
        idempotencyKey: input.idempotencyKey,
      });

      if (response.status >= 400) {
        return {
          ok: false,
          error: SquareErrorMapper.map(response.body),
        };
      }

      return {
        ok: true,
        paymentId: response.body.payment.id,
        status: response.body.payment.status,
      };
    } catch (err) {
      return {
        ok: false,
        error: SquareErrorMapper.map(err),
      };
    }
  }

  async getPayment(input: GetSquarePaymentInput): Promise<GetSquarePaymentResult> {
    try {
      const response = await this.client.requestJson<SquarePaymentResponse>({
        method: 'GET',
        path: `/v2/payments/${input.paymentId}`,
      });

      if (response.status >= 400) {
        return {
          ok: false,
          error: SquareErrorMapper.map(response.body),
        };
      }

      return {
        ok: true,
        payment: response.body.payment,
      };
    } catch (err) {
      return {
        ok: false,
        error: SquareErrorMapper.map(err),
      };
    }
  }

  async refundPayment(input: RefundSquarePaymentInput): Promise<RefundSquarePaymentResult> {
    try {
      const response = await this.client.requestJson<SquareRefundResponse>({
        method: 'POST',
        path: '/v2/refunds',
        body: {
          payment_id: input.paymentId,
          idempotency_key: input.idempotencyKey ?? this.generateIdempotencyKey(),
          amount_money: {
            amount: input.amount,
            currency: 'USD', // Should come from payment
          },
        },
        idempotencyKey: input.idempotencyKey,
      });

      if (response.status >= 400) {
        return {
          ok: false,
          error: SquareErrorMapper.map(response.body),
        };
      }

      return {
        ok: true,
        refundId: response.body.refund.id,
      };
    } catch (err) {
      return {
        ok: false,
        error: SquareErrorMapper.map(err),
      };
    }
  }

  private generateIdempotencyKey(): string {
    return `square_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
```

#### 5. Create Error Mapper

**File**: `src/core/gateways/square/square-error.mapper.ts`

```typescript
import {
  NormalizedError,
  NormalizedErrorCode,
} from '../../../common/errors/normalized-error.model';

export class SquareErrorMapper {
  static map(error: unknown): NormalizedError {
    if (!error || typeof error !== 'object') {
      return {
        code: NormalizedErrorCode.Unknown,
        message: 'An unknown error occurred',
        gateway: 'square',
      };
    }

    const err = error as Record<string, unknown>;

    // Square errors have 'errors' array
    if (Array.isArray(err.errors) && err.errors.length > 0) {
      const firstError = err.errors[0];
      const category = firstError.category;
      const code = firstError.code;

      // Map Square error categories/codes to normalized codes
      const normalizedCode = this.mapSquareErrorCode(category, code);

      return {
        code: normalizedCode,
        message: firstError.detail || 'Square error occurred',
        gateway: 'square',
        details: {
          squareCategory: category,
          squareCode: code,
          originalError: firstError,
        },
      };
    }

    return {
      code: NormalizedErrorCode.Unknown,
      message: err.message ? String(err.message) : 'Square error occurred',
      gateway: 'square',
    };
  }

  private static mapSquareErrorCode(category: string, code: string): NormalizedErrorCode {
    // Map Square-specific errors to normalized codes
    switch (category) {
      case 'PAYMENT_METHOD_ERROR':
        if (code === 'CARD_DECLINED') {
          return NormalizedErrorCode.CardDeclined;
        }
        if (code === 'INSUFFICIENT_FUNDS') {
          return NormalizedErrorCode.InsufficientFunds;
        }
        return NormalizedErrorCode.PaymentMethodInvalid;

      case 'AUTHENTICATION_ERROR':
        return NormalizedErrorCode.Unauthorized;

      case 'INVALID_REQUEST_ERROR':
        return NormalizedErrorCode.InvalidRequest;

      case 'RATE_LIMIT_ERROR':
        return NormalizedErrorCode.RateLimitExceeded;

      case 'API_ERROR':
        return NormalizedErrorCode.GatewayError;

      default:
        return NormalizedErrorCode.Unknown;
    }
  }
}
```

**Update Error Normalizer**: Add to [src/core/services/error-normalizer.service.ts](../../../src/core/services/error-normalizer.service.ts)

```typescript
export class ErrorNormalizerService {
  normalize(error: unknown, context: ErrorNormalizationContext): NormalizedError {
    const { gateway } = context;

    switch (gateway) {
      case 'stripe':
        return StripeErrorMapper.map(error);
      case 'paypal':
        return PaypalErrorMapper.map(error);
      case 'square': // ← Add new gateway
        return SquareErrorMapper.map(error);
      default:
        return this.mapUnknownError(error, gateway);
    }
  }
}
```

#### 6. Implement Gateway

**File**: `src/core/gateways/square/square.gateway.ts`

```typescript
import {
  PaymentGateway,
  CreatePaymentCommand,
  CreatePaymentResult /* ... */,
} from '../../ports/payment-gateway.port';

export class SquareGateway implements PaymentGateway {
  readonly key: GatewayKey = 'square';

  constructor(private readonly client: SquarePaymentsClient) {}

  async createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
    const input: CreateSquarePaymentInput = {
      amount: command.amount.amount,
      currency: command.amount.currency,
      sourceId: command.paymentMethodId || 'cnon:card-nonce-ok', // Test nonce
      locationId: 'main', // Should come from config
      idempotencyKey: command.idempotencyKey,
    };

    const result = await this.client.createPayment(input);

    if (!result.ok) {
      return {
        payment: null,
        error: result.error,
      };
    }

    const now = new Date();

    const payment: Payment = {
      id: result.paymentId!,
      gateway: 'square',
      gatewayPaymentId: result.paymentId!,
      amount: command.amount,
      status: this.mapSquareStatus(result.status),
      createdAt: now,
      updatedAt: now,
    };

    return {
      payment,
    };
  }

  async getPaymentStatus(command: GetPaymentStatusQuery): Promise<GetPaymentStatusResult> {
    const result = await this.client.getPayment({
      paymentId: command.paymentId,
    });

    if (!result.ok) {
      return {
        payment: null,
        error: result.error,
      };
    }

    const payment: Payment = {
      id: result.payment!.id,
      gateway: 'square',
      gatewayPaymentId: result.payment!.id,
      amount: {
        currency: result.payment!.amount_money.currency,
        amount: result.payment!.amount_money.amount,
      },
      status: this.mapSquareStatus(result.payment!.status),
      createdAt: new Date(result.payment!.created_at),
      updatedAt: new Date(result.payment!.updated_at),
    };

    return {
      payment,
    };
  }

  async refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult> {
    const result = await this.client.refundPayment({
      paymentId: command.paymentId,
      amount: command.amount.amount,
      idempotencyKey: command.idempotencyKey,
    });

    if (!result.ok) {
      return {
        refund: null,
        error: result.error,
      };
    }

    const now = new Date();

    const refund: Refund = {
      id: result.refundId!,
      gateway: 'square',
      gatewayRefundId: result.refundId!,
      paymentId: command.paymentId,
      amount: command.amount,
      reason: command.reason,
      status: 'pending', // Square refunds are async
      createdAt: now,
      updatedAt: now,
    };

    return {
      refund,
    };
  }

  private mapSquareStatus(squareStatus?: string): PaymentStatus {
    switch (squareStatus) {
      case 'PENDING':
        return PaymentStatus.Pending;
      case 'APPROVED':
        return PaymentStatus.Authorized;
      case 'COMPLETED':
        return PaymentStatus.Captured;
      case 'CANCELED':
        return PaymentStatus.Canceled;
      case 'FAILED':
        return PaymentStatus.Failed;
      default:
        return PaymentStatus.Pending;
    }
  }
}
```

#### 7. Add Webhook Support

**Webhook Verifier**: `src/core/gateways/square/square-webhook-verifier.ts`
**Webhook Normalizer**: `src/core/gateways/square/square-webhook-normalizer.ts`
**Webhook Handler**: `src/core/gateways/square/square-webhook.handler.ts`

(See Stripe/PayPal implementations for reference patterns)

#### 8. Register in Module

**File**: [src/paymentKit.module.ts](../../../src/paymentKit.module.ts)

```typescript
// Add factory provider
{
  provide: SquareClient,
  useFactory: () => {
    const squareCfg = resolvedConfig.gateways.square;
    return squareCfg ? new SquareClient({ config: squareCfg }) : null;
  },
},
{
  provide: SquarePaymentsClient,
  useFactory: (client: SquareClient | null) => {
    return client ? new SquarePaymentsClient(client) : null;
  },
  inject: [SquareClient],
},
{
  provide: SquareGateway,
  useFactory: (client: SquarePaymentsClient | null) => {
    return client ? new SquareGateway(client) : null;
  },
  inject: [SquarePaymentsClient],
},

// Register in GatewayRegistry
{
  provide: GatewayRegistry,
  useFactory: (
    stripe: StripeGateway | null,
    paypal: PaypalGateway | null,
    square: SquareGateway | null, // ← Add parameter
  ) => {
    const registry = new GatewayRegistry();

    if (stripe) registry.register(stripe);
    if (paypal) registry.register(paypal);
    if (square) registry.register(square); // ← Register

    return registry;
  },
  inject: [StripeGateway, PaypalGateway, SquareGateway], // ← Add to inject
},
```

---

## Gateway Testing Patterns

### Test Structure

Each gateway should have tests for:

1. **Payment creation** (happy path + errors)
2. **Payment status retrieval** (found + not found)
3. **Refund operations** (full + partial)
4. **Error mapping** (all error codes)
5. **Webhook verification** (valid + invalid signatures)
6. **Webhook normalization** (all event types)

### Example Test Suite

```typescript
// test/unit/core/gateways/square/square.gateway.spec.ts

describe('SquareGateway', () => {
  let gateway: SquareGateway;
  let fakeClient: FakeSquarePaymentsClient;

  beforeEach(() => {
    fakeClient = new FakeSquarePaymentsClient();
    gateway = new SquareGateway(fakeClient as SquarePaymentsClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('creates payment successfully', async () => {
      fakeClient.createPaymentResult = {
        ok: true,
        paymentId: 'sq_payment_123',
        status: 'COMPLETED',
      };

      const command: CreatePaymentCommand = {
        gateway: 'square',
        amount: { currency: 'USD', amount: 1000 },
      };

      const result = await gateway.createPayment(command);

      expect(result.payment).toBeDefined();
      expect(result.payment?.id).toBe('sq_payment_123');
      expect(result.payment?.gateway).toBe('square');
      expect(result.error).toBeUndefined();
    });

    it('handles payment failure', async () => {
      fakeClient.createPaymentResult = {
        ok: false,
        error: {
          code: NormalizedErrorCode.CardDeclined,
          message: 'Card declined',
          gateway: 'square',
        },
      };

      const command: CreatePaymentCommand = {
        gateway: 'square',
        amount: { currency: 'USD', amount: 1000 },
      };

      const result = await gateway.createPayment(command);

      expect(result.payment).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(NormalizedErrorCode.CardDeclined);
    });
  });

  // More test cases...
});

// Fake client implementation
class FakeSquarePaymentsClient {
  createPaymentResult: CreateSquarePaymentResult = {
    ok: true,
    paymentId: 'sq_payment_test',
    status: 'COMPLETED',
  };

  async createPayment(input: CreateSquarePaymentInput): Promise<CreateSquarePaymentResult> {
    return this.createPaymentResult;
  }

  // Implement other methods...
}
```

---

## Gateway Maintenance

### Updating API Versions

When a gateway updates its API:

1. **Check changelog** for breaking changes
2. **Update API version** in config
3. **Test all operations** with new version
4. **Update error mappings** if error format changed
5. **Update webhook schemas** if event format changed

### Deprecating a Gateway

If removing gateway support:

1. **Mark as deprecated** in v X.Y.0
2. **Add migration guide** in documentation
3. **Remove in next major** version (X+1.0.0)
4. **Keep config validation** but return warning

---

**Remember**: Every gateway must implement the full `PaymentGateway` interface and provide comprehensive test coverage.
