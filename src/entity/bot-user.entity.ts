import { BaseEntity } from 'src/entity/base';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class BotUser extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  botId: number;

  @Column()
  source?: string;

  @Column()
  ip?: string;

  @Column()
  name?: string;

  @Column()
  inviteCode?: string;
}
