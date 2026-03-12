# PaymentKit - Testing Instructions

**Last updated: February 2026**

## Testing Philosophy

### Core Principles

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Test Public Interfaces**: Don't test private methods directly
3. **Fail Fast**: Tests should fail immediately when something breaks
4. **Deterministic**: Tests must produce the same result every time
5. **Isolated**: Each test should be independent of others
6. **Fast**: Unit tests should run in milliseconds

### What We Test

- **Business Logic**: Payment creation, refunds, status checks
- **Error Handling**: Error normalization, validation failures
- **Configuration**: Config loading, environment validation
- **Webhook Processing**: Verification, normalization, routing
- **Integration Points**: Gateway adapters, HTTP clients (mocked)

### What We Don't Test

- **Third-Party Libraries**: Assume NestJS, Stripe SDK work correctly
- **TypeScript Compiler**: Don't test type checking
- **Trivial Code**: Simple getters, pure data transformations
- **Network Calls**: Mock HTTP clients, never hit real APIs

---

## Coverage Targets

| Layer                                     | Minimum Coverage | Target |
| ----------------------------------------- | ---------------- | ------ |
| **Core Domain** (`src/core/`)             | 90%              | 95%    |
| **Services** (`src/core/services/`)       | 85%              | 90%    |
| **Gateways** (`src/core/gateways/`)       | 85%              | 90%    |
| **Config** (`src/config/`)                | 80%              | 85%    |
| **Controllers** (`src/nest/controllers/`) | 75%              | 80%    |
| **Overall Project**                       | 80%              | 85%    |

**Current Status**: 149 tests passing, ~85% coverage

---

## File Organization

### Directory Structure

```
test/
├── app.e2e-spec.ts              # E2E tests (minimal for library)
├── jest-e2e.json                # E2E Jest config
└── unit/                        # Unit tests mirror src/
    ├── paymentKit.module.spec.ts
    ├── common/
    │   └── errors/
    │       └── normalized-error.model.spec.ts
    ├── config/
    │   ├── paymentKit.config.spec.ts
    │   ├── paymentKit.config-loader.spec.ts
    │   ├── stripe.config.spec.ts
    │   └── paypal.config.spec.ts
    ├── controllers/
    │   └── internal-webhook.controller.spec.ts
    └── core/
        ├── payment-status.enum.spec.ts
        ├── entities/
        │   └── payment-and-refund.entity.spec.ts
        ├── gateways/
        │   ├── stripe/
        │   │   ├── stripe.gateway.spec.ts
        │   │   ├── stripe.client.spec.ts
        │   │   ├── stripe-payments.client.spec.ts
        │   │   ├── stripe-error.mapper.spec.ts
        │   │   ├── stripe-webhook.handler.spec.ts
        │   │   ├── stripe-webhook-verifier.spec.ts
        │   │   └── stripe-webhook-normalizer.spec.ts
        │   └── paypal/
        │       └── ... (same structure)
        └── services/
            ├── payment-engine.service.spec.ts
            ├── gateway-registry.service.spec.ts
            ├── error-normalizer.service.spec.ts
            └── webhook/
                ├── webhook-gateway-router.service.spec.ts
                ├── webhook-event-dispatcher.service.spec.ts
                └── webhook-mode.service.spec.ts
```

### Naming Pattern

**Rule**: `[source-file-name].spec.ts`

```
src/core/gateways/stripe/stripe.gateway.ts
→ test/unit/core/gateways/stripe/stripe.gateway.spec.ts

src/config/paymentKit.config-loader.ts
→ test/unit/config/paymentKit.config-loader.spec.ts
```

---

## Test Template

### Standard Structure

```typescript
import { ClassUnderTest } from '@src/path/to/class';
import type { Dependency1, Dependency2 } from '@src/path/to/dependencies';

// Helper functions for test data
const makeTestData = (overrides: Partial<TestData> = {}): TestData => ({
  field1: 'default-value',
  field2: 42,
  ...overrides,
});

describe('ClassUnderTest', () => {
  // Setup/teardown if needed
  beforeEach(() => {
    // Reset state
  });

  afterEach(() => {
    // Cleanup
  });

  describe('methodName', () => {
    it('should handle happy path scenario', () => {
      // Arrange
      const input = makeTestData();
      const instance = new ClassUnderTest(/* deps */);

      // Act
      const result = instance.methodName(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.field).toBe('expected-value');
    });

    it('should handle error scenario', () => {
      // Arrange
      const invalidInput = makeTestData({ field1: '' });

      // Act
      const result = instance.methodName(invalidInput);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('EXPECTED_ERROR_CODE');
    });

    it('should handle edge case', () => {
      // Test boundary conditions
    });
  });

  describe('anotherMethod', () => {
    // More test cases
  });
});
```

