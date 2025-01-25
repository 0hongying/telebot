import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BotMessageQuota } from 'src/subscription/entity/bot-message-quota.entity';
import { BotPlan } from 'src/subscription/entity/bot-plan.entity';
import { BotSubscription } from 'src/subscription/entity/bot-subscription.entity';
import { LessThan, MoreThan, Repository } from 'typeorm';

@Injectable()
export class SubscriptionDataService {
  constructor(
    @InjectRepository(BotPlan)
    private readonly botPlanRepository: Repository<BotPlan>,
    @InjectRepository(BotSubscription)
    private readonly botSubscriptionRepository: Repository<BotSubscription>,
    @InjectRepository(BotMessageQuota)
    private readonly botMessageQuotaRepository: Repository<BotMessageQuota>,
  ) {}

  async getCurrentSubscription(userId: number) {
    const date = new Date();
    return await this.botSubscriptionRepository.findOneBy({
      userId,
      status: 'ACTIVE',
      startTime: LessThan(date),
      endTime: MoreThan(date),
    });
  }

  async getSubscriptionDetail(userId: number, planId: number, subscriptionId: number) {
    const date = new Date();
    const currentPlan = await this.botPlanRepository.findOneByOrFail({ id: planId });
    const messageQuotas = await this.botMessageQuotaRepository.findOneByOrFail({
      userId,
      sourceType: 'SUBSCRIBE',
      sourceId: subscriptionId,
      startTime: LessThan(date),
      endTime: MoreThan(date),
      obsolete: false,
    });
    return {
      plan: currentPlan.name,
      usedCount: messageQuotas.usedCount,
      quotaCount: messageQuotas.quotaCount,
    };
  }

  async findActiveSubscription(userId: number) {
    const subscription = await this.botSubscriptionRepository.findOneBy({ userId, status: 'ACTIVE' });
    const date = new Date();
    if (!!subscription && subscription.startTime < date && subscription.endTime > date) {
      return subscription;
    }
    return null;
  }
}
