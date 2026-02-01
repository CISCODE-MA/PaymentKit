# PaymentKit - General Instructions

**Last updated: February 2026**

## Package Overview

**Name**: `@ciscode/paymentkit`  
**Type**: Payment Orchestration Library  
**Framework**: NestJS (v11+)  
**Target Users**: Backend developers building payment integrations in NestJS applications  
**Primary Purpose**: Unified payment gateway abstraction for Stripe and PayPal with webhook handling

### Key Characteristics

- **Gateway-agnostic API**: Single interface for multiple payment providers
- **Hexagonal Architecture**: Ports & adapters pattern for clean separation
- **Zero-config webhooks**: Built-in internal webhook controller
- **Type-safe**: Full TypeScript with strict typing
- **Dependency Injection**: Native NestJS DI throughout
- **Extensible**: Add new gateways without modifying core logic
- **Idempotent**: Safe payment operations with idempotency key support

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Host NestJS Application                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      PaymentKitModule                         │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │              PaymentsService (Public API)               │  │  │
│  │  │  • createPayment(command)                              │  │  │
│  │  │  • getPaymentStatus(query)                             │  │  │
│  │  │  • refundPayment(command)                              │  │  │
│  │  └──────────────────┬──────────────────────────────────────┘  │  │
│  │                     │                                          │  │
│  │  ┌──────────────────▼──────────────────────────────────────┐  │  │
│  │  │         DefaultPaymentEngine (Orchestrator)            │  │  │
│  │  │  Delegates to gateways via GatewayRegistry             │  │  │
│  │  └──────────┬────────────────────────┬────────────────────┘  │  │
│  │             │                        │                        │  │
│  │  ┌──────────▼─────────┐   ┌─────────▼──────────┐            │  │
│  │  │  InMemoryGateway   │   │  DefaultError      │            │  │
│  │  │  Registry          │   │  Normalizer        │            │  │
│  │  │  • get(key)        │   │  • normalize()     │            │  │
│  │  │  • list()          │   └────────────────────┘            │  │
│  │  └──────────┬─────────┘                                     │  │
│  │             │                                                │  │
│  │     ┌───────┴────────┐                                      │  │
│  │     │                │                                      │  │
│  │  ┌──▼─────────┐  ┌──▼──────────┐                          │  │
│  │  │  Stripe    │  │   PayPal    │                          │  │
│  │  │  Gateway   │  │   Gateway   │  (implements PaymentGateway) │
│  │  └──┬─────────┘  └──┬──────────┘                          │  │
│  │     │               │                                      │  │
│  │  ┌──▼──────────┐ ┌──▼───────────┐                         │  │
│  │  │  Stripe     │ │   PayPal     │                         │  │
│  │  │  Payments   │ │   Payments   │                         │  │
│  │  │  Client     │ │   Client     │                         │  │
│  │  └──┬──────────┘ └──┬───────────┘                         │  │
│  │     │               │                                      │  │
│  │  ┌──▼──────────┐ ┌──▼───────────┐                         │  │
│  │  │  Stripe     │ │   PayPal     │                         │  │
│  │  │  Client     │ │   Client     │  (HTTP layer)           │  │
│  │  │  (HTTP)     │ │   (HTTP)     │                         │  │
│  │  └─────────────┘ └──────────────┘                         │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │         Webhook Stack (Parallel)                    │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │  InternalWebhookController                    │  │  │  │
│  │  │  │  POST /paymentKit/webhooks/internal           │  │  │  │
│  │  │  │  Header: x-paymentkit-gateway: stripe|paypal  │  │  │  │
│  │  │  └───────────┬───────────────────────────────────┘  │  │  │
│  │  │              │                                       │  │  │
│  │  │  ┌───────────▼───────────────────────────────────┐  │  │  │
│  │  │  │  WebhookGatewayRouter                         │  │  │  │
│  │  │  │  Routes by gateway key to handlers            │  │  │  │
│  │  │  └──────┬──────────────────────┬─────────────────┘  │  │  │
│  │  │         │                      │                     │  │  │
│  │  │  ┌──────▼────────┐    ┌───────▼──────────┐         │  │  │
│  │  │  │  Stripe       │    │   PayPal         │         │  │  │
│  │  │  │  Webhook      │    │   Webhook        │         │  │  │
│  │  │  │  Handler      │    │   Handler        │         │  │  │
│  │  │  │  • Verifier   │    │   • Verifier     │         │  │  │
│  │  │  │  • Normalizer │    │   • Normalizer   │         │  │  │
│  │  │  └───────────────┘    └──────────────────┘         │  │  │
│  │  │                                                      │  │  │
│  │  │  ┌──────────────────────────────────────────────┐  │  │  │
│  │  │  │  WebhookEventDispatcher                      │  │  │  │
│  │  │  │  Emits normalized events for consumption     │  │  │  │
│  │  │  └──────────────────────────────────────────────┘  │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
           │                                    │
           ▼                                    ▼
    ┌──────────────┐                   ┌──────────────┐
    │ Stripe API   │                   │ PayPal API   │
    │ api.stripe   │                   │ api.paypal   │
    └──────────────┘                   └──────────────┘