### Example: Testing a Gateway

```typescript
import { StripeGateway } from '@src/core/gateways/stripe/stripe.gateway';
import {
  type StripePaymentsClient,
  type CreateStripePaymentResult,
} from '@src/core/gateways/stripe/stripe-payments.client';
import { PaymentStatus } from '@src/core/entities/payment-status.enum';
import { NormalizedErrorCode } from '@src/common/errors/normalized-error.model';
import type { CreatePaymentCommand, Money } from '@src/core/ports/payment-gateway.port';

// Mock implementation
class FakeStripePaymentsClient implements Partial<StripePaymentsClient> {
  public createPaymentResult: CreateStripePaymentResult | null = null;

  createPayment(): Promise<CreateStripePaymentResult> {
    if (!this.createPaymentResult) {
      throw new Error('createPaymentResult not set in fake');
    }
    return Promise.resolve(this.createPaymentResult);
  }
}

const makeMoney = (overrides: Partial<Money> = {}): Money => ({
  currency: 'USD',
  amount: 1000,
  ...overrides,
});

const makeCommand = (overrides: Partial<CreatePaymentCommand> = {}): CreatePaymentCommand => ({
  gateway: 'stripe',
  amount: makeMoney(),
  ...overrides,
});

describe('StripeGateway', () => {
  it('creates a payment successfully', async () => {
    // Arrange
    const fake = new FakeStripePaymentsClient();
    fake.createPaymentResult = {
      ok: true,
      paymentIntentId: 'pi_123',
      status: 'requires_payment_method',
      clientSecret: 'pi_123_secret_abc',
    };

    const gateway = new StripeGateway(fake as StripePaymentsClient);
    const command = makeCommand();

    // Act
    const result = await gateway.createPayment(command);

    // Assert
    expect(result.payment).toBeDefined();
    expect(result.payment?.id).toBe('pi_123');
    expect(result.payment?.status).toBe(PaymentStatus.Pending);
    expect(result.payment?.gateway).toBe('stripe');
    expect(result.nextAction).toEqual({
      type: 'client_secret',
      clientSecret: 'pi_123_secret_abc',
    });
  });

  it('returns error when client returns error', async () => {
    // Arrange
    const fake = new FakeStripePaymentsClient();
    fake.createPaymentResult = {
      ok: false,
      error: {
        code: NormalizedErrorCode.CardDeclined,
        message: 'Card was declined',
        gateway: 'stripe',
      },
    };

    const gateway = new StripeGateway(fake as StripePaymentsClient);
    const command = makeCommand();

    // Act
    const result = await gateway.createPayment(command);

    // Assert
    expect(result.payment).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe(NormalizedErrorCode.CardDeclined);
  });
});
```

---

## Mocking Patterns

### 1. Fake Implementations (Preferred)

```typescript
// ✅ GOOD: Fake class that implements interface
class FakeGatewayRegistry implements GatewayRegistry {
  private gateways = new Map<GatewayKey, PaymentGateway>();

  register(gateway: PaymentGateway): void {
    this.gateways.set(gateway.key, gateway);
  }

  get(key: GatewayKey): PaymentGateway | undefined {
    return this.gateways.get(key);
  }

  list(): PaymentGateway[] {
    return Array.from(this.gateways.values());
  }
}

// Usage
const registry = new FakeGatewayRegistry();
registry.register(new FakeStripeGateway());
```

### 2. Partial Implementations

```typescript
// ✅ GOOD: Implement only what you need for test
class FakePaypalPaymentsClient implements Partial<PaypalPaymentsClient> {
  public createPaymentResult: CreatePaypalPaymentResult | null = null;

  createPayment(): Promise<CreatePaypalPaymentResult> {
    return Promise.resolve(this.createPaymentResult!);
  }

  // Don't implement other methods if not needed for test
}
```

### 3. Spy Objects

```typescript
// ✅ GOOD: Track method calls
class SpyWebhookRouter implements WebhookGatewayRouter {
  public routeCalls: Array<{
    gateway: GatewayKey;
    body: unknown;
    headers: Record<string, string | string[]>;
  }> = [];

  async route(input: {
    gateway: GatewayKey;
    body: unknown;
    headers: Record<string, string | string[]>;
  }): Promise<void> {
    this.routeCalls.push(input);
  }

  registerHandler(): void {}
}

// Usage
const router = new SpyWebhookRouter();
await controller.handleWebhook(body, headers);
expect(router.routeCalls).toHaveLength(1);
expect(router.routeCalls[0].gateway).toBe('stripe');
```

