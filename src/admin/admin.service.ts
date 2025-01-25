import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { BotUser } from 'src/entity/bot-user.entity';
import { getSubscriptionPageUrl } from 'src/shared/const';
import { TelegramClient } from 'src/shared/telegram-bot';
import { Repository } from 'typeorm';

@Injectable()
export class AdminService {
  public readonly domain = this.configService.get('FRONTEND_DOMAIN');
  constructor(
     @InjectRepository(BotUser)
      private readonly botUserRepository: Repository<BotUser>,
      private readonly telegramClient: TelegramClient, 
      private readonly configService: ConfigService
    ) {}

  async pushUserMessage(userIds: number[], message: string) {
    for (const userId of userIds) {
      await this.pushNewManageMessageByUserId(userId);
    }
  }

  async pushMessageByUserId(userId: number, message: string) {
    try {
      const keyboard = {
        inline_keyboard: [[{ text: 'Subscribe', web_app: { url: getSubscriptionPageUrl(this.domain, userId) } }]],
      };
      const bot = this.telegramClient.getChannelClient();
      await bot.sendMessage(userId, message, {
        reply_markup: keyboard,
      });
    } catch (error) {
      console.error(`pushMessageByUsrId error: ${error}`);
    }
  }

  async pushNewManageMessageByUserId(userId: number) {
    try {
      const botUser = await this.botUserRepository.findOneBy({ userId });
      if (!botUser) return;
      const bot = this.telegramClient.getChatClient(botUser.botId);
      await bot.sendMessage(userId, `We have completed our system maintenance and upgrade, and our service has now returned to normal operation. To ensure you continue to enjoy full service, please visit our new Bot: <a href='https://t.me/ServeMate_chatbot'>ServeMate_chatbot</a>
All your benefits will be protected in the new Bot, and you can log in directly to manage them.`, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error(`pushMessageByUsrId error: ${error}`);
    }
  }
}
