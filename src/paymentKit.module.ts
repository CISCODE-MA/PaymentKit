import { DynamicModule, Module } from '@nestjs/common';
import { PAYMENTKIT_CONFIG } from '@common/constants';
import { PaymentKitPublicConfig } from '@config/paymentKit.config';
import { PaymentKitConfigLoader } from '@config/paymentKit.config-loader';
import { InternalWebhookController } from './nest/controllers/internal-webhook.controller';
import { WebhookGatewayRouter } from '@src/core/services/webhook-gateway-router.service';
import {
  InMemoryWebhookEventDispatcher,
  type WebhookEventDispatcher,
} from '@src/core/services/webhook-event-dispatcher.service';

@Module({
  controllers: [InternalWebhookController],
  providers: [WebhookGatewayRouter, InMemoryWebhookEventDispatcher],
  exports: [WebhookGatewayRouter, InMemoryWebhookEventDispatcher],
})
export class PaymentKitModule {
  static register(config: PaymentKitPublicConfig): DynamicModule {
    const resolvedConfig = PaymentKitConfigLoader.loadFromEnv(config);

    return {
      module: PaymentKitModule,
      controllers: [InternalWebhookController],
      providers: [
        { provide: PAYMENTKIT_CONFIG, useValue: resolvedConfig },
        {
          provide: InMemoryWebhookEventDispatcher,
          useClass: InMemoryWebhookEventDispatcher,
        },
        {
          provide: WebhookGatewayRouter,
          useFactory: (dispatcher: WebhookEventDispatcher) => new WebhookGatewayRouter(dispatcher),
          inject: [InMemoryWebhookEventDispatcher],
        },
      ],
      exports: [PAYMENTKIT_CONFIG, WebhookGatewayRouter, InMemoryWebhookEventDispatcher],
    };
  }
}
