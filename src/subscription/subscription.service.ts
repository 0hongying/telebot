import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { BotPlan } from 'src/subscription/entity/bot-plan.entity';
import { BotSubscription } from 'src/subscription/entity/bot-subscription.entity';
import { onInstance0 } from 'src/shared/task.service';
import { Repository } from 'typeorm';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(BotSubscription)
    private readonly botSubscriptionRepository: Repository<BotSubscription>,
    @InjectRepository(BotPlan)
    private readonly botPlanRepository: Repository<BotPlan>,
  ) {}

  async getSubscriptionPlan(userId: number) {
    const date = new Date();
    const currentSusbcription = await this.botSubscriptionRepository.findOneBy({ userId: userId, status: 'ACTIVE' });
    if (currentSusbcription && currentSusbcription.startTime < date && currentSusbcription.endTime > date) {
      const currentPlan = await this.botPlanRepository.findOneByOrFail({ id: currentSusbcription.planId });
      return {
        plan: currentPlan.name,
        startTime: currentSusbcription.startTime,
        endTime: currentSusbcription.endTime,
        channelType: currentSusbcription.channelType,
        autoRenew: currentSusbcription.autoRenew,
      };
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { disabled: !onInstance0() })
  async scanExpiredSubscription() {
    console.log('begin scan expired subscription', new Date());
    try {
      const subscriptions = await this.botSubscriptionRepository
        .createQueryBuilder('subscription')
        .where('subscription.end_time < :currentDate', { currentDate: new Date() })
        .andWhere('subscription.status = :status', { status: 'ACTIVE' })
        .orderBy('subscription.id', 'ASC')
        .getMany();

      for (const subscription of subscriptions) {
        try {
          await this.updateExpired(subscription);
        } catch (e) {
          console.log(e);
        }
      }
    } catch (error) {
      console.error(error);
    }
    console.log('end scan expired subscription');
  }

  private async updateExpired(subscription: BotSubscription) {
    await this.botSubscriptionRepository
      .createQueryBuilder()
      .update(BotSubscription)
      .set({ status: 'EXPIRED' })
      .where('id = :id', { id: subscription.id })
      .execute();
  }
}
