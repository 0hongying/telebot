import { Injectable } from '@nestjs/common';
import { TelegramBotService } from './service/telegram-bot.service';
import { Request } from 'express';
import { TelegramChannelService } from './service/telegram-channel.service';
import { TelegramChatService } from './service/telegram-chat.service';
import { CreateBotChatDto } from './bot.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WHITE_LIST } from 'src/shared/const';
import TelegramBot from 'node-telegram-bot-api';
import { Characters } from 'src/character/entity/characters.entity';
import { Bots } from './entity/bots.entity';
@Injectable()
export class BotService {
  constructor(
    @InjectRepository(Characters)
    private readonly charactersRepository: Repository<Characters>,
    @InjectRepository(Bots)
    private readonly botsRepository: Repository<Bots>,
    private readonly telegramBotService: TelegramBotService,
    private readonly telegramChannelService: TelegramChannelService,
    private readonly telegramChatService: TelegramChatService,
  ) {}

  async channelBotCompletion(req: Request) {
    try {
      const botEntity = await this.telegramBotService.getChannelTelegramBot();
      const { bot, id } = botEntity;
      const isUpdated = await this.telegramBotService.isUpdateProcessed(req.body, id);
      if (isUpdated) {
        console.log(`[channel] botId:${id} UpdateId ${req.body.update_id} already processed`);
        return;
      }
      req.body.callback_query
        ? await this.telegramChannelService.callbackQuery(req.body)
        : await this.telegramChannelService.sendMessageOrCommand(req.body.message, botEntity);
      await this.telegramBotService.markUpdateAsProcessed(req.body, id);
      console.log(`[channel] botId:${id} Update ${req.body.update_id} processed successful`);
    } catch (error) {
      console.error('Webhook error:', error);
    }
  }

  async chatBotCompletion(req: Request) {
    try {
      const { character, botEntity } = await this.telegramBotService.getChatTelegramBot(req.body);
      const { bot, id } = botEntity;
      const isUpdated = await this.telegramBotService.isUpdateProcessed(req.body, id);
      if (isUpdated) {
        console.log(`[chat] botId:${id} UpdateId ${req.body.update_id} already processed`);
        return;
      }
      req.body.callback_query
        ? await this.telegramChatService.callbackQuery(req.body)
        : await this.telegramChatService.sendMessageOrCommand(req.body.message, botEntity, character);
      await this.telegramBotService.markUpdateAsProcessed(req.body, id);
      console.log(`[chat] botId:${id} Update ${req.body.update_id} processed successful`);
    } catch (error) {
      console.error('[chat] Webhook error:', error);
    }
  }

  async sendCharacterCardFromWebsite(payload: CreateBotChatDto) {
    const { chatId, characterId, userId, isChannel } = payload;
    const [character, { botUser }] = await Promise.all([
      this.charactersRepository.findOneByOrFail({ id: characterId }),
      this.telegramBotService.findOrInsertBotUser(userId),
    ]);
    const bot = await this.botsRepository.findOneByOrFail({ id: botUser.botId });
    await this.telegramChatService.sendCharacterCard({ chatId, userId, character, bot, isChannel });
  }

  isAccessAllowed(update: TelegramBot.Update) {
    const userId = update.message?.from?.id;
    return process.env.NODE_ENV === 'production' || WHITE_LIST.includes(userId!);
  }
}
