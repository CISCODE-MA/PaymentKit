# Copilot Instructions - PaymentKit Developer Guide

> **Purpose**: Project-specific instructions for contributing to PaymentKit, a unified payment gateway abstraction for Stripe and PayPal with webhook handling.

---

## 🎯 Project Overview

**Project**: @ciscode/paymentkit  
**Type**: Payment Orchestration NestJS Library  
**Version**: 1.2.0  
**Purpose**: Unified payment gateway abstraction for Stripe and PayPal with built-in webhook handling and type safety.

### PaymentKit Provides:

- **Gateway-agnostic API**: Single interface for multiple payment providers
- **Hexagonal Architecture**: Ports & adapters pattern for clean separation
- **Zero-config webhooks**: Built-in internal webhook controller
- **Type-safe**: Full TypeScript with strict typing
- **Dependency Injection**: Native NestJS DI throughout
- **Extensible**: Add new gateways without modifying core logic
- **Idempotent**: Safe payment operations with idempotency key support
- **Webhook normalization**: Unified webhook events across providers
- **Jest testing with 80%+ coverage required**
- **Changesets for versioning and changelog**

---

## 🏗️ PaymentKit Project Structure

PaymentKit uses a Hexagonal Architecture (Ports & Adapters) for gateway abstraction.

```
src/
  index.ts                      # PUBLIC API exports
  paymentKit.module.ts          # Main NestJS module
  common/
    constants.ts                # DI tokens, magic strings
    errors/                     # Error models
    types/                      # Shared type definitions
    utils/                      # Helper functions
  config/
    paymentKit.config.ts        # Public config interface
    paymentKit.config-loader.ts # Env-based config builder
    gateways/                   # Gateway-specific configs
      stripe.config.ts
      paypal.config.ts
  core/
    entities/                   # Domain entities
      payment.entity.ts
      refund.entity.ts
      payment-status.enum.ts
    value-objects/
      money.value-object.ts
    ports/                      # Interface contracts (Hexagonal)
      payment-gateway.port.ts
      payment-engine.port.ts
    services/
      payment-engine.service.ts # Main orchestrator
      gateway-registry.service.ts
      error-normalizer.service.ts
  adapters/                     # Gateway implementations
    stripe/
      stripe.gateway.ts
      stripe-webhook.handler.ts
      stripe-payments.client.ts
    paypal/
      paypal.gateway.ts
      paypal-webhook.handler.ts
      paypal-payments.client.ts
  controllers/
    payments.controller.ts       # Main API endpoints
    webhooks.controller.ts       # Internal webhook controller
```

**Responsibility Layers:**

| Layer           | Responsibility                   | Examples                    |
| --------------- | -------------------------------- | --------------------------- |
| **Controllers** | HTTP endpoints, request handling | `payments.controller.ts`    |
| **Services**    | Business logic, orchestration    | `payment-engine.service.ts` |
| **Adapters**    | Gateway-specific implementations | `stripe.gateway.ts`         |
| **Ports**       | Interface contracts              | `payment-gateway.port.ts`   |
| **Entities**    | Domain models                    | `payment.entity.ts`         |
| **Config**      | Configuration management         | `paymentKit.config.ts`      |

**Public API Exports:**

```typescript
// src/index.ts - Only export what consumers need
export { PaymentKitModule } from './paymentKit.module';
export { PaymentsService } from './core/services';
export { PaymentEngine } from './core/ports';
export { Payment, PaymentStatus, Refund } from './core/entities';
export type { PaymentKitConfig } from './config';
```

---

## 📝 Naming Conventions

### Files

**Pattern**: `kebab-case` + suffix

| Type       | Example                     | Directory        |
| ---------- | --------------------------- | ---------------- |
| Controller | `payments.controller.ts`    | `controllers/`   |
| Service    | `payment-engine.service.ts` | `core/services/` |
| Gateway    | `stripe.gateway.ts`         | `adapters/`      |
| Handler    | `stripe-webhook.handler.ts` | `adapters/`      |
| Client     | `stripe-payments.client.ts` | `adapters/`      |
| Entity     | `payment.entity.ts`         | `core/entities/` |
| Config     | `stripe.config.ts`          | `config/`        |
| Utility    | `currency.utils.ts`         | `common/utils/ ` |

### Code Naming

