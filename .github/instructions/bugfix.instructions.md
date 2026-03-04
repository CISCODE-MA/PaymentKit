# PaymentKit - Bug Fix Instructions

**Last updated: February 2026**

## Bug Investigation Process

### Phase 1: Understand the Issue

1. **Reproduce the bug**: Create a minimal test case
2. **Identify affected gateway**: Stripe, PayPal, or both?
3. **Check related code**: Search for similar patterns
4. **Review recent changes**: Check git history for related commits
5. **Read error messages**: Use NormalizedError codes to trace source

### Questions to Answer

- [ ] Can you reproduce it consistently?
- [ ] Is it environment-specific (sandbox vs production)?
- [ ] Is it gateway-specific or affects all gateways?
- [ ] Does it happen with specific configurations only?
- [ ] Are there any error codes or stack traces?
- [ ] When did it start happening? (recent change?)

---

## Common Bug Categories

### 1. Payment Creation Failures

#### Symptoms

- `createPayment` returns error
- Payment stuck in pending state
- Missing required fields error

#### Investigation Steps

```typescript
// Step 1: Check command validation
const command: CreatePaymentCommand = {
  gateway: 'stripe',
  amount: { currency: 'USD', amount: 1000 },
  // Missing required fields?
};

// Step 2: Enable debug logging (add to gateway implementation)
console.log('[DEBUG] CreatePayment command:', JSON.stringify(command, null, 2));

// Step 3: Check gateway-specific error mapping
// Look in: src/core/gateways/stripe/stripe-error.mapper.ts
```

#### Common Causes

**Missing Currency**

```typescript
// ❌ BAD
const amount = { amount: 1000 }; // Missing currency

// ✅ FIX
const amount = { currency: 'USD', amount: 1000 };
```

**Wrong Amount Format**

```typescript
// ❌ BAD (Stripe expects cents, not dollars)
const amount = { currency: 'USD', amount: 10.5 }; // Should be 1050

// ✅ FIX
const amount = { currency: 'USD', amount: 1050 }; // 1050 cents = $10.50
```

**Invalid Gateway Configuration**

```typescript
// Check: Is gateway properly configured?
// File: src/config/paymentKit.config.ts

// If gateway is null, fix config:
PaymentKitModule.register({
  gateways: {
    stripe: {
      enabled: true, // ← Must be true
      apiVersion: '2023-10-16',
    },
  },
});
```

#### Fix Template

```typescript
// test/unit/core/gateways/stripe/stripe.gateway.spec.ts

describe('StripeGateway - Bug Fix: Payment Creation', () => {
  it('should handle missing currency gracefully', async () => {
    // Arrange: Setup fake client
    const fakeClient = new FakeStripePaymentsClient();
    const gateway = new StripeGateway(fakeClient as StripePaymentsClient);

    // Act: Create payment with missing currency
    const command: CreatePaymentCommand = {
      gateway: 'stripe',
      amount: { currency: '', amount: 1000 }, // Invalid currency
    };

    const result = await gateway.createPayment(command);

    // Assert: Should return error, not throw
    expect(result.payment).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe(NormalizedErrorCode.InvalidRequest);
  });
});
```

---

### 2. Webhook Verification Failures

#### Symptoms

- Webhooks not being processed
- "Invalid signature" errors
- Events not dispatched to listeners

#### Investigation Steps

```typescript
// Step 1: Check webhook signature verification
// File: src/core/gateways/stripe/stripe-webhook-verifier.ts

// Step 2: Verify webhook secret is correct
// Check environment variables or config

// Step 3: Test with raw webhook payload
const rawPayload = `{"id":"evt_123","type":"payment_intent.succeeded"}`;
const signature = 'computed_signature_from_stripe';

const isValid = await verifier.verify(rawPayload, signature);
console.log('[DEBUG] Webhook verification:', isValid);
```

#### Common Causes

**Wrong Webhook Secret**

```typescript
// ❌ BAD: Using test secret in production
PAYMENTKIT_STRIPE_WEBHOOK_SECRET = whsec_test_123;

// ✅ FIX: Use production secret
PAYMENTKIT_STRIPE_WEBHOOK_SECRET = whsec_live_456;
```

**Incorrect Signature Header**

