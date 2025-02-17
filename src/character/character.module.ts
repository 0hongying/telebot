import { Module } from '@nestjs/common';
import { CharacterController } from './character.controller';
import { CharacterService } from './character.service';
import { CharacterListCacheService } from 'src/character/character-list-cache.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Characters } from './entity/characters.entity';
import { CharacterTag } from './entity/character.tag.entity';
import { CharacterSearch } from './entity/characterSearch.entity';
import { CharacterStats } from './character.dto';
import { TagModule } from 'src/tag/tag.module';

@Module({
  imports: [TypeOrmModule.forFeature([Characters, CharacterTag, CharacterSearch, CharacterStats]), TagModule],
  controllers: [CharacterController],
  providers: [CharacterService, CharacterListCacheService],
  exports: [CharacterService, CharacterListCacheService],
})
export class CharacterModule {}
