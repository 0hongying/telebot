import {
  CACHE_KEY_METADATA,
  CacheInterceptor,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const cacheKey = this.reflector.get(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );

    if (cacheKey) {
      const request = context.switchToHttp().getRequest();
      const generatedCacheKey = `${cacheKey}-${request._parsedUrl.query}`;
      console.log('Generated cache key:', generatedCacheKey);
      return `${cacheKey}-${request._parsedUrl.query}`;
    }

    return super.trackBy(context);
  }
}
