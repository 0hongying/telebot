import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { keyBy } from 'lodash';
import moment from 'moment';
import { CharacterView, SearchCharactersParams } from 'src/character/character.dto';
import { CacheManagerService } from 'src/shared/cache-manager.service';
import { DEFAULT_PAGE_SIZE, Paginated, getPagination } from 'src/shared/paginated.dto';
import { onInstance0 } from 'src/shared/task.service';
import { TagService } from 'src/tag/tag.service';
import { In, Repository } from 'typeorm';
import { CharacterTag } from './entity/character.tag.entity';
import { Characters } from './entity/characters.entity';
import { CharacterStats } from './entity/characterStats.entity';

@Injectable()
export class CharacterListCacheService {
  private readonly redis: Redis;
  constructor(
    @InjectRepository(Characters)
    private readonly charactersRepository: Repository<Characters>,
    @InjectRepository(CharacterStats)
    private readonly characterStatsRepository: Repository<CharacterStats>,
    @InjectRepository(CharacterTag)
    private readonly characterTagRepository: Repository<CharacterTag>,
    private readonly redisService: RedisService,
    private readonly cacheManagerService: CacheManagerService,
    private readonly tagService: TagService
  ) {
    this.redis = this.redisService.getClient();
  }

  async addToSortedSet(key: string, member: string, score: number): Promise<number> {
    return this.redis.zadd(key, score, member);
  }

  async getSortedSetRange(key: string, start: number, end: number): Promise<string[]> {
    return this.redis.zrevrange(key, start, end);
  }

  async getSortedSetRangeWithScores(key: string, start: number, end: number): Promise<any[]> {
    return this.redis.zrevrange(key, start, end, 'WITHSCORES');
  }

  async getZSetLength(zsetName: string): Promise<number> {
    return this.redis.zcard(zsetName);
  }

  async removeMemberFromZSet(zsetName: string, member: string): Promise<number> {
    return this.redis.zrem(zsetName, member);
  }

  async getCharacters(characterIds: string[]) {
    return this.charactersRepository.find({
      where: { id: In(characterIds) },
    });
  }

  checkCharacter(list: Partial<Characters>[], cid: string): boolean {
    const entity = list.find(n => n.id === cid);
    if (!entity || entity.isPublic === false) {
      return false;
    }
    return true;
  }

  async searchCharacters(searchParams: SearchCharactersParams): Promise<Paginated<CharacterView>> {
    const cacheKey = this.getCacheKeyBySearchParams(searchParams);

    const { from, to } = getPagination(searchParams.page || 1);
    let characterIds = await this.getSortedSetRange(cacheKey, from, to - 1);
    const characters: CharacterView[] = [];
    let needRefresh = false;
    const list = await this.getCharacters(characterIds);
    // check if show
    for (const cid of characterIds) {
      const r = this.checkCharacter(list, cid);
      if (!r) {
        await this.deleteCharacterFromCache(cid, [searchParams]);
        needRefresh = true;
      }
    }
    if (needRefresh) {
      characterIds = await this.getSortedSetRange(cacheKey, from, to - 1);
    }
    // this.logger.debug(`|||  characterIds ${characterIds} |||`);

    for (const charId of characterIds) {
      const characterView = await this.cacheManagerService.getFromCache(
        `CharacterView_${charId}`,
        () => this.getCharacterViewById(charId),
        3600 * 1000,
      );

      if (characterView && this.characterViewMatchSearchParams(characterView, searchParams)) {
        characters.push(characterView);
      } else {
        await this.deleteCharacterFromCache(charId, [searchParams]);
      }
    }
    const totalCount = await this.getZSetLength(cacheKey);
    return {
      data: characters,
      total: totalCount ?? 0,
      size: DEFAULT_PAGE_SIZE,
      page: searchParams.page || 1,
    };
  }

  async getCharacterViewById(characterId: string) {
    const characterEntity = await this.getCharacterEntityById(characterId);
    //character可能会被删除
    if (!characterEntity || characterEntity.isPublic === false) {
      return null;
    }
    const characterTagIds = await this.getCharacterTagIds(characterEntity.id);
    const characterStats = await this.getCharacterStatsById(characterEntity.id);
    const tags = await this.tagService.findAll();
    const tagsMap = keyBy(tags, 'id');
    return {
      ...characterEntity,
      tags: characterTagIds.map(tagId => tagsMap[tagId]).filter(tag => !!tag),
      stats: {
        chat: characterStats?.totalChat ?? 0,
        message: characterStats?.totalMessage ?? 0,
      } 
    } as CharacterView;
  }

  characterViewMatchSearchParams(characterView: CharacterView, searchParams: SearchCharactersParams): boolean {
    const { user_id, mode, tag_id, special_mode } = searchParams;
    if (user_id && characterView.creatorId !== user_id) {
      return false;
    }
    if (tag_id && !characterView.tags?.map(tag => tag.id).includes(tag_id)) {
      return false;
    }
    const fourteenDayAgo = moment().add(-14, 'day').toDate();
    if (special_mode && special_mode === 'trending' && new Date(characterView.createdAt) < fourteenDayAgo) {
      return false;
    }
    return true;
  }

  async deleteCharacterFromCache(characterId: string, allSearchParams: SearchCharactersParams[]) {
    for (const searchParams of allSearchParams) {
      const cacheKey = this.getCacheKeyBySearchParams(searchParams);
      await this.removeMemberFromZSet(cacheKey, characterId);
    }
  }

