import { Injectable } from '@nestjs/common';
import {
  CHANNEL_BOT_ID,
  FREE_QUOTA_COUNT,
  getFreeTrialQuotaTip,
  getSubscriptionPageUrl,
  getSubscriptionQuotaTip,
  INVITE_MESSAGE_DETAIL,
  inviteForNewUser,
  inviteForSubscription,
} from 'src/shared/const';
import { getDateDiff } from 'src/shared/utils';
import { TelegramClient } from './telegram-bot';
import { ConfigService } from '@nestjs/config';
import { BotSubscription } from 'src/subscription/entity/bot-subscription.entity';
import { In, LessThan, MoreThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { BotMessageQuota } from 'src/subscription/entity/bot-message-quota.entity';
import { BotPlan } from 'src/subscription/entity/bot-plan.entity';
import { BotUser } from 'src/entity/bot-user.entity';
import { sample, sumBy } from 'lodash';
import { Bots } from 'src/bot/entity/bots.entity';

@Injectable()
export class TelegramCommonService {
  public readonly domain = this.configService.get('FRONTEND_DOMAIN');

  constructor(
    @InjectRepository(BotSubscription)
    private readonly botSubscriptionRepository: Repository<BotSubscription>,
    @InjectRepository(BotMessageQuota)
    public readonly botMessageQuotaRepository: Repository<BotMessageQuota>,
    @InjectRepository(BotPlan)
    private readonly botPlanRepository: Repository<BotPlan>,
    @InjectRepository(BotUser)
    private readonly botUserRepository: Repository<BotUser>,
    @InjectRepository(Bots)
    public readonly botsRepository: Repository<Bots>,
    private telegramClient: TelegramClient,
    private readonly configService: ConfigService,
  ) {}

  async sendMessageQuota(chatId: number, userId: number) {
    const bot = this.telegramClient.getChannelClient();
    // const keyboard = {
    //   inline_keyboard: [[{ text: 'Subscribe or upgrade', web_app: { url: getSubscriptionPageUrl(this.domain, userId) } }]],
    // };
    const subscription = await this.botSubscriptionRepository.findOneBy({ userId, status: 'ACTIVE' });
    const date = new Date();
    let text = '';
    if (subscription) {
      const day = getDateDiff(subscription.startTime, subscription.endTime);
      const currentPlan = await this.botPlanRepository.findOneByOrFail({ id: subscription.planId });
      const messageQuotas = await this.botMessageQuotaRepository.findOneByOrFail({
        userId,
        sourceType: 'SUBSCRIBE',
        sourceId: subscription.id,
        startTime: LessThan(date),
        endTime: MoreThan(date),
        obsolete: false,
      });
      text = getSubscriptionQuotaTip(currentPlan.name, messageQuotas.usedCount * 2, messageQuotas.quotaCount * 2, day);
    } else {
      const { totalUsedCount, totalQuotaCount } = await this.getTotalFreeMessageQuota(userId);
      const leftQuota = totalQuotaCount - totalUsedCount;
      text = getFreeTrialQuotaTip(leftQuota * 2, totalQuotaCount * 2);
    }
    await bot.sendMessage(chatId, text, {
      // reply_markup: keyboard,
      parse_mode: 'HTML',
    });
  }

  async getTotalFreeMessageQuota(userId: number) {
    const messageQuotas = await this.botMessageQuotaRepository.findBy({
      userId,
      sourceType: In(['FREE_TRIAL', 'REWARD']),
      obsolete: false,
    });
    const freeTrialQuota = messageQuotas.find(quota => quota.sourceType === 'FREE_TRIAL');
    const totalUsedCount = sumBy(messageQuotas, 'usedCount');
    const totalQuotaCount = sumBy(messageQuotas, 'quotaCount');
    if (!freeTrialQuota) {
      await this.botMessageQuotaRepository.save(
        new BotMessageQuota(userId, FREE_QUOTA_COUNT, 0, new Date(), new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), 'FREE_TRIAL', null),
      );
    }
    return { totalUsedCount, totalQuotaCount };
  }

  async sendInvitedNotification(chatId: number, userId: number, invitedUserId: number, isSubscribed: boolean) {
    let text = '';
    if (isSubscribed) {
      text = inviteForSubscription;
    } else {
      const botUser = await this.botUserRepository.findOneBy({ userId: invitedUserId });
      text = inviteForNewUser(botUser?.name);
    }
    const [channelBot, { inviteCode }] = await Promise.all([
      this.botsRepository.findOneOrFail({ where: { id: CHANNEL_BOT_ID } }),
      this.botUserRepository.findOneByOrFail({ userId }),
    ]);
    const inviteText = sample(INVITE_MESSAGE_DETAIL);
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: 'Continue Inviting',
            url: `https://t.me/share/url?url=https://t.me/${channelBot.name}?start=inv-${inviteCode}&text=${encodeURIComponent(inviteText!)}`,
          },
        ],
      ],
    };
    await this.telegramClient.getChannelClient().sendMessage(chatId, text, { reply_markup: keyboard });
  }
}