```typescript
// ❌ BAD: Wrong header name
const signature = req.headers['x-stripe-signature'];

// ✅ FIX: Correct header name
const signature = req.headers['stripe-signature'];
```

**Body Parser Issues**

```typescript
// ❌ BAD: Body parser alters raw body
app.use(express.json()); // ← This parses JSON, breaking signature

// ✅ FIX: Use raw body for webhook routes
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body.toString(); // ← Raw string for verification
  // ...
});
```

**Missing Signature Timestamp**

```typescript
// Stripe signature format: t=timestamp,v1=signature

// Check timestamp tolerance (default 5 minutes)
// If webhooks are delayed, increase tolerance:

const verifier = new StripeWebhookVerifier({
  secret: config.webhookSecret,
  tolerance: 600, // 10 minutes (in seconds)
});
```

#### Fix Template

```typescript
// test/unit/core/gateways/stripe/stripe-webhook-verifier.spec.ts

describe('StripeWebhookVerifier - Bug Fix: Signature Verification', () => {
  it('should reject expired signatures', async () => {
    // Arrange
    const secret = 'whsec_test_secret';
    const verifier = new StripeWebhookVerifier({ secret, tolerance: 300 });

    // Create payload with old timestamp (10 minutes ago)
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
    const payload = JSON.stringify({ id: 'evt_123', type: 'test' });
    const signature = `t=${oldTimestamp},v1=fake_signature`;

    // Act
    const result = await verifier.verify(payload, signature);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('timestamp too old');
  });

  it('should accept valid signatures within tolerance', async () => {
    const secret = 'whsec_test_secret';
    const verifier = new StripeWebhookVerifier({ secret });

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ id: 'evt_123' });

    // Compute actual HMAC signature
    const signature = computeStripeSignature(payload, secret, currentTimestamp);

    const result = await verifier.verify(payload, signature);

    expect(result.isValid).toBe(true);
  });
});
```

---

### 3. Error Mapping Issues

#### Symptoms

- Generic errors instead of specific ones
- Wrong `NormalizedErrorCode` returned
- Missing error details

#### Investigation Steps

```typescript
// Step 1: Check gateway error response
console.log('[DEBUG] Gateway raw error:', JSON.stringify(gatewayError, null, 2));

// Step 2: Verify error mapper handles this case
// File: src/core/gateways/stripe/stripe-error.mapper.ts

// Step 3: Check normalized error
console.log('[DEBUG] Normalized error:', normalizedError);
```

#### Common Causes

**Unmapped Gateway Error Code**

```typescript
// ❌ BAD: Gateway error code not handled
// src/core/gateways/stripe/stripe-error.mapper.ts

export class StripeErrorMapper {
  static map(error: unknown): NormalizedError {
    // Missing case for 'card_declined'
    switch (errorCode) {
      case 'insufficient_funds':
        return { code: NormalizedErrorCode.InsufficientFunds, ... };
      // Missing: case 'card_declined'
      default:
        return { code: NormalizedErrorCode.Unknown, ... };
    }
  }
}

// ✅ FIX: Add missing error code
export class StripeErrorMapper {
  static map(error: unknown): NormalizedError {
    switch (errorCode) {
      case 'insufficient_funds':
        return { code: NormalizedErrorCode.InsufficientFunds, ... };

      case 'card_declined': // ← Add missing case
        return {
          code: NormalizedErrorCode.CardDeclined,
          message: 'Card was declined',
          gateway: 'stripe',
          details: { stripeCode: 'card_declined' },
        };

      default:
        return { code: NormalizedErrorCode.Unknown, ... };
    }
  }
}
```

**Lost Error Details**

```typescript
// ❌ BAD: Losing gateway-specific details
return {
  code: NormalizedErrorCode.Unknown,
  message: 'Error occurred',
  gateway: 'stripe',
  // Missing: details with original error info
};

// ✅ FIX: Preserve gateway details
return {
  code: NormalizedErrorCode.Unknown,
  message: error.message || 'Error occurred',
  gateway: 'stripe',
  details: {
    stripeCode: error.code,
    stripeType: error.type,
    declineCode: error.decline_code,
    originalError: error,
  },
};
```

#### Fix Template

