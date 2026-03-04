# PaymentKit Examples

This directory contains practical, real-world examples demonstrating how to use PaymentKit in various scenarios.

## Available Examples

### 1. [Basic Payment Flow](./01-basic-payment-flow.ts)

Simple payment creation with Stripe and PayPal, including next action handling.

### 2. [E-commerce Checkout](./02-ecommerce-checkout.ts)

Complete checkout flow with order management, payment creation, and confirmation.

### 3. [Webhook Handling](./03-webhook-handling.ts)

Setting up and handling payment webhooks from Stripe and PayPal.

### 4. [Error Handling](./04-error-handling.ts)

Comprehensive error handling patterns for payment operations.

### 5. [Refund Operations](./05-refund-operations.ts)

Full and partial refund examples with proper error handling.

### 6. [Multi-Gateway Switching](./06-multi-gateway-switching.ts)

Dynamically switching between payment gateways based on business logic.

## Running the Examples

These examples are TypeScript files showing integration patterns. To use them in your project:

1. Install PaymentKit:

   ```bash
   npm install @ciscode/paymentkit
   ```

2. Configure environment variables (see each example for required variables)

3. Adapt the code to your application structure

## Prerequisites

- NestJS application
- Environment variables configured for your chosen gateways
- Basic understanding of async/await and error handling

## Need Help?

- Check the [main README](../README.md)
- Review [GitHub Copilot instructions](../.github/instructions/)
- Open an [issue](https://github.com/CISCODE-MA/PaymentKit/issues) if you encounter problems
