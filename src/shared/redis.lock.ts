import { Redis } from 'ioredis';
import { Injectable } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';

@Injectable()
export class RedisLock {
  private redis: Redis;

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getClient();
  }

  async acquireLock(lockKey: string, requestId: string, lockTimeout: number) {
    try {
      const result = await this.redis.set(lockKey, requestId, 'EX', lockTimeout, 'NX');
      return result === 'OK';
    } catch (error) {
      console.error('get lock fail:', error);
      return false;
    }
  }

  async releaseLock(lockKey: string, requestId: string) {
    const luaScript = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
    `;
    try {
      const result = await this.redis.eval(luaScript, 1, lockKey, requestId);
      return result === 1;
    } catch (error) {
      console.error(`release ${lockKey} fail`, error);
      return false;
    }
  }
}