```typescript
// test/unit/core/services/error-mapping/stripe-error-mapper.spec.ts

describe('StripeErrorMapper - Bug Fix: Card Declined', () => {
  it('should map card_declined to CardDeclined code', () => {
    // Arrange
    const stripeError = {
      type: 'card_error',
      code: 'card_declined',
      message: 'Your card was declined',
      decline_code: 'generic_decline',
    };

    // Act
    const normalized = StripeErrorMapper.map(stripeError);

    // Assert
    expect(normalized.code).toBe(NormalizedErrorCode.CardDeclined);
    expect(normalized.message).toContain('declined');
    expect(normalized.details?.stripeCode).toBe('card_declined');
    expect(normalized.details?.declineCode).toBe('generic_decline');
  });
});
```

---

### 4. Configuration Issues

#### Symptoms

- Gateway not initialized
- "Gateway not configured" errors
- Environment variables not loaded

#### Investigation Steps

```typescript
// Step 1: Check resolved config
// File: src/config/paymentKit.config-loader.ts

// Step 2: Verify environment variables
console.log('PAYMENTKIT_STRIPE_ENABLED:', process.env.PAYMENTKIT_STRIPE_ENABLED);
console.log(
  'PAYMENTKIT_STRIPE_SECRET_KEY:',
  process.env.PAYMENTKIT_STRIPE_SECRET_KEY ? '***' : 'MISSING',
);

// Step 3: Check gateway factory
// File: src/paymentKit.module.ts
```

#### Common Causes

**Environment Variables Not Loaded**

```typescript
// ❌ BAD: Accessing env vars before they're loaded
const config = PaymentKitModule.register({
  gateways: {
    stripe: {
      enabled: process.env.STRIPE_ENABLED === 'true', // ← Won't work
    },
  },
});

// ✅ FIX: Use config loader
const config = PaymentKitConfigLoader.loadFromEnv({
  environment: 'sandbox',
  defaultCurrency: 'USD',
  gateways: {
    stripe: { enabled: true }, // ← Loader reads from env
  },
});
```

**Validation Errors Ignored**

```typescript
// ❌ BAD: Not checking validation result
const config = PaymentKitConfigLoader.loadFromEnv(rawConfig);

// ✅ FIX: Check for validation errors
const result = validatePaymentKitPublicConfig(rawConfig);
if (!result.valid) {
  console.error('Config validation failed:', result.issues);
  throw new ConfigValidationError(result.issues);
}
```

**Wrong Environment**

```typescript
// ❌ BAD: Using sandbox keys in production
PaymentKitModule.register({
  environment: 'production', // ← Says production
  gateways: {
    stripe: {
      // But using sandbox keys
      secretKey: 'sk_test_123',
    },
  },
});

// ✅ FIX: Match environment to keys
PaymentKitModule.register({
  environment: 'production',
  gateways: {
    stripe: {
      secretKey: 'sk_live_123', // ← Production key
    },
  },
});
```

#### Fix Template

```typescript
// test/unit/config/paymentKit.config-loader.spec.ts

describe('PaymentKitConfigLoader - Bug Fix: Missing Env Vars', () => {
  it('should throw descriptive error when secret key is missing', () => {
    // Arrange
    const rawConfig: PaymentKitPublicConfig = {
      environment: 'sandbox',
      defaultCurrency: 'USD',
      gateways: {
        stripe: { enabled: true },
      },
    };

    const env = {
      PAYMENTKIT_STRIPE_ENABLED: 'true',
      // Missing: PAYMENTKIT_STRIPE_SECRET_KEY
    };

    // Act & Assert
    expect(() => {
      PaymentKitConfigLoader.loadFromEnv(rawConfig, env);
    }).toThrow(/PAYMENTKIT_STRIPE_SECRET_KEY.*required/i);
  });
});
```

---

### 5. Gateway-Specific Issues

#### Stripe: Payment Intent Status Confusion

```typescript
// Problem: Mapping Stripe status to PaymentKit status

// Stripe has many statuses:
// - requires_payment_method
// - requires_confirmation
// - requires_action
// - processing
// - succeeded
// - canceled

// PaymentKit has fewer:
export enum PaymentStatus {
  Pending = 'pending',
  Authorized = 'authorized',
  Captured = 'captured',
  Failed = 'failed',
  Canceled = 'canceled',
  Refunded = 'refunded',
}

// ✅ FIX: Map correctly
function mapStripeStatusToPaymentStatus(stripeStatus: string): PaymentStatus {
  switch (stripeStatus) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
    case 'processing':
      return PaymentStatus.Pending;

    case 'requires_capture':
      return PaymentStatus.Authorized;

    case 'succeeded':
      return PaymentStatus.Captured;

    case 'canceled':
      return PaymentStatus.Canceled;

    default:
      return PaymentStatus.Pending; // Default to pending for unknown
  }
}
```

