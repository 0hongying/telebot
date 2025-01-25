import { Injectable } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { In, Repository } from 'typeorm';
import {
  CHANNEL_BOT_ID,
  CHARACTER_CARD,
  HELP_MESSAGE,
  INVITE_MESSAGE,
  INVITE_MESSAGE_DETAIL,
  MAX_LENGTH,
  MESSAGE_MAX_LENGTH,
  getWebsiteUrl,
} from 'src/shared/const';
import { fomatMessage, formatVaildHtml, getBotAvatarUrl } from 'src/shared/utils';
import { InjectRepository } from '@nestjs/typeorm';
import { BotChatMessage } from '../../chat/entity/bot-chat-message.entity';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramClient } from 'src/shared/telegram-bot';
import { ConfigService } from '@nestjs/config';
import { BotEntity, TelegramCharacterCard, TelegramMessage } from '../types/telegram-message';
import { BotChat } from '../../chat/entity/bot-chat.entity';
import { TelegramAiService } from './telegram-ai-service';
import { SubscriptionDataService } from 'src/subscription/service/subscription-data.service';
import { EvonetService } from 'src/subscription/evonet-pay/evonet.service';
import { TrackService } from 'src/track/track.service';
import { TelegramCommonService } from 'src/shared/telegram-common-service';
import { BotChannelMessgae } from 'src/chat/entity/bot-channel-message.entity';
import { BotUser } from 'src/entity/bot-user.entity';
import { InvitationService } from 'src/invitation/invitation.service';
import { sample } from 'lodash';
import { Characters } from 'src/character/entity/characters.entity';
import { CharacterTag } from 'src/character/entity/character.tag.entity';
import { Tags } from 'src/tag/entity/tag.entity';
import { Bots } from '../entity/bots.entity';

@Injectable()
export class TelegramChatService {
  public readonly bucketUrl = this.configService.get('BUCKET_URL');
  public readonly domain = this.configService.get('FRONTEND_DOMAIN');

  constructor(
    @InjectRepository(Characters)
    public readonly charactersRepository: Repository<Characters>,
    @InjectRepository(CharacterTag)
    public readonly characterTagRepository: Repository<CharacterTag>,
    @InjectRepository(Tags)
    public readonly tagsRepository: Repository<Tags>,
    @InjectRepository(BotChatMessage)
    public readonly botChatMessageRepository: Repository<BotChatMessage>,
    @InjectRepository(BotChannelMessgae)
    public readonly botChannelMessgaeRepository: Repository<BotChannelMessgae>,
    @InjectRepository(BotChat)
    public readonly botChatRepository: Repository<BotChat>,
    @InjectRepository(BotUser)
    public readonly botUserRepository: Repository<BotUser>,
    @InjectRepository(Bots)
    public readonly botsRepository: Repository<Bots>,
    public readonly telegramBotService: TelegramBotService,
    public readonly telegramClient: TelegramClient,
    public readonly subscriptionDataService: SubscriptionDataService,
    public readonly trackService: TrackService,
    public readonly evonetService: EvonetService,
    public readonly telegramCommonService: TelegramCommonService,
    public readonly invitationService: InvitationService,
    private readonly configService: ConfigService,
    private readonly telegramAiService: TelegramAiService,
  ) {}

  async callbackQuery(msg: TelegramBot.Update) {
    console.log(`[chat] Handling callback query: ${JSON.stringify(msg)}`);
    const { callback_query } = msg;
    if (!callback_query || !callback_query.message) return;
    const { message } = callback_query;
    const messageText = callback_query.data?.trim();
    const userId = callback_query.from?.id!;
    const chatId = message.chat.id;
    if (messageText === 'change_character') {
      await this.sendRandomCharacterCard(userId, chatId, false);
      this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_order_change_character' });
    } else if (messageText?.startsWith('chat_with')) {
      await this.sendStartMessage({
        chatId,
        isStart: false,
        messageId: message.message_id,
        messageText,
        userId,
        userName: callback_query.from?.first_name,
      });
    }
    // else if (messageText === 'invite') {
    //   await this.sendInvitation(chatId, userId, false);
    //   this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_bot2_invite_now_button' });
    // }
    else {
      console.log(`[chat] Handling callback query error: ${JSON.stringify(msg)}`);
    }
  }

