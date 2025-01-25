import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache, Milliseconds } from 'cache-manager';
import { DEFAULT_CACHE_TTL } from 'src/shared/const';

@Injectable()
export class CacheManagerService {
  private readonly logger = new Logger(CacheManagerService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async clearCachePrefix(prefix: string) {
    const keys = await this.cacheManager.store.keys();

    // This is O(n), quite inefficent, but we don't have too many keys, so should be fine now
    // We might have more keys, but should still be fine lol...
    const keysWithPrefix = keys.filter(key => key.startsWith(prefix));

    await Promise.all(
      keysWithPrefix.map(key => {
        this.logger.debug('clear cache key', key);
        this.cacheManager.del(key);
      }),
    );

    return true;
  }

  async getFromCache<T>(cacheKey: string, getFunction: () => Promise<T>, ttl = DEFAULT_CACHE_TTL): Promise<T> {
    let item = await this.cacheManager.get<T>(cacheKey);
    if (!item) {
      // this.logger.debug('cache MISS ' + cacheKey);
      item = await getFunction();
      this.cacheManager.set(cacheKey, item, ttl);
    } else {
      // this.logger.debug('cache HIT ' + cacheKey);
    }

    return item;
  }

  async getCache<T>(cacheKey: string): Promise<T | null> {
    const item = await this.cacheManager.get<T>(cacheKey);
    if (!item) {
      return null;
    }
    return item;
  }

  async setCache(key: string, value: unknown, ttl?: Milliseconds) {
    await this.cacheManager.set(key, value, ttl);
  }

  async clearCharacterCache(characterId: string) {
    // this.logger.debug('clear character cache ' + characterId);
    await this.cacheManager.del(`/characters/${characterId}`);
  }

  async clearProfileCache(profileId: string) {
    // this.logger.debug('clear profile cache ' + profileId);
    await this.cacheManager.del(`/profiles/${profileId}`); // public profile
    await this.cacheManager.del(`full_profile_${profileId}`); // private profile
  }

  async clearTagsCache() {
    await this.cacheManager.del('tags');
  }

  async printKeys() {
    const keys: string[] = await this.cacheManager.store.keys();
    keys.forEach(key => this.logger.debug(key));
  }
}
