import { HttpException, HttpStatus, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { CharacterView, SearchCharactersParams } from 'src/character/character.dto';
import { Paginated } from 'src/shared/paginated.dto';
import { CharacterListCacheService } from 'src/character/character-list-cache.service';
import { TEN_MINUTE_TTL } from 'src/shared/const';
import { CacheManagerService } from 'src/shared/cache-manager.service';
import { CharacterSearch } from './entity/characterSearch.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TagService } from 'src/tag/tag.service';
import { keyBy } from 'lodash';

@Injectable()
export class CharacterService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CharacterService.name);

  constructor(
    @InjectRepository(CharacterSearch)
    private readonly characterSearchRepository: Repository<CharacterSearch>,
    private readonly characterListCacheService: CharacterListCacheService,
    private readonly cacheManagerService: CacheManagerService,
    private readonly tagService: TagService,
  ) {}

  async searchPublicCharactersNew(searchParams: SearchCharactersParams): Promise<Paginated<CharacterView>> {
    return await this.characterListCacheService.searchCharacters(searchParams);
  }

  async getCharacterCached(characterId: string, userId?: string) {
    const characterView = await this.cacheManagerService.getFromCache(
      `/characters/${characterId}`,
      () => this.getCharacter(characterId),
      TEN_MINUTE_TTL,
    );
    if (characterView.creatorId === userId) {
      return characterView;
    } else if (characterView.isPublic) {
      return characterView;
    }
    throw new HttpException('Can not find character', HttpStatus.NOT_FOUND);
  }

  async getCharacter(characterId: string) {
    const characterSearch = await this.characterSearchRepository.findOne({
      where: { id: characterId },
      select: [
        'id', 'name', 'avatar', 'createdAt', 'creatorId', 'genderId',
        'description', 'personality', 'scenario', 'exampleDialogs', 'firstMessage',
        'isPublic', 'tagIds', 'totalChat', 'totalMessage'
      ]
    });
    if (!characterSearch) {
      throw new HttpException('Can not find character', HttpStatus.NOT_FOUND);
    }
    const tags = await this.tagService.findAll();
    const tagsMap = keyBy(tags, 'id');
    // Refactor this later
    const characterWithTagAndStats = {
      ...characterSearch,
      tags: (characterSearch.tagIds || []).map((tagId: number) => tagsMap[tagId]).filter((tag: any) => !!tag),
      stats: {
        chat: characterSearch.totalChat ?? 0,
        message: characterSearch.totalMessage ?? 0,
      },
    };

    return characterWithTagAndStats;
  }

  async onApplicationBootstrap() {
    return;
  }
}
