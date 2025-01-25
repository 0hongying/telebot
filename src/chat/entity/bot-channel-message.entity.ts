import { BaseEntity } from 'src/entity/base';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class BotChannelMessgae extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  isBot: boolean;

  @Column()
  botId: number;

  @Column({ type: 'text' })
  message: string;
}
