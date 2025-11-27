import { PAYMENTKIT_CONFIG } from '@common/constants';
import { PaymentKitPublicConfig } from '@config/paymentKit.config';
import { PaymentKitConfigLoader } from '@config/paymentKit.config-loader';
import { DynamicModule, Module } from '@nestjs/common';

@Module({})
export class PaymentKitModule {
  static register(config: PaymentKitPublicConfig): DynamicModule {
    const resolvedConfig = PaymentKitConfigLoader.loadFromEnv(config);

    return {
      module: PaymentKitModule,
      providers: [{ provide: PAYMENTKIT_CONFIG, useValue: resolvedConfig }],
      exports: [PAYMENTKIT_CONFIG],
    };
  }
}
