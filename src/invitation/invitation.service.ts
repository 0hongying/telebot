import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BotMessageQuotaReward } from 'src/subscription/entity/bot-message-quota-reward.entity';
import { BotUser } from 'src/entity/bot-user.entity';
import { generateRandomString } from 'src/shared/utils';
import { BotInvitation } from 'src/invitation/entity/bot-invitation.entity';
import { BotMessageQuota } from 'src/subscription/entity/bot-message-quota.entity';
import { BotSubscription } from 'src/subscription/entity/bot-subscription.entity';
import { REWARD_NEW_USER_QUOTA, REWARD_SUBSCRIBER_QUOTA } from 'src/shared/const';
import { TelegramCommonService } from 'src/shared/telegram-common-service';
import { TrackService } from 'src/track/track.service';
@Injectable()
export class InvitationService {
  constructor(
    @InjectRepository(BotMessageQuotaReward)
    private readonly botMessageQuotaRewardRepository: Repository<BotMessageQuotaReward>,
    @InjectRepository(BotMessageQuota)
    private readonly botMessageQuotaRepository: Repository<BotMessageQuota>,
    @InjectRepository(BotUser)
    private readonly botUserRepository: Repository<BotUser>,
    @InjectRepository(BotInvitation)
    private readonly botInvitationRepository: Repository<BotInvitation>,
    @InjectRepository(BotSubscription)
    private readonly botSubscriptionRepository: Repository<BotSubscription>,
    private readonly telegramCommonService: TelegramCommonService,
    private readonly trackService: TrackService,
  ) {}

  async rewardSubscribeMessageQuota(invitedUserId: number) {
    const userId = await this.checkSubscribeReward(invitedUserId);
    if (!userId) return;
    await this.addRewardMessageQuota(userId, invitedUserId, REWARD_SUBSCRIBER_QUOTA, 'SUBSCRIBE');
    // await this.telegramCommonService.sendInvitedNotification(userId, userId, invitedUserId, true);
    this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_invite_reward2_successful' });
    this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_invite_successful' });
    this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_bot1_continue_inviting' });
  }

  async checkSubscribeReward(invitedUserId: number) {
    const botInvitation = await this.botInvitationRepository.findOneBy({ invitedUserId });
    if (!botInvitation) return;
    const subscriptions = await this.botSubscriptionRepository.findBy({ userId: invitedUserId });
    if (subscriptions.length !== 1 || subscriptions[0].status !== 'ACTIVE') return;
    return botInvitation.userId;
  }

  async rewardNewUserMessageQuota(invitedUserId: number) {
    const botInvitation = await this.botInvitationRepository.findOneBy({ invitedUserId, isNewUser: true, isNewUserRewarded: false });
    if (!botInvitation) return;
    const userId = botInvitation.userId;
    await Promise.all([
      this.addRewardMessageQuota(userId, invitedUserId, REWARD_NEW_USER_QUOTA, 'NEW_USER'),
      this.botInvitationRepository.update({ id: botInvitation.id }, { isNewUserRewarded: true }),
      // this.telegramCommonService.sendInvitedNotification(userId, userId, invitedUserId, false),
      this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_invite_reward1_successful' }),
      this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_invite_successful' }),
      this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_bot1_continue_inviting' }),
    ]);
  }

  async addRewardMessageQuota(userId: number, invitedUserId: number, quotaCount: number, type: string) {
    const botMessageQuota = new BotMessageQuota(
      userId,
      quotaCount,
      0,
      new Date(),
      new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
      `REWARD`,
      null,
    );
    const savedMessageQuota = await this.botMessageQuotaRepository.save(botMessageQuota);
    await this.botMessageQuotaRewardRepository.insert({
      userId,
      quotaCount,
      description: `INVITE_${invitedUserId}`,
      type,
      rewardMessageQuotaId: savedMessageQuota.id,
    });
  }

  async inviteUser(invitedUserId: number, inviteCode: string, isNewUser: boolean) {
    const existInvitation = await this.botInvitationRepository.findOneBy({ invitedUserId });
    if (!!existInvitation) return;
    const inviteUser = await this.botUserRepository.findOneByOrFail({ inviteCode });
    if (inviteUser.userId === invitedUserId) {
      throw new Error('You cannot invite yourself');
    }
    await this.botInvitationRepository.insert({ userId: inviteUser.userId, invitedUserId, isNewUser, isNewUserRewarded: false });
  }

  async getOrCreateInviteCode(userId: number) {
    const botUser = await this.botUserRepository.findOneOrFail({ where: { userId } });
    if (botUser.inviteCode) {
      return botUser.inviteCode;
    }
    const code = await this.generationInviteCode();
    botUser.inviteCode = code;
    await this.botUserRepository.save(botUser);
    return code;
  }

  async generationInviteCode() {
    let isUnique = false;
    let inviteCode = '';
    let attempts = 0;
    const maxAttempts = 3;
    while (!isUnique && attempts < maxAttempts) {
      inviteCode = this.generateUniqueInviteCode();
      const existingUserProfile = await this.botUserRepository.findOne({ where: { inviteCode: inviteCode } });
      if (!existingUserProfile) {
        isUnique = true;
      } else {
        attempts++;
      }
    }
    if (!isUnique) {
      throw new HttpException('Internal server error, please try again later.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return inviteCode;
  }

  private generateUniqueInviteCode(): string {
    return generateRandomString(5);
  }
}
