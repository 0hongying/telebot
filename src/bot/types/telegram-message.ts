import TelegramBot from 'node-telegram-bot-api';
import { Bots } from '../entity/bots.entity';
import { Characters } from 'src/character/entity/characters.entity';

export interface TelegramMessage {
  chatId: number;
  isStart?: boolean;
  messageText?: string;
  messageId?: number;
  userName?: string;
  userId: number;
}

export interface BotEntity {
  bot: TelegramBot;
  id: number;
  type: string;
  name: string;
  token: string;
  isChannel: boolean;
  updatedAt: Date;
  createdAt: Date;
}

export interface TelegramCharacterCard {
  chatId: number;
  userId: number;
  bot: Bots;
  character: Characters;
  isChannel: boolean;
}
