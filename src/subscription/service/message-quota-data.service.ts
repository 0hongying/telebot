import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { BotMessageQuota } from 'src/subscription/entity/bot-message-quota.entity';
import { FREE_QUOTA_COUNT, getUserDailyRewardCountKey, REWARD_OF_DAILY_LIMIT } from 'src/shared/const';
import Redis from 'ioredis';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { BotSubscription } from 'src/subscription/entity/bot-subscription.entity';
import { sortBy, sumBy } from 'lodash';

@Injectable()
export class MessageQuotaDataService {
  private readonly redis: Redis;

  constructor(
    @InjectRepository(BotMessageQuota)
    private readonly botMessageQuotaRepository: Repository<BotMessageQuota>,
    private readonly redisService: RedisService,
  ) {
    this.redis = this.redisService.getClient();
  }

  async getUserMessageQuota(userId: number) {
    const date = new Date();
    const messageQuotas = await this.botMessageQuotaRepository.findBy({
      userId,
      obsolete: false,
      startTime: LessThanOrEqual(date),
      endTime: MoreThanOrEqual(date),
    });
    const subscribeQuota = messageQuotas.find(quota => quota.sourceType === 'SUBSCRIBE');
    const rewardQuotas = messageQuotas.filter(quota => quota.sourceType == 'REWARD');
    const freeTrialQuota = messageQuotas.find(quota => quota.sourceType === 'FREE_TRIAL');
    const count = await this.getUserDailyReward(userId);
    const rewardUsedCount = sumBy(rewardQuotas, 'usedCount');
    const rewardQuotaCount = sumBy(rewardQuotas, 'quotaCount');
    if (subscribeQuota && subscribeQuota.usedCount < subscribeQuota.quotaCount) {
      return { usedCount: subscribeQuota.usedCount, quotaCount: subscribeQuota.quotaCount };
    } else if (rewardQuotas.length > 0 && rewardUsedCount < rewardQuotaCount && count < REWARD_OF_DAILY_LIMIT) {
      return { usedCount: rewardUsedCount, quotaCount: rewardQuotaCount };
    } else if (freeTrialQuota) {
      return { usedCount: freeTrialQuota.usedCount, quotaCount: freeTrialQuota.quotaCount };
    }
    await this.botMessageQuotaRepository.save(
      new BotMessageQuota(userId, FREE_QUOTA_COUNT, 0, new Date(), new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), 'FREE_TRIAL', null),
    );
    return { usedCount: 0, quotaCount: FREE_QUOTA_COUNT };
  }

  async updateUserMessageQuota(userId: number) {
    const date = new Date();
    const messageQuotas = await this.botMessageQuotaRepository.findBy({
      userId,
      obsolete: false,
      startTime: LessThanOrEqual(date),
      endTime: MoreThanOrEqual(date),
    });
    const subscribeQuota = messageQuotas.find(quota => quota.sourceType === 'SUBSCRIBE');
    const rewardQuotas = sortBy(
      messageQuotas.filter(quota => quota.sourceType == 'REWARD' && quota.quotaCount > quota.usedCount),
      (item: BotMessageQuota) => item.endTime,
    );
    const freeTrialQuota = messageQuotas.find(quota => quota.sourceType === 'FREE_TRIAL');
    const count = await this.getUserDailyReward(userId);
    if (subscribeQuota && subscribeQuota.usedCount < subscribeQuota.quotaCount) {
      subscribeQuota.usedCount += 1;
      return await this.botMessageQuotaRepository.save(subscribeQuota);
    } else if (rewardQuotas.length > 0 && count < REWARD_OF_DAILY_LIMIT) {
      rewardQuotas[0].usedCount += 1;
      await Promise.all([this.updateUserDailyReward(userId), this.botMessageQuotaRepository.save(rewardQuotas[0])]);
      return;
    } else if (freeTrialQuota) {
      freeTrialQuota.usedCount += 1;
      return await this.botMessageQuotaRepository.save(freeTrialQuota);
    }
  }

  async obsoleteAll(userId: number, subscription: BotSubscription) {
    const messageQuotas = await this.findActiveMessageQuotas(userId, subscription);
    for (const messageQuota of messageQuotas) {
      messageQuota.obsolete = true;
      await this.botMessageQuotaRepository.save(messageQuota);
    }
  }

  async findActiveMessageQuotas(userId: number, subscription: BotSubscription) {
    const messageQuotas = await this.botMessageQuotaRepository.findBy({
      userId: userId,
      sourceType: 'SUBSCRIBE',
      sourceId: subscription.id,
      obsolete: false,
    });
    return messageQuotas;
  }

  async getUserDailyReward(userId: number) {
    const now = new Date();
    const key = getUserDailyRewardCountKey(userId, now);
    const count = await this.redis.get(key);
    return Number(count);
  }

  async updateUserDailyReward(userId: number) {
    const now = new Date();
    const key = getUserDailyRewardCountKey(userId, now);
    await Promise.all([this.redis.incrby(key, 1), this.redis.expire(key, 60 * 60 * 24 * 3)]);
  }
}
