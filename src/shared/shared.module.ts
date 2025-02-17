import { Global, Module } from '@nestjs/common';
import { CacheManagerService } from 'src/shared/cache-manager.service';
import { HttpCacheInterceptor } from 'src/shared/httpCache.interceptor';
import { TasksService } from 'src/shared/task.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramClient } from './telegram-bot';
import { TelegramCommonService } from './telegram-common-service';
import { BotMessageQuota } from 'src/subscription/entity/bot-message-quota.entity';
import { BotSubscription } from 'src/subscription/entity/bot-subscription.entity';
import { BotPlan } from 'src/subscription/entity/bot-plan.entity';
import { BotUser } from 'src/entity/bot-user.entity';
import { Bots } from 'src/bot/entity/bots.entity';
import { RedisLock } from './redis.lock';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      delimiter: '.',
      maxListeners: 10,
      ignoreErrors: true,
      wildcard: true,
    }),
    TypeOrmModule.forFeature([Bots, BotMessageQuota, BotSubscription, BotPlan, BotUser]),
  ],
  providers: [TasksService, HttpCacheInterceptor, CacheManagerService, TelegramClient, TelegramCommonService, RedisLock],
  exports: [TasksService, HttpCacheInterceptor, CacheManagerService, TelegramClient, TelegramCommonService, RedisLock],
})
export class SharedModule {}