### 4. HTTP Client Mocks

```typescript
// ✅ GOOD: Mock HTTP client for gateway testing
class FakeHttpClient {
  public requests: StripeHttpRequest[] = [];
  public responses: StripeHttpResponse[] = [];

  handle = async <T>(request: StripeHttpRequest): Promise<StripeHttpResponse<T>> => {
    this.requests.push(request);

    const response = this.responses.shift();
    if (!response) {
      throw new Error('No response configured in FakeHttpClient');
    }

    return response as StripeHttpResponse<T>;
  };
}

// Usage
const fakeHttp = new FakeHttpClient();
fakeHttp.responses.push({
  status: 200,
  body: { id: 'pi_123', amount: 1000 },
  headers: {},
});

const client = new StripeClient({
  config: { apiKey: 'sk_test_123' },
  httpClient: fakeHttp.handle,
});
```

### 5. Environment Variable Mocking

```typescript
describe('Config loading', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.PAYMENTKIT_STRIPE_API_KEY = 'sk_test_123';
    process.env.PAYMENTKIT_STRIPE_WEBHOOK_SECRET = 'whsec_456';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('loads config from env', () => {
    // Test with modified process.env
  });
});
```

### 6. Test Data Builders

```typescript
// ✅ GOOD: Reusable test data factories
const makePayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'pay_1',
  gateway: 'stripe',
  gatewayPaymentId: 'pi_123',
  amount: { currency: 'USD', amount: 1000 },
  status: PaymentStatus.Pending,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeWebhookEvent = (overrides: Partial<WebhookEvent> = {}): WebhookEvent => ({
  type: 'payment.succeeded',
  gateway: 'stripe',
  payload: { id: 'pay_1' },
  occurredAt: new Date(),
  ...overrides,
});

// Usage
const payment = makePayment({ status: PaymentStatus.Captured });
const event = makeWebhookEvent({ gateway: 'paypal' });
```

---

## What to Test

### 1. Gateway Methods

```typescript
describe('StripeGateway', () => {
  // ✅ Test successful payment creation
  it('creates payment with correct data mapping');
  it('returns nextAction with client_secret');

  // ✅ Test error scenarios
  it('returns error when client returns error');
  it('handles unexpected errors from client');

  // ✅ Test status retrieval
  it('gets payment status by paymentId');
  it('gets payment status by gatewayPaymentId');
  it('maps Stripe status to PaymentStatus correctly');

  // ✅ Test refunds
  it('refunds payment successfully');
  it('returns error when refund fails');
});
```

### 2. Configuration Loading

```typescript
describe('PaymentKitConfigLoader', () => {
  // ✅ Test valid configurations
  it('loads config when all required env vars present');
  it('supports multiple enabled gateways');
  it('defaults webhooks.mode to internal');

  // ✅ Test validation failures
  it('throws ConfigValidationError when env vars missing');
  it('aggregates multiple validation issues');
  it('does not require env vars for disabled gateways');

  // ✅ Test edge cases
  it('trims whitespace from env values');
  it('handles empty string env values');
});
```

### 3. Error Normalization

```typescript
describe('StripeErrorMapper', () => {
  // ✅ Test known error codes
  it('maps card_declined to CardDeclined');
  it('maps insufficient_funds to InsufficientFunds');

  // ✅ Test unknown errors
  it('maps unknown error to Unknown code');
  it('handles non-object errors');

  // ✅ Test error details preservation
  it('preserves raw error message');
  it('includes gateway in normalized error');
});
```

### 4. Webhook Processing

```typescript
describe('StripeWebhookHandler', () => {
  // ✅ Test verification
  it('returns undefined when signature invalid');
  it('returns undefined when no endpoint secret configured');

  // ✅ Test normalization
  it('normalizes Stripe event to WebhookEvent');
  it('returns normalized events for valid webhook');

  // ✅ Test edge cases
  it('handles JSON parsing errors gracefully');
  it('returns undefined when normalizer yields no events');
});
```

### 5. Services & Engine

```typescript
describe('DefaultPaymentEngine', () => {
  // ✅ Test orchestration
  it('delegates to correct gateway from registry');
  it('returns error when gateway not found');
  it('ensures gateway field on errors');

  // ✅ Test error handling
  it('catches and normalizes gateway exceptions');
  it('aggregates errors from multiple sources');
});
```

### 6. Registry

