import { BaseEntity } from 'src/entity/base';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class BotChatMessage extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  messageId: number;

  @Column()
  order: number;

  @Column()
  chatId: number;

  @Column()
  model?: string;

  @Column()
  isBot: boolean;

  @Column({ type: 'text' })
  message: string;
}
