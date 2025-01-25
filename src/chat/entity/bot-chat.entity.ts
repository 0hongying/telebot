import { BaseEntity } from 'src/entity/base';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class BotChat extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  characterId: string;

  @Column()
  messageCount?: number;

  @Column()
  botId: number;
}
