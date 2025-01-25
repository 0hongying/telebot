import { Column, CreateDateColumn, Entity, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { Characters } from './characters.entity';
import { BaseEntity } from 'src/entity/base';

@Entity({ name: 'character_tags' })
export class CharacterTag extends BaseEntity {
  @PrimaryColumn({ type: 'bigint' })
  tagId: number;

  @PrimaryColumn({ type: 'uuid' })
  characterId: string;

  @Column({ type: 'bool', default: false })
  obsolete: boolean;

  @ManyToOne(() => Characters, characters => characters.tags, {
    createForeignKeyConstraints: false,
  })
  character: Characters;
}
