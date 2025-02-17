import { CacheKey, CacheTTL, Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CharacterService } from 'src/character/character.service';
import { SearchCharactersParams } from 'src/character/character.dto';
import { HttpCacheInterceptor } from 'src/shared/httpCache.interceptor';
import { SEARCH_CACHE_KEY_NEW } from 'src/shared/const';

@Controller('characters')
@ApiTags('characters')
export class CharacterController {
  constructor(private characterService: CharacterService) {}

  @Get('/new')
  @UseInterceptors(HttpCacheInterceptor)
  @CacheKey(SEARCH_CACHE_KEY_NEW)
  @CacheTTL(60 * 60 * 1000) // 1 hours
  async searchCharactersNew(@Query() params: SearchCharactersParams) {
    console.log('Params:', params);
    return this.characterService.searchPublicCharactersNew(params);
  }

  @Get('/:id')
  async getCharacter(@Param('id') characterId: string) {
    return this.characterService.getCharacterCached(characterId);
  }
}
