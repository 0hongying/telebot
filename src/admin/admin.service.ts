import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Characters } from 'src/character/entity/characters.entity';
import { OpenAIInputMessage } from 'src/chat/types/openai';
import { BotUser } from 'src/entity/bot-user.entity';
import { CacheManagerService } from 'src/shared/cache-manager.service';
import { CHARACTER_INTRODUCTION_USER_PROMPT, getSubscriptionPageUrl } from 'src/shared/const';
import { onInstance0 } from 'src/shared/task.service';
import { TelegramClient } from 'src/shared/telegram-bot';
import { In, IsNull, Repository } from 'typeorm';
import { CreateIntroductionDto } from './admin.dto';
import { intersection, sample } from 'lodash';
import { OpenrouterAPIService } from 'src/chat/service/openrouter-api.service';

@Injectable()
export class AdminService {
  public readonly domain = this.configService.get('FRONTEND_DOMAIN');
  constructor(
      @InjectRepository(BotUser)
      private readonly botUserRepository: Repository<BotUser>,
      @InjectRepository(Characters)
      private readonly charactersRepository: Repository<Characters>,
      private readonly telegramClient: TelegramClient, 
      private readonly configService: ConfigService,
      private readonly cacheManagerService: CacheManagerService,
      private readonly openrouterAPIService: OpenrouterAPIService
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

  @Cron(CronExpression.EVERY_DAY_AT_10AM, { disabled: !onInstance0() })
  async updateCharatersIntroduction() {
    let characters = await this.charactersRepository.findBy({ introduction: IsNull(), isPublic: true });
    if (!characters.length) return;
    const chunkSize = 20;
    for (let i = 0; i < characters.length; i += chunkSize) {
      const currentChunk = characters.slice(i, i + chunkSize);
      const promises = currentChunk.map(item => this.updateCharaterIntroductionById(item.id).catch(error => console.error(error)));
      await Promise.all(promises);
    }
  }

  async updateCharaterIntroductionById(characterId: string) {
    const character = await this.charactersRepository.findOneBy({ id: characterId, isPublic: true });
    if (!character) return;
    const introduction = await this.generateCharacterIntroduction({
      name: character.name,
      personality: character.personality,
      description: character.description,
      scenario: character.scenario,
      firstMessage: character.firstMessage,
    });
    if (!introduction) {
      throw new Error('update character introduction error');
    }
    await this.charactersRepository.update(
      {
        id: characterId,
      },
      {
        introduction,
      },
    );
    await this.cacheManagerService.clearCharacterCache(characterId);
  }


  async generateCharacterIntroduction(createIntroductionDto: CreateIntroductionDto) {
    const messages = this.generateCharacterIntroductionPrompt(createIntroductionDto);
    try {
      const response = await this.openrouterAPIService.callOpenrouterReturnJson(messages, 'meta-llama/llama-3-70b-instruct');
      const content = response.data.choices[0].message.content;
      return this.matchIntroductionInfo(content);
    } catch (error) {
      console.error('call openrouter error', error);
    }
  }

  generateCharacterIntroductionPrompt(createIntroductionDto: CreateIntroductionDto) {
    const characterIntroductionSystemPrompt = `以下为角色和故事设定：在这个设定中角色扮演的是{{char}}，用户扮演{{user}}
      {{char}}'s name:${createIntroductionDto.name}
      ${createIntroductionDto.description}
      {{char}}'s Personality & Settings:
      ${createIntroductionDto.personality}
      first message will be sent to {{user}}:
      ${createIntroductionDto.firstMessage}
      Scenario:
      ${createIntroductionDto.scenario}
      `;
    const messages: OpenAIInputMessage[] = [];
    messages.push({
      role: 'system',
      content: characterIntroductionSystemPrompt,
    });
    messages.push({
      role: 'user',
      content: CHARACTER_INTRODUCTION_USER_PROMPT,
    });
    return messages;
  }

  matchIntroductionInfo(content: string) {
    const regexVersions = /{\s+"versions"\s*:\s*\[\s+{[\s\S]*?}\s+]\s+}/i;
    const versions = content.match(regexVersions);
    if (!versions) return;
    try {
      const versionJson = JSON.parse(versions[0]);
      const version = sample(versionJson.versions);
      if (!version || !version.character_introduction || !version.keywords) return;
      return { keywords: version.keywords, characterIntroduction: version.character_introduction };
    } catch (error) {
      console.log(`message: ${versions[0]}`, error);
    }
  }

  async addGenderTag(characterIds: string[]) {
    const tagsIds = [1, 2, 3];
    const characters = await this.charactersRepository.find({
      where: {
        id: In(characterIds),
      },
      relations: ['tags'],
    });
    for (const character of characters) {
      const characerTagIds = character.tags.map(item => Number(item.tagId));
      const genderIds = intersection(characerTagIds, tagsIds);
      if (genderIds.length > 0) {
        console.log(`save tagId to genderId: ${character.id}`);
        character.genderId = genderIds[0];
        this.charactersRepository.save(character);
        continue;
      }
      console.log(`start genderId: ${character.id}`);
      const characerTagId = await this.generateGenderTag({
        name: character.name,
        personality: character.personality,
        description: character.description,
        scenario: character.scenario,
        firstMessage: character.firstMessage,
      });
      if (characerTagId) {
        character.genderId = characerTagId;
        this.charactersRepository.save(character);
      }
    }
  }

  async generateGenderTag(createIntroductionDto: CreateIntroductionDto) {
    const messages = this.generateGenderTagPrompt(createIntroductionDto);
    try {
      const response = await this.openrouterAPIService.callOpenrouterReturnJson(messages, 'meta-llama/llama-3-70b-instruct');
      const content = response.data.choices[0].message.content;
      const match = content.match(/\d+/g);
      return [1, 2, 3].includes(Number(match[0])) ? Number(match[0]) : undefined;
    } catch (error) {
      console.error('call openrouter error', error);
    }
  }

  generateGenderTagPrompt(createIntroductionDto: CreateIntroductionDto) {
    const characterIntroductionSystemPrompt = `The following is the character and story settings: In this setting role, the input is {{char}}, and the user enters {{user}}
      {{char}}'s name:${createIntroductionDto.name}
      ${createIntroductionDto.description}
      {{char}}'s Personality & Settings:
      ${createIntroductionDto.personality}
      first message will be sent to {{user}}:
      ${createIntroductionDto.firstMessage}
      Scenario:
      ${createIntroductionDto.scenario}
      `;
    const messages: OpenAIInputMessage[] = [];
    messages.push({
      role: 'system',
      content: characterIntroductionSystemPrompt,
    });
    messages.push({
      role: 'user',
      content: `Suppose you are a character reviewer on an AI role-playing platform. You need to choose a label for the character from the perspective of the target user based on the character's story settings and other information. There are three types of role tags with the following requirements:
        Male is 1, female is 2, non-binary is 3
        Just return the result directly as a number`,
    });
    return messages;
  }

}