  async sendRandomCharacterCard(userId: number, chatId: number, isChannel: boolean) {
    const [telegramBot, character] = await Promise.all([
      this.telegramBotService.getUserTelegramBot(userId),
      this.telegramBotService.getTelegramCharacter(),
    ]);
    if (!telegramBot || !character) return;
    await this.sendCharacterCard({ chatId, userId, character, isChannel, bot: telegramBot });
  }

  async sendCharacterCard(payload: TelegramCharacterCard) {
    const { chatId, character, bot, isChannel, userId } = payload;
    const characterTags = await this.characterTagRepository.find({ where: { characterId: character.id, obsolete: false } });
    const tags = await this.tagsRepository.find({
      where: {
        id: In(characterTags.map(tag => tag.tagId)),
      },
    });
    const client = isChannel ? this.telegramClient.getChannelClient() : this.telegramClient.getChatClient(bot.id);
    const tagsLength = tags.map(tag => tag.name).join('   ').length;
    const nameLength = character.name.length;
    const maxDescriptionLength = MAX_LENGTH - tagsLength - nameLength - 3;
    const description =
      character.description.length > maxDescriptionLength
        ? formatVaildHtml(character.description).slice(0, maxDescriptionLength) + '...'
        : formatVaildHtml(character.description);
    const caption = CHARACTER_CARD(character.name, description, tags.map(tag => tag.name).join('   '));
    await client.sendPhoto(chatId, getBotAvatarUrl(this.bucketUrl, character.avatar), {
      caption,
      reply_markup: {
        inline_keyboard: [
          isChannel
            ? [{ text: `Chat With ${character.name}`, url: `https://t.me/${bot.name}?start=${character.id}_${bot.id}` }]
            : [{ text: `Chat With ${character.name}`, callback_data: `chat_with=${character.id}_${bot.id}` }],
          [
            { text: 'Change Character', callback_data: 'change_character' },
            { text: 'All Characters', web_app: { url: getWebsiteUrl(this.domain, chatId, userId, isChannel) } },
          ],
        ],
      },
      parse_mode: 'HTML',
    });
  }

  async sendMessageOrCommand(msg: TelegramBot.Message, botEntity: BotEntity, character: Characters) {
    console.log(`[chat] Handling send message or command: ${JSON.stringify(msg)}`);
    if (!msg || !msg.text) return;
    return msg.text.startsWith('/') ? this.sendCommand(msg, botEntity) : this.telegramAiService.sendMessageByModel(msg, botEntity, character);
  }

  async sendCommand(msg: TelegramBot.Message, botEntity: BotEntity) {
    try {
      const chatId = msg.chat.id;
      const messageText = msg.text?.trim();
      const userId = msg.from?.id!;
      if (messageText?.match(/\/start(.+)/)) {
        await this.sendStartMessage({
          chatId,
          isStart: true,
          messageId: msg.message_id,
          messageText,
          userId,
          userName: msg.chat.first_name,
        });
        this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_bot2_start' });
      } else if (messageText?.startsWith('/characters')) {
        await this.sendAllCharacters(chatId, userId, botEntity, false);
      } else if (messageText?.startsWith('/serve_mate')) {
        await botEntity.bot.sendMessage(chatId, "Manage your Roymate here: <a href='https://t.me/ServeMate_chatbot'>ServeMate_chatbot</a>!", {
          parse_mode: 'HTML',
        });
      } else {
        await botEntity.bot.sendMessage(chatId, `Sorry, I don't recognize this command. Type /help to view available commands.`);
      }
    } catch (error) {
      console.error('Error send command:', error);
    }
  }

  async sendHelpMessage(userId: number, chatId: number) {
    const bot = this.telegramClient.getChannelClient();
    await bot.sendMessage(chatId, HELP_MESSAGE, { parse_mode: 'HTML' });
    this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_order_help' });
  }

