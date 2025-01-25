import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import TelegramBot from 'node-telegram-bot-api';
import { Bots } from 'src/bot/entity/bots.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TelegramClient implements OnModuleInit {
  #channelTelegram: TelegramBot;
  #chatTelegramMap: Map<number, TelegramBot> = new Map();

  constructor(@InjectRepository(Bots) private readonly botsRepository: Repository<Bots>) {}

  async onModuleInit() {
    const bots = await this.botsRepository.find();
    for (const bot of bots) {
      if (bot.isChannel) {
        this.#channelTelegram = new TelegramBot(bot.token);
      } else {
        this.#chatTelegramMap.set(bot.id, new TelegramBot(bot.token));
      }
    }
  }

  getChannelClient() {
    return this.#channelTelegram;
  }

  getChatClient(botId: number) {
    const telegram = this.#chatTelegramMap.get(botId);
    if (!telegram) throw new Error(`Telegram bot with id ${botId} not found`);
    return telegram;
  }
}