```

---

## File Structure

```
@ciscode/paymentkit/
├── .github/                          # GitHub workflows & instructions
│   └── instructions/                 # AI assistant guidance (this folder)
├── docs/                             # Documentation
│   ├── CONTRIBUTING.md               # Contribution guidelines
│   └── workflow.md                   # Development workflow
├── src/                              # Source code
│   ├── index.ts                      # Public API exports
│   ├── main.ts                       # Dev server entry (not published)
│   ├── app.module.ts                 # Dev app module (not published)
│   ├── paymentKit.module.ts          # Main PaymentKit DI module
│   ├── common/                       # Shared utilities & types
│   │   ├── constants.ts              # DI tokens, magic strings
│   │   ├── errors/                   # Error models
│   │   │   ├── config-validation.error.ts
│   │   │   └── normalized-error.model.ts
│   │   ├── types/                    # Shared type definitions
│   │   │   ├── gateway.types.ts      # GatewayKey union type
│   │   │   └── webhook.types.ts      # Webhook event types
│   │   └── utils/                    # Helper functions
│   ├── config/                       # Configuration system
│   │   ├── paymentKit.config.ts      # Public config interface
│   │   ├── paymentKit.config-loader.ts # Env-based config builder
│   │   └── gateways/                 # Gateway-specific configs
│   │       ├── stripe.config.ts      # Stripe env mapping
│   │       └── paypal.config.ts      # PayPal env mapping
│   ├── core/                         # Domain layer (framework-agnostic)
│   │   ├── entities/                 # Domain entities
│   │   │   ├── payment.entity.ts     # Payment aggregate
│   │   │   ├── refund.entity.ts      # Refund aggregate
│   │   │   └── payment-status.enum.ts # Payment lifecycle states
│   │   ├── value-objects/            # Value objects
│   │   │   └── money.value-object.ts # Money representation
│   │   ├── ports/                    # Interface contracts (hexagonal)
│   │   │   ├── payment-gateway.port.ts     # Gateway contract
│   │   │   └── payment-engine.port.ts      # Engine contract
│   │   ├── services/                 # Domain services
│   │   │   ├── payment-engine.service.ts        # Main orchestrator
│   │   │   ├── gateway-registry.service.ts      # Gateway lookup
│   │   │   ├── error-normalizer.service.ts      # Error mapping
│   │   │   ├── webhook-gateway-router.service.ts # Webhook routing
│   │   │   ├── webhook-event-dispatcher.service.ts # Event bus
│   │   │   ├── webhook-mode.service.ts          # Mode inspection
│   │   │   └── error-mapping/               # Per-gateway mappers
│   │   │       ├── stripe-error-mapper.ts
│   │   │       └── paypal-error-mapper.ts
│   │   └── gateways/                 # Gateway adapters
│   │       ├── stripe/               # Stripe implementation
│   │       │   ├── stripe.gateway.ts          # PaymentGateway impl
│   │       │   ├── stripe.client.ts           # HTTP client
│   │       │   ├── stripe-payments.client.ts  # Payments API
│   │       │   ├── stripe-error.mapper.ts     # Error mapping
│   │       │   ├── stripe-webhook.handler.ts  # Webhook handler
│   │       │   ├── stripe-webhook-verifier.ts # Signature check
│   │       │   └── stripe-webhook-normalizer.ts # Event mapping
│   │       └── paypal/               # PayPal implementation
│   │           ├── paypal.gateway.ts
│   │           ├── paypal.client.ts
│   │           ├── paypal-payments.client.ts
│   │           ├── paypal-error.mapper.ts
│   │           ├── paypal-webhook.handler.ts
│   │           ├── paypal-webhook-verifier.ts
│   │           └── paypal-webhook-normalizer.ts
│   └── nest/                         # NestJS integration layer
│       ├── controllers/              # HTTP controllers
│       │   └── internal-webhook.controller.ts # Webhook endpoint
│       └── services/                 # NestJS services
│           └── payments.service.ts   # Public facade
├── test/                             # Test suite
│   ├── app.e2e-spec.ts               # E2E tests
│   ├── jest-e2e.json                 # E2E config
│   └── unit/                         # Unit tests (mirrors src/)
│       ├── paymentKit.module.spec.ts
│       ├── common/
│       ├── config/
│       ├── controllers/
│       └── core/
├── package.json                      # NPM metadata
├── tsconfig.json                     # TypeScript config
├── tsconfig.build.json               # Build config
├── nest-cli.json                     # NestJS CLI config
├── eslint.config.mjs                 # ESLint config
├── .prettierrc                       # Prettier config
├── commitlint.config.cjs             # Commit linting
└── .releaserc.json                   # Semantic release
```

---

## Naming Conventions

### Files

| Type           | Pattern                        | Example                          |
| -------------- | ------------------------------ | -------------------------------- |
| Module         | `*.module.ts`                  | `paymentKit.module.ts`           |
| Service        | `*.service.ts`                 | `payment-engine.service.ts`      |
| Controller     | `*.controller.ts`              | `internal-webhook.controller.ts` |
| Gateway        | `*.gateway.ts`                 | `stripe.gateway.ts`              |
| Client         | `*.client.ts`                  | `stripe.client.ts`               |
| Port/Interface | `*.port.ts`                    | `payment-gateway.port.ts`        |
| Entity         | `*.entity.ts`                  | `payment.entity.ts`              |
| Value Object   | `*.value-object.ts`            | `money.value-object.ts`          |
| Enum           | `*.enum.ts`                    | `payment-status.enum.ts`         |
| Mapper         | `*-mapper.ts` or `*.mapper.ts` | `stripe-error.mapper.ts`         |
| Handler        | `*.handler.ts`                 | `stripe-webhook.handler.ts`      |
| Verifier       | `*-verifier.ts`                | `stripe-webhook-verifier.ts`     |
| Normalizer     | `*-normalizer.ts`              | `stripe-webhook-normalizer.ts`   |
| Config         | `*.config.ts`                  | `paymentKit.config.ts`           |
| Types          | `*.types.ts`                   | `gateway.types.ts`               |
| Test           | `*.spec.ts`                    | `stripe.gateway.spec.ts`         |
| E2E Test       | `*.e2e-spec.ts`                | `app.e2e-spec.ts`                |

### Classes & Interfaces

```typescript
// ✅ Interfaces: Descriptive nouns, no "I" prefix
export interface PaymentGateway {}
export interface GatewayRegistry {}
export interface WebhookEventDispatcher {}

