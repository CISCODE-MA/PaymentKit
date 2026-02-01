import { BadRequestException, Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import type { GatewayKey } from '@common/types/gateway.types';
import { WebhookGatewayRouter } from '@src/core/services/webhook-gateway-router.service';

/**
 * Internal webhook endpoint used by PaymentKit.
 * Gateways will eventually target this endpoint (directly or via proxy).
 */
@Controller('paymentKit/webhooks/internal')
export class InternalWebhookController {
  constructor(private readonly router: WebhookGatewayRouter) {}

  @Post()
  @HttpCode(202)
  async handleInternalWebhook(
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[]>,
  ): Promise<void> {
    const gatewayKey = this.extractGatewayFromHeaders(headers);

    if (!gatewayKey) {
      throw new BadRequestException('Missing or invalid x-paymentkit-gateway header');
    }

    await this.router.route({
      gateway: gatewayKey,
      body,
      headers,
    });
  }

  private extractGatewayFromHeaders(
    headers: Record<string, string | string[]>,
  ): GatewayKey | undefined {
    const raw =
      headers['x-paymentkit-gateway'] ??
      headers['X-PaymentKit-Gateway'] ??
      headers['X-PAYMENTKIT-GATEWAY'];

    const value = Array.isArray(raw) ? raw[0] : raw;

    if (value !== 'stripe' && value !== 'paypal') {
      return undefined;
    }

    return value as GatewayKey;
  }
}
