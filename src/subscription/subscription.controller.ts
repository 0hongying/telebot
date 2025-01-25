import { Controller, Get, Param } from '@nestjs/common';
import { msgSuccess } from 'src/shared/utils';
import { SubscriptionService } from 'src/subscription/subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('/plan/:userId')
  async getSubscriptionPlan(@Param('userId') userId: string) {
    const data = await this.subscriptionService.getSubscriptionPlan(Number(userId));
    return msgSuccess({ data });
  }
}
