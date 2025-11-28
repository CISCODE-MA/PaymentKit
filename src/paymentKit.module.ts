import { DynamicModule, Module } from '@nestjs/common';
import { PAYMENTKIT_CONFIG } from '@common/constants';
import { PaymentKitPublicConfig } from '@config/paymentKit.config';
import { PaymentKitConfigLoader } from '@config/paymentKit.config-loader';
import { InternalWebhookController } from './nest/controllers/internal-webhook.controller';
import { WebhookGatewayRouter } from '@src/core/services/webhook-gateway-router.service';

@Module({
  controllers: [InternalWebhookController],
  providers: [WebhookGatewayRouter],
  exports: [WebhookGatewayRouter],
})
export class PaymentKitModule {
  static register(config: PaymentKitPublicConfig): DynamicModule {
    const resolvedConfig = PaymentKitConfigLoader.loadFromEnv(config);

    return {
      module: PaymentKitModule,
      controllers: [InternalWebhookController],
      providers: [{ provide: PAYMENTKIT_CONFIG, useValue: resolvedConfig }, WebhookGatewayRouter],
      exports: [PAYMENTKIT_CONFIG, WebhookGatewayRouter],
    };
  }
}
