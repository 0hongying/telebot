import { Injectable } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TelegramClient } from 'src/shared/telegram-bot';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { BotChat } from '../../chat/entity/bot-chat.entity';
import { BotUser } from '../../entity/bot-user.entity';
import { getBotUpdateId, MOST_POPULAR_CHARACTER_ID } from 'src/shared/const';
import { sample } from 'lodash';
import { Characters } from 'src/character/entity/characters.entity';
import { Bots } from '../entity/bots.entity';

@Injectable()
export class TelegramBotService {
  private readonly redis: Redis;

  constructor(
    @InjectRepository(Bots)
    private readonly botsRepository: Repository<Bots>,
    @InjectRepository(Characters)
    private readonly charactersRepository: Repository<Characters>,
    @InjectRepository(BotChat)
    public readonly botChatRepository: Repository<BotChat>,
    @InjectRepository(BotUser)
    private readonly botUserRepository: Repository<BotUser>,
    private readonly telegramClient: TelegramClient,
    private readonly redisService: RedisService,
  ) {
    this.redis = this.redisService.getClient();
  }

  async getChannelTelegramBot() {
    const botEntity = await this.botsRepository
      .createQueryBuilder('bot')
      .where('bot.is_channel = :isChannel', { isChannel: true })
      .orderBy('bot.id', 'DESC')
      .limit(1)
      .getOne();
    if (!botEntity) throw new Error('No available bot found');
    return { ...botEntity, bot: this.telegramClient.getChannelClient() };
  }

  async getChatTelegramBot(msg: TelegramBot.Update) {
    const { characterId, botId } = msg.message?.text?.match(/\/start(.+)/)
      ? this.getChatBotStartInfo(msg.message?.text)
      : await this.botChatRepository.findOneOrFail({
          where: { userId: msg.message?.from?.id },
          order: { id: 'DESC' },
          select: ['characterId', 'botId'],
        });
    if (!characterId || !botId) throw new Error('No available bot or character found');
    const [character, botEntity] = await Promise.all([
      this.charactersRepository.findOneBy({ id: characterId }),
      this.getTelegramBotById(Number(botId)),
    ]);
    if (!character || !botEntity) throw new Error('No available bot or character found');
    return { character, botEntity };
  }

  async getUserTelegramBot(userId: number) {
    const { botUser } = await this.findOrInsertBotUser(userId);
    const bot = await this.botsRepository.findOneByOrFail({ id: botUser.botId });
    return { ...bot, payload: this.telegramClient.getChatClient(botUser.botId) };
  }

  async findOrInsertBotUser(userId: number, userName?: string, source?: string) {
    if (!userId) throw new Error('Invalid userId');
    const botUser = await this.botUserRepository.findOneBy({ userId });
    if (botUser) return { botUser, isNewUser: false };
    const bot = await this.getRandomChatTelegramBot();
    const newBotUser = await this.botUserRepository.save({ userId, botId: bot.id, source, name: userName });
    return { botUser: newBotUser, isNewUser: true };
  }

  async getRandomChatTelegramBot() {
    const bot = await this.botsRepository
      .createQueryBuilder('bot')
      .where('bot.is_channel = :isChannel', { isChannel: false })
      .orderBy('RANDOM()')
      .limit(1)
      .getOne();
    if (!bot) throw new Error('No available bot found');
    return bot;
  }

  async getTelegramCharacter() {
    const characterId = sample(MOST_POPULAR_CHARACTER_ID);
    if (!characterId) throw new Error('No available character found');
    const character = await this.charactersRepository.findOneBy({ id: characterId });
    if (!character) {
      console.log('No available character found, get random public character');
      return await this.getRandomPublicCharacter();
    }
    return character;
  }

  async getRandomPublicCharacter() {
    const character = await this.charactersRepository
      .createQueryBuilder('character')
      .where('character.is_public = :isPublic', { isPublic: true })
      .andWhere('character.audited = :audited', { audited: true })
      .andWhere('character.deleted_at is NULL')
      .orderBy('RANDOM()')
      .limit(1)
      .getOne();
    return character;
  }

  async getTelegramBotById(botId: number) {
    const botEntity = await this.botsRepository.findOneBy({ id: botId });
    if (!botEntity) throw new Error('No available bot found');
    return { ...botEntity, bot: botEntity.isChannel ? this.telegramClient.getChannelClient() : this.telegramClient.getChatClient(botId) };
  }

  async isUpdateProcessed(update: TelegramBot.Update, botId: number) {
    const updateId = update.update_id;
    const now = new Date();
    const key = getBotUpdateId(botId, now);
    const preKey = getBotUpdateId(botId, new Date(now.getTime() - 24 * 60 * 60 * 1000));
    return (await this.redis.sismember(key, updateId)) === 1 || (await this.redis.sismember(preKey, updateId)) === 1;
  }

  async markUpdateAsProcessed(update: TelegramBot.Update, botId: number) {
    const lastUpdateId = update.update_id;
    const now = new Date();
    const key = getBotUpdateId(botId, now);
    await Promise.all([this.redis.sadd(key, lastUpdateId), this.redis.expire(key, 60 * 60 * 24 * 3)]);
  }

  getChatBotStartInfo(text?: string) {
    const startInfo = text && text.match(/\/start(.+)/);
    if (!startInfo) throw new Error('Invalid start command');
    const info = startInfo[1].trim();
    const [characterId, botId] = info.split('_');
    console.log(`[character] botId ${botId} characterId ${characterId}`);
    return { characterId, botId };
  }

  getChatWithInfo(text?: string) {
    const chatWithInfo = text && text.match(/chat_with=(.+)/);
    if (!chatWithInfo) throw new Error('Invalid chatWithInfo command');
    const info = chatWithInfo[1].trim();
    const [characterId, botId] = info.split('_');
    console.log(`[character] botId ${botId} characterId ${characterId}`);
    return { characterId, botId };
  }

  getCancelInfo(text?: string) {
    const cancelInfo = text && text.match(/cancel_subscription=(.+)/);
    if (!cancelInfo) throw new Error('Invalid cancelInfo command');
    const endDate = cancelInfo[1].trim();
    const cancelText = `Your subscription benefits will last until ${endDate}. After expiration, your subscription will not renew automatically, and no further charges will be applied.`;
    return cancelText;
  }

  getChannleBotStartInfo(text?: string) {
    const ret: { source?: string; inviteCode?: string } = { source: undefined, inviteCode: undefined };
    const textInfo = text && text.match(/\/start(.+)/);
    if (!textInfo) return ret;
    const info = textInfo[1].trim();
    info.startsWith('inv-') ? (ret.inviteCode = info.slice(4)) : (ret.source = info);
    return ret;
  }
}
