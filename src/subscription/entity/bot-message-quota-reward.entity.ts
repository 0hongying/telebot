import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../entity/base';

@Entity()
export class BotMessageQuotaReward extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  quotaCount: number;

  @Column()
  rewardMessageQuotaId: number;

  @Column()
  type: string;

  @Column()
  description?: string;
}
