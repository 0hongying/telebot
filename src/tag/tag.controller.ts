import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { TagService } from './tag.service';

@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey('tags')
  @CacheTTL(3600 * 1000)
  findAll() {
    return this.tagService.findAll();
  }
}
