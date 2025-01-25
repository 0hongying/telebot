import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthorizationParam,
  Endpoint,
  EventEvonetComplete,
  MerchantTransInfo,
  Metadata,
  Method,
  Notification,
  NotificationForRequestToken,
  NotificationOneKeyPay,
  PaymentMethodEncrypted,
  PaymentStateResponse,
  PaymentStatus,
  StateResp,
  TokenPaymentResponse,
  TransAmount,
  UserToken,
} from 'Evonet';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { flow, has, isArray, isEmpty, isString, isUndefined, map, padStart, startCase, toLower, toString } from 'lodash';
import { lastValueFrom } from 'rxjs';
import { msgFail, msgSuccess, sha256 } from 'src/shared/utils';
import { EntityManager, In, LessThan, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { SubscriptionWebhookHandleService } from '../subscription-webhook-handle.service';
import moment from 'moment-timezone';
import { Cron, CronExpression } from '@nestjs/schedule';
import { onInstance0 } from 'src/shared/task.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { BotSubscriptionHistory } from 'src/subscription/entity/bot-subscription-history.entity';
import { BotPlan } from 'src/subscription/entity/bot-plan.entity';
import { BotSubscription } from 'src/subscription/entity/bot-subscription.entity';
import { Action, BotOrder } from 'src/subscription/entity/bot-order.entity';
import { BotEvonetToken } from 'src/subscription/entity/bot-evonet-token.entity';
import { SubscriptionCommonService } from '../subscription-common.service';
import { BotUser } from 'src/entity/bot-user.entity';
import { BotMessageQuota } from 'src/subscription/entity/bot-message-quota.entity';

@Injectable()
export class EvonetService {
  private readonly logger = new Logger(EvonetService.name);
  private readonly channelType = 'EVONET';
  private readonly paymentChannelId = 20;
  private readonly CFG = {
    base: this.config.get('EV_END_POINT'),
    storeId: this.config.get('EV_STORE_ID'),
    signKey: this.config.get('EV_SIGN_KEY'),
    vaultId: this.config.get('EV_VAULT_ID'),
    returnURL: this.config.get('EV_RETURN_URL'),
    webhook: this.config.get('EV_WEBHOOK'),
    merchant: '/g2/v1/payment/mer/',
    ack: 'SUCCESS', // webhook acknowledge
  };

  constructor(
    @InjectRepository(BotUser)
    private readonly botUserRepository: Repository<BotUser>,
    @InjectRepository(BotPlan)
    private readonly botPlanRepository: Repository<BotPlan>,
    @InjectRepository(BotSubscription)
    private readonly botSubscriptionRepository: Repository<BotSubscription>,
    @InjectRepository(BotOrder)
    private readonly botOrderRepository: Repository<BotOrder>,
    @InjectRepository(BotEvonetToken)
    private readonly evonetTokenRepository: Repository<BotEvonetToken>,
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly entityManager: EntityManager,
    private readonly eventEmitter: EventEmitter2,
    private readonly subsriptionWebhookHandleService: SubscriptionWebhookHandleService,
    private readonly subscriptionCommonService: SubscriptionCommonService,
  ) {}

  async client<T = any>(meta: ReturnType<typeof this.getMetaData>, method: Method, url: str, body?: any) {
    const unsign: AuthorizationParam = {
      method,
      url,
    };
    if (body && method !== 'GET') {
      unsign.body = body;
    }
    console.log(`[evonet] request evonet method: ${method}, url: ${url}, body: ${JSON.stringify(body)}`);
    const headers = this.getHeaders(unsign, meta);
    if (method === 'POST') {
      return this.fetchPost<T>(url, body, { headers });
    } else if (method === 'GET') {
      return this.fetchGet<T>(url, body, { headers });
    }

    throw 'method not implement!';
  }

  async webhook(notification: { metadate: Metadata } & any) {
    try {
      switch (notification.metadata) {
        case 'subscription.created':
          console.log('subscription.created');
          return this.subscriptionCreated(notification);
        case 'create.token':
          console.log('create.token');
          return this.subscriptionFirstPay(notification);
        case 'subscription.updated':
          console.log('subscription.updated');
          return this.subscriptionUpdate(notification);
        case 'subscription.renew':
          console.log('subscription.renew');
          return this.subscriptionRenew(notification);
      }
      console.log('[EVONET] event not exists', notification.metadata);

      return this.CFG.ack;
    } catch (error) {
      console.error(`[EVONET] webhook error`);
      console.error(error);
      throw new BadRequestException();
    }
  }

  async getActiveSubscription(subId: str) {
    const date = new Date();
    return this.botSubscriptionRepository.findOne({
      where: {
        status: 'ACTIVE',
        startTime: LessThan(date),
        endTime: MoreThan(date),
        thirdPartySubscriptionId: subId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async subscriptionCreated(message: Notification): Promise<str> {
    const { paymentMethod, payment } = message;
    const merchantTransInfo = paymentMethod?.merchantTransInfo ?? payment?.merchantTransInfo;
    const recurringReference = paymentMethod?.recurringReference ?? '';
    const mInfo = (message.payment ? message.payment.merchantTransInfo : merchantTransInfo) as MerchantTransInfo;

    if (!isEmpty(recurringReference)) {
      const hasSubscription = await this.getActiveSubscription(recurringReference);
      if (hasSubscription) {
        console.log(`[evonet] subscription.created will not handle this notification, already had subscribe ${hasSubscription.id}`);
        return this.CFG.ack;
      }
    }

    const order = await this.botOrderRepository.findOne({
      where: {
        thirdPartyOrderId: mInfo.merchantTransID,
        status: In(['pending', 'timeout']),
        action: 'subscribe',
      },
    });
    if (!order) {
      throw '[evonet] subscriptionCreated error order not exists';
    }

    // 判断响应体成功与否
    const messageStatus = paymentMethod?.status ?? payment?.status ?? ('' as PaymentStatus);

    console.log(`messageStatus ${messageStatus}`);

    const plan = await this.getPlanByOrder(order);
    if (!plan) throw '[evonet] subscriptionCreated plan not exists';

    if (messageStatus !== 'Success' && messageStatus !== 'Captured') {
      // error
      const failureCode = paymentMethod?.failureCode ?? payment?.failureCode ?? '';
      const failureReason = paymentMethod?.failureReason ?? payment?.failureReason ?? '';
      const reason = failureReason ?? 'fail unkown reason';
      if (failureReason) {
        console.error(`The evonet order:${order.id} is failed errno:${failureCode} reason:${failureReason}`);
      }
      order.reason = `${failureCode}:${reason}`;
      order.status = 'fail';
      order.remark = JSON.stringify(message);
      await this.entityManager.save(order);
      return this.CFG.ack;
    }

    const oldToken = await this.getEvonetToken(order.userId);
    const token = paymentMethod?.token.value;

    if (oldToken && oldToken.token !== token) {
      oldToken.token = token;
      await this.evonetTokenRepository.save(oldToken);
    } else {
      await this.setEvonetToken(order.userId, token);
    }

    order.status = 'payed';
    order.remark = JSON.stringify(message);
    await this.entityManager.save(order);
    console.log('[evonet] subscription.created before create');
    await this.subsriptionWebhookHandleService.handleSuscriptionCreated(
      order.userId,
      plan.id,
      this.paymentChannelId,
      this.channelType,
      undefined,
      this.subscriptionCommonService.getSubscriptionEndTime(plan.type),
      recurringReference,
      'created',
    );
    this.subscriptionCommonService.launch({ type: 'subscription.created', userId: order.userId, channel: this.channelType, price: plan.price });
    return this.CFG.ack;
  }

  async subscriptionUpdate(message: NotificationOneKeyPay): Promise<str> {
    console.log('[evonet] start subscriptionUpdate');
    const { paymentMethod, payment } = message;
    const recurringReference = payment?.recurringReference ?? paymentMethod.recurringReference;
    const merchantTransInfo = payment?.merchantTransInfo ?? paymentMethod.merchantTransInfo;

    const currentSubscription = await this.getActiveSubscription(recurringReference);
    if (!currentSubscription) {
      throw '[evonet] subscriptionUpdated subscription not exists';
    }

    const order = await this.botOrderRepository.findOne({
      where: {
        thirdPartyOrderId: merchantTransInfo.merchantTransID,
        status: In(['pending', 'timeout']),
        action: 'upgrade',
      },
    });
    if (!order) {
      throw '[evonet] subscriptionUpdated order not exists';
    }

    // 判断响应体成功与否
    const messageStatus = paymentMethod?.status ?? payment?.status ?? ('' as PaymentStatus);

    console.log(`messageStatus ${messageStatus}`);

    if (messageStatus !== 'Success' && messageStatus !== 'Captured') {
      // error
      const failureCode = paymentMethod?.failureCode ?? payment?.failureCode ?? '';
      const failureReason = paymentMethod?.failureReason ?? payment?.failureReason ?? '';
      const reason = failureReason ?? 'fail unkown reason';
      if (failureReason) {
        console.error(`The evonet order:${order.id} is failed errno:${failureCode} reason:${failureReason}`);
      }
      order.reason = `${failureCode}:${reason}`;
      order.status = 'fail';
      order.remark = JSON.stringify(message);
      await this.entityManager.save(order);

      return this.CFG.ack;
    }

    const oldPlan = await this.botPlanRepository.findOne({
      where: {
        id: currentSubscription.planId,
      },
    });
    const newPlan = await this.getPlanByOrder(order);
    if (!newPlan || !oldPlan) {
      throw '[evonet] subscriptionUpdated new|old plan not exists';
    }
    this.entityManager.transaction(async entityManager => {
      const historyRepo = entityManager.getRepository(BotSubscriptionHistory);
      const subscriptionRepo = entityManager.getRepository(BotSubscription);

      order.status = 'payed';
      order.remark = JSON.stringify(message);
      await entityManager.save(order);
      const userId = currentSubscription.userId;

      // 处理同期变更订阅的情况
      if (oldPlan.type === newPlan.type) {
        console.log('[evonet] 处理同期变更订阅的情况');
        await historyRepo.insert({
          userId,
          oldPlanId: currentSubscription.planId,
          newPlanId: newPlan.id,
          changeTime: new Date(),
          reason: 'Change Subscribe',
          paymentChannelId: this.paymentChannelId,
          channelType: this.channelType,
        });
        currentSubscription.planId = newPlan.id;
        await subscriptionRepo.save(currentSubscription);
        await this.subscriptionCommonService.updateQuotaCount(
          userId,
          currentSubscription,
          newPlan.quotaCount,
          entityManager.getRepository(BotMessageQuota),
        );
      } else {
        // 处理改期变更订阅的情况
        console.log('[evonet] 处理改期变更订阅的情况');
        await this.subsriptionWebhookHandleService.handleSuscriptionExpired(userId, currentSubscription);
        await this.subsriptionWebhookHandleService.handleSuscriptionCreated(
          userId,
          newPlan.id,
          this.paymentChannelId,
          this.channelType,
          undefined,
          this.subscriptionCommonService.getSubscriptionEndTime(newPlan.type),
          recurringReference,
        );
      }
    });
    this.subscriptionCommonService.launch({ type: 'subscription.upgrade', userId: order.userId, channel: this.channelType, price: newPlan.price });
    return this.CFG.ack;
  }

  async subscriptionRenew(message: NotificationOneKeyPay): Promise<str> {
    console.log('[evonet] start subscriptionRenew');
    const { paymentMethod, payment } = message;
    const recurringReference = payment?.recurringReference ?? paymentMethod.recurringReference;
    const merchantTransInfo = payment?.merchantTransInfo ?? paymentMethod.merchantTransInfo;

    const subs = await this.getActiveSubscription(recurringReference);
    if (!subs) {
      throw '[evonet] subscriptionRenew subscription not exists';
    }

    let order = await this.botOrderRepository.findOne({
      where: {
        thirdPartyOrderId: merchantTransInfo.merchantTransID,
        status: In(['pending', 'timeout']),
        action: 'renew',
      },
    });
    if (!order) {
      console.log(`[evonet] origin order not exists ${merchantTransInfo.merchantTransID}`);
      order = await this.handleLostOrder(subs, message);
      if (!order) {
        throw '[evonet] subscriptionRenew order not exists';
      }
    }
    const plan = await this.botPlanRepository.findOne({
      where: { id: subs.planId },
    });
    if (!plan) {
      throw '[evonet] not found plan';
    }

    // 判断响应体成功与否
    const messageStatus = paymentMethod?.status ?? payment?.status ?? ('' as PaymentStatus);

    console.log(`messageStatus ${messageStatus}`);

    if (messageStatus !== 'Success' && messageStatus !== 'Captured') {
      // error
      const failureCode = paymentMethod?.failureCode ?? payment?.failureCode ?? '';
      const failureReason = paymentMethod?.failureReason ?? payment?.failureReason ?? '';
      const reason = failureReason ?? 'fail unkown reason';
      if (failureReason) {
        console.error(`The evonet order:${order.id} is failed errno:${failureCode} reason:${failureReason}`);
      }
      order.reason = `${failureCode}:${reason}`;
      order.status = 'fail';
      order.remark = JSON.stringify(message);
      await this.entityManager.save(order);

      return this.CFG.ack;
    }

    try {
      await this.subsriptionWebhookHandleService.handleSuscriptionExpired(subs.userId, subs);
      await this.subsriptionWebhookHandleService.handleSuscriptionCreated(
        subs.userId,
        subs.planId,
        this.paymentChannelId,
        this.channelType,
        undefined,
        this.subscriptionCommonService.getSubscriptionEndTime(plan.type),
        recurringReference,
        'renew',
      );

      order.status = 'payed';
      order.remark = JSON.stringify(message);
      await this.entityManager.save(order);
      this.subscriptionCommonService.launch({ type: 'subscription.renew', userId: order.userId, channel: this.channelType, price: plan.price });
      return this.CFG.ack;
    } catch (error) {
      console.log('[EVONET] subscriptionRenew error');
      console.log(error);
      throw new BadRequestException();
    }
  }

  private async handleLostOrder(subs: BotSubscription, message: NotificationOneKeyPay) {
    const isAlmostExpired = moment(subs.endTime).diff(moment(), 'days') < 3;
    const { paymentMethod, payment } = message;
    const recurringReference = payment?.recurringReference ?? paymentMethod.recurringReference;
    const merchantTransInfo = payment?.merchantTransInfo ?? paymentMethod.merchantTransInfo;
    const orderNo = merchantTransInfo.merchantTransID;

    if (isAlmostExpired && subs.autoRenew) {
      await this.botOrderRepository.insert({
        userId: subs.userId,
        orderNo,
        thirdPartyOrderId: orderNo,
        amount: Number(payment.transAmount.value) * 100,
        action: 'renew',
        status: 'pending',
        purchaseToken: recurringReference ?? '', // 记录 recurringReference
        productId: subs.planId.toString(),
        remark: JSON.stringify(message ?? '{}'),
      });
    }
    const order = await this.botOrderRepository.findOne({
      where: {
        thirdPartyOrderId: orderNo,
        status: In(['pending', 'timeout']),
        action: 'renew',
      },
    });

    return order;
  }

  async getPlanByOrder(order: BotOrder) {
    return this.botPlanRepository.findOne({
      where: {
        id: Number(order.productId),
      },
    });
  }

  /**
   * Capture API is only applied to Card payment transactions. In EVO Cloud, each Card payment
   * transaction must be followed by a Capture, which aims to confirm the clearing process with Card
   * Schemes.
   * @returns
   */
  async capture(transAmount: TransAmount, merchantTransInfo: MerchantTransInfo) {
    try {
      const meta = this.getMetaData();
      meta.merchantTransInfo = merchantTransInfo;
      const url = this.buildRequestLink('capture', `?merchantTransID=${merchantTransInfo.merchantTransID}`);

      const body = {
        merchantTransInfo,
        transAmount,
      };
      const r = await this.client(meta, 'POST', url, body);

      return r;
    } catch (error) {
      return this.handleError(error, 'capture');
    }
  }

  async getEvonetToken(userId: number) {
    return this.evonetTokenRepository.findOne({
      where: { userId },
    });
  }

  async setEvonetToken(userId: number, token: str) {
    return this.evonetTokenRepository.insert({
      userId,
      token,
    });
  }

  /**
   *
   * @param ids 订阅id []
   */
  async forceUserRenew(ids: number[]) {
    const recurringReferences: Record<string, string> = {};
    for (const id of ids) {
      const sub = await this.botSubscriptionRepository.findOne({
        where: {
          id,
        },
      });
      if (!sub) continue;
      try {
        const plan = await this.botPlanRepository.findOne({
          where: { id: sub.planId },
        });
        if (!plan) continue;

        console.log('before onekey pay [restore]');
        const transAmount = this.getTransAmount(plan.price);

        // pay and notify result
        const meta = this.getMetaData();
        const url = this.buildRequestLink('payment');
        const userId = sub.userId;
        const userInfo = (await this.getUserInfo(userId)) as any;
        const ip = userInfo.ip;
        delete userInfo.ip;

        const commonParam = this.getCommonParam('subscription.renew', ip);
        const recurringReference = sub.thirdPartySubscriptionId;
        const eToken = await this.getEvonetToken(userId);
        if (!eToken) throw '[evonet] the user have no valid token';
        const body = {
          paymentMethod: {
            recurringProcessingModel: 'Subscription',
            type: 'token',
            token: {
              value: eToken.token,
            },
            recurringReference,
          },
          captureAfterHours: '0',
          merchantTransInfo: meta.merchantTransInfo,
          transAmount,
          userInfo,
          ...commonParam,
        };
        const r = await this.client<TokenPaymentResponse>(meta, 'POST', url, body);
        console.log(r);

        await this.preOrder({
          amount: Number(transAmount.value) * 100,
          orderNo: meta.merchantTransID,
          userId,
          recurringReference,
          planId: plan.id,
          action: 'renew',
          remark: r,
        });

        // 强制指定的订阅为未到期
        await this.botSubscriptionRepository.update(
          {
            id,
          },
          {
            status: 'ACTIVE',
            endTime: moment().tz('UTC').add(3, 'hours').toDate(),
          },
        );
        recurringReferences[id] = recurringReference;
      } catch (error) {
        console.log(`[evonet restore] renew had error, userId:${sub.userId} subscriptionId:${sub.thirdPartySubscriptionId}`);
        console.log(error);
      }
    }
    return recurringReferences;
  }

  async getEvonetTokenViaAPI(uid: number | number[]) {
    try {
      if (isArray(uid)) {
        const obj: Record<string, string> = {};
        for (const userId of uid) {
          obj[userId] = (await this.getEvonetTokenViaAPI(userId)) as string;
        }

        return obj;
      }
      const meta = this.getMetaData();
      const url = this.buildRequestLink('paymentMethod', `?userReference=${uid}`);

      const r = await this.client<UserToken>(meta, 'GET', url);

      const token = r.paymentMethodList[0].token.value;
      // store token
      const oldToken = await this.getEvonetToken(uid);
      if (oldToken && oldToken.token !== token) {
        oldToken.token = token;
        await this.evonetTokenRepository.save(oldToken);
      } else {
        await this.setEvonetToken(uid, token);
      }
      return token;
    } catch (error) {
      console.error(`[EVONET] getEvonetToken error`);
      console.error(error);
      throw new BadRequestException();
    }
  }

  private async getActiveSubscriptionByUserId(userId: number) {
    const currentTime = moment().tz('UTC').toDate();
    return this.botSubscriptionRepository.findOneBy({
      status: 'ACTIVE',
      startTime: LessThan(currentTime),
      endTime: MoreThan(currentTime),
      userId,
      channelType: this.channelType,
    });
  }

  /**
   * 一键扣款 支持升级扣款和续费扣款
   * @param userId
   * @param isRenew boolean 是否是续费扣款
   * @returns
   */
  async oneKeyPay(userId: number, transAmount: TransAmount, plan: BotPlan, isRenew = false) {
    try {
      const currentSubscription = await this.getActiveSubscriptionByUserId(userId);
      if (!currentSubscription) {
        throw '[evonet] oneKeyPay subscription not exists';
      }

      const meta = this.getMetaData();
      const url = this.buildRequestLink('payment');

      const userInfo = (await this.getUserInfo(userId)) as any;
      const ip = userInfo.ip;
      delete userInfo.ip;

      let commonParam = this.getCommonParam('subscription.updated', ip);
      if (isRenew) {
        commonParam = this.getCommonParam('subscription.renew', ip);
      }

      const { raw } = await this.preOrder({
        amount: parseInt(transAmount.value) * 100,
        orderNo: meta.merchantTransID,
        userId,
        planId: plan.id,
        action: isRenew ? 'renew' : 'upgrade',
      });
      const preOrderId = raw[0].id;
      console.log(`[evonet] preOrderId: ${preOrderId} ${userId} ${isRenew ? 'renew' : 'upgrade'}`);
      const recurringReference = currentSubscription.thirdPartySubscriptionId;
      const eToken = await this.getEvonetToken(userId);
      if (!eToken) throw '[evonet] the user have no valid token';
      const body = {
        orderId: preOrderId,
        paymentMethod: {
          recurringProcessingModel: 'Subscription',
          type: 'token',
          token: {
            value: eToken.token,
          },
          recurringReference,
        },
        captureAfterHours: '0',
        merchantTransInfo: meta.merchantTransInfo,
        transAmount,
        userInfo,
        ...commonParam,
      };
      const r = await this.client<TokenPaymentResponse>(meta, 'POST', url, body);
      console.log(`onekey pay response: `, r);

      const payload: EventEvonetComplete = {
        id: preOrderId,
        recurringReference,
        remark: JSON.stringify(r),
      };
      this.eventEmitter.emit('request.evonet.complete', payload);
      return recurringReference;
    } catch (err) {
      console.error(`[EVONET] oneKeyPay error`);
      console.error(err);
      throw new BadRequestException();
    }
  }

  getTransAmount(cent: int, isCent = true): TransAmount {
    return {
      currency: 'USD',
      value: isCent ? (cent / 100).toString() : cent.toString(),
    };
  }

  getCommonParam(metadata: Metadata, ip: str, returnURL = this.CFG.returnURL) {
    return {
      transInitiator: {
        platform: 'WEB',
        userCreateIP: ip,
      },
      metadata,
      returnURL,
      webhook: this.CFG.webhook,
    };
  }

  async fetchOrderState(args: { recurringReference: string; isUpdate: boolean; userId: number }): Promise<StateResp> {
    const { recurringReference, isUpdate, userId } = args;

    // valid params
    if (!recurringReference) throw 'UnAuthorization';
    if (isUndefined(isUpdate)) throw 'UnAuthorization';

    let action: Action = 'subscribe';
    if (isUpdate) {
      action = 'upgrade';
    }
    const order = await this.botOrderRepository.findOne({
      where: {
        userId,
        purchaseToken: recurringReference,
        action,
      },
      order: {
        id: 'DESC',
      },
    });

    if (!order) {
      throw 'order not exists';
    }

    /**
     * 包装响应消息
     * @param s 消息
     * @param done 是否结束 用户结束查询
     * @param isOk 业务上是否ok的阶段
     */
    const wrapResp = (s: string, done = true, isOk = true): StateResp => ({
      reason: s,
      date: moment(order.createdAt).format('YYYY.MM.DD HH:mm:ss'),
      done,
      isOk,
    });

    if (order.status === 'payed') {
      return wrapResp('success');
    }
    if (order.status === 'timeout' || order.status === 'fail') {
      return wrapResp(this.errorMsgControl(order.reason?.split(':')[0]), true, false);
    }
    // check trans if had Exception
    const orderNo = order.orderNo;

    const meta = this.getMetaData(orderNo);
    const url = this.buildRequestLink('payment', `?merchantTransID=${orderNo}`);

    const r = await this.client<PaymentStateResponse>(meta, 'GET', url);

    const { paymentMethod, payment } = r;
    // 处理情况1
    if (paymentMethod || payment) {
      const failureCode = paymentMethod?.failureCode ?? payment?.failureCode ?? '';
      const failureReason = paymentMethod?.failureReason ?? payment?.failureReason ?? '';
      const status = paymentMethod.status ?? payment?.status;

      console.log(status);
      // 处理情况2
      if (status === 'Failed') {
        if (failureCode) {
          // return explicit error message
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const msg = this.errorMsgControl(failureCode);
          return wrapResp(msg, true, false);
        } else {
          console.log('fetchOrderState bad failureCode');
          console.log(`${failureCode}: ${failureReason}`);
        }
        return wrapResp('something error, please try again', false);
      } else if (status === 'Captured') {
        return wrapResp('Obtaining bank deduction results,please refresh the page later.', false);
      }
    }

    return wrapResp('unknown error', true, false);
  }

  handleErrorCode(code: string) {
    const allowed = ['B0009', 'B0040', 'I0051', 'B0021', 'I0093', 'P0059'];
    return allowed.includes(code);
  }

  errorMsgControl(code: string) {
    const defaults = 'Your issuing bank has declined this payment. Please use a different card or contact your bank.';
    if (['B0009', 'B0040'].includes(code)) {
      return 'The card number may be incorrect. Please verify and try again.';
    }
    if (['I0051'].includes(code)) {
      return 'Insufficient funds on your card. Please use a different card and try again.';
    }

    if (['B0021'].includes(code)) {
      return 'Your card or authentication information is incorrect. Please verify and try again.';
    }
    if (['P0059', 'I0093'].includes(code)) {
      return defaults;
    }

    return defaults;
  }

  async beginSubscriptionUpgrade(outside: { title: string; type: string; userId: number }) {
    const title = outside.title.replace(/pephop/i, '').trim();

    // not allow downgrade
    const currentSubscription = await this.getActiveSubscriptionByUserId(outside.userId);
    if (!currentSubscription) {
      throw 'handleSubscriptionUpgrade subscription not exists';
    }
    const plan = await this.botPlanRepository.findOne({
      where: { id: currentSubscription.planId },
    });
    if (!plan) {
      throw 'not found plan';
    }
    const params = {
      oldPlan: plan.name,
      newPlan: title,
      oldPeriod: plan.type.toLowerCase(),
      newPeriod: outside.type,
    };

    if (!this.canUpgrade(params)) {
      throw 'cannot downgrade';
    }
    // find the new priceId
    const newPlan = await this.getPlan(title, outside.type);
    if (!newPlan) {
      throw 'handleSubscriptionUpgrade new plan dose not exists';
    }

    const upgradePrice = this.subscriptionCommonService.getUpgradePrice({
      currentSubscription,
      curPlan: plan,
      newPlan,
    });
    if (upgradePrice < 0) throw 'unauthorized';
    const transAmount = this.getTransAmount(upgradePrice);
    const r = await this.oneKeyPay(outside.userId, transAmount, newPlan, false);

    // print update response
    console.log('update reponse ----'.repeat(5));
    // console.log(data.status);
    // console.log(data);

    return r;
  }

  private async getPlan(name: str, type: str) {
    const recurrenceMap: Record<str, str> = {
      monthly: 'MONTHLY',
      '3months': '3MONTHS',
      yearly: 'YEARLY',
      annually: 'YEARLY',
    };
    return this.botPlanRepository.findOne({
      where: {
        name: startCase(toLower(name)),
        type: recurrenceMap[toLower(type)],
      },
      order: {
        id: 'ASC',
      },
    });
  }

  canUpgrade(args: { oldPlan: str; newPlan: str; oldPeriod: str; newPeriod: str }) {
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

  async refund(notification: any) {
    console.log('start refund process');
    console.log(notification);
    try {
      const meta = this.getMetaData();
      const url = this.buildRequestLink('refund', `?merchantTransID=${meta.merchantTransID}`);
      const body = {
        merchantTransInfo: '',
        transAmount: '',
      };
      const r = await this.client(meta, 'POST', url, body);
      console.log(r);
      return 'done';
    } catch (error) {
      return this.handleError(error, 'refund');
    }
  }

  async getPlanDetail(userId: number) {
    const currentSubscription = await this.getActiveSubscriptionByUserId(userId);
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
    };
  }

  async cancel(userId: number) {
    try {
      const currentSubscription = await this.getActiveSubscriptionByUserId(userId);
      if (!currentSubscription) {
        console.log('currentSubscription not exists');
        return;
      }
      const order = await this.botOrderRepository.findOneOrFail({
        where: {
          userId,
        },
        order: {
          id: 'DESC',
        },
      });
      console.log('cancel subscription done');
      currentSubscription.autoRenew = false;
      await this.entityManager.save(currentSubscription);
      this.subscriptionCommonService.launch({
        type: 'subscription.canceled',
        userId: order.userId,
        channel: this.channelType,
        subscriptionId: currentSubscription.thirdPartySubscriptionId,
        price: order.amount,
      });
      return 'done';
    } catch (error) {
      return this.handleError(error, 'cancel');
    }
  }

  async cardPay(
    args: {
      userId: number;
      encrypted: str;
      planName: str;
      type: str;
      email?: str;
    },
    ip: str,
  ) {
    let preOrderId;
    try {
      const { userId } = args;
      const userInfo = await this.getUserInfo(userId, ip);
      delete userInfo.ip;
      const { vaultId } = this.CFG;
      const plan = await this.getPlanByThreeFactor(args);
      if (!plan) throw '[evonet] cardPay plan not exists';
      // 暂时不使用
      // const { paymentMethod: tokenResp, meta } = await this.requestToken(
      //   args.encrypted,
      //   userInfo,
      //   plan,
      // );

      // check if buy a already exists subscription
      const currentSubscription = await this.getActiveSubscriptionByUserId(userId);
      if (currentSubscription?.planId === plan.id) {
        throw 'You have already subscribed to this plan.Please select a different subscription plan to upgrade.';
      }
      // check if had a same plan in processing
      const order = await this.botOrderRepository.findOne({
        where: {
          userId,
          status: 'pending',
          action: 'subscribe',
        },
      });
      if (Number(order?.productId) === plan.id) {
        throw 'You already have a subscription payment in progress. Please try again later.';
      }
      const endpoint = this.buildRequestLink('payment');
      const meta = this.getMetaData();

      const { raw } = await this.preOrder({
        amount: plan.price,
        action: 'subscribe',
        userId,
        orderNo: meta.merchantTransID,
        planId: plan.id,
      });
      preOrderId = raw[0].id;
      const body = {
        orderId: preOrderId,
        allowAuthentication: true,
        captureAfterHours: '0',
        paymentMethod: {
          recurringProcessingModel: 'Subscription',
          type: 'card',
          card: {
            userReference: userInfo.reference,
            encryptedCardInfo: args.encrypted,
            vaultID: vaultId,
            tokenize: true,
          },
        },
        merchantTransInfo: meta.merchantTransInfo,
        transAmount: this.getTransAmount(plan.price),
        userInfo,
        ...this.getCommonParam('subscription.created', ip),
      };
      const payWithTokenResp = await this.client<PaymentMethodEncrypted>(meta, 'POST', endpoint, body);
      console.log('payWithTokenResp');
      console.log(payWithTokenResp);

      let url = null;
      if (payWithTokenResp.action) {
        url = payWithTokenResp.action.threeDSData.url;
      }
      const recurringReference = payWithTokenResp.paymentMethod.recurringReference;

      // emit success
      const payload: EventEvonetComplete = {
        id: raw[0].id,
        recurringReference,
        remark: JSON.stringify(payWithTokenResp),
      };
      this.eventEmitter.emit('request.evonet.complete', payload);
      return msgSuccess({
        data: {
          link: url,
          recurringReference,
        },
      });
    } catch (error) {
      if (preOrderId) {
        await this.botOrderRepository.update(
          {
            id: preOrderId,
          },
          {
            status: 'fail',
            reason: 'Create pre order failed',
          },
        );
      }
      return this.handleError(error, 'cardPay');
    }
  }

  private async preOrder(args: {
    userId: number;
    orderNo: str;
    amount: number;
    planId: number;
    action: Action;
    remark?: any;
    recurringReference?: str;
  }) {
    try {
      const { userId, orderNo, amount, action, remark, recurringReference, planId } = args;
      const r = await this.botOrderRepository.insert({
        userId,
        orderNo,
        thirdPartyOrderId: orderNo,
        amount,
        action,
        status: 'pending',
        purchaseToken: recurringReference ?? '', // 记录 recurringReference
        productId: planId.toString(),
        remark: JSON.stringify(remark ?? '{}'),
      });
      return r;
    } catch (error) {
      console.log(`preOrder error for ${args.userId} ${args.orderNo}`, error);
      throw new Error('preOrder error!!');
    }
  }

  async getPlanByThreeFactor(args: { planName: str; type: str }) {
    const { type, planName } = args;
    const name = planName.replace(/pephop/i, '').trim();
    let mType = type;
    if (type === 'annually') {
      mType = 'yearly';
    }
    const plan = await this.botPlanRepository.findOne({
      where: {
        name,
        type: mType.toUpperCase(),
      },
    });
    if (!plan) throw '[evonet] plan not exists';
    return plan;
  }

  async getUserInfo(userId: number, ip?: str) {
    const r = await this.botUserRepository.findOne({
      where: {
        userId,
      },
    });
    if (!r) {
      throw 'user not exists';
    }
    if (!r.ip && ip) {
      r.ip = ip;
      await this.botUserRepository.save(r);
    }
    return {
      reference: String(r.id),
      ip: r.ip ?? ip ?? '',
    } as Partial<{
      reference: string;
      ip: string;
    }>;
  }

  async getPaymentMethod() {
    const endpoint = this.buildRequestLink('paymentMethod');

    const meta = this.getMetaData();
    const r = await this.client(meta, 'GET', endpoint);

    return r.paymentMethod.paymentBrandList;
  }

  @OnEvent('request.evonet.complete')
  handleRequestEvonetDone(args: EventEvonetComplete) {
    console.log(`event args ${JSON.stringify(args)}`);
    this.botOrderRepository.update(
      {
        id: args.id,
      },
      {
        remark: args.remark ?? '',
        purchaseToken: args.recurringReference,
        reason: args.reason ?? '',
      },
    );
  }

  async subscriptionFirstPay(message: NotificationForRequestToken): Promise<str> {
    const endpoint = this.buildRequestLink('payment');

    const meta = this.getMetaData();

    const merchantTransID = message.paymentMethod.merchantTransInfo?.merchantTransID;
    const order = await this.botOrderRepository.findOne({
      where: {
        thirdPartyOrderId: merchantTransID,
        status: 'pending',
        action: 'subscribe',
      },
    });
    if (!order) {
      throw '[evonet] requestFirstPay error order not exists';
    }
    const recurringReference = message.paymentMethod.recurringReference;
    const token = message.paymentMethod.token.value;

    const userInfo = (await this.getUserInfo(order.userId)) as any;
    const ip = userInfo.ip;
    delete userInfo.ip;

    const plan = await this.getPlanByOrder(order);
    if (!plan) throw '[evonet] requestFirstPay plan not exists';

    const body = {
      allowAuthentication: true,
      captureAfterHours: '0',
      paymentMethod: {
        recurringProcessingModel: 'Subscription',
        type: 'token',
        token: {
          value: token,
        },
        recurringReference,
      },
      merchantTransInfo: meta.merchantTransInfo,
      transAmount: this.getTransAmount(plan.price),
      userInfo,
      ...this.getCommonParam('subscription.created', ip),
    };
    const paymentMethod = await this.client<PaymentMethodEncrypted>(meta, 'POST', endpoint, body);
    // IMPORTANT!  must update orderNo for next webhook
    order.orderNo = meta.merchantTransInfo.merchantTransID;
    order.thirdPartyOrderId = meta.merchantTransID;
    await this.botOrderRepository.save(order);

    console.log('subscriptionFirstPay');
    console.log(paymentMethod);
    return 'SUCCESS';
  }

  async requestToken(encryptedCardInfo: str, userInfo: any, plan: BotPlan) {
    const endpoint = this.buildRequestLink('paymentMethod');
    const meta = this.getMetaData();
    const { vaultId } = this.CFG;
    const ip = userInfo.ip;
    delete userInfo.ip;
    const body = {
      allowAuthentication: true,
      captureAfterHours: '0',
      paymentMethod: {
        recurringProcessingModel: 'Subscription',
        type: 'card',
        card: {
          encryptedCardInfo,
          vaultID: vaultId,
        },
      },
      merchantTransInfo: meta.merchantTransInfo,
      transAmount: this.getTransAmount(plan.price),
      userInfo,
      ...this.getCommonParam('create.token', ip),
    };
    const paymentMethod = await this.client<PaymentMethodEncrypted>(meta, 'POST', endpoint, body);
    console.log('response of requestToken');
    console.log(paymentMethod);
    return { paymentMethod, meta };
  }

  private buildRequestLink(action: Endpoint, query: str = '') {
    const { storeId, merchant } = this.CFG;
    const url = `${merchant}${storeId}/${action}${query}`;
    return url;
  }

  async fetchGet<T>(endpoint: string, params?: any, config?: AxiosRequestConfig) {
    try {
      const url = new URL(endpoint, this.CFG.base);
      const response = this.httpService.get<T>(url.href, {
        ...config,
        params,
      });
      const result = await lastValueFrom(response);

      return this.handleResponseError<T>(result.data, params?.orderId);
    } catch (error) {
      throw this.handleRequestError(error, params?.orderId);
    }
  }

  async fetchPost<T>(endpoint: string, body?: Record<str, any>, config?: AxiosRequestConfig) {
    try {
      const url = new URL(endpoint, this.CFG.base);
      const response = this.httpService.post<T>(url.href, body, config);
      const result = await lastValueFrom(response);

      return this.handleResponseError<T>(result.data, body?.orderId);
    } catch (error) {
      throw this.handleRequestError(error, body?.orderId);
    }
  }

  getMetaData(transId = '') {
    const d = moment().tz('Asia/Shanghai');
    const fillZero = flow(toString, (s: string) => padStart(s, 2, '0'));
    const hours = fillZero(d.hours());
    const minutes = fillZero(d.minutes());
    const seconds = fillZero(d.seconds());
    const day = fillZero(d.date());
    const monthIndex = fillZero(d.month() + 1);
    const year = d.year().toString();

    const pubDate = monthIndex + day + d.unix().toString().substring(0, 10) + (Math.floor(Math.random() * (999 - 100)) + 100);

    const msgId = 'M' + year + pubDate;

    const merchantTransID = isEmpty(transId) ? 'T' + year.substring(3, 4) + pubDate : transId;
    const merTransTime = year + '-' + monthIndex + '-' + day + 'T' + hours + ':' + minutes + ':' + seconds + '+08:00';
    const datetime = merTransTime;

    const merchantTransInfo = {
      merchantTransID,
      merchantTransTime: merTransTime,
      merchantOrderReference: merchantTransID,
    };
    return {
      merchantTransInfo,
      msgId,
      datetime,
      merchantTransID,
      merTransTime,
      year,
      monthIndex,
      day,
      hours,
      minutes,
      seconds,
    };
  }

  getHeaders(args: AuthorizationParam, meta: ReturnType<typeof this.getMetaData>) {
    const { datetime, msgId } = meta;
    return {
      SignType: 'SHA256',
      DateTime: datetime,
      MsgID: msgId,
      Authorization: this.getAuthorization(args, meta),
    };
  }

  getAuthorization(args: AuthorizationParam, meta: ReturnType<typeof this.getMetaData>) {
    const { signKey } = this.CFG;
    const { datetime, msgId } = meta;
    const { method, url, body = '' } = args;
    const arr = [method, url, datetime, signKey, msgId, isString(body) ? body : JSON.stringify(body)];
    if (isEmpty(body)) {
      arr.pop();
    }
    const signString = arr.join('\n');

    return sha256(signString);
  }

  handleResponseError<T>(apiResp: any, orderId?: number): T {
    if (has(apiResp, 'result')) {
      const { code, message } = apiResp.result;
      if (code === 'S0000') {
        return apiResp;
      } else if (this.handleErrorCode(code)) {
        if (orderId) {
          this.eventEmitter.emit('request.evonet.complete', {
            id: orderId,
            reason: `${code}:${message}`,
          } as EventEvonetComplete);
        }
        throw this.errorMsgControl(code);
      } else {
        console.log('[evonet] response error');
        console.log(apiResp.result);

        if (orderId) {
          this.eventEmitter.emit('request.evonet.complete', {
            id: orderId,
            reason: `unknown:${apiResp?.result}`,
          } as EventEvonetComplete);
        }
        // handle explicit error no
        throw message;
      }
    }
    throw 'unAuthorized';
  }

  handleRequestError(error: Error | AxiosError | any, orderId?: number) {
    if (error instanceof AxiosError) {
      console.log('evonet API response error');
      console.log(error.code);
      console.log(error.response?.statusText);
      console.log(error.message);
      if (orderId) {
        this.eventEmitter.emit('request.evonet.complete', {
          id: orderId,
          reason: `${error.code}:${error.message}`,
        } as EventEvonetComplete);
      }
      return error.message;
    }
    console.error('evonet request error');
    console.error(error);

    return error;
  }

  handleError(err: any, label: str) {
    if (isString(err)) {
      return msgFail({
        msg: err,
      });
    }
    console.error(`[EVONET] ${label} error`);
    console.error(err);
    throw new BadRequestException();
  }

  private async scanSubscription() {
    const groups = await this.botSubscriptionRepository.find({
      where: {
        channelType: this.channelType,
        paymentChannelId: this.paymentChannelId,
        autoRenew: true,
        endTime: LessThanOrEqual(moment().tz('UTC').add(24, 'hours').toDate()),
        status: 'ACTIVE',
      },
    });
    const ids = map(groups, 'id');
    return ids;
  }

  @Cron(CronExpression.EVERY_6_HOURS, { disabled: !onInstance0() })
  async handleTaskQueue() {
    this.logger.log('[EVONET] start process renew task');
    // const client = this.redisService.getClient();
    const ids = await this.scanSubscription();
    this.logger.debug(`handleing ids: ${ids}`);
    const queue: int[] = [];

    const plans = await this.botPlanRepository.findBy({});
    for (const id of ids) {
      const sub = await this.botSubscriptionRepository.findOneBy({ id });
      if (!sub) continue;
      if (!sub.autoRenew || sub.status !== 'ACTIVE') {
        // queue.push(id);
        continue;
      }
      const plan = plans.find(n => n.id === sub.planId);
      if (!plan) continue;

      this.logger.log('before onekey pay');
      const transAmount = this.getTransAmount(plan.price);
      try {
        await this.oneKeyPay(sub.userId, transAmount, plan, true);
        queue.push(id);
      } catch (error) {
        console.log(`[evonet] renew had error, userId:${sub.userId} subscriptionId:${sub.thirdPartySubscriptionId}`);
        console.log(error);
      }
    }

    this.logger.log(`[EVONET] renew handles ${queue.toString()}`);
    this.logger.log(`[EVONET] end process ${queue.length} renew task`);
  }

  @Cron(CronExpression.EVERY_10_MINUTES, { disabled: !onInstance0() })
  async handleTimeoutTask() {
    try {
      this.logger.log('handleTimeoutTask start');
      const orders = await this.botOrderRepository.find({
        where: {
          status: 'pending',
        },
      });

      const ids = [] as number[];
      orders.forEach(n => {
        const diff = moment(new Date(n.createdAt)).tz('UTC').diff(moment().tz('UTC'), 'minutes');
        if (Math.abs(diff) > 5) {
          ids.push(n.id);
        }
      });

      if (isEmpty(orders)) return;

      // timeout those orders
      await this.botOrderRepository.update(
        {
          id: In(ids),
        },
        {
          status: 'timeout',
          reason: 'Bank debit timed out. Contact card issuer or try another card.',
        },
      );

      this.logger.log(`handleTimeoutTask end len:${ids.length}`);
    } catch (error) {
      console.error('handleTimeoutTask error');
      console.error(error);
    }
  }
}
