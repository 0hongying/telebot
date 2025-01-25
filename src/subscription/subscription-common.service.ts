import { Injectable } from '@nestjs/common';
import moment from 'moment';
import { Repository, LessThan, MoreThan, FindOptionsWhere } from 'typeorm';
import { floor, lowerCase, startCase, toLower, upperFirst } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BotSubscription } from 'src/subscription/entity/bot-subscription.entity';
import { BotPlan } from 'src/subscription/entity/bot-plan.entity';
import { Action, BotOrder } from 'src/subscription/entity/bot-order.entity';
import { BotMessageQuota } from 'src/subscription/entity/bot-message-quota.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { TrackService } from 'src/track/track.service';
import { TelegramClient } from 'src/shared/telegram-bot';
import { BotUser } from 'src/entity/bot-user.entity';
import { TelegramCommonService } from 'src/shared/telegram-common-service';
import { delay } from 'src/shared/utils';
import { InvitationService } from 'src/invitation/invitation.service';

export type EventName = 'subscription.created' | 'subscription.renew' | 'subscription.upgrade' | 'subscription.canceled';
export interface EventPayload {
  type: EventName;
  userId: number;
  channel: ChannelType;
  price: number;
  endTime?: Date;
  amount?: number;
  subscriptionId?: string;
}

export interface TrialingEmailPayload extends EventPayload {
  /**
   * seconds
   * 数据有效时间
   */
  remain: number;
}

@Injectable()
export class SubscriptionCommonService {
  constructor(
    @InjectRepository(BotPlan)
    private readonly botPlanRepository: Repository<BotPlan>,
    @InjectRepository(BotSubscription)
    private readonly botSubscriptionRepository: Repository<BotSubscription>,
    @InjectRepository(BotOrder)
    private readonly botOrderRepository: Repository<BotOrder>,
    @InjectRepository(BotUser)
    private readonly botUserRepository: Repository<BotUser>,
    private readonly trackService: TrackService,
    private readonly eventEmitter: EventEmitter2,
    private readonly telegramClient: TelegramClient,
    private readonly telegramCommonService: TelegramCommonService,
    private readonly invitationService: InvitationService,
  ) {}

  /**
   * 获取当前订阅
   * @param subId 第三方订阅id
   * @returns
   */
  async getActiveSubscription(subId: str) {
    const currentTime = moment().tz('UTC').toDate();
    return this.botSubscriptionRepository.findOneBy({
      status: 'ACTIVE',
      startTime: LessThan(currentTime),
      endTime: MoreThan(currentTime),
      thirdPartySubscriptionId: subId,
    });
  }

  async getLatestSubscription(subId: str) {
    return this.botSubscriptionRepository.findOne({
      where: {
        thirdPartySubscriptionId: subId,
      },
      order: {
        id: 'DESC',
      },
    });
  }

  async getActiveSubscriptionByUserId(userId: number, channelType: ChannelType) {
    const currentTime = moment().tz('UTC').toDate();
    return this.botSubscriptionRepository.findOneBy({
      status: 'ACTIVE',
      startTime: LessThan(currentTime),
      endTime: MoreThan(currentTime),
      userId,
      channelType,
    });
  }

  async updateQuotaCount(userId: number, subscription: BotSubscription, quotaCount: number, repo: Repository<BotMessageQuota>) {
    const messageQuotas = await repo.findBy({
      userId,
      sourceType: 'SUBSCRIBE',
      sourceId: subscription.id,
      obsolete: false,
    });
    if (!messageQuotas || messageQuotas.length === 0) {
      console.error(`messageQuota not exsit for subscription: ${subscription.id}`);
      return;
    }
    for (const messageQuota of messageQuotas) {
      messageQuota.quotaCount = quotaCount;
      await repo.save(messageQuota);
    }
  }

