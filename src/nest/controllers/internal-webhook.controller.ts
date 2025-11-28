import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';

/**
 * Internal webhook endpoint used by PaymentKit.
 * Gateways will eventually target this endpoint (directly or via proxy).
 *
 * Further behaviour (routing, verification, normalization) will be added
 * in the next tickets.
 */
@Controller('paymentKit/webhooks/internal')
export class InternalWebhookController {
  @Post()
  @HttpCode(202)
  async handleInternalWebhook(
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[]>,
  ): Promise<void> {
    // Will be wired to router / verification / normalization logic later
  }
}
