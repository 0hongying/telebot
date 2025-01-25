import { Injectable } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { CHANNEL_BEGIN_MESSAGE, CHANNEL_BOT_ID, getSubscriptionPageUrl } from 'src/shared/const';
import { TelegramChatService } from './telegram-chat.service';
import { BotEntity, TelegramMessage } from '../types/telegram-message';
import { formatDateToYYMMDD } from 'src/shared/utils';
import { Characters } from 'src/character/entity/characters.entity';

@Injectable()
export class TelegramChannelService extends TelegramChatService {
  async callbackQuery(msg: TelegramBot.Update) {
    console.log(`[channel] Handling callback query: ${JSON.stringify(msg)}`);
    const { callback_query } = msg;
    const chatId = callback_query?.message?.chat.id;
    const userId = callback_query?.from.id;
    const messageId = callback_query?.message?.message_id;
    if (!callback_query || !chatId || !userId || !messageId) return;

    const messageText = callback_query.data?.trim();
    if (messageText === 'manage_cookies') {
      await this.clickManageCookies(chatId, messageId);
      await this.sendRandomCharacterCard(userId, chatId, true);
    } else if (messageText === 'change_character') {
      await this.sendRandomCharacterCard(userId, chatId, true);
      this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_order_change_character' });
      // } else if (messageText === 'subscribe') {
      //   await this.sendManageSubscription(chatId, userId);
      //   this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_order_subscribe' });
    } else if (messageText === 'cancel') {
      await this.sendCancelSubscription(chatId, userId);
      this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_cancel_subscription_click' });
    } else if (messageText === 'quota') {
      await this.telegramCommonService.sendMessageQuota(chatId, userId);
      this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_order_quota' });
    } else if (messageText?.startsWith('cancel_subscription')) {
      const text = this.telegramBotService.getCancelInfo(messageText);
      this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_cancel_subscription_sure_click' });
      await this.sendCancelSubscriptionTip(messageId, userId, chatId, text);
    } else if (messageText === 'not_cancel_subscription') {
      await this.sendNotCancelSubscriptionTip(messageId, chatId);
      this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_cancel_subscription_not_click' });
    } else {
      console.log(`[channel] Handling callback query error: ${JSON.stringify(msg)}`);
    }
  }

  async sendMessageOrCommand(msg: TelegramBot.Message, botEntity: BotEntity, character?: Characters) {
    console.log(`[channel] Handling send message or command: ${JSON.stringify(msg)}`);
    if (!msg || !msg.text) return;
    const userId = msg.from?.id!;
    return msg.text.startsWith('/') ? this.sendCommand(msg, botEntity) : this.saveUserMessage(msg.text, userId);
  }

  async saveUserMessage(message: string, userId: number) {
    await this.botChannelMessgaeRepository.save({ message, userId, isBot: false, botId: CHANNEL_BOT_ID });
  }

  async sendCommand(msg: TelegramBot.Message, botEntity: BotEntity) {
    try {
      const chatId = msg.chat.id;
      const userId = msg.from?.id!;
      const messageText = msg.text?.trim();
      const bot = botEntity.bot;
      if (messageText?.startsWith('/start')) {
        await this.handleSendStart(msg);
      } else if (messageText?.startsWith('/help')) {
        await this.sendHelpMessage(userId, chatId);
      } else if (messageText?.startsWith('/characters')) {
        await this.sendAllCharacters(chatId, userId, botEntity, true);
      } else if (messageText?.startsWith('/quota')) {
        await this.telegramCommonService.sendMessageQuota(chatId, userId);
        this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_order_quota' });
      } else if (messageText?.startsWith('/manage_subscription')) {
        await this.sendManageSubscription(chatId, userId);
        this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_order_manage_subscription' });
        // } else if (messageText?.startsWith('/subscribe')) {
        //   await this.sendSubscription(chatId, userId);
        //   this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_order_subscribe' });
        // }
        // else if (messageText?.startsWith('/invite')) {
        //   await this.sendInvitation(chatId, userId, true);
        //   this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_order_invite' });
      } else {
        await bot.sendMessage(chatId, `Sorry, I don't recognize this command. Type /help to view available commands.`);
      }
    } catch (error) {
      console.error('Error send command:', error);
    }
  }

