# Integration Tests

This directory contains integration tests that verify PaymentKit works correctly with real gateway sandbox environments.

## Structure

```
integration/
├── README.md                    # This file
├── setup.ts                     # Test environment setup
├── stripe/
│   ├── stripe-payments.integration.spec.ts
│   ├── stripe-webhooks.integration.spec.ts
│   └── stripe-refunds.integration.spec.ts
└── paypal/
    ├── paypal-payments.integration.spec.ts
    ├── paypal-webhooks.integration.spec.ts
    └── paypal-refunds.integration.spec.ts
```

## Running Integration Tests

Integration tests require real API credentials for gateway sandbox environments.

### Prerequisites

1. **Stripe Test Account**
   - Sign up at https://stripe.com
   - Get test API keys from Dashboard > Developers > API keys
   - Get webhook signing secret

2. **PayPal Sandbox Account**
   - Sign up at https://developer.paypal.com
   - Create sandbox app
   - Get client ID and secret

### Environment Setup

Create `.env.test` file in project root:

```bash
# Test environment
PAYMENTKIT_ENVIRONMENT=sandbox
PAYMENTKIT_DEFAULT_CURRENCY=USD

# Stripe Test Keys
PAYMENTKIT_STRIPE_ENABLED=true
PAYMENTKIT_STRIPE_SECRET_KEY=sk_test_...
PAYMENTKIT_STRIPE_WEBHOOK_SECRET=whsec_test_...

# PayPal Sandbox Keys
PAYMENTKIT_PAYPAL_ENABLED=true
PAYMENTKIT_PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYMENTKIT_PAYPAL_SECRET=your-sandbox-secret
PAYMENTKIT_PAYPAL_WEBHOOK_ID=your-webhook-id
```

### Run Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific gateway tests
npm run test:integration -- --testPathPattern=stripe
npm run test:integration -- --testPathPattern=paypal

# Run with coverage
npm run test:integration -- --coverage
```

## Test Scenarios

### Payment Flow Tests

- Create payment with valid data
- Create payment with invalid data
- Retrieve payment status
- Handle payment errors

### Webhook Tests

- Verify webhook signatures
- Process payment success events
- Process payment failure events
- Handle duplicate webhooks

### Refund Tests

- Process full refunds
- Process partial refunds
- Handle refund errors
- Verify refund status

## Test Data

All tests use sandbox/test mode data:

- **Stripe test cards**: https://stripe.com/docs/testing
- **PayPal sandbox accounts**: Generated in PayPal developer dashboard

## CI/CD Integration

Integration tests are **NOT** run in CI by default (to avoid exposing secrets).

To enable in CI:

1. Add secrets to CI environment
2. Update CI workflow to run integration tests on specific branches

## Notes

- Integration tests are slower than unit tests (real network calls)
- Use test mode/sandbox only - never production credentials
- Clean up test data after each test run
- Rate limits apply even in sandbox mode