// ✅ Classes: Implementation name + descriptor
export class StripeGateway implements PaymentGateway {}
export class InMemoryGatewayRegistry implements GatewayRegistry {}
export class DefaultPaymentEngine implements PaymentEngine {}

// ✅ Static mapper classes: [Gateway][Purpose]Mapper
export class StripeErrorMapper {}
export class PaypalErrorMapper {}

// ✅ Abstract classes: Base + descriptor
export abstract class BaseWebhookHandler {}

// ❌ Don't use "I" prefix for interfaces
// ❌ Don't use "Abstract" prefix for abstract classes
```

### Functions & Methods

```typescript
// ✅ Verbs for actions
createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult>
getPaymentStatus(query: GetPaymentStatusQuery): Promise<GetPaymentStatusResult>
refundPayment(command: RefundPaymentCommand): Promise<RefundPaymentResult>

// ✅ Boolean getters: is/has/can prefix
isValid(): boolean
hasExpired(): boolean
canRefund(): boolean

// ✅ Builders: build prefix
buildStripeInternalConfig(enabled: boolean, env: EnvSource): StripeConfigBuildResult

// ✅ Normalizers: normalize prefix
normalizeStripeWebhook(raw: unknown): WebhookEvent[]
normalizeError(error: unknown, context: Context): NormalizedError

