# PaymentKit - Feature Development Instructions

**Last updated: February 2026**

## Before Starting

### Pre-Development Checklist

- [ ] **Search for existing implementation**: Check if similar feature exists
- [ ] **Understand scope**: Is this breaking, minor, or patch?
- [ ] **Check interfaces**: Will this change public API?
- [ ] **Review architecture**: Does it fit hexagonal pattern?
- [ ] **Plan tests**: Know what you'll test before coding
- [ ] **Update this file**: Add your feature to relevant sections

### Questions to Answer

1. **Is this a breaking change?** → Requires MAJOR version bump
2. **Does it affect all gateways?** → Update Stripe AND PayPal
3. **Is it gateway-specific?** → Keep it in gateway folder
4. **Does it change public API?** → Update `src/index.ts` exports
5. **Does it need configuration?** → Update config interfaces

---

## Implementation Checklist

### Phase 1: Design

- [ ] Define interfaces/types in `src/core/ports/` or relevant location
- [ ] Sketch out method signatures
- [ ] Document expected behavior with JSDoc
- [ ] Identify dependencies

### Phase 2: Core Implementation

- [ ] Implement domain logic (pure functions when possible)
- [ ] Add error handling (return errors, don't throw)
- [ ] Add validation at boundaries
- [ ] Keep gateway implementations independent

### Phase 3: Gateway Integration

- [ ] Update Stripe implementation (if applicable)
- [ ] Update PayPal implementation (if applicable)
- [ ] Ensure both gateways have feature parity
- [ ] Add gateway-specific tests

### Phase 4: Testing

- [ ] Write unit tests (aim for 85%+ coverage)
- [ ] Test happy paths
- [ ] Test error scenarios
- [ ] Test edge cases
- [ ] Run full test suite: `npm test`

### Phase 5: Documentation

- [ ] Update JSDoc comments
- [ ] Update README.md if public API changed
- [ ] Add example usage
- [ ] Update CHANGELOG.md

### Phase 6: Verification

- [ ] Run linter: `npm run lint:fix`
- [ ] Build successfully: `npm run build`
- [ ] All tests pass: `npm test`
- [ ] Manual testing with dev setup
- [ ] Check TypeScript strict mode compliance

---

## Adding New Gateway Methods

### Example: Add `capturePayment` Method

#### Step 1: Update Port Interface

```typescript
// src/core/ports/payment-gateway.port.ts

/**
 * Input for manually capturing an authorized payment.
 */
export interface CapturePaymentCommand {
  gateway: GatewayKey;
  /**
   * PaymentKit payment id or gateway-specific payment id.
   */
  paymentId: string;
  /**
   * Optional amount to capture (partial capture).
   * If omitted, captures full authorized amount.
   */
  amount?: Money;
  idempotencyKey?: string;
}

/**
 * Result of capturing a payment.
 */
export interface CapturePaymentResult {
  payment: Payment | null;
  error?: NormalizedError;
}

/**
 * Contract all concrete gateway implementations must fulfill.
 */
export interface PaymentGateway {
  readonly key: GatewayKey;
  createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult>;
  getPaymentStatus(command: GetPaymentStatusQuery): Promise<GetPaymentStatusResult>;
  refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult>;
  capturePayment(command: CapturePaymentCommand): Promise<CapturePaymentResult>; // ← New method
}
```

#### Step 2: Update Engine

```typescript
// src/core/services/payment-engine.service.ts

export interface PaymentEngine {
  createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult>;
  getPaymentStatus(query: GetPaymentStatusQuery): Promise<GetPaymentStatusResult>;
  refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult>;
  capturePayment(command: CapturePaymentCommand): Promise<CapturePaymentResult>; // ← Add to interface
}

export class DefaultPaymentEngine implements PaymentEngine {
  // ... existing methods

  async capturePayment(command: CapturePaymentCommand): Promise<CapturePaymentResult> {
    const gateway = this.getGatewayOrNull(command.gateway);

    if (!gateway) {
      return {
        payment: null,
        error: this.buildGatewayNotConfiguredError(command.gateway),
      };
    }

    try {
      const result = await gateway.capturePayment(command);

      if (result.error) {
        return {
          ...result,
          error: this.ensureGatewayOnError(result.error, command.gateway),
        };
      }

      return result;
    } catch (err) {
      const normalized = this.errorNormalizer.normalize(err, {
        gateway: command.gateway,
      });

      return {
        payment: null,
        error: normalized,
      };
    }
  }
}
```

#### Step 3: Implement in Stripe Gateway

```typescript
// src/core/gateways/stripe/stripe-payments.client.ts

export interface CaptureStripePaymentInput {
  paymentIntentId: string;
  amount?: number; // cents
  idempotencyKey?: string;
}

export interface CaptureStripePaymentResult {
  ok: boolean;
  paymentIntentId?: string;
  status?: string;
  error?: NormalizedError;
}

export class StripePaymentsClient {
  // ... existing methods

  async capturePayment(input: CaptureStripePaymentInput): Promise<CaptureStripePaymentResult> {
    try {
      const body: Record<string, unknown> = {};

      if (input.amount !== undefined) {
        body.amount_to_capture = input.amount;
      }

      const response = await this.client.requestJson<StripePaymentIntent>({
        method: 'POST',
        path: `/payment_intents/${input.paymentIntentId}/capture`,
        body,
        idempotencyKey: input.idempotencyKey,
      });

      if (response.status >= 400) {
        return {
          ok: false,
          error: StripeErrorMapper.map(response.body),
        };
      }

      return {
        ok: true,
        paymentIntentId: response.body.id,
        status: response.body.status,
      };
    } catch (err) {
      return {
        ok: false,
        error: StripeErrorMapper.map(err),
      };
    }
  }
}
```

```typescript
// src/core/gateways/stripe/stripe.gateway.ts

export class StripeGateway implements PaymentGateway {
  // ... existing methods

  async capturePayment(command: CapturePaymentCommand): Promise<CapturePaymentResult> {
    const input: CaptureStripePaymentInput = {
      paymentIntentId: command.paymentId,
      amount: command.amount ? command.amount.amount : undefined,
      idempotencyKey: command.idempotencyKey,
    };

    const result = await this.client.capturePayment(input);

    if (!result.ok) {
      return {
        payment: null,
        error: result.error,
      };
    }

    const now = new Date();

    const payment: Payment = {
      id: result.paymentIntentId!,
      gateway: 'stripe',
      gatewayPaymentId: result.paymentIntentId!,
      amount: command.amount ?? { currency: 'USD', amount: 0 }, // Would need to fetch actual amount
      status: mapStripeStatusToPaymentStatus(result.status),
      createdAt: now,
      updatedAt: now,
    };

    return {
      payment,
    };
  }
}
```

#### Step 4: Implement in PayPal Gateway

```typescript
// src/core/gateways/paypal/paypal-payments.client.ts

export interface CapturePaypalPaymentInput {
  orderId: string;
  amount?: { value: string; currency_code: string };
  idempotencyKey?: string;
}

export interface CapturePaypalPaymentResult {
  ok: boolean;
  captureId?: string;
  status?: string;
  error?: NormalizedError;
}

export class PaypalPaymentsClient {
  // ... existing methods

  async capturePayment(input: CapturePaypalPaymentInput): Promise<CapturePaypalPaymentResult> {
    try {
      const response = await this.client.requestJson<PaypalCaptureResponse>({
        method: 'POST',
        path: `/v2/checkout/orders/${input.orderId}/capture`,
        body: input.amount ? { amount: input.amount } : undefined,
        idempotencyKey: input.idempotencyKey,
      });

      if (response.status >= 400) {
        return {
          ok: false,
          error: PaypalErrorMapper.map(response.body),
        };
      }

      const capture = response.body.purchase_units?.[0]?.payments?.captures?.[0];

      return {
        ok: true,
        captureId: capture?.id,
        status: capture?.status,
      };
    } catch (err) {
      return {
        ok: false,
        error: PaypalErrorMapper.map(err),
      };
    }
  }
}
```

```typescript
// src/core/gateways/paypal/paypal.gateway.ts

export class PaypalGateway implements PaymentGateway {
  // ... existing methods

  async capturePayment(command: CapturePaymentCommand): Promise<CapturePaymentResult> {
    const input: CapturePaypalPaymentInput = {
      orderId: command.paymentId,
      amount: command.amount
        ? {
            value: (command.amount.amount / 100).toFixed(2),
            currency_code: command.amount.currency,
          }
        : undefined,
      idempotencyKey: command.idempotencyKey,
    };

    const result = await this.client.capturePayment(input);

    if (!result.ok) {
      return {
        payment: null,
        error: result.error,
      };
    }

    const now = new Date();

    const payment: Payment = {
      id: result.captureId!,
      gateway: 'paypal',
      gatewayPaymentId: result.captureId!,
      amount: command.amount ?? { currency: 'USD', amount: 0 },
      status: mapPaypalStatusToPaymentStatus(result.status),
      createdAt: now,
      updatedAt: now,
    };

    return {
      payment,
    };
  }
}
```

#### Step 5: Update Public API

```typescript
// src/nest/services/payments.service.ts

@Injectable()
export class PaymentsService {
  constructor(private readonly engine: DefaultPaymentEngine) {}

  // ... existing methods

  capturePayment(command: CapturePaymentCommand): Promise<CapturePaymentResult> {
    return this.engine.capturePayment(command);
  }
}
```

```typescript
// src/index.ts

export type {
  CapturePaymentCommand,
  CapturePaymentResult,
  // ... other exports
} from './core/ports/payment-gateway.port';
```

#### Step 6: Write Tests

```typescript
// test/unit/core/gateways/stripe/stripe.gateway.spec.ts

describe('StripeGateway', () => {
  // ... existing tests

  describe('capturePayment', () => {
    it('captures authorized payment successfully', async () => {
      // Arrange
      const fake = new FakeStripePaymentsClient();
      fake.capturePaymentResult = {
        ok: true,
        paymentIntentId: 'pi_123',
        status: 'succeeded',
      };

      const gateway = new StripeGateway(fake as StripePaymentsClient);
      const command: CapturePaymentCommand = {
        gateway: 'stripe',
        paymentId: 'pi_123',
      };

      // Act
      const result = await gateway.capturePayment(command);

      // Assert
      expect(result.payment).toBeDefined();
      expect(result.payment?.status).toBe(PaymentStatus.Captured);
      expect(result.error).toBeUndefined();
    });

    it('handles partial capture', async () => {
      const fake = new FakeStripePaymentsClient();
      fake.capturePaymentResult = {
        ok: true,
        paymentIntentId: 'pi_123',
        status: 'succeeded',
      };

      const gateway = new StripeGateway(fake as StripePaymentsClient);
      const command: CapturePaymentCommand = {
        gateway: 'stripe',
        paymentId: 'pi_123',
        amount: { currency: 'USD', amount: 500 },
      };

      const result = await gateway.capturePayment(command);

      expect(result.payment).toBeDefined();
    });

    it('returns error when capture fails', async () => {
      const fake = new FakeStripePaymentsClient();
      fake.capturePaymentResult = {
        ok: false,
        error: {
          code: NormalizedErrorCode.InvalidRequest,
          message: 'Payment intent not authorized',
          gateway: 'stripe',
        },
      };

      const gateway = new StripeGateway(fake as StripePaymentsClient);
      const command: CapturePaymentCommand = {
        gateway: 'stripe',
        paymentId: 'pi_123',
      };

      const result = await gateway.capturePayment(command);

      expect(result.payment).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(NormalizedErrorCode.InvalidRequest);
    });
  });
});
```

---

## Adding Configuration Options

### Example: Add Custom Timeouts

#### Step 1: Update Config Interface

```typescript
// src/config/paymentKit.config.ts

export interface PaymentKitPublicConfig {
  environment: PaymentKitEnvironment;
  defaultCurrency: string;
  gateways: PaymentKitGatewaysConfig;
  webhooks?: PaymentKitWebhookConfig;
  timeouts?: PaymentKitTimeoutConfig; // ← New optional config
}

export interface PaymentKitTimeoutConfig {
  /**
   * Request timeout in milliseconds for payment operations.
   * Default: 30000 (30 seconds)
   */
  requestTimeout?: number;
  /**
   * Webhook processing timeout in milliseconds.
   * Default: 10000 (10 seconds)
   */
  webhookTimeout?: number;
}
```

#### Step 2: Add Validation

```typescript
// src/config/paymentKit.config.ts

export function validatePaymentKitPublicConfig(raw: unknown): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = [];

  // ... existing validation

  // Validate timeouts
  const rawTimeouts = obj.timeouts;
  if (rawTimeouts !== undefined) {
    if (typeof rawTimeouts !== 'object' || rawTimeouts === null) {
      issues.push({
        path: 'timeouts',
        message: 'timeouts must be an object if provided',
        code: 'TIMEOUTS_NOT_OBJECT',
      });
    } else {
      const timeoutsObj = rawTimeouts as Record<string, unknown>;

      if (
        timeoutsObj.requestTimeout !== undefined &&
        (typeof timeoutsObj.requestTimeout !== 'number' || timeoutsObj.requestTimeout <= 0)
      ) {
        issues.push({
          path: 'timeouts.requestTimeout',
          message: 'requestTimeout must be a positive number',
          code: 'REQUEST_TIMEOUT_INVALID',
        });
      }

      if (
        timeoutsObj.webhookTimeout !== undefined &&
        (typeof timeoutsObj.webhookTimeout !== 'number' || timeoutsObj.webhookTimeout <= 0)
      ) {
        issues.push({
          path: 'timeouts.webhookTimeout',
          message: 'webhookTimeout must be a positive number',
          code: 'WEBHOOK_TIMEOUT_INVALID',
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
```

#### Step 3: Add Defaults in Resolved Config

```typescript
// src/config/paymentKit.config-loader.ts

export interface PaymentKitResolvedConfig {
  environment: PaymentKitEnvironment;
  defaultCurrency: string;
  gateways: PaymentKitResolvedGateways;
  webhooks: PaymentKitResolvedWebhooks;
  timeouts: Required<PaymentKitTimeoutConfig>; // ← Always present with defaults
}

export class PaymentKitConfigLoader {
  static loadFromEnv(
    rawConfig: PaymentKitPublicConfig,
    env: GenericEnv = process.env,
  ): PaymentKitResolvedConfig {
    const validConfig = parsePaymentKitPublicConfig(rawConfig);

    // ... existing logic

    const timeouts: Required<PaymentKitTimeoutConfig> = {
      requestTimeout: validConfig.timeouts?.requestTimeout ?? 30000,
      webhookTimeout: validConfig.timeouts?.webhookTimeout ?? 10000,
    };

    return {
      environment,
      defaultCurrency,
      gateways: resolvedGateways,
      webhooks: { mode: webhookMode },
      timeouts, // ← Add to resolved config
    };
  }
}
```

#### Step 4: Use in HTTP Clients

```typescript
// src/core/gateways/stripe/stripe.client.ts

export class StripeClient {
  constructor(
    private readonly options: StripeClientOptions,
    private readonly timeout: number = 30000, // ← Accept timeout
  ) {
    this.httpClient = options.httpClient ?? this.createDefaultHttpClient();
  }

  private createDefaultHttpClient(): StripeHttpClient {
    return async <T = unknown>(request: StripeHttpRequest): Promise<StripeHttpResponse<T>> => {
      // ... setup

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(url.toString(), {
          method: request.method,
          headers,
          body: encodedBody,
          signal: controller.signal, // ← Use timeout
        });

        clearTimeout(timeoutId);

        // ... rest of implementation
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };
  }
}
```

#### Step 5: Wire in Module

```typescript
// src/paymentKit.module.ts

{
  provide: StripeClient,
  useFactory: () => {
    const stripeCfg = resolvedConfig.gateways.stripe;
    return stripeCfg
      ? new StripeClient(
          { config: stripeCfg },
          resolvedConfig.timeouts.requestTimeout, // ← Pass timeout
        )
      : null;
  },
}
```

#### Step 6: Update Documentation

````typescript
// README.md

```ts
PaymentKitModule.register({
  environment: 'sandbox',
  defaultCurrency: 'USD',
  gateways: {
    stripe: { enabled: true },
  },
  timeouts: {
    requestTimeout: 60000, // 60 seconds
    webhookTimeout: 15000, // 15 seconds
  },
});
````

---

## Adding Webhook Event Types

### Example: Add `payment.partially_refunded` Event

#### Step 1: Update Types

```typescript
// src/common/types/webhook.types.ts

export type WebhookEventType =
  | 'payment.created'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.refunded'
  | 'payment.partially_refunded' // ← New event type
  | 'refund.created'
  | 'refund.failed';
```

#### Step 2: Map in Normalizers

```typescript
// src/core/gateways/stripe/stripe-webhook-normalizer.ts

function mapStripeEventType(stripeType: string): WebhookEventType | (string & {}) {
  const mapping: Record<string, WebhookEventType> = {
    'payment_intent.succeeded': 'payment.succeeded',
    'payment_intent.payment_failed': 'payment.failed',
    'payment_intent.created': 'payment.created',
    'charge.refunded': 'payment.refunded',
    'charge.refund.updated': 'payment.partially_refunded', // ← New mapping
    // ...
  };

  return mapping[stripeType] ?? `stripe.${stripeType}`;
}
```

```typescript
// src/core/gateways/paypal/paypal-webhook-normalizer.ts

function mapPaypalEventTypeToWebhookEventType(eventType: string): WebhookEventType | (string & {}) {
  const mapping: Record<string, WebhookEventType> = {
    'PAYMENT.CAPTURE.COMPLETED': 'payment.succeeded',
    'PAYMENT.CAPTURE.DENIED': 'payment.failed',
    'PAYMENT.CAPTURE.REFUNDED': 'payment.refunded',
    'PAYMENT.CAPTURE.PARTIALLY_REFUNDED': 'payment.partially_refunded', // ← New mapping
    // ...
  };

  return mapping[eventType] ?? eventType;
}
```

#### Step 3: Test Event Normalization

```typescript
// test/unit/core/gateways/stripe/stripe-webhook-normalizer.spec.ts

it('maps charge.refund.updated to payment.partially_refunded', () => {
  const raw = {
    id: 'evt_123',
    type: 'charge.refund.updated',
    created: 1700000000,
    data: { object: { id: 're_123', amount: 500 } },
  };

  const [event] = normalizeStripeWebhook(raw);

  expect(event.type).toBe('payment.partially_refunded');
  expect(event.gateway).toBe('stripe');
});
```

---

## Backwards Compatibility Guidelines

### DO: Add Optional Parameters

```typescript
// ✅ GOOD: Add optional field to command
export interface CreatePaymentCommand {
  gateway: GatewayKey;
  amount: Money;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  description?: string; // ← New optional field, no breaking change
}
```

### DO: Add New Methods to Interfaces

```typescript
// ✅ GOOD: Provide default implementation for new methods
export interface PaymentGateway {
  createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult>;
  // ... existing methods

  // New optional method with default behavior
  validatePayment?(command: ValidatePaymentCommand): Promise<ValidatePaymentResult>;
}

// In implementations, it's optional
export class StripeGateway implements PaymentGateway {
  // Can choose to implement or not
  validatePayment(command: ValidatePaymentCommand): Promise<ValidatePaymentResult> {
    // Implementation
  }
}
```

### DO: Deprecate Before Removing

```typescript
// ✅ GOOD: Mark as deprecated, remove in next major version
/**
 * @deprecated Use createPayment instead. Will be removed in v2.0.0
 */
export interface LegacyCreatePaymentCommand {
  // ...
}
```

### DON'T: Change Return Types

```typescript
// ❌ BAD: Changes return type (breaking)
// Before
createPayment(): Promise<CreatePaymentResult>

// After
createPayment(): Promise<CreatePaymentResult | null>

// ✅ GOOD: Keep return type, add optional field
export interface CreatePaymentResult {
  payment: Payment | null;
  nextAction?: NextAction;
  error?: NormalizedError;
  warnings?: string[]; // ← New optional field
}
```

### DON'T: Remove Public Exports

```typescript
// ❌ BAD: Removing export (breaking)
// Before: export { StripeGateway }
// After: (removed)

// ✅ GOOD: Deprecate first, remove in major version
/**
 * @deprecated Internal implementation, will be removed in v2.0.0
 * @internal
 */
export { StripeGateway } from './core/gateways/stripe/stripe.gateway';
```

### DON'T: Rename Public APIs

```typescript
// ❌ BAD: Renaming (breaking)
// Before
export interface CreatePaymentCommand {}

// After
export interface PaymentCreationCommand {}

// ✅ GOOD: Keep old name, alias to new
export interface CreatePaymentCommand {}
/** @deprecated Use CreatePaymentCommand */
export type PaymentCreationCommand = CreatePaymentCommand;
```

---

## Deprecation Process

### Step 1: Mark as Deprecated

```typescript
/**
 * @deprecated Use createPayment instead. This method will be removed in v2.0.0.
 * See migration guide: https://github.com/org/paymentkit/docs/migration-v2.md
 */
export interface OldMethod {
  // ...
}
```

### Step 2: Add Warning in Implementation

```typescript
export class PaymentsService {
  /**
   * @deprecated Use createPayment instead
   */
  legacyCreatePayment(command: LegacyCreatePaymentCommand) {
    // Log deprecation warning
    console.warn(
      'PaymentKit: legacyCreatePayment is deprecated and will be removed in v2.0.0. ' +
        'Please use createPayment instead.',
    );

    // Forward to new method
    return this.createPayment(this.convertLegacyCommand(command));
  }
}
```

### Step 3: Document in CHANGELOG

```markdown
## [1.5.0] - 2026-02-15

### Deprecated

- `legacyCreatePayment` - Use `createPayment` instead. Will be removed in v2.0.0.
```

### Step 4: Remove in Next Major Version

```typescript
// v2.0.0 - Remove deprecated code
// export function legacyCreatePayment() { } ← Removed

// Document in CHANGELOG
## [2.0.0] - 2026-06-01

### Breaking Changes
- Removed `legacyCreatePayment` (deprecated in v1.5.0). Use `createPayment` instead.
```

---

## Example: Complete Feature Walkthrough

### Feature: Add Payment Cancellation

**Goal**: Allow users to cancel a payment before it's captured.

#### 1. Design

- **Interface**: Add `cancelPayment` method to `PaymentGateway`
- **Command**: `CancelPaymentCommand { gateway, paymentId, reason? }`
- **Result**: `CancelPaymentResult { payment?, error? }`
- **Gateways**: Stripe supports cancellation, PayPal may not (handle gracefully)

#### 2. Update Interfaces

```typescript
// src/core/ports/payment-gateway.port.ts

export interface CancelPaymentCommand {
  gateway: GatewayKey;
  paymentId: string;
  reason?: string;
}

export interface CancelPaymentResult {
  payment: Payment | null;
  error?: NormalizedError;
}

export interface PaymentGateway {
  // ... existing methods
  cancelPayment(command: CancelPaymentCommand): Promise<CancelPaymentResult>;
}
```

#### 3. Implement in Engine

```typescript
// src/core/services/payment-engine.service.ts

async cancelPayment(command: CancelPaymentCommand): Promise<CancelPaymentResult> {
  const gateway = this.getGatewayOrNull(command.gateway);

  if (!gateway) {
    return {
      payment: null,
      error: this.buildGatewayNotConfiguredError(command.gateway),
    };
  }

  try {
    return await gateway.cancelPayment(command);
  } catch (err) {
    return {
      payment: null,
      error: this.errorNormalizer.normalize(err, { gateway: command.gateway }),
    };
  }
}
```

#### 4. Implement in Gateways (Stripe, PayPal)

#### 5. Write Tests (15+ test cases covering all scenarios)

#### 6. Update Public API & Documentation

#### 7. Verify & Release

**Version**: `1.2.0` (new feature, backwards-compatible)

---

**Remember**: Every feature should enhance the package without breaking existing functionality. When in doubt, make it optional and backwards-compatible.