  isUpgradeOrNot(args: { oldPlan: str; newPlan: str; oldPeriod: str; newPeriod: str }) {
    const { oldPlan, newPlan, oldPeriod, newPeriod } = args;
    const map = {
      Lite: 0,
      Classic: 1,
      Elite: 2,
      monthly: 0,
      '3months': 1,
      annually: 2,
      yearly: 2,
    } as any;
    if (map[oldPlan] < map[newPlan]) {
      return true;
    } else if (map[oldPlan] == map[newPlan]) {
      return map[oldPeriod] < map[newPeriod];
    }
    return false;
  }

  async getPlanByTwoFactor(planName: str, planType: str, where?: FindOptionsWhere<BotPlan>) {
    const recurrenceMap: Record<str, str> = {
      monthly: 'MONTHLY',
      '3months': '3MONTHS',
      yearly: 'YEARLY',
      annually: 'YEARLY',
    };

    return this.botPlanRepository.findOne({
      where: {
        name: startCase(toLower(planName)),
        type: recurrenceMap[toLower(planType)],
        ...where,
      },
      order: {
        id: 'ASC',
      },
    });
  }

  async getPlanByPriceId(condition: FindOptionsWhere<BotPlan>) {
    return this.botPlanRepository.findOne({
      where: condition,
    });
  }

  /**
   * 获取index
   * @param plan
   * @returns string CLASSIC:3MONTHS..
   */
  getIndexName(plan: BotPlan) {
    const { name, type } = plan;
    const n = name.toUpperCase();
    const t = type.toUpperCase();
    return `${n}:${t}`;
  }

  async getPlanByIndex(planIndex: string) {
    const [planName, planType] = planIndex.split(':');
    const r = await this.botPlanRepository.findOneByOrFail({
      name: upperFirst(lowerCase(planName)),
      type: planType,
    });

    return r;
  }

  async getPlanById(id: number) {
    const r = await this.botPlanRepository.findOneByOrFail({
      id,
    });

    return r;
  }

  getEndsDateByPlan(plan: BotPlan, start?: Date): Date {
    let unit = 1;
    if (plan.type === '3MONTHS') {
      unit = 3;
    } else if (plan.type === 'YEARLY') {
      unit = 12;
    }

    return moment(start ?? null)
      .tz('UTC')
      .add(unit, 'M')
      .toDate();
  }

  checkNotificationDate(recvDate: Date) {
    return moment(recvDate).diff(moment(), 'hours') <= 24;
  }

  genSubscriptionId() {
    return uuidv4();
  }

  genOrderNo() {
    return uuidv4();
  }

  async getPlanDetail(userId: number, channelType: ChannelType) {
    const currentSubscription = await this.getActiveSubscriptionByUserId(userId, channelType);
    if (!currentSubscription) {
      throw 'not exists';
    }
    const plan = await this.botPlanRepository.findOne({
      where: {
        id: currentSubscription.planId,
      },
    });

    if (!plan) {
      throw 'not found plan';
    }
    return {
      type: plan.type,
      title: plan.name,
      price: plan.price,
      thirdId: currentSubscription.thirdPartySubscriptionId,
    };
  }

  /**
   * make pre order
   * @param args
   * @returns
   */
  async preOrder(args: {
    userId: number;
    orderNo: str;
    amount: number;
    planId: number;
    action: Action;
    recurringReference: str;
    remark?: Record<str, any>;
  }) {
    const { userId, orderNo, amount, action, remark, recurringReference, planId } = args;
    return this.botOrderRepository.insert({
      userId,
      orderNo,
      thirdPartyOrderId: orderNo,
      amount,
      action,
      status: 'pending',
      purchaseToken: recurringReference, // 记录 recurringReference
      productId: planId.toString(),
      remark: JSON.stringify(remark),
    });
  }

  async insertOrder(d: Partial<BotOrder>) {
    this.botOrderRepository.insert(d);
  }
  async fillOrder(where: FindOptionsWhere<BotOrder>, update: Partial<BotOrder>) {
    const r = await this.botOrderRepository.findOneOrFail({
      where,
      order: {
        id: 'DESC',
      },
    });
    Object.assign(r, update);
    await this.botOrderRepository.save(r);
  }