```typescript
describe('InMemoryGatewayRegistry', () => {
  // ✅ Test lookup
  it('returns gateway by key when registered');
  it('returns undefined for unknown gateway');

  // ✅ Test listing
  it('lists all registered gateways');

  // ✅ Test edge cases
  it('last registered gateway wins for duplicate keys');
});
```

---

## Error Scenarios

### Test These Error Conditions

1. **Network Errors**

   ```typescript
   it('handles network timeout', async () => {
     fakeHttp.responses.push({
       status: 504,
       body: { error: 'Gateway timeout' },
       headers: {},
     });

     const result = await client.requestJson(/* ... */);

     expect(result.status).toBe(504);
   });
   ```

2. **Invalid Input**

   ```typescript
   it('validates required fields', () => {
     const invalidConfig = { environment: 'staging' }; // Invalid value

     const result = validatePaymentKitPublicConfig(invalidConfig);

     expect(result.valid).toBe(false);
     expect(result.issues[0].code).toBe('ENVIRONMENT_INVALID');
   });
   ```

3. **Missing Configuration**

   ```typescript
   it('returns error when gateway not configured', async () => {
     const registry = new InMemoryGatewayRegistry([]); // Empty
     const engine = new DefaultPaymentEngine(registry, normalizer);

     const result = await engine.createPayment({
       gateway: 'stripe',
       amount: { currency: 'USD', amount: 1000 },
     });

     expect(result.payment).toBeNull();
     expect(result.error?.code).toBe(NormalizedErrorCode.GatewayNotConfigured);
   });
   ```

4. **Gateway API Errors**

   ```typescript
   it('normalizes card declined error', () => {
     const stripeError = {
       code: 'card_declined',
       message: 'Your card was declined',
       statusCode: 402,
     };

     const normalized = StripeErrorMapper.map(stripeError);

     expect(normalized.code).toBe(NormalizedErrorCode.CardDeclined);
     expect(normalized.gateway).toBe('stripe');
   });
   ```

5. **Webhook Verification Failures**

   ```typescript
   it('rejects webhook with invalid signature', async () => {
     const handler = new StripeWebhookHandler('whsec_valid');

     const result = await handler.handleWebhook({
       body: { id: 'evt_1' },
       headers: { 'stripe-signature': 'invalid_sig' },
     });

     expect(result).toBeUndefined(); // Verification failed
   });
   ```

---

## Edge Cases

### Common Edge Cases to Test

1. **Null/Undefined Values**

   ```typescript
   it('handles null input gracefully', () => {
     const result = normalizeStripeWebhook(null);
     expect(result).toEqual([]);
   });
   ```

2. **Empty Arrays/Objects**

   ```typescript
   it('handles empty gateway list', () => {
     const registry = new InMemoryGatewayRegistry([]);
     expect(registry.list()).toEqual([]);
   });
   ```

3. **Whitespace**

   ```typescript
   it('trims whitespace from API key', () => {
     const env = { PAYMENTKIT_STRIPE_API_KEY: '  sk_test_123  ' };
     const result = buildStripeInternalConfig(true, env);
     expect(result.config?.apiKey).toBe('sk_test_123');
   });
   ```

4. **Duplicate Keys**

   ```typescript
   it('uses last registered gateway for duplicate keys', () => {
     const first = new FakeGateway('stripe');
     const second = new FakeGateway('stripe');
     const registry = new InMemoryGatewayRegistry([first, second]);

     expect(registry.get('stripe')).toBe(second);
   });
   ```

5. **Large Numbers**

   ```typescript
   it('handles large payment amounts', async () => {
     const command = makeCommand({
       amount: { currency: 'USD', amount: 999999999 },
     });

     const result = await gateway.createPayment(command);

     expect(result.payment?.amount.amount).toBe(999999999);
   });
   ```

6. **Special Characters**

   ```typescript
   it('handles metadata with special characters', async () => {
     const command = makeCommand({
       metadata: { description: 'Test "payment" with \'quotes\'' },
     });

     const result = await gateway.createPayment(command);

     expect(result.payment?.metadata).toEqual(command.metadata);
   });
   ```

---

## Running Tests

### Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (recommended during development)
npm run test:watch

# Run with coverage
npm run test:cov

# Run specific test file
npm test -- stripe.gateway.spec.ts

# Run tests matching pattern
npm test -- --testNamePattern="creates payment"

# Debug tests
npm run test:debug

# Run e2e tests
npm run test:e2e
```

### Watch Mode Filters

In watch mode, press:

- `a` - Run all tests
- `f` - Run only failed tests
- `p` - Filter by filename pattern
- `t` - Filter by test name pattern
- `q` - Quit watch mode

---

## Common Mistakes

### ❌ Don't Test Implementation Details

```typescript
// ❌ BAD: Testing private method behavior
it('should call private method', () => {
  const gateway = new StripeGateway(client);
  const spy = jest.spyOn(gateway as any, 'privateMethod');
  gateway.createPayment(command);
  expect(spy).toHaveBeenCalled();
});

