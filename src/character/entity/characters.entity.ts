import { BaseEntity } from 'src/entity/base';
import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { CharacterTag } from './character.tag.entity';

@Entity()
export class Characters extends BaseEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  avatar: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  firstMessage: string;

  @Column()
  personality: string;

  @Column()
  scenario: string;

  @Column()
  exampleDialogs: string;

  @Column({ type: 'bool' })
  isPublic: boolean;

  @Column()
  creatorId: string;

  @OneToMany(() => CharacterTag, tag => tag.character, {
    createForeignKeyConstraints: false,
  })
  tags: CharacterTag[];

  @Column({ type: 'bool' })
  isNsfw: boolean;
}