  /**
   * 计算套餐有效天数
   * @param planType only support [monthly 3months yearly]
   * @returns days of plan type
   */
  getDays(planType: string): number {
    const type = planType.toLocaleLowerCase();
    if (type.includes('monthly')) {
      return 30;
    } else if (type.includes('3months')) {
      return 30 * 3;
    }
    return 30 * 12;
  }

  getSubscriptionEndTime(planType: string, start?: Date) {
    const timeMapper: Record<str, int> = {
      MONTHLY: 1,
      YEARLY: 12,
      '3MONTHS': 3,
    };
    const month = timeMapper[planType] as int;
    if (!month) {
      throw 'bad plan type';
    }
    const subscriptionEndTime = moment(start).add(month, 'month').toDate();
    return subscriptionEndTime;
  }

  /**
   * 计算升级差价
   * @param args
   * @returns 10 cent
   */
  getUpgradePrice(args: { currentSubscription: BotSubscription; curPlan: BotPlan; newPlan: BotPlan }): number {
    const { currentSubscription, curPlan, newPlan } = args;
    const usedDay = moment().diff(moment(currentSubscription.startTime), 'days');

    const curPlanTotalPrice = curPlan.price;
    const curPlanDays = this.getDays(curPlan.type);

    const newPlanTotalPrice = newPlan.price;
    const newPlanDays = this.getDays(newPlan.type);

    let cost = (curPlanTotalPrice / curPlanDays) * usedDay + (newPlanTotalPrice / newPlanDays) * (newPlanDays - usedDay) - curPlanTotalPrice;
    if (curPlan.type !== newPlan.type) {
      // 计算改期升级差价
      cost = newPlanTotalPrice - (curPlanTotalPrice / curPlanDays) * (curPlanDays - usedDay);
    }

    if (cost < 0) {
      console.log(
        `upgrade cost less than zero curPlan ${curPlan.name}:${curPlan.type} newPlan ${newPlan.name}:${newPlan.type} uid:${currentSubscription.userId}`,
      );
      throw 'upgrade error';
    }

    return floor(cost);
  }

  launch(args: EventPayload) {
    return this.eventEmitter.emit(args.type, args);
  }

  @OnEvent('subscription.*', { async: false })
  async handleSubscriptionEvent(payload: EventPayload) {
    const { type, userId, channel, price } = payload;
    const referrerInfo = `${channel}-${price}`;
    switch (type) {
      case 'subscription.created':
        this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_subscription_created_successful', referrerInfo });
        await this.notifyUserSubscription(userId);
        await this.invitationService.rewardSubscribeMessageQuota(userId);
        break;
      case 'subscription.upgrade':
        this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_subscription_upgrade_successful', referrerInfo });
        await this.notifyUserSubscription(userId);
        break;
      case 'subscription.renew':
        this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_subscription_renew_successful', referrerInfo });
        break;
      case 'subscription.canceled':
        if (payload.subscriptionId) {
          const sub = await this.getActiveSubscription(payload.subscriptionId);
          if (moment().diff(moment(sub?.startTime), 'hours') <= 24) {
            this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_subscription_cancel_successful', referrerInfo });
          }
        }
        break;
    }
    console.log(`subscription event handled for user:${userId}`);
  }

  async notifyUserSubscription(userId: number) {
    await delay(1000);
    const botUser = await this.botUserRepository.findOneByOrFail({ userId });
    const channelBot = this.telegramClient.getChannelClient();
    const chatBot = this.telegramClient.getChatClient(botUser.botId);
    // 对于私人聊天时，chat_id 与用户的 user_id 相同
    await Promise.all([
      channelBot.sendMessage(userId, `You've successfully subscribed.`),
      this.telegramCommonService.sendMessageQuota(userId, userId),
      chatBot.sendMessage(userId, `You've successfully subscribed.`),
    ]);
  }
}
