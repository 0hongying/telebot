import { OpenAIInputMessage } from 'src/chat/types/openai';
import { delay, fomatMessage, getTokenLength } from 'src/shared/utils';
import { BotChatMessage } from '../../chat/entity/bot-chat-message.entity';
import { ChatResult } from 'src/chat/types/chat';
import { ClaudeAPIService } from 'src/chat/service/claude-api.service';
import { AmethystAPIService } from 'src/chat/service/amethyst-api.service';
import TelegramBot from 'node-telegram-bot-api';
import { last, random } from 'lodash';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BotChat } from '../../chat/entity/bot-chat.entity';
import { BotMessageQuota } from '../../subscription/entity/bot-message-quota.entity';
import { BotEntity } from '../types/telegram-message';
import { getSubscriptionPageUrl, getTelegramBotControlKey, TELEGRAM_BOT_PER_MINUTE_MESSAGE_COUNT } from 'src/shared/const';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { MessageQuotaDataService } from 'src/subscription/service/message-quota-data.service';
import { TrackService } from 'src/track/track.service';
import { InvitationService } from 'src/invitation/invitation.service';
import { OpenrouterAPIService } from 'src/chat/service/openrouter-api.service';
import { Characters } from 'src/character/entity/characters.entity';

export class TelegramAiService {
  public readonly domain = this.configService.get('FRONTEND_DOMAIN');
  private readonly redis: Redis;

  constructor(
    @InjectRepository(BotChatMessage)
    public readonly botChatMessageRepository: Repository<BotChatMessage>,
    @InjectRepository(BotChat)
    public readonly botChatRepository: Repository<BotChat>,
    @InjectRepository(BotMessageQuota)
    public readonly botMessageQuotaRepository: Repository<BotMessageQuota>,
    private readonly messageQuotaDataService: MessageQuotaDataService,
    private readonly claudeAPIService: ClaudeAPIService,
    private readonly openrouterAPIService: OpenrouterAPIService,
    private readonly amethystAPIService: AmethystAPIService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly trackService: TrackService,
    private readonly invitationService: InvitationService,
  ) {
    this.redis = this.redisService.getClient();
  }

  async sendMessageByModel(msg: TelegramBot.Message, botEntity: BotEntity, character?: Characters) {
    try {
      const chatId = msg.chat.id;
      const messageText = msg.text?.trim();
      const userId = msg.from?.id;
      if (!messageText || !character || !userId) return;
      const bot = botEntity.bot;
      const { usedCount, quotaCount } = await this.messageQuotaDataService.getUserMessageQuota(userId);
      if (usedCount >= quotaCount) {
        await this.sendSubscribeMessage(chatId, userId, bot);
        this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_subscribe_button' });
        this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_bot2_message_usedup_invite_button' });
        return;
      }
      const isBotLimit = await this.checkBotMessageLimit(botEntity.id);
      if (isBotLimit) {
        console.log(`Bot ${botEntity.id} has reached the frequency control`);
        await delay(random(0, 2000));
      }
      const message = await bot.sendMessage(chatId, 'Replying...', { parse_mode: 'Markdown' });
      await this.streamReply(msg, bot, message.message_id, character);
      await this.messageQuotaDataService.updateUserMessageQuota(userId);
      await this.updateBotFrequencyControl(botEntity.id);
    } catch (error) {
      console.error('Error send message:', error);
    }
  }

