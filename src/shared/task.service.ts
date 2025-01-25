import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Redis } from 'ioredis';
import { SupaClient } from './supabaseClient';

export function onInstance0() {
  const instance = process.env.NODE_APP_INSTANCE;
  return !instance || instance === '1';
}

@Injectable()
export class TasksService {
  private readonly redis: Redis;

  constructor(private readonly redisService: RedisService, private spClient: SupaClient) {
    this.redis = this.redisService.getClient();
  }

  @Cron(CronExpression.EVERY_30_MINUTES, { disabled: !onInstance0() })
  async refreshViewCron() {
    let retryCount = 0;
    while (retryCount <= 3) {
      try {
        const result = await this.spClient.getClient().rpc('refresh_materialized_view', { view_name: 'new_character_stats' });
        if (!result.error) {
          console.log(`Refresh materialized view success after ${retryCount + 1} attempt(s).`);
          return;
        }
        console.log(`Refresh attempt ${retryCount + 1} failed with error: ${result.error}`);
      } catch (err) {
        console.error(`Refresh attempt ${retryCount + 1} caught an error:`, err);
      }
      retryCount++;
    }
  }
}