#### PayPal: Order vs Capture Confusion

```typescript
// Problem: PayPal has Orders and Captures as separate entities

// ❌ BAD: Treating order ID as payment ID
const payment: Payment = {
  id: paypalOrderId, // ← This is the order, not the payment
  gatewayPaymentId: paypalOrderId,
};

// ✅ FIX: Use capture ID
const payment: Payment = {
  id: paypalCaptureId, // ← Use the capture ID
  gatewayPaymentId: paypalCaptureId,
  metadata: {
    orderId: paypalOrderId, // ← Store order ID in metadata
  },
};
```

---

## Debugging Tips

### Enable Verbose Logging

```typescript
// Add to gateway implementation temporarily
export class StripeGateway implements PaymentGateway {
  async createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
    console.log('[STRIPE] createPayment called:', JSON.stringify(command, null, 2));

    const result = await this.client.createPayment(input);

    console.log('[STRIPE] createPayment result:', JSON.stringify(result, null, 2));

    return result;
  }
}
```

### Use Fake Clients in Tests

```typescript
// Don't make real API calls during debugging

class FakeStripePaymentsClient {
  createPaymentResult: CreateStripePaymentResult = {
    ok: true,
    paymentIntentId: 'pi_test_123',
    clientSecret: 'secret_123',
  };

  async createPayment(input: CreateStripePaymentInput): Promise<CreateStripePaymentResult> {
    console.log('[FAKE] createPayment called with:', input);
    return this.createPaymentResult;
  }
}

// Set specific behaviors
const fake = new FakeStripePaymentsClient();
fake.createPaymentResult = {
  ok: false,
  error: { code: NormalizedErrorCode.InvalidRequest, ... },
};
```

### Use Git Bisect for Regressions

```bash
# Find which commit introduced the bug
git bisect start
git bisect bad              # Current version is broken
git bisect good v1.0.0      # v1.0.0 was working

# Git will checkout commits for you to test
npm test                    # Run your test
git bisect good             # If test passes
# or
git bisect bad              # If test fails

# Repeat until git finds the breaking commit
```

### Check Gateway Webhooks Logs

```bash
# Stripe CLI for testing webhooks locally
stripe listen --forward-to localhost:3000/webhooks/stripe

# Trigger test event
stripe trigger payment_intent.succeeded
```

---

## Bug Fix Workflow

### Step 1: Write Failing Test

```typescript
// ALWAYS write a test that reproduces the bug first

describe('Bug #123: Payment creation fails with special characters', () => {
  it('should handle special characters in metadata', async () => {
    const gateway = new StripeGateway(fakeClient);

    const command: CreatePaymentCommand = {
      gateway: 'stripe',
      amount: { currency: 'USD', amount: 1000 },
      metadata: {
        description: 'Order #123: "Special" & <tags>',
      },
    };

    const result = await gateway.createPayment(command);

    expect(result.payment).toBeDefined();
    expect(result.error).toBeUndefined();
  });
});
```

### Step 2: Fix the Bug

```typescript
// Make the test pass with the smallest change possible

export class StripePaymentsClient {
  async createPayment(input: CreateStripePaymentInput): Promise<CreateStripePaymentResult> {
    const body = {
      amount: input.amount,
      currency: input.currency,
      metadata: this.sanitizeMetadata(input.metadata), // ← Fix
    };

    // ...
  }

  private sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, string> {
    if (!metadata) return {};

    return Object.entries(metadata).reduce(
      (acc, [key, value]) => {
        acc[key] = String(value); // ← Ensure all values are strings
        return acc;
      },
      {} as Record<string, string>,
    );
  }
}
```

### Step 3: Verify Fix

```bash
# Run the specific test
npm test -- bug-123.spec.ts

# Run all tests to ensure no regressions
npm test

# Run linter
npm run lint:fix

# Build to check TypeScript
npm run build
```