// ✅ Verifiers: verify prefix
verifyStripeWebhook(input: VerificationInput): VerificationResult

// ❌ Don't use get/set for non-properties
// ❌ Don't use generic names like "process", "handle" without context
```

### Constants & Enums

```typescript
// ✅ Constants: SCREAMING_SNAKE_CASE
export const PAYMENTKIT_CONFIG = 'PAYMENTKIT_CONFIG';
export const DEFAULT_WEBHOOK_MODE: WebhookMode = 'internal';

// ✅ Enums: PascalCase for enum, PascalCase for values
export enum PaymentStatus {
  Pending = 'Pending',
  Authorized = 'Authorized',
  Captured = 'Captured',
  Failed = 'Failed',
  Canceled = 'Canceled',
}

export enum NormalizedErrorCode {
  InvalidRequest = 'InvalidRequest',
  CardDeclined = 'CardDeclined',
  InsufficientFunds = 'InsufficientFunds',
  // ...
}

// ❌ Don't use SCREAMING_SNAKE_CASE for enum values
```

### Types

```typescript
// ✅ Union types: Descriptive name
export type GatewayKey = 'stripe' | 'paypal';
export type WebhookMode = 'internal' | 'manual';
export type WebhookEventType = 'payment.succeeded' | 'payment.failed' | /* ... */;

// ✅ Command/Query/Result suffixes
export interface CreatePaymentCommand { }
export interface GetPaymentStatusQuery { }
export interface CreatePaymentResult { }

// ✅ Config suffixes
export interface StripeInternalConfig { }
export interface PaymentKitPublicConfig { }
export interface PaymentKitResolvedConfig { }

// ✅ Input/Output for functions
export interface StripeHttpRequest { }
export interface StripeHttpResponse<T> { }
export interface PaypalWebhookVerificationInput { }
export interface PaypalWebhookVerificationResult { }
```

---

## Code Patterns

### 1. Dependency Injection (NestJS)

```typescript
// ✅ Use constructor injection for services
@Injectable()
export class PaymentsService {
  constructor(private readonly engine: DefaultPaymentEngine) {}

  createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
    return this.engine.createPayment(command);
  }
}

// ✅ Use factory providers for conditional instantiation
{
  provide: StripeClient,
  useFactory: () => {
    const config = resolvedConfig.gateways.stripe;
    return config ? new StripeClient({ config }) : null;
  },
}

// ✅ Use nullable pattern for optional gateways
{
  provide: StripeGateway,
  useFactory: (payments: StripePaymentsClient | null) =>
    payments ? new StripeGateway(payments) : null,
  inject: [StripePaymentsClient],
}

