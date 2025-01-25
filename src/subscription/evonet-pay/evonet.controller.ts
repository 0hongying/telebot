import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { EvonetService } from './evonet.service';
import { msgFail, msgSuccess } from 'src/shared/utils';
import { RealIP } from 'nestjs-real-ip';
import { isString } from 'lodash';

@Controller('evonet')
export class EvonetController {
  constructor(private readonly evonetService: EvonetService) {}

  @Post('card-pay')
  @HttpCode(200)
  cardPay(@Body() body: any, @RealIP() ip: str) {
    return this.evonetService.cardPay(body, ip);
  }

  @Post('webhook')
  @HttpCode(200)
  async notification(@Body() body: any) {
    console.log(`[evonet] webhook: ${body}`);
    return this.evonetService.webhook(body);
  }

  @Post('sub-upgrade')
  @HttpCode(200)
  async handleSubscriptionUpgrade(@Body() body: { title: string; type: string; userId: number }) {
    const data = await this.evonetService.beginSubscriptionUpgrade(body);
    return msgSuccess({ data });
  }

  @Post('order-state')
  @HttpCode(200)
  async fetchOrderState(@Body() body: any) {
    try {
      const data = await this.evonetService.fetchOrderState(body);
      if (data.done && !data.isOk) {
        return msgFail({ msg: data.reason, data });
      }
      return msgSuccess({ data });
    } catch (err) {
      let msg = '';
      if (isString(err)) {
        msg = err;
      }
      return msgFail({ msg });
    }
  }

  @Get('sub-plan/:userId')
  async getSubscriptionPlan(@Param('userId') userId: string) {
    const data = await this.evonetService.getPlanDetail(Number(userId));
    return msgSuccess({ data });
  }
}
