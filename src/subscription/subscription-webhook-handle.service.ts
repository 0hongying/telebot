import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { SubscriptionDataService } from 'src/subscription/service/subscription-data.service';
import { MessageQuotaDataService } from 'src/subscription/service/message-quota-data.service';
import { BotPlan } from 'src/subscription/entity/bot-plan.entity';
import { BotSubscriptionHistory } from 'src/subscription/entity/bot-subscription-history.entity';
import { BotSubscription } from 'src/subscription/entity/bot-subscription.entity';
import { BotMessageQuota } from 'src/subscription/entity/bot-message-quota.entity';

@Injectable()
export class SubscriptionWebhookHandleService {
  constructor(
    @InjectRepository(BotMessageQuota)
    private readonly messageQuotaRepository: Repository<BotMessageQuota>,
    @InjectRepository(BotSubscription)
    private readonly subscriptionRepository: Repository<BotSubscription>,
    @InjectRepository(BotSubscriptionHistory)
    private readonly subscriptionHistoryRepository: Repository<BotSubscriptionHistory>,
    @InjectRepository(BotPlan)
    private readonly planRepository: Repository<BotPlan>,
    private readonly subscriptionDataService: SubscriptionDataService,
    private readonly messageQuotaDataService: MessageQuotaDataService,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  public readonly PAYMENT_DAOHE_ID: number = 3;
  private readonly MAX_PERIOD_DAYS = 40; // 最大周期长度为40天

  async handleSuscriptionCreated(
    userId: number,
    planId: number,
    paymentChannelId?: number,
    channelType?: string,
    messageQuotaCount?: number,
    subscriptionEndTime?: Date,
    thirdPartySubscriptionId?: string,
    event?: string,
  ) {
    try {
      if (subscriptionEndTime && new Date().getTime() >= subscriptionEndTime.getTime()) {
        console.log(`subscription endTime is ${subscriptionEndTime} for user: ${userId}, not greater than current time`);
        return null;
      }
      console.log(`handle subscription  ${planId} created for user: ${userId}`);
      return await this.createNewSubscriptionIfNotExistsActive(
        userId,
        planId,
        paymentChannelId,
        channelType,
        messageQuotaCount,
        subscriptionEndTime,
        thirdPartySubscriptionId,
        event,
      );
    } catch (error) {
      console.error('customer.subscription.created error');
      console.error(error);
      throw new HttpException('internal error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async handleSuscriptionExpired(userId: number, currentSubscription: BotSubscription) {
    try {
      currentSubscription.status = 'EXPIRED';
      await this.subscriptionRepository.save(currentSubscription);
      await this.messageQuotaDataService.obsoleteAll(userId, currentSubscription);
    } catch (error) {
      console.error('handle subscription expired error');
      console.error(error);
      throw new HttpException('internal error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private getPlanDays(plan: BotPlan) {
    if (plan.type === '3MONTHS') {
      return 92;
    } else if (plan.type === 'YEARLY') {
      return 367;
    } else {
      return 32;
    }
  }

  private async createNewSubscriptionIfNotExistsActive(
    userId: number,
    planId: number,
    paymentChannelId?: number,
    channelType?: string,
    messageQuotaCount?: number,
    subscriptionEndTime?: Date,
    thirdPartySubscriptionId?: string,
    event?: string,
  ) {
    let plan = await this.planRepository.findOneBy({ id: planId });
    return await this.entityManager.transaction(async () => {
      if (!plan) {
        throw new Error(`plan not exist for : ${planId}`);
      }
      const planDays = this.getPlanDays(plan);
      const currentSusbcription = await this.subscriptionDataService.findActiveSubscription(userId);
      if (currentSusbcription) {
        console.error('can not create subscription since user has active subscription, userId: ', userId);
        return;
      }
      const startTime = new Date();
      const endTime = subscriptionEndTime ? subscriptionEndTime : new Date(startTime.getTime() + planDays * 24 * 60 * 60 * 1000);
      return await this.processCreateSubscription(userId, plan, startTime, endTime, paymentChannelId, channelType, thirdPartySubscriptionId, event);
    });
  }

  async processCreateSubscription(
    userId: number,
    plan: BotPlan,
    startTime: Date,
    endTime: Date,
    paymentChannelId?: number,
    channelType?: string,
    thirdPartySubscriptionId?: string,
    subscriptionCustomerId?: string,
    event?: string,
  ) {
    const subscriptionEntity = await this.subscriptionRepository.save(
      new BotSubscription(
        userId,
        plan.id,
        'ACTIVE',
        startTime,
        endTime,
        paymentChannelId,
        channelType,
        subscriptionCustomerId,
        thirdPartySubscriptionId,
      ),
    );
    this.subscriptionHistoryRepository.save(
      new BotSubscriptionHistory(
        userId,
        null,
        plan.id,
        new Date(),
        'New Subscribe',
        paymentChannelId,
        channelType,
        subscriptionCustomerId,
        thirdPartySubscriptionId,
      ),
    );
    if ((endTime.getTime() - startTime.getTime()) / (24 * 60 * 60 * 1000) < this.MAX_PERIOD_DAYS) {
      await this.messageQuotaRepository.save(new BotMessageQuota(userId, plan.quotaCount, 0, startTime, endTime, 'SUBSCRIBE', subscriptionEntity.id));
    } else {
      const messageQuotaPeriods = this.getSubscriptionPeriods(startTime.getTime(), endTime.getTime());
      for (const period of messageQuotaPeriods) {
        await this.messageQuotaRepository.save(
          new BotMessageQuota(userId, plan.quotaCount, 0, period.start, period.end, 'SUBSCRIBE', subscriptionEntity.id),
        );
      }
    }
    return subscriptionEntity;
  }

  private getSubscriptionPeriods(startTime: number, endTime: number) {
    let start = new Date(startTime);
    let end = new Date(endTime);
    let initialDay = start.getDate();
    let periods = [];

    while (start < end) {
      let year = start.getFullYear();
      let month = start.getMonth();
      let hours = start.getHours();
      let minutes = start.getMinutes();
      let seconds = start.getSeconds();

      // 计算下一个周期的开始日期
      let nextMonth = month + 1;
      let nextYear = year;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear++;
      }

      let nextPeriodStart = new Date(nextYear, nextMonth, initialDay, hours, minutes, seconds);

      // 如果下个月没有相同的日期，则使用该月的最后一天
      if (nextPeriodStart.getMonth() !== nextMonth) {
        nextPeriodStart = new Date(nextYear, nextMonth + 1, 0, hours, minutes, seconds);
      }

      let periodEnd = new Date(Math.min(nextPeriodStart.getTime(), end.getTime()));

      // 检查最后一个周期的长度
      if (end.getTime() - start.getTime() < this.MAX_PERIOD_DAYS * 24 * 60 * 60 * 1000) {
        periodEnd = end;
      }

      periods.push({
        start: start,
        end: periodEnd,
      });

      // 准备下一个周期
      start = periodEnd;
    }

    return periods;
  }
}