// ❌ Don't use @Optional() decorator - use nullable types instead
// ❌ Don't create singletons manually - use DI system
```

### 2. Error Handling

```typescript
// ✅ Return errors as values, don't throw
async createPayment(command: CreatePaymentCommand): Promise<CreatePaymentResult> {
  try {
    const result = await gateway.createPayment(command);

    if (result.error) {
      return {
        payment: null,
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

// ✅ Use NormalizedError for all gateway errors
export interface NormalizedError {
  code: NormalizedErrorCode;
  message: string;
  gateway: GatewayKey;
  rawMessage?: string;
  details?: Record<string, unknown>;
}

// ✅ Map gateway-specific errors to normalized codes
export class StripeErrorMapper {
  static map(error: unknown): NormalizedError {
    if (!error || typeof error !== 'object') {
      return {
        code: NormalizedErrorCode.Unknown,
        message: 'Unknown Stripe error',
        gateway: 'stripe',
      };
    }

    const stripeError = error as StripeError;

    switch (stripeError.code) {
      case 'card_declined':
        return {
          code: NormalizedErrorCode.CardDeclined,
          message: stripeError.message,
          gateway: 'stripe',
        };
      // ... more cases
    }
  }
}

// ❌ Don't throw exceptions for business logic errors
// ❌ Don't expose raw gateway errors to API consumers
```

### 3. Configuration Loading

```typescript
// ✅ Use builder pattern for gateway configs
export function buildStripeInternalConfig(
  enabled: boolean,
  env: EnvSource,
  prefix = 'PAYMENTKIT_STRIPE_',
): StripeConfigBuildResult {
  if (!enabled) {
    return { config: null, issues: [] };
  }

  const issues: ConfigValidationIssue[] = [];

  const apiKey = env[`${prefix}API_KEY`];

  if (!apiKey || apiKey.trim().length === 0) {
    issues.push({
      path: 'gateways.stripe',
      message: `${prefix}API_KEY is required when Stripe gateway is enabled`,
      code: 'STRIPE_API_KEY_REQUIRED',
    });
    return { config: null, issues };
  }

  const config: StripeInternalConfig = {
    apiKey: apiKey.trim(),
    webhookSecret: env[`${prefix}WEBHOOK_SECRET`]?.trim(),
  };

  return { config, issues };
}

// ✅ Fail-fast with detailed validation
export class PaymentKitConfigLoader {
  static loadFromEnv(
    rawConfig: PaymentKitPublicConfig,
    env: GenericEnv = process.env,
  ): PaymentKitResolvedConfig {
    const validConfig = parsePaymentKitPublicConfig(rawConfig); // throws if invalid

    const issues: ConfigValidationIssue[] = [];

    // Build each gateway config
    const stripeResult = buildStripeInternalConfig(/* ... */);
    if (stripeResult.issues.length > 0) {
      issues.push(...stripeResult.issues);
    }

    // Aggregate and fail-fast
    if (issues.length > 0) {
      throw new ConfigValidationError(issues);
    }

    return resolvedConfig;
  }
}

// ❌ Don't use process.env directly in gateway code
// ❌ Don't return partial configs on validation failure
```

### 4. Type Safety

```typescript
// ✅ Use discriminated unions for result types
export type NextAction =
  | { type: 'redirect'; url: string }
  | { type: 'client_secret'; clientSecret: string }
  | { type: 'none' };

// Usage
if (result.nextAction?.type === 'redirect') {
  // TypeScript knows url is available here
  console.log(result.nextAction.url);
}

// ✅ Use branded types for IDs
export type PaymentId = string & { __brand: 'PaymentId' };

// ✅ Use const assertions for literal types
const STRIPE_GATEWAY_KEY: GatewayKey = 'stripe' as const;

// ✅ Use type guards
function isStripeError(error: unknown): error is StripeError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

// ❌ Don't use 'any' type - use 'unknown' and validate
// ❌ Don't assert types without validation
```

### 5. Webhook Handling

```typescript
// ✅ Implement GatewayWebhookHandler for each gateway
export class StripeWebhookHandler implements GatewayWebhookHandler {
  readonly key: GatewayKey = 'stripe';

  constructor(private readonly endpointSecret: string | null) {}

  async handleWebhook(context: IncomingWebhookContext): Promise<WebhookEvent[] | void> {
    // 1. Check if enabled
    if (!this.endpointSecret) {
      return Promise.resolve();
    }

    // 2. Verify signature
    const verification = verifyStripeWebhook({
      payload: /* ... */,
      signatureHeader: /* ... */,
      endpointSecret: this.endpointSecret,
    });

    if (!verification.isValid) {
      return Promise.resolve(); // Fail silently
    }

    // 3. Normalize events
    const events = normalizeStripeWebhook(rawEvent);

    if (!events.length) {
      return Promise.resolve();
    }

    return Promise.resolve(events);
  }
}

// ✅ Register handlers in module
{
  provide: 'PAYMENTKIT_WEBHOOK_HANDLER_REGISTRATION',
  useFactory: (router: WebhookGatewayRouter) => {
    const stripeSecret = resolvedConfig.gateways.stripe?.webhookSecret ?? null;
    if (stripeSecret) {
      router.registerHandler(new StripeWebhookHandler(stripeSecret));
    }
    return true;
  },
  inject: [WebhookGatewayRouter],
}

// ❌ Don't expose raw webhook payloads to consumers
// ❌ Don't throw errors on verification failure - fail silently
```

---

## Anti-Patterns

### ❌ Direct Gateway Dependencies in Engine

```typescript
// ❌ BAD: Engine knows about specific gateways
class PaymentEngine {
  constructor(
    private stripeGateway: StripeGateway,
    private paypalGateway: PaypalGateway,
  ) {}

  async createPayment(command: CreatePaymentCommand) {
    if (command.gateway === 'stripe') {
      return this.stripeGateway.createPayment(command);
    }
    // ...
  }
}

// ✅ GOOD: Engine uses registry abstraction
class DefaultPaymentEngine {
  constructor(private readonly registry: GatewayRegistry) {}

  async createPayment(command: CreatePaymentCommand) {
    const gateway = this.registry.get(command.gateway);
    if (!gateway) {
      return { payment: null, error: /* ... */ };
    }
    return gateway.createPayment(command);
  }
}
```

### ❌ Exposing Implementation Details

```typescript
// ❌ BAD: Expose raw Stripe types in public API
export interface CreatePaymentResult {
  stripePaymentIntent?: Stripe.PaymentIntent;
  paypalOrder?: PayPalOrder;
}

// ✅ GOOD: Use normalized domain types
export interface CreatePaymentResult {
  payment: Payment | null;
  nextAction?: NextAction;
  error?: NormalizedError;
}
```

### ❌ Mixing Concerns

```typescript
// ❌ BAD: Gateway doing HTTP + business logic + error mapping
class StripeGateway {
  async createPayment(command: CreatePaymentCommand) {
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ amount: command.amount }),
    });

    if (!response.ok) {
      // Error mapping mixed in
      throw new Error('Stripe error');
    }

    // Business logic mixed in
    const data = await response.json();
    return { payment: this.mapToPayment(data) };
  }
}