  async addCharacterToCache(character: Characters, allSearchParams: SearchCharactersParams[], characterStats: any) {
    for (const searchParams of allSearchParams) {
      const cacheKey = this.getCacheKeyBySearchParams(searchParams);
      if (searchParams.sort === 'popular' || searchParams.special_mode === 'trending') {
        await this.addToSortedSet(cacheKey, character.id, characterStats.total_message);
      } else if (searchParams.sort === 'latest') {
        await this.addToSortedSet(cacheKey, character.id, new Date(character.createdAt).getTime());
      }
    }
  }

  getCacheKeyBySearchParams(searchParams: SearchCharactersParams) {
    // eslint-disable-next-line prefer-const
    let { user_id, mode, tag_id, sort, special_mode } = searchParams;
    if (!sort && !special_mode) {
      sort = 'popular';
    }
    return `${user_id}-${mode}-${tag_id}-${sort}-${special_mode}`;
  }

  async getCharacterStatsById(characterId: string) {
    return this.characterStatsRepository.findOne({
      where: { characterId },
      select: ['totalChat', 'totalMessage'], // 选择字段
    });
  }

  async getCharacterEntityById(characterId: string) {
    return this.charactersRepository.findOne({
      where: { id: characterId },
      select: [
        'id',
        'name',
        'avatar',
        'createdAt',
        'creatorId',
        'description',
        'personality',
        'scenario',
        'exampleDialogs',
        'firstMessage',
        'isNsfw',
        'isPublic',
        'updatedAt',
      ],
    });
  }

  async getAllPublicCharacterIds() {
    const pageSize = 1000;
    let page = 0;
    const allCharacterIds: string[] = [];

    while (true) {
      const characterIds = await this.charactersRepository.find({
        where: { isPublic: true },
        select: ['id'],
        order: { createdAt: 'ASC' }, // 按创建时间升序排序
        skip: page * pageSize, // 跳过前面的数据
        take: pageSize, // 每页数据量
      });

      if (characterIds.length === 0) {
        break;
      }
      characterIds.forEach(character => allCharacterIds.push(character.id));
      page++; // 增加页数
    }
    console.log('All public character count: ', allCharacterIds.length);
    return allCharacterIds;
  }

  async getCharacterTagIds(characterId: string) {
    const characterTags = await this.characterTagRepository.find({
      where: {
        characterId,
        obsolete: false
      },
      select: ['tagId']
    });
    return characterTags.map(tag => Number(tag.tagId));
  }

  getAllPossibleSearchParams(character: Characters, characterTagIds: number[]) {
    const allSearchParams = [];
    //user_id
    allSearchParams.push({ user_id: character.creatorId, sort: 'latest' });
    allSearchParams.push({ user_id: character.creatorId, sort: 'popular' });
    //tag_id
    for (const tagId of characterTagIds) {
      allSearchParams.push({ tag_id: tagId, sort: 'latest', mode: 'all' });
      allSearchParams.push({ tag_id: tagId, sort: 'popular', mode: 'all' });
      if (character.isNsfw) {
        allSearchParams.push({ tag_id: tagId, sort: 'latest', mode: 'nsfw' });
        allSearchParams.push({ tag_id: tagId, sort: 'popular', mode: 'nsfw' });
      } else {
        allSearchParams.push({ tag_id: tagId, sort: 'latest', mode: 'sfw' });
        allSearchParams.push({ tag_id: tagId, sort: 'popular', mode: 'sfw' });
      }
    }
    //mode
    allSearchParams.push({ sort: 'latest', mode: 'all' });
    allSearchParams.push({ sort: 'popular', mode: 'all' });
    if (character.isNsfw) {
      allSearchParams.push({ sort: 'latest', mode: 'nsfw' });
      allSearchParams.push({ sort: 'popular', mode: 'nsfw' });
    } else {
      allSearchParams.push({ sort: 'latest', mode: 'sfw' });
      allSearchParams.push({ sort: 'popular', mode: 'sfw' });
    }
    //special_mode
    const fourteenDayAgo = moment().add(-14, 'day').toDate();
    if (new Date(character.createdAt) > fourteenDayAgo) {
      allSearchParams.push({ special_mode: 'trending', mode: 'all' });
      if (character.isNsfw) {
        allSearchParams.push({ special_mode: 'trending', mode: 'nsfw' });
      } else {
        allSearchParams.push({ special_mode: 'trending', mode: 'sfw' });
      }
    }
    return allSearchParams as SearchCharactersParams[];
  }

  @Cron(CronExpression.EVERY_4_HOURS, { disabled: !onInstance0() })
  async initAllCache() {
    try {
      console.log('begin initAllCache');
      const allCharacterIds = await this.getAllPublicCharacterIds();
      for (const characterId of allCharacterIds) {
        const character = await this.charactersRepository.findOneBy({ id: characterId });
        if (!character) continue;
        const characterTagIds = await this.getCharacterTagIds(character.id);
        const characterStats = await this.getCharacterStatsById(character.id);
        const allSearchParams = this.getAllPossibleSearchParams(character, characterTagIds);
        await this.addCharacterToCache(character, allSearchParams, characterStats);
      }
      console.log('finish initAllCache');
    } catch (error) {
      console.log(error);
    }
  }
}
