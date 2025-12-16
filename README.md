# @ciscode/PaymentKit

PaymentKit is a flexible payment orchestration package for **NestJS**, designed to integrate **PayPal** and **Stripe** payment gateways with minimal configuration. This package simplifies the payment lifecycle while exposing a unified API for payment creation, status retrieval, refunds, and webhook handling.

---

## Features

- **Unified API**: Easy-to-integrate payment flow for Stripe and PayPal.
- **nextAction Handling**: Returns actionable next steps (`client_secret` for Stripe, redirect URL for PayPal).
- **Webhooks**: Built-in internal webhook handler for both PayPal and Stripe, with event routing.
- **Idempotency & Retry Safe**: Ensures safe and repeatable payment actions.
- **Zero configuration required** for the host app to get started.

---

## Architecture

PaymentKit implements a **Modular** architecture:

1. **PaymentKitModule**: The central module for registering and wiring all payment logic.
2. **PaymentsService**: The service used by the host app to manage the payment lifecycle.
3. **Gateways**:
   - **StripeGateway**: Handles Stripe-specific payment flow.
   - **PaypalGateway**: Handles PayPal-specific payment flow.
4. **Webhook Handler**: Automatically handles incoming webhooks from Stripe/PayPal and triggers the appropriate actions based on gateway events.
5. **Error Handling**: Maps gateway-specific errors to a unified error structure.
6. **Next Action**: Facilitates the next step of the payment process (either redirect URL or client secret for Stripe).

---

## Install & Run

1. **Install the package**:
   In your **NestJS** application, install PaymentKit via npm:

   ```bash
   npm install @ciscode/paymentkit@latest
   ```

2. **Configure the payment module:**
   Import the PaymentKitModule in your AppModule and pass the necessary configuration (PayPal/Stripe).

   ```ts
   import { Module } from '@nestjs/common';
   import { PaymentKitModule } from '@ciscode/paymentkit';

   @Module({
     imports: [
       PaymentKitModule.register({
         environment: process.env.PAYMENTKIT_ENVIRONMENT ?? 'sandbox',
         gateways: {
           paypal: { enabled: true },
           stripe: { enabled: true },
         },
         webhooks: { mode: 'internal' }, // Optionally set to 'external' if required
       }),
     ],
   })
   export class AppModule {}
   ```

3. **Create payment**
   Use the PaymentsService to create a payment:

   ```ts
   import { Injectable } from '@nestjs/common';
   import { PaymentsService } from '@ciscode/paymentkit';
   import { CreatePaymentCommand } from '@ciscode/paymentkit';

   @Injectable()
   export class MyPaymentService {
     constructor(private readonly paymentsService: PaymentsService) {}

     async createPayment() {
       const command: CreatePaymentCommand = {
         gateway: 'paypal', // or 'stripe'
         amount: { amount: 1000, currency: 'USD' },
         metadata: { orderId: 'o_1' },
       };

       const result = await this.paymentsService.createPayment(command);

       if (result.nextAction?.type === 'redirect') {
         // Redirect the user to PayPal
         console.log('Redirect to PayPal: ', result.nextAction.url);
       } else if (result.nextAction?.type === 'client_secret') {
         // Process Stripe payment with client_secret
         console.log('Stripe client secret: ', result.nextAction.clientSecret);
       }
     }
   }
   ```

4. **Start the app**
   Start your NestJS app as usual:
   ```bash
   npm run start
   ```

---

## Environment Variable

Set the following environment variables for Stripe and PayPal configurations:

```bash
# Required environment variables
PAYMENTKIT_ENVIRONMENT=production   # Set to 'sandbox' for testing
STRIPE_API_KEY=sk_test_yourapikey   # Stripe API key
PAYPAL_CLIENT_ID=your-paypal-client-id  # PayPal Client ID
PAYPAL_SECRET=your-paypal-secret-key   # PayPal Secret Key
```

Ensure your app is running in sandbox mode for testing or production when live.

**Optional**:
If you need to tweak the webhook handling:

```bash
WEBHOOK_MODE=internal  # Set to 'external' if using external webhook endpoints
```

---

## Usage Example

This example creates a payment via PayPal or Stripe.

```ts
const command = {
  gateway: 'paypal', // or 'stripe'
  amount: { amount: 1000, currency: 'USD' },
  metadata: { orderId: 'o_1' },
};

const result = await payments.createPayment(command);

if (result.nextAction?.type === 'redirect') {
  // Handle PayPal redirect
  console.log('Redirect URL: ', result.nextAction.url);
} else if (result.nextAction?.type === 'client_secret') {
  // Handle Stripe client secret
  console.log('Stripe client secret: ', result.nextAction.clientSecret);
}
```

---

## Changelog

This package uses automated changelog generation. All releases are tagged and documented in the changelog.

---

## Known Issues & Limitations

• Stripe webhook signature verification is not included in this package. Please ensure your webhook handling is secure.
• Only supports Stripe PaymentIntent flow, not Checkout Sessions yet (we’ll add this in future versions).

--- 

## Maintainer  

[TheVlpha](https://gihub.com/Zaiidmo)