// ✅ GOOD: Separated concerns
// StripeClient handles HTTP
// StripePaymentsClient handles API semantics
// StripeGateway implements business interface
// StripeErrorMapper handles error normalization
```

### ❌ Hardcoded Gateway Keys

```typescript
// ❌ BAD: Magic strings everywhere
if (command.gateway === 'stripe') {
}

// ✅ GOOD: Type-safe gateway keys
const STRIPE_GATEWAY_KEY: GatewayKey = 'stripe';
if (command.gateway === STRIPE_GATEWAY_KEY) {
}

// ✅ EVEN BETTER: Use the gateway's own key property
const gateway = this.registry.get(command.gateway);
if (gateway && gateway.key === 'stripe') {
}
```

---

## Export Rules

### What Should Be Public API (`src/index.ts`)

```typescript
// ✅ Module
export { PaymentKitModule } from './paymentKit.module';

// ✅ Main service facade
export { PaymentsService } from './nest/services/payments.service';

// ✅ Configuration types
export type { PaymentKitPublicConfig } from './config/paymentKit.config';
export type { GatewayKey } from './common/types/gateway.types';

// ✅ Command/Query/Result types
export type {
  CreatePaymentCommand,
  CreatePaymentResult,
  GetPaymentStatusQuery,
  GetPaymentStatusResult,
  RefundPaymentCommand,
  RefundPaymentResult,
  NextAction,
} from './core/ports/payment-gateway.port';