- **Classes & Interfaces**: `PascalCase` → `StripeGateway`, `PaymentEngine`
- **Functions & Methods**: `camelCase` → `createPayment()`, `normalizeError()`
- **Constants**: `UPPER_SNAKE_CASE` → `STRIPE_API_KEY`, `PAYMENT_TIMEOUT`
- **Variables**: `camelCase` → `paymentData`, `gatewayKey`

### Path Aliases

Configured in `tsconfig.json`:

```json
"@common/*"    → "src/common/*",
"@config/*"    → "src/config/*",
"@core/*"      → "src/core/*",
"@adapters/*"  → "src/adapters/*",
"@controllers/*" → "src/controllers/*"
```

---

## 🧪 Testing - MANDATORY for PaymentKit

### Coverage Target: 80%+ (REQUIRED)

**Unit Tests - MANDATORY:**

- ✅ Payment service logic
- ✅ Error normalization
- ✅ Gateway registry
- ✅ Config loading

**Integration Tests:**

- ✅ Payment flow (create → status → refund)
- ✅ Webhook handling for each gateway
- ✅ Gateway fallback/switching

**Test file location:**

```
src/
  ├── core/
  │   └── services/
  │       ├── payment-engine.service.ts
  │       └── payment-engine.service.spec.ts
  └── adapters/
      └── stripe/
          ├── stripe.gateway.ts
          └── stripe.gateway.spec.ts
```

---

## 📚 Documentation - REQUIRED

### JSDoc/TSDoc - MANDATORY for all public APIs:

```typescript
/**
 * Creates a payment with the specified gateway
 * @param command - Payment creation command (amount, currency, gateway)
 * @returns Created payment with status and transaction ID
 * @throws {PaymentError} If payment creation fails
 * @example
 * const payment = await paymentsService.createPayment({
 *   amount: 9999,
 *   currency: 'USD',
 *   gateway: 'stripe'
 * });
 */
async createPayment(command: CreatePaymentCommand): Promise<Payment>
```

---

## 🚀 Development Principles

### 1. Gateway Abstraction

- ✅ All gateways implement `PaymentGateway` port
- ✅ Business logic in services, not adapters
- ✅ Gateway-specific code isolated in adapters
- ✅ Easy to add new gateways without modifying core

### 2. Error Normalization

- ✅ Normalize all gateway errors to `PaymentError`
- ✅ Never expose provider-specific error details
- ✅ Consistent error codes across gateways

### 3. Webhook Handling

- ✅ Built-in webhook controller for all gateways
- ✅ Automatic gateway detection via header
- ✅ Webhook signature verification per gateway
- ✅ Normalized event dispatch

### 4. Type Safety

- ✅ Full TypeScript strict mode
- ✅ Strong typing for all entities
- ✅ Money value objects for currency handling

---

## 🔄 Workflow & Task Management

### Branch Naming:

```bash
feature/PAY-123-add-stripe-payment
bugfix/PAY-456-webhook-timeout
refactor/PAY-789-error-handling
```

### Task Documentation:

```
docs/tasks/active/PAY-123-add-feature.md
docs/tasks/archive/by-release/v1.2.0/
```

---

## 📦 Versioning & Breaking Changes

### Semantic Versioning (STRICT)

- **MAJOR** (x.0.0): Breaking changes to PaymentGateway port
- **MINOR** (0.x.0): New gateways, new payment types
- **PATCH** (0.0.x): Bug fixes, webhook improvements

### Changesets Workflow

**ALWAYS create a changeset for user-facing changes:**

```bash
npx changeset
```

---

## ✅ Release Checklist

Before publishing:

- [ ] All tests passing (100% of test suite)
- [ ] Coverage >= 80%
- [ ] No ESLint warnings (`--max-warnings=0`)
- [ ] TypeScript strict mode passing
- [ ] All public APIs documented (JSDoc)
- [ ] Changeset created
- [ ] No security vulnerabilities (`npm audit`)
- [ ] Webhook integration tested with all gateways

---

## 🎨 Code Style

- ESLint `--max-warnings=0`
- Prettier formatting
- TypeScript strict mode
- Dependency injection via constructor

---

## 💬 Communication Style

- Brief and direct
- Focus on payment security and reliability
- Highlight security implications immediately
- PaymentKit handles real money

---

## 📋 Summary

**PaymentKit Principles:**

1. Security first (payment data)
2. Comprehensive testing (80%+)
3. Complete documentation
4. Gateway abstraction
5. Error normalization
6. Webhook reliability
7. Type safety

---

_Last Updated: March 1, 2026_  
_Version: 1.2.0_
