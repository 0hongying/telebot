import { Module } from '@nestjs/common';
import { CharacterController } from './character.controller';
import { CharacterService } from './character.service';
import { CharacterListCacheService } from 'src/character/character-list-cache.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Characters } from './entity/characters.entity';
import { CharacterTag } from './entity/character.tag.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Characters, CharacterTag])],
  controllers: [CharacterController],
  providers: [CharacterService, CharacterListCacheService],
  exports: [CharacterService, CharacterListCacheService],
})
export class CharacterModule {}