// ✅ Domain types
export type { Money } from './core/value-objects/money.value-object';
export { PaymentStatus } from './core/entities/payment-status.enum';

// ✅ DI tokens (for advanced usage)
export { PAYMENTKIT_CONFIG } from './common/constants';

// ✅ Optional exports for advanced users
export { DefaultPaymentEngine } from './core/services/payment-engine.service';
export { InMemoryGatewayRegistry } from './core/services/gateway-registry.service';
export { WebhookGatewayRouter } from './core/services/webhook-gateway-router.service';
export { InMemoryWebhookEventDispatcher } from './core/services/webhook-event-dispatcher.service';
```

### What Should Be Internal

```typescript
// ❌ Don't export gateway implementations
// export { StripeGateway } from './core/gateways/stripe/stripe.gateway';

// ❌ Don't export client classes
// export { StripeClient } from './core/gateways/stripe/stripe.client';

// ❌ Don't export internal config types
// export type { StripeInternalConfig } from './config/gateways/stripe.config';

// ❌ Don't export mappers
// export { StripeErrorMapper } from './core/services/error-mapping/stripe-error-mapper';

// ❌ Don't export controllers
// export { InternalWebhookController } from './nest/controllers/internal-webhook.controller';
```

---

## Security Practices

### 1. Webhook Signature Verification

```typescript
// ✅ Always verify webhook signatures before processing
const verification = verifyStripeWebhook({
  payload: rawBody,
  signatureHeader: headers['stripe-signature'],
  endpointSecret: this.webhookSecret,
});

if (!verification.isValid) {
  // Fail silently, log if needed
  return Promise.resolve();
}

// ✅ Use timing-safe comparison for signatures
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  return timingSafeEqual(bufA, bufB);
}
```

### 2. API Key Handling

```typescript
// ✅ Load from environment variables
const apiKey = env['PAYMENTKIT_STRIPE_API_KEY'];

// ✅ Validate before use
if (!apiKey || apiKey.trim().length === 0) {
  issues.push({ /* ... */ });
}

// ✅ Never log API keys
// ❌ logger.log(`Using API key: ${apiKey}`);
// ✅ logger.log('Stripe client initialized');

// ✅ Use authorization headers correctly
headers: {
  Authorization: `Bearer ${config.apiKey}`,
}
```

### 3. Idempotency

```typescript
// ✅ Support idempotency keys for safe retries
export interface CreatePaymentCommand {
  gateway: GatewayKey;
  amount: Money;
  idempotencyKey?: string; // ← Important
  metadata?: Record<string, unknown>;
}

// ✅ Pass through to gateway HTTP clients
if (options.idempotencyKey) {
  headers['Idempotency-Key'] = options.idempotencyKey;
}
```

### 4. Input Validation

```typescript
// ✅ Validate all inputs at boundaries
export function validatePaymentKitPublicConfig(raw: unknown): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = [];

  if (typeof raw !== 'object' || raw === null) {
    issues.push({
      path: '',
      message: 'Configuration must be a non-null object',
      code: 'CONFIG_NOT_OBJECT',
    });
    return { valid: false, issues };
  }

  // ... detailed validation
}

