import { BaseEntity } from 'src/entity/base';
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class BotInvitation extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  invitedUserId: number;

  @Column()
  isNewUser: boolean;

  @Column()
  isNewUserRewarded: boolean;
}
