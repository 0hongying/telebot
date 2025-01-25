import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotController } from './bot.controller';
import { TelegramBotService } from './service/telegram-bot.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramChannelService } from './service/telegram-channel.service';
import { TelegramChatService } from './service/telegram-chat.service';
import { BotChatMessage } from '../chat/entity/bot-chat-message.entity';
import { BotEvent } from '../track/entity/bot-event.entity';
import { BotChat } from '../chat/entity/bot-chat.entity';
import { BotMessageQuota } from '../subscription/entity/bot-message-quota.entity';
import { BotUser } from '../entity/bot-user.entity';
import { ChatModule } from 'src/chat/chat.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { TelegramAiService } from './service/telegram-ai-service';
import { TrackModule } from 'src/track/track.module';
import { BotChannelMessgae } from 'src/chat/entity/bot-channel-message.entity';
import { InvitationModule } from 'src/invitation/invitation.module';
import { Characters } from 'src/character/entity/characters.entity';
import { CharacterTag } from 'src/character/entity/character.tag.entity';
import { Tags } from 'src/tag/entity/tag.entity';
import { Bots } from './entity/bots.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bots, Characters, CharacterTag, Tags, BotEvent, BotChatMessage, BotChat, BotMessageQuota, BotUser, BotChannelMessgae]),
    ChatModule,
    SubscriptionModule,
    TrackModule,
    InvitationModule,
  ],
  controllers: [BotController],
  providers: [BotService, TelegramBotService, TelegramChannelService, TelegramChatService, TelegramAiService],
  exports: [BotService, TelegramBotService, TelegramChannelService, TelegramChatService, TelegramAiService],
})
export class BotModule {}