  async streamReply(msg: TelegramBot.Message, bot: TelegramBot, messageId: number, character: Characters) {
    let accumulatedText = '';
    let originText = '';
    let lastSentLength = 0;
    const chatId = msg.chat.id;
    const userName = msg.chat.first_name;
    const userId = msg.from?.id;
    const messageText = msg.text!.trim();
    const { name, id: characterId } = character;
    const botChat = await this.botChatRepository.findOne({ where: { userId, characterId }, order: { id: 'desc' } });
    const botChatMessages = await this.botChatMessageRepository.find({ where: { chatId: botChat?.id }, order: { id: 'asc' } });
    const lastBotChatMessage = last(botChatMessages);
    const openAIInputMessage = this.buildPrompt(character, messageText, botChatMessages);
    let model: string | undefined;
    for await (const { content, apiKey } of this.generateReplyStream(openAIInputMessage, lastBotChatMessage?.order || 1)) {
      accumulatedText += content;
      originText += content;
      if (accumulatedText.length - lastSentLength >= 80) {
        await delay(random(0, 500));
        await bot.editMessageText(accumulatedText, {
          chat_id: chatId,
          message_id: messageId,
        });
        lastSentLength = accumulatedText.length;
      }
      model = apiKey;
    }
    if (accumulatedText === '') {
      return;
    }
    try {
      accumulatedText = fomatMessage(accumulatedText, name, userName) + '  ';
      await bot.editMessageText(accumulatedText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error('Error generating reply:', error);
      try {
        await bot.editMessageText(accumulatedText, {
          chat_id: chatId,
          message_id: messageId,
        });
      } catch (error) {
        console.error('Telegram editing message error:', error);
      }
    }

    const order = Number(lastBotChatMessage?.order) || 1;
    await Promise.all([
      this.botChatMessageRepository.save([
        {
          messageId,
          message: messageText,
          order: order + 1,
          isBot: false,
          chatId: botChat?.id,
        },
        {
          messageId,
          message: originText,
          order: order + 2,
          model,
          isBot: true,
          chatId: botChat?.id,
        },
      ]),
      this.botChatRepository
        .createQueryBuilder()
        .update(BotChat)
        .set({
          messageCount: () => `COALESCE(bot_chat.message_count, 0) + 2`,
        })
        .where({ id: botChat?.id })
        .execute(),
    ]);
    await this.invitationService.rewardNewUserMessageQuota(userId!);
  }

  async *generateReplyStream(messages: OpenAIInputMessage[], order: number) {
    try {
      const response = await this.selectModelByMessageLength(messages, order);
      for await (const chunk of this.processStreamChunks(response)) {
        if (this.isSorryPhrases(chunk.content)) {
          yield* this.generateReplyByAmethyst(messages);
          return;
        }
        yield chunk;
      }
    } catch (error) {
      console.error('Error calling OpenRouter API:', error);
      yield { content: 'Sorry, an error occurred while generating the reply. Please try again later.', apiKey: '' };
    }
  }

  async *generateReplyByAmethyst(originMessages: OpenAIInputMessage[]) {
    try {
      const response = await this.amethystAPIService.tryCallAmethyst(originMessages);
      for await (const chunk of this.processStreamChunks(response)) {
        yield chunk;
      }
    } catch (error) {
      console.error('Error calling Amethyst API:', error);
      yield { content: 'Sorry, an error occurred while generating the reply. Please try again later.', apiKey: '' };
    }
  }

  private async *processStreamChunks(response: any) {
    const { apiKey, response: stream } = response;
    try {
      for await (const chunk of stream.data) {
        const lines = chunk
          .toString('utf8')
          .split('\n')
          .filter((line: string) => line.trim() !== '');
        for (const line of lines) {
          if (line.includes('[DONE]')) return;

          if (line.startsWith('data:')) {
            const data = JSON.parse(line.slice(5));
            const content = data.choices[0].delta.content;
            yield { content, apiKey };
          }
        }
      }
    } catch (error) {
      console.error('Error processing stream:', error);
      yield { content: 'Sorry, an error occurred while generating the reply. Please try again later.', apiKey: '' };
    }
  }

  async selectModelByMessageLength(originMessages: OpenAIInputMessage[], order: number) {
    let result: ChatResult;
    try {
      if (order > 5) {
        if ((order + 1) % 4 === 0) {
          result = await this.claudeAPIService.tryCallClaudeHaiku(originMessages);
        } else {
          result = await this.openrouterAPIService.tryCallOpenrouter(originMessages, 'meta-llama/llama-3-8b-instruct');
        }
      } else {
        // result = await this.novitaAPIService.tryCallNovita(originMessages, 'meta-llama/llama-3-70b-instruct');
        result = await this.openrouterAPIService.tryCallOpenrouter(originMessages, 'meta-llama/llama-3-70b-instruct');
      }
    } catch (error) {
      result = await this.amethystAPIService.tryCallAmethyst(originMessages);
    }
    return result;
  }

  async checkBotMessageLimit(botId: number) {
    const msgCount = await this.redis.hget(getTelegramBotControlKey(new Date()), String(botId));
    return Number(msgCount) >= TELEGRAM_BOT_PER_MINUTE_MESSAGE_COUNT;
  }

  async updateBotFrequencyControl(botId: number) {
    const key = getTelegramBotControlKey(new Date());
    await Promise.all([this.redis.hincrby(key, String(botId), 1), this.redis.expire(key, 5 * 60 * 60)]);
  }

  async sendSubscribeMessage(chatId: number, userId: number, bot: TelegramBot) {
    // const keyboard = {
    //   inline_keyboard: [
    //     [{ text: 'Subscribe', web_app: { url: getSubscriptionPageUrl(this.domain, userId) } }],
    //     [{ text: 'Invite for Free Messages', callback_data: 'invite' }],
    //   ],
    // };
    // await bot.sendMessage(chatId, 'You have reached your message limit; upgrade your subscription to chat without restrictions.', {
    //   reply_markup: keyboard,
    // });
    await bot.sendMessage(
      chatId,
      "You've reached your message limit. Continue your romantic adventure at <a href='https://deepsweet.ai'>Deepsweet</a>!",
      { parse_mode: 'HTML' },
    );
    this.trackService.addTelegramEvent({ userId, eventName: 'Telegram_bot2_message_usedup_invite_click' });
  }

  buildPrompt(character: Characters, messageText: string, botChatMessages: BotChatMessage[]) {
    const maxContentLength = 4095 - 320;
    const userMessage: OpenAIInputMessage = { role: 'user', content: messageText };
    const systemInstruction = this.buildSystemInstruction(character);
    const chatHistory = this.buildChatHistory(botChatMessages);

    let messages: OpenAIInputMessage[] = [systemInstruction, ...chatHistory, userMessage];
    let promptTokenLength = getTokenLength(messages);
    if (promptTokenLength < maxContentLength) {
      return messages;
    }
    let maxLoop = 100;
    while (promptTokenLength >= maxContentLength && chatHistory.length > 0 && maxLoop > 0) {
      chatHistory.shift();
      messages = [systemInstruction, ...chatHistory, userMessage];
      promptTokenLength = getTokenLength(messages);
      maxLoop--;
    }
    return messages;
  }

  buildSystemInstruction(character: Characters) {
    const { name, scenario, personality } = character;
    const system: OpenAIInputMessage = {
      role: 'system',
      content: `
      XXYYI{{*prompt*}}XXYYI.
      {{char}}'s name: ${name}. {{char}} calls {{user}} by {{user}} or any name introduced by {{user}}.
      {{char}}'s personality: ${personality}.
      Scenario of the roleplay: ${scenario}.
      `,
    };
    return system;
  }

  buildChatHistory(botChatMessages: BotChatMessage[]) {
    const chatHistory: OpenAIInputMessage[] = botChatMessages.map(message => {
      return message.isBot ? { role: 'assistant', content: message.message } : { role: 'user', content: message.message };
    });
    return chatHistory;
  }

  isSorryPhrases(contentBuffer: string) {
    const sorryPhrases = [
      `Sorry, I can't`,
      'I’m sorry',
      "I'm sorry",
      "*I'm sorry",
      'I am sorry',
      '*I am sorry',
      'Sorry, I canno',
      '*Sorry, I cann',
      'Sorry, but I',
      '*Sorry, but I',
      'I cannot fullf',
      'I apologize, b',
      '*I apologize, b',
      'Apologies, but',
      '*Apologies, but',
      'I apologize',
      '*I apologize',
      "I'm afraid",
      "*I'm afraid",
      'I do not want ',
      '*I do not want',
      'I do not feel ',
      '*I do not feel',
      '*I will no ',
      'I will not ',
      'Je ne peux ',
      '*Je ne peux ',
      'Lo siento ',
      '*Lo siento ',
      'I cannot conti',
      '*I cannot cont',
      'I cannot enga',
      '*I cannot eng',
      'I cannot crea',
      '*I cannot cre',
      'I cannot role',
      '*I cannot rol',
      `I can't creat`,
      `*I can't crea`,
      'I absolutely c',
      '*I absolutely ',
      `I can't conti`,
      `*I can't cont`,
      `I cannot writ`,
      `*I cannot wri`,
      `I cannot fulf`,
      `*I cannot ful`,
      `I cannot ask `,
      `*I cannot ask`,
      `I cannot acti`,
      `*I cannot act`,
      `I cannot gene`,
      `*I cannot gen`,
      `I can't gener`,
      `*I can't gene`,
    ];
    return sorryPhrases.some(phrase => contentBuffer.startsWith(phrase)) || contentBuffer.includes('AI language');
  }
}