  async sendAllCharacters(chatId: number, userId: number, botEntity: BotEntity, isChannel: boolean) {
    const keyboard = {
      inline_keyboard: [[{ text: 'All Characters', web_app: { url: getWebsiteUrl(this.domain, chatId, userId, isChannel) } }]],
    };
    const telegramBot = isChannel ? this.telegramClient.getChannelClient() : botEntity.bot;
    await telegramBot.sendMessage(chatId, 'A world of fantasies awaits，tap below to explore them all now.', {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    });
    this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_order_all_character' });
  }

  async sendStartMessage(payload: TelegramMessage) {
    const { chatId, messageId, messageText, userId, userName, isStart } = payload;

    const { characterId, botId } = isStart
      ? this.telegramBotService.getChatBotStartInfo(messageText)
      : this.telegramBotService.getChatWithInfo(messageText);
    const character = await this.charactersRepository.findOneBy({ id: characterId });
    if (!character) {
      throw new Error('Character not found');
    }
    const firstMessage = fomatMessage(character.firstMessage, character.name, userName);
    const chatTelegram = this.telegramClient.getChatClient(Number(botId));
    const botChat = await this.botChatRepository.save({
      userId,
      characterId,
      telegramChatId: chatId,
      messageCount: 1,
      botId: Number(botId),
    });
    await this.sendMultipleMessage(chatTelegram, chatId, firstMessage);
    await Promise.all([
      this.botChatMessageRepository.save({
        messageId,
        message: character.firstMessage,
        order: 1,
        chatId: botChat.id,
        isBot: true,
      }),
      this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_order_chat_with' }),
    ]);
  }

  async sendMultipleMessage(bot: TelegramBot, chatId: number, messageText: string) {
    if (messageText.length < MESSAGE_MAX_LENGTH) {
      await this.trySendMarkDownMessage(bot, chatId, messageText);
      return;
    }
    const messages = this.splitTelegramMessage(messageText);
    for (const message of messages) {
      await this.trySendMarkDownMessage(bot, chatId, message);
    }
  }

  async trySendMarkDownMessage(bot: TelegramBot, chatId: number, message: string) {
    try {
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Sending start message error:', error);
      await bot.sendMessage(chatId, message);
    }
  }

  splitTelegramMessage(text: string) {
    const messages = [];
    let currentMessage = '';
    const words = text.split(/(\s+)/);
    for (const word of words) {
      if ((currentMessage + word).length > MESSAGE_MAX_LENGTH) {
        messages.push(currentMessage.trim());
        currentMessage = word;
      } else {
        currentMessage += word;
      }
    }
    if (currentMessage) {
      messages.push(currentMessage.trim());
    }
    return messages;
  }

  async sendInvitation(chatId: number, userId: number, isChannel: boolean) {
    const inviteText = sample(INVITE_MESSAGE_DETAIL);
    const [channelBot, code] = await Promise.all([
      this.botsRepository.findOneOrFail({ where: { id: CHANNEL_BOT_ID } }),
      this.invitationService.getOrCreateInviteCode(userId),
    ]);
    const text = isChannel ? 'Invite for Free Messages' : 'Invite Now';
    const keyboard = {
      inline_keyboard: [
        [{ text, url: `https://t.me/share/url?url=https://t.me/${channelBot.name}?start=inv-${code}&text=${encodeURIComponent(inviteText!)}` }],
      ],
    };
    const botUser = await this.botUserRepository.findOneByOrFail({ userId });
    const bot = isChannel ? this.telegramClient.getChannelClient() : this.telegramClient.getChatClient(botUser.botId);
    await bot.sendMessage(chatId, INVITE_MESSAGE, { reply_markup: keyboard, parse_mode: 'HTML' });
    this.trackService.addTelegramEvent({ userId, eventName: isChannel ? 'Telegram_bot1_invite_for_button' : 'Telegram_bot2_invite_now_button' });
  }
}