// ✅ Trim and sanitize user inputs
const apiKey = rawApiKey?.trim();

// ❌ Don't trust user input
// ❌ Don't skip validation for "internal" calls
```

---

## Versioning (Semantic Versioning)

### Version Format: `MAJOR.MINOR.PATCH`

**MAJOR** (breaking changes):

- Removing or renaming public exports
- Changing method signatures in `PaymentGateway` interface
- Changing `CreatePaymentCommand` / `CreatePaymentResult` shapes
- Removing gateway support
- Changing webhook event formats

**MINOR** (new features, backwards-compatible):

- Adding new gateway support
- Adding new optional fields to commands
- Adding new methods to services
- Adding new webhook event types
- New configuration options (with defaults)

**PATCH** (bug fixes, no API changes):

- Fixing error mapping logic
- Fixing webhook verification
- Fixing HTTP client bugs
- Documentation updates
- Dependency updates (non-breaking)

### Examples

```
1.1.0 → 2.0.0  (Removed Adyen support - breaking)
1.1.0 → 1.2.0  (Added Square gateway - new feature)
1.1.0 → 1.1.1  (Fixed PayPal error mapping - bug fix)
```

---

## Release Checklist

Before releasing a new version:

### 1. Code Quality

- [ ] All tests passing (`npm test`)
- [ ] Lint clean (`npm run lint`)
- [ ] Build successful (`npm run build`)
- [ ] No TypeScript errors
- [ ] Code coverage ≥ 80%

### 2. Documentation

- [ ] CHANGELOG.md updated
- [ ] README.md updated if needed
- [ ] JSDoc comments on new public APIs
- [ ] Migration guide for breaking changes

### 3. Testing

- [ ] Unit tests for new features
- [ ] Integration tests if applicable
- [ ] Manual testing with real Stripe/PayPal accounts
- [ ] Webhook testing with webhook.site or similar

### 4. Versioning

- [ ] Version number follows semantic versioning
- [ ] Git tags created
- [ ] Commit messages follow conventional commits

### 5. Security

- [ ] No hardcoded secrets in code
- [ ] Dependencies audited (`npm audit`)
- [ ] Vulnerability scan passed

---

## Development Commands

```bash
# Development
npm run start:dev          # Start dev server with watch mode
npm run start:debug        # Start with debugger

# Building
npm run build              # Build for NestJS app usage
npm run build:lib          # Build for library distribution

# Testing
npm test                   # Run all unit tests
npm run test:watch         # Run tests in watch mode
npm run test:cov           # Run with coverage report
npm run test:debug         # Debug tests
npm run test:e2e           # Run e2e tests

# Code Quality
npm run lint               # Check code style
npm run lint:fix           # Fix code style issues
npm run format             # Format code with Prettier
npm run format:check       # Check formatting

# Release
npm run release            # Semantic release (CI only)
```

---

## AI Guidelines Summary

When working on this codebase:

1. **Architecture**: Respect hexagonal architecture - keep core domain pure
2. **Gateway Pattern**: New gateways follow Stripe/PayPal structure exactly
3. **Error Handling**: Always return errors as values, never throw for business logic
4. **Type Safety**: Use discriminated unions, type guards, no 'any'
5. **Testing**: Write tests before implementation, aim for 80%+ coverage
6. **Naming**: Follow established conventions religiously
7. **Exports**: Only export what's needed by consumers
8. **Security**: Verify webhooks, handle secrets carefully, support idempotency
9. **Dependencies**: Keep gateway implementations independent
10. **Documentation**: Update this file when patterns change

---

**Remember**: This package is a **library**, not an application. Every export is public API. Breaking changes affect all users. Be conservative.