// ✅ GOOD: Test public behavior
it('creates payment successfully', async () => {
  const result = await gateway.createPayment(command);
  expect(result.payment).toBeDefined();
});
```

### ❌ Don't Use Jest Mocks (Use Fakes Instead)

```typescript
// ❌ BAD: Jest mock (brittle, tied to implementation)
const mockClient = {
  createPayment: jest.fn().mockResolvedValue({ ok: true }),
};

// ✅ GOOD: Fake implementation (flexible, clear)
class FakeClient implements Partial<StripePaymentsClient> {
  public createPaymentResult: CreateStripePaymentResult;

  createPayment(): Promise<CreateStripePaymentResult> {
    return Promise.resolve(this.createPaymentResult);
  }
}
```

### ❌ Don't Test Multiple Things in One Test

```typescript
// ❌ BAD: Too many assertions
it('handles everything', async () => {
  const result1 = await gateway.createPayment(command1);
  expect(result1.payment).toBeDefined();

  const result2 = await gateway.getPaymentStatus(query);
  expect(result2.status).toBe(PaymentStatus.Pending);

  const result3 = await gateway.refundPayment(refundCommand);
  expect(result3.refund).toBeDefined();
});

// ✅ GOOD: One behavior per test
it('creates payment successfully', async () => {
  const result = await gateway.createPayment(command);
  expect(result.payment).toBeDefined();
});

it('gets payment status', async () => {
  const result = await gateway.getPaymentStatus(query);
  expect(result.status).toBe(PaymentStatus.Pending);
});
```

### ❌ Don't Rely on Test Execution Order

```typescript
// ❌ BAD: Tests depend on each other
let sharedPayment: Payment;

it('creates payment', async () => {
  sharedPayment = await gateway.createPayment(command);
});

it('refunds payment', async () => {
  await gateway.refundPayment({ paymentId: sharedPayment.id });
});

// ✅ GOOD: Each test is independent
it('creates payment', async () => {
  const payment = await gateway.createPayment(command);
  expect(payment).toBeDefined();
});

it('refunds payment', async () => {
  const payment = makePayment();
  await gateway.refundPayment({ paymentId: payment.id });
});
```

### ❌ Don't Ignore Async/Await

```typescript
// ❌ BAD: Missing await
it('creates payment', () => {
  gateway.createPayment(command); // Promise ignored!
  expect(result.payment).toBeDefined(); // result is undefined
});

// ✅ GOOD: Proper async handling
it('creates payment', async () => {
  const result = await gateway.createPayment(command);
  expect(result.payment).toBeDefined();
});
```

---

## Jest Configuration

### Main Config (`package.json`)

```json
{
  "jest": {
    "rootDir": ".",
    "moduleFileExtensions": ["js", "json", "ts"],
    "testEnvironment": "node",
    "testMatch": ["<rootDir>/test/**/*.spec.ts"],
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "moduleNameMapper": {
      "^@config/(.*)$": "<rootDir>/src/config/$1",
      "^@common/(.*)$": "<rootDir>/src/common/$1",
      "^@src/(.*)$": "<rootDir>/src/$1",
      "^@gateways/(.*)$": "<rootDir>/src/gateways/$1",
      "^@core/(.*)$": "<rootDir>/src/core/$1"
    },
    "collectCoverageFrom": ["src/**/*.ts", "!src/main.ts", "!src/app.module.ts", "!src/**/*.d.ts"],
    "coverageDirectory": "coverage",
    "coverageThresholds": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

### E2E Config (`test/jest-e2e.json`)

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

---

## Quick Reference

### Test Checklist

When writing a new test:

- [ ] Test file mirrors source file location
- [ ] Test file ends with `.spec.ts`
- [ ] Uses `describe` for grouping related tests
- [ ] Uses `it` for individual test cases
- [ ] Follows Arrange-Act-Assert pattern
- [ ] Uses helper functions for test data
- [ ] Tests both happy path and error scenarios
- [ ] Includes edge case tests
- [ ] Uses fake implementations instead of Jest mocks
- [ ] Each test is independent
- [ ] Async operations use `async/await`
- [ ] Assertions are specific and meaningful
- [ ] Test names describe the behavior being tested

---

**Remember**: Good tests are your safety net. Write tests that give you confidence to refactor and add features without fear of breaking existing functionality.
