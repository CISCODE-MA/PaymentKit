import { DynamicModule, Module } from '@nestjs/common';
import { PAYMENTKIT_CONFIG } from '@common/constants';
import type { PaymentKitPublicConfig } from '@config/paymentKit.config';
import { PaymentKitConfigLoader } from '@config/paymentKit.config-loader';

import { InternalWebhookController } from './nest/controllers/internal-webhook.controller';

import {
  InMemoryWebhookEventDispatcher,
  type WebhookEventDispatcher,
} from '@src/core/services/webhook-event-dispatcher.service';
import { WebhookGatewayRouter } from '@src/core/services/webhook-gateway-router.service';

import {
  InMemoryGatewayRegistry,
  type GatewayRegistry,
} from '@src/core/services/gateway-registry.service';
import {
  DefaultErrorNormalizer,
  type ErrorNormalizer,
} from '@src/core/services/error-normalizer.service';
import { DefaultPaymentEngine } from '@src/core/services/payment-engine.service';

import { PaymentsService } from '@src/nest/services/payments.service';
import type { PaymentGateway } from './core/ports/payment-gateway.port';

// Stripe stack
import { StripeClient } from '@src/core/gateways/stripe/stripe.client';
import { StripePaymentsClient } from '@src/core/gateways/stripe/stripe-payments.client';
import { StripeGateway } from '@src/core/gateways/stripe/stripe.gateway';
import { StripeWebhookHandler } from '@src/core/gateways/stripe/stripe-webhook.handler';

// PayPal stack
import { PaypalClient } from '@src/core/gateways/paypal/paypal.client';
import { PaypalPaymentsClient } from '@src/core/gateways/paypal/paypal-payments.client';
import { PaypalGateway } from '@src/core/gateways/paypal/paypal.gateway';
import { PaypalWebhookHandler } from '@src/core/gateways/paypal/paypal-webhook.handler';

@Module({})
export class PaymentKitModule {
  static register(config: PaymentKitPublicConfig): DynamicModule {
    const resolvedConfig = PaymentKitConfigLoader.loadFromEnv(config);

    return {
      module: PaymentKitModule,
      controllers: [InternalWebhookController],
      providers: [
        { provide: PAYMENTKIT_CONFIG, useValue: resolvedConfig },

        // ---------------- Webhooks infra ----------------
        { provide: InMemoryWebhookEventDispatcher, useClass: InMemoryWebhookEventDispatcher },
        {
          provide: WebhookGatewayRouter,
          useFactory: (dispatcher: WebhookEventDispatcher) => new WebhookGatewayRouter(dispatcher),
          inject: [InMemoryWebhookEventDispatcher],
        },

        // ---------------- Core engine plumbing ----------------
        { provide: DefaultErrorNormalizer, useClass: DefaultErrorNormalizer },

        // ---------------- Stripe providers (nullable) ----------------
        {
          provide: StripeClient,
          useFactory: () => {
            const stripeCfg = resolvedConfig.gateways.stripe;
            return stripeCfg ? new StripeClient({ config: stripeCfg }) : null;
          },
        },
        {
          provide: StripePaymentsClient,
          useFactory: (client: StripeClient | null) =>
            client ? new StripePaymentsClient(client) : null,
          inject: [StripeClient],
        },
        {
          provide: StripeGateway,
          useFactory: (payments: StripePaymentsClient | null) =>
            payments ? new StripeGateway(payments) : null,
          inject: [StripePaymentsClient],
        },

        // ---------------- PayPal providers (nullable) ----------------
        {
          provide: PaypalClient,
          useFactory: () => {
            const paypalCfg = resolvedConfig.gateways.paypal;
            return paypalCfg
              ? new PaypalClient({ config: paypalCfg, environment: resolvedConfig.environment })
              : null;
          },
        },
        {
          provide: PaypalPaymentsClient,
          useFactory: (client: PaypalClient | null) =>
            client ? new PaypalPaymentsClient(client) : null,
          inject: [PaypalClient],
        },
        {
          provide: PaypalGateway,
          useFactory: (payments: PaypalPaymentsClient | null) =>
            payments ? new PaypalGateway(payments) : null,
          inject: [PaypalPaymentsClient],
        },

        // ---------------- Registry ----------------
        {
          provide: InMemoryGatewayRegistry,
          useFactory: (stripe: StripeGateway | null, paypal: PaypalGateway | null) => {
            const gateways: PaymentGateway[] = [];
            if (stripe) gateways.push(stripe);
            if (paypal) gateways.push(paypal);
            return new InMemoryGatewayRegistry(gateways);
          },
          inject: [StripeGateway, PaypalGateway],
        },

        // ---------------- Engine ----------------
        {
          provide: DefaultPaymentEngine,
          useFactory: (registry: GatewayRegistry, normalizer: ErrorNormalizer) =>
            new DefaultPaymentEngine(registry, normalizer),
          inject: [InMemoryGatewayRegistry, DefaultErrorNormalizer],
        },

        // ---------------- Public Nest facade ----------------
        PaymentsService,

        // ---------------- Register webhook handlers into router ----------------
        {
          provide: 'PAYMENTKIT_WEBHOOK_HANDLER_REGISTRATION',
          useFactory: (router: WebhookGatewayRouter) => {
            // PayPal: handler takes PaypalInternalConfig | null
            const paypalCfg = resolvedConfig.gateways.paypal ?? null;
            if (paypalCfg) {
              router.registerHandler(new PaypalWebhookHandler(paypalCfg));
            }

            // Stripe: handler takes endpoint secret string | null
            const stripeSecret = resolvedConfig.gateways.stripe?.webhookSecret ?? null;
            if (stripeSecret) {
              router.registerHandler(new StripeWebhookHandler(stripeSecret));
            }

            return true;
          },
          inject: [WebhookGatewayRouter],
        },
      ],
      exports: [
        PAYMENTKIT_CONFIG,

        // Main thing the host app should use
        PaymentsService,

        // Optional exports (useful for advanced host usage / testing)
        DefaultPaymentEngine,
        InMemoryGatewayRegistry,
        DefaultErrorNormalizer,

        // Webhooks
        WebhookGatewayRouter,
        InMemoryWebhookEventDispatcher,
      ],
    };
  }
}