### Step 4: Add Edge Case Tests

```typescript
// Add more tests for related scenarios

describe('Bug #123: Metadata handling', () => {
  it('should handle special characters in metadata', () => {
    /* ... */
  });

  it('should handle empty metadata', async () => {
    const result = await gateway.createPayment({
      gateway: 'stripe',
      amount: { currency: 'USD', amount: 1000 },
      metadata: {},
    });

    expect(result.payment).toBeDefined();
  });

  it('should handle undefined metadata', async () => {
    const result = await gateway.createPayment({
      gateway: 'stripe',
      amount: { currency: 'USD', amount: 1000 },
      // metadata: undefined,
    });

    expect(result.payment).toBeDefined();
  });

  it('should handle nested objects in metadata', async () => {
    const result = await gateway.createPayment({
      gateway: 'stripe',
      amount: { currency: 'USD', amount: 1000 },
      metadata: {
        nested: { object: 'value' },
      },
    });

    expect(result.payment).toBeDefined();
    expect(result.payment?.metadata).toEqual({
      nested: '[object Object]', // ← Stringified
    });
  });
});
```

### Step 5: Document in CHANGELOG

```markdown
## [1.1.1] - 2026-02-15

### Fixed

- Fixed payment creation failure when metadata contains special characters (#123)
- Metadata values are now properly sanitized and converted to strings
```

---

## Common Pitfalls

### 1. Not Handling Null/Undefined

```typescript
// ❌ BAD
function processPayment(payment: Payment) {
  return payment.metadata.orderId; // ← Crashes if metadata is undefined
}

// ✅ FIX
function processPayment(payment: Payment) {
  return payment.metadata?.orderId ?? null;
}
```

### 2. Mutating Shared Objects

```typescript
// ❌ BAD
function enrichPayment(payment: Payment) {
  payment.metadata.enriched = true; // ← Mutates original
  return payment;
}

// ✅ FIX
function enrichPayment(payment: Payment): Payment {
  return {
    ...payment,
    metadata: {
      ...payment.metadata,
      enriched: true,
    },
  };
}
```

### 3. Catching Errors Too Broadly

```typescript
// ❌ BAD
try {
  await gateway.createPayment(command);
} catch (err) {
  return { payment: null, error: { code: NormalizedErrorCode.Unknown, ... } };
}

// ✅ FIX
try {
  const result = await gateway.createPayment(command);

  if (result.error) {
    // Handle expected errors
    return result;
  }

  return result;
} catch (err) {
  // Only catch unexpected errors
  return {
    payment: null,
    error: this.errorNormalizer.normalize(err, { gateway: 'stripe' }),
  };
}
```

### 4. Not Cleaning Up Test Resources

```typescript
// ❌ BAD
describe('PaymentGateway', () => {
  let gateway: StripeGateway;

  beforeEach(() => {
    gateway = new StripeGateway(client);
  });

  // Missing cleanup
});

// ✅ FIX
describe('PaymentGateway', () => {
  let gateway: StripeGateway;
  let cleanup: () => void;

  beforeEach(() => {
    gateway = new StripeGateway(client);
    cleanup = setupTestWebhooks();
  });

  afterEach(() => {
    cleanup?.();
    jest.clearAllMocks();
  });
});
```

---

## Emergency Hotfix Process

### When Production is Broken

1. **Create hotfix branch**

   ```bash
   git checkout main
   git checkout -b hotfix/payment-creation-fix
   ```

2. **Write test reproducing production issue**

   ```typescript
   it('reproduces production bug: ...', () => {
     /* ... */
   });
   ```

3. **Fix with minimal change**
   - Don't refactor
   - Don't add features
   - Fix ONLY the bug

4. **Verify thoroughly**

   ```bash
   npm test
   npm run build
   npm run lint
   ```

5. **Fast-track review & deploy**

   ```bash
   git commit -m "fix: resolve payment creation failure in production (#456)"
   git push origin hotfix/payment-creation-fix
   # Create PR, get emergency review, merge, deploy
   ```

6. **Bump patch version**
   ```bash
   npm version patch
   git push --tags
   ```

---

**Remember**: Fix bugs with tests first, make minimal changes, and verify thoroughly before shipping.