  async handleSendStart(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const userId = msg.from?.id!;
    const userName = msg.chat.first_name;
    const messageText = msg.text?.trim();
    const { source, inviteCode } = this.telegramBotService.getChannleBotStartInfo(messageText);
    await this.sendStartMessage({ chatId, userId });
    const { isNewUser } = await this.telegramBotService.findOrInsertBotUser(userId, userName, source);
    if (inviteCode) {
      await this.invitationService.inviteUser(userId, inviteCode, isNewUser);
    }
    this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_bot1_start' });
  }

  async sendStartMessage(payload: TelegramMessage) {
    const { chatId } = payload;
    const keyboard = {
      inline_keyboard: [[{ text: 'Accept All', callback_data: 'manage_cookies' }]],
    };
    await this.telegramClient.getChannelClient().sendMessage(chatId, CHANNEL_BEGIN_MESSAGE, { reply_markup: keyboard, parse_mode: 'HTML' });
  }

  async clickManageCookies(chatId: number, messageId: number) {
    const keyboard = {
      inline_keyboard: [[{ text: 'Accepted', callback_data: 'button_disabled' }]],
    };
    await this.telegramClient
      .getChannelClient()
      .editMessageText(CHANNEL_BEGIN_MESSAGE, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'HTML' });
  }

  // async sendSubscription(chatId: number, userId: number) {
  //   const bot = this.telegramClient.getChannelClient();
  //   const keyboard = {
  //     inline_keyboard: [[{ text: 'Subscribe or upgrade', web_app: { url: getSubscriptionPageUrl(this.domain, userId) } }]],
  //   };
  //   await bot.sendMessage(chatId, 'Unlock endless fantasy with our subscription—up to 70% off. Join now!', {
  //     reply_markup: keyboard,
  //   });
  // }

  async sendManageSubscription(chatId: number, userId: number) {
    const bot = this.telegramClient.getChannelClient();
    const keyboard = {
      inline_keyboard: [
        // [{ text: 'Subscribe or upgrade', web_app: { url: getSubscriptionPageUrl(this.domain, userId) } }],
        [{ text: 'Cancel my subscription', callback_data: 'cancel' }],
        [{ text: 'Check available message quota', callback_data: 'quota' }],
      ],
    };
    await bot.sendMessage(chatId, 'Unlock endless fantasy with our subscription—up to 70% off. Join now!', {
      reply_markup: keyboard,
    });
  }

  async sendCancelSubscription(userId: number, chatId: number) {
    const bot = this.telegramClient.getChannelClient();
    const currentSubscription = await this.subscriptionDataService.findActiveSubscription(userId);
    if (!currentSubscription) {
      await bot.sendMessage(chatId, 'You do not have any active subscriptions.');
    } else if (!currentSubscription.autoRenew) {
      const endDate = formatDateToYYMMDD(currentSubscription.endTime);
      const text = `Your subscription benefits will last until ${endDate}. After expiration, your subscription will not renew automatically, and no further charges will be applied.`;
      await bot.sendMessage(chatId, text);
    } else if (currentSubscription.autoRenew) {
      const endDate = formatDateToYYMMDD(currentSubscription.endTime);
      const keyboard = {
        inline_keyboard: [
          [
            { text: 'I am sure', callback_data: `cancel_subscription=${endDate}` },
            { text: `Don't cancel`, callback_data: 'not_cancel_subscription' },
          ],
        ],
      };
      await bot.sendMessage(chatId, 'Are you sure you want to cancel your subscription? This action cannot be undone.', {
        reply_markup: keyboard,
      });
    }
  }

  async sendCancelSubscriptionTip(messageId: number, userId: number, chatId: number, text: string) {
    const bot = this.telegramClient.getChannelClient();
    await bot.deleteMessage(chatId, messageId);
    await this.evonetService.cancel(userId);
    await bot.sendMessage(chatId, text);
  }

  async sendNotCancelSubscriptionTip(messageId: number, chatId: number) {
    const bot = this.telegramClient.getChannelClient();
    await bot.deleteMessage(chatId, messageId);
    await bot.sendMessage(chatId, 'Subscription has been reserved for you.');
  }
}